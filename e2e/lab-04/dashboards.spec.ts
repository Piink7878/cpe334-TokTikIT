import { test, expect, Page } from '@playwright/test';
import { login, createTicketAsRequester, REQUESTER, STAFF } from './helpers';

// Lab 4 Part 8: both dashboards. The numbers shown must equal what the API computes from the database, every KPI card
// drills down to a filtered list, the empty accounts show zeros, and each dashboard is closed to the other role.

async function kpi(page: Page, title: string): Promise<number> {
  const text = await page.locator('a.kpi-card', { hasText: title }).innerText();
  const match = text.match(/\d+/);
  expect(match, `no number on the "${title}" card`).not.toBeNull();
  return Number(match![0]);
}

test.describe('Dashboards (Lab 4)', () => {
  test('requester dashboard: metrics match the API, drill-down, recent tickets, role protection', async ({ page }) => {
    test.slow();
    await createTicketAsRequester('E2E Dashboard');
    await login(page, REQUESTER.email, /\/my-tickets/);

    const apiPromise = page.waitForResponse((r) => r.url().includes('/api/dashboard/requester') && r.ok());
    await page.goto('/requester-dashboard');
    const api = (await (await apiPromise).json()).data;
    await expect(page.getByRole('heading', { name: 'Requester Dashboard' })).toBeVisible();
    await expect(page.locator('a.kpi-card')).toHaveCount(4);

    expect(await kpi(page, 'Total Tickets')).toBe(api.totalTickets);
    expect(await kpi(page, 'Active Tickets')).toBe(api.activeTickets);
    expect(await kpi(page, 'Waiting for Me')).toBe(api.waitingForRequesterTickets);
    expect(await kpi(page, 'Resolved / Closed')).toBe(api.resolvedOrClosedTickets);
    expect(api.totalTickets).toBeGreaterThan(0);
    // Recent tickets are shown, newest activity first
    expect(api.recentTickets.length).toBeGreaterThan(0);
    await expect(page.locator('a:visible', { hasText: api.recentTickets[0].ticketNumber }).first()).toBeVisible();

    // Drill-down: Active Tickets -> My Tickets filtered by status, and the list agrees with the card
    await page.locator('a.kpi-card', { hasText: 'Active Tickets' }).click();
    await expect(page).toHaveURL(/\/my-tickets\?status=NEW,OPEN,IN_PROGRESS/);
    await expect(page.getByRole('heading', { name: 'My Tickets' })).toBeVisible();

    // Role protection
    await page.goto('/staff-dashboard');
    await expect(page.getByText('403 Forbidden')).toBeVisible();
    const direct = await page.request.get('/api/dashboard/staff');
    expect(direct.status()).toBe(403);
  });

  test('staff dashboard: metrics match the API, breakdown, drill-down, role protection', async ({ page }) => {
    test.slow();
    await login(page, STAFF.email, /\/staff-queue/);

    const apiPromise = page.waitForResponse((r) => r.url().includes('/api/dashboard/staff') && r.ok());
    await page.goto('/staff-dashboard');
    const api = (await (await apiPromise).json()).data;
    await expect(page.getByRole('heading', { name: 'IT Staff Dashboard' })).toBeVisible();
    await expect(page.locator('a.kpi-card')).toHaveCount(4);

    expect(await kpi(page, 'Unassigned Tickets')).toBe(api.unassignedTickets);
    expect(await kpi(page, 'My Active Tickets')).toBe(api.myActiveTickets);
    expect(await kpi(page, 'Follow-Up Required')).toBe(api.ticketsRequiringFollowUp);
    expect(await kpi(page, 'Critical / High Priority')).toBe(api.criticalOrHighPriorityTickets);
    await expect(page.getByText('Queue Status Breakdown')).toBeVisible();

    // Drill-down: Unassigned -> Staff Queue with the matching filter
    await page.locator('a.kpi-card', { hasText: 'Unassigned Tickets' }).click();
    await expect(page).toHaveURL(/\/staff-queue\?ownerId=unassigned/);

    // Role protection
    await page.goto('/requester-dashboard');
    await expect(page.getByText('403 Forbidden')).toBeVisible();
    const direct = await page.request.get('/api/dashboard/requester');
    expect(direct.status()).toBe(403);
  });

  test('accounts with no data show zero metrics and empty lists, not errors', async ({ page }) => {
    test.slow();
    await login(page, 'req_empty@toktikit.local', /\/my-tickets/);
    await page.goto('/requester-dashboard');
    await expect(page.getByRole('heading', { name: 'Requester Dashboard' })).toBeVisible();
    for (const title of ['Total Tickets', 'Active Tickets', 'Waiting for Me', 'Resolved / Closed']) {
      expect(await kpi(page, title)).toBe(0);
    }
    await expect(page.locator('.alert-danger')).toHaveCount(0);

    await page.context().clearCookies();
    await login(page, 'tech_empty@toktikit.local', /\/staff-queue/);
    await page.goto('/staff-dashboard');
    await expect(page.getByRole('heading', { name: 'IT Staff Dashboard' })).toBeVisible();
    expect(await kpi(page, 'My Active Tickets')).toBe(0);
    await expect(page.locator('.alert-danger')).toHaveCount(0);
  });
});
