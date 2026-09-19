import { test, expect } from '@playwright/test';

test.describe('Lab 3 Responsive Screenshots', () => {
  test('1. Capture Authentication screenshot', async ({ page }, testInfo) => {
    const viewName = testInfo.project.name.split(' ')[0].toLowerCase();
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Verify no horizontal overflow
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
    await page.screenshot({ path: `artifacts/lab-03/screenshots/authentication/${viewName}.png` });
  });

  test('2. Capture Staff Queue screenshot', async ({ page }, testInfo) => {
    const viewName = testInfo.project.name.split(' ')[0].toLowerCase();
    await page.goto('/login');
    await page.fill('input[type="email"]', 'staff2@toktikit.local');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/staff-queue/);
    await expect(page.locator('h2', { hasText: 'IT Staff Ticket Queue' })).toBeVisible();
    
    // Wait for visible Open Detail button (works across desktop table and mobile list cards)
    const openDetail = page.locator('a', { hasText: 'Open Detail' }).filter({ visible: true }).first();
    await expect(openDetail).toBeVisible({ timeout: 10000 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
    await page.screenshot({ path: `artifacts/lab-03/screenshots/staff-queue/${viewName}.png` });
  });

  test('3. Capture Staff Ticket Detail screenshot', async ({ page }, testInfo) => {
    const viewName = testInfo.project.name.split(' ')[0].toLowerCase();
    await page.goto('/login');
    await page.fill('input[type="email"]', 'staff2@toktikit.local');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/staff-queue/);
    await page.goto('/staff/tickets/1');
    await expect(page).toHaveURL(/\/staff\/tickets\/1/);
    await expect(page.locator('h2', { hasText: 'TKT-1001' })).toBeVisible();
    await expect(page.locator('h5', { hasText: 'Activity & Communication' })).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
    await page.screenshot({ path: `artifacts/lab-03/screenshots/staff-ticket-detail/${viewName}.png` });
  });

  test('4. Capture User Management screenshot', async ({ page }, testInfo) => {
    const viewName = testInfo.project.name.split(' ')[0].toLowerCase();
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@toktikit.local');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/user-management/);
    await expect(page.locator('h2', { hasText: 'User Management' })).toBeVisible();
    await expect(page.locator('text=Loading users...')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('table tbody tr')).not.toHaveCount(0);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
    await page.screenshot({ path: `artifacts/lab-03/screenshots/user-management/${viewName}.png` });
  });
});
