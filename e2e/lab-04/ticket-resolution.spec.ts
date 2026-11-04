import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login, createTicketAsRequester, STAFF } from './helpers';

// Lab 4 Part 7: the approved status workflow, the Resolution Gate (RESOLVED needs at least one Action Taken),
// terminal states and the append-only audit trail written as Internal Notes.

async function changeStatusTo(page: Page, status: string) {
  await page.locator('#status-select').selectOption(status);
  await page.getByRole('button', { name: 'Change', exact: true }).click();
}

async function openAddActionDialog(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Record Action Taken' });
  // The page above this button is still settling after a status change (banner, audit note), so a click can land on
  // a position that has just moved; click again until the dialog is really open.
  await expect(async () => {
    await page.getByRole('button', { name: '+ Add the first Action Taken' }).click({ timeout: 5000 });
    await expect(dialog).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30000 });
  return dialog;
}

test.describe('Ticket workflow and Resolution Gate (Lab 4)', () => {
  test('resolution is blocked without an Action Taken, allowed with one, then closed (terminal)', async ({ page }) => {
    test.slow();
    const ticket = await createTicketAsRequester('E2E Resolution Gate', 'HIGH');
    await login(page, STAFF.email, /\/staff-queue/);
    await page.goto(`/staff/tickets/${ticket.id}`);
    await expect(page.getByText('Status Transition')).toBeVisible();

    // NEW offers only its permitted destinations (not RESOLVED / CLOSED)
    const fromNew = await page.locator('#status-select option').allInnerTexts();
    expect(fromNew).not.toContain('RESOLVED');
    expect(fromNew).not.toContain('CLOSED');

    await changeStatusTo(page, 'OPEN');
    await expect(page.getByText('Status updated successfully')).toBeVisible();
    await changeStatusTo(page, 'IN_PROGRESS');
    await expect(page.getByText('Status updated successfully')).toBeVisible();

    // Resolution Gate: the warning appears, and the server still refuses the change
    await page.locator('#status-select').selectOption('RESOLVED');
    await expect(page.getByText(/Resolution Gate: record at least one Action Taken/)).toBeVisible();
    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await expect(page.getByText('Record at least one Action Taken before resolving this ticket.', { exact: true })).toBeVisible();
    await expect(page.getByText('Status Transition')).toBeVisible();

    // Record an Action Taken, then the same change succeeds
    const dialog = await openAddActionDialog(page);
    await dialog.getByLabel(/^Description/).fill('Diagnosed core network switch latency');
    await dialog.getByLabel(/^Result/).fill('Port throughput normalized');
    await dialog.getByRole('button', { name: 'Record Action' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Diagnosed core network switch latency')).toBeVisible();

    await changeStatusTo(page, 'RESOLVED');
    await expect(page.getByText('Status updated successfully')).toBeVisible();
    // The audit trail is an Internal Note
    await expect(page.getByText('Status changed from IN_PROGRESS to RESOLVED')).toBeVisible();

    // From RESOLVED the only destinations are CLOSED and REOPENED
    const fromResolved = await page.locator('#status-select option:not([disabled])').allInnerTexts();
    expect(fromResolved.sort()).toEqual(['CLOSED', 'REOPENED']);

    await changeStatusTo(page, 'CLOSED');
    await expect(page.getByText('Status changed from RESOLVED to CLOSED')).toBeVisible();

    // CLOSED is terminal: no transitions, controls locked, Actions Taken cannot be added
    await expect(page.getByText('No further transitions allowed from CLOSED.')).toBeVisible();
    await expect(page.locator('#assignee-select')).toBeDisabled();
    await expect(page.locator('#priority-select')).toBeDisabled();
    await expect(page.getByRole('button', { name: '+ Add Action Taken' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Edit Action Taken #1' })).toBeDisabled();
  });

  test('a resolved ticket can be reopened and worked again', async ({ page }) => {
    test.slow();
    const ticket = await createTicketAsRequester('E2E Reopen');
    await login(page, STAFF.email, /\/staff-queue/);
    await page.goto(`/staff/tickets/${ticket.id}`);
    await expect(page.getByText('Status Transition')).toBeVisible();

    await changeStatusTo(page, 'OPEN');
    await expect(page.getByText('Status updated successfully')).toBeVisible();
    await expect(page.getByText('Status changed from NEW to OPEN')).toBeVisible();
    const dialog = await openAddActionDialog(page);
    await dialog.getByLabel(/^Description/).fill('Restarted the print spooler');
    await dialog.getByLabel(/^Result/).fill('Queue is printing again');
    await dialog.getByRole('button', { name: 'Record Action' }).click();
    await expect(dialog).toBeHidden();

    await changeStatusTo(page, 'RESOLVED');
    await expect(page.getByText('Status changed from OPEN to RESOLVED')).toBeVisible();
    await changeStatusTo(page, 'REOPENED');
    await expect(page.getByText('Status changed from RESOLVED to REOPENED')).toBeVisible();

    // Not terminal: the ticket moves on again
    await expect(page.getByText(/No further transitions allowed/)).toHaveCount(0);
    await changeStatusTo(page, 'IN_PROGRESS');
    await expect(page.getByText('Status changed from REOPENED to IN_PROGRESS')).toBeVisible();
  });

  test('rejecting needs a reason, which is written to the audit trail; REJECTED is terminal', async ({ page }) => {
    test.slow();
    const ticket = await createTicketAsRequester('E2E Rejection', 'LOW');
    await login(page, STAFF.email, /\/staff-queue/);
    await page.goto(`/staff/tickets/${ticket.id}`);
    await expect(page.getByText('Status Transition')).toBeVisible();

    await changeStatusTo(page, 'REJECTED');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Reject Ticket' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Reject Ticket' })).toBeDisabled();

    // The dialog is accessible (labelled controls)
    const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);

    const reason = 'Out of scope request - refer to facility management.';
    await dialog.getByPlaceholder('Enter rejection reason...').fill(reason);
    await expect(dialog.getByRole('button', { name: 'Reject Ticket' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Reject Ticket' }).click();

    await expect(page.getByText(`Status changed from NEW to REJECTED. Reason: ${reason}`)).toBeVisible();
    await expect(page.getByText('No further transitions allowed from REJECTED.')).toBeVisible();
    await expect(page.locator('#assignee-select')).toBeDisabled();
  });
});
