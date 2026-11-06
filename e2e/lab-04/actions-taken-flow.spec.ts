import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login, createTicketAsRequester, REQUESTER, STAFF } from './helpers';

// Lab 4 Part 6: IT Staff record, edit and review Actions Taken (with append-only revision history); the Requester
// only gets a read-only "Service Actions" tab.
test.describe('Actions Taken flow (Lab 4)', () => {
  test('staff records and edits an Action Taken; revision history is kept; requester sees it read-only', async ({ page }) => {
    test.slow();
    const ticket = await createTicketAsRequester('E2E Actions Taken');

    // --- Staff opens the ticket: empty state ---
    await login(page, STAFF.email, /\/staff-queue/);
    await page.goto(`/staff/tickets/${ticket.id}`);
    const section = page.getByRole('region', { name: 'Service Actions' });
    await expect(section.getByText('No service actions recorded for this ticket.')).toBeVisible();

    // --- Record: validation first ---
    await page.getByRole('button', { name: '+ Add Action Taken' }).click();
    const dialog = page.getByRole('dialog', { name: 'Record Action Taken' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('performed-by')).toContainText(STAFF.name); // server-attributed, not editable

    await dialog.getByRole('button', { name: 'Record Action' }).click();
    await expect(dialog.getByText('Description is required.')).toBeVisible();
    await expect(dialog.getByText('Result is required.')).toBeVisible();

    // The open dialog has no WCAG A/AA violations
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);

    await dialog.getByLabel(/^Description/).fill('Replaced malfunctioning RAM module in slot 2');
    await dialog.getByLabel(/^Result/).fill('Memory diagnostics passed without error');
    await dialog.getByLabel('Follow-Up Required').check();
    await dialog.getByRole('button', { name: 'Record Action' }).click();
    await expect(dialog.getByText('Follow-Up Note is required when follow-up is required.')).toBeVisible();

    await dialog.getByLabel(/^Follow-Up Note/).fill('Monitor system memory during peak hours');
    await dialog.getByLabel('Attachment Notes').fill('Referenced MemTest86 diagnostic log');
    await dialog.getByRole('button', { name: 'Record Action' }).click();
    await expect(dialog).toBeHidden();

    // --- The card shows what was recorded; no way to delete ---
    await expect(section.getByText('Action Taken recorded successfully.')).toBeVisible();
    await expect(section.getByText('Replaced malfunctioning RAM module in slot 2')).toBeVisible();
    await expect(section.getByText('Memory diagnostics passed without error')).toBeVisible();
    await expect(section.getByText('Performed by:')).toContainText(STAFF.name);
    await expect(section.getByText('Follow-up required')).toBeVisible();
    await expect(section.getByText('Monitor system memory during peak hours')).toBeVisible();
    await expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0);

    // --- Edit: the change is kept as a revision ---
    await page.getByRole('button', { name: 'Edit Action Taken #1' }).click();
    const editDialog = page.getByRole('dialog', { name: 'Edit Action Taken' });
    await expect(editDialog).toBeVisible();
    await editDialog.getByLabel(/^Description/).fill('Replaced malfunctioning RAM module in slot 2 with 32GB DDR4');
    await editDialog.getByRole('button', { name: 'Save Changes' }).click();
    await expect(editDialog).toBeHidden();
    await expect(section.getByText('Action Taken updated successfully.')).toBeVisible();
    await expect(section.getByText('Replaced malfunctioning RAM module in slot 2 with 32GB DDR4')).toBeVisible();

    await section.getByRole('button', { name: /View Revision History \(1\)/ }).click();
    await expect(section.getByText('Revision 1')).toBeVisible();
    await expect(section.getByText(/by IT Staff Two/)).toBeVisible();
    await expect(section.getByText(/Replaced malfunctioning RAM module in slot 2”/)).toBeVisible(); // the original text is preserved

    // --- Requester: read-only Service Actions tab ---
    await page.context().clearCookies();
    await login(page, REQUESTER.email, /\/my-tickets/);
    await page.goto(`/tickets/${ticket.id}`);
    await page.getByRole('button', { name: /Service Actions \(1\)/ }).click();
    const requesterSection = page.getByRole('region', { name: 'Service Actions' });
    await expect(requesterSection.getByText('Replaced malfunctioning RAM module in slot 2 with 32GB DDR4')).toBeVisible();
    await expect(requesterSection.getByText('Memory diagnostics passed without error')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add Action Taken' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Edit/ })).toHaveCount(0);
    await expect(page.getByText(/Revision History/)).toHaveCount(0);
  });
});
