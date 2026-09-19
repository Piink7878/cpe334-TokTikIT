import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test('unauthenticated users are redirected to login', async ({ page }) => {
    await page.goto('/my-tickets');
    await expect(page).toHaveURL(/\/login/);
  });

  test('valid login redirects to my-tickets', async ({ page }) => {
    await page.goto('/login');
    
    // Using req2@toktikit.local who doesn't need password change
    await page.fill('input[type="email"]', 'req2@toktikit.local');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/my-tickets/);
    
    // Check App Shell for user name
    await expect(page.locator('.navbar')).toContainText('Requester Two');
    await expect(page.locator('.navbar')).toContainText('REQUESTER');
  });

  test('invalid login shows error', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[type="email"]', 'req2@toktikit.local');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('.alert-danger')).toContainText('Invalid email or password');
  });

  test('mandatory password change blocks other pages', async ({ page }) => {
    await page.goto('/login');
    
    // req1@toktikit.local needs password change
    await page.fill('input[type="email"]', 'req1@toktikit.local');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // Should redirect to change password
    await expect(page).toHaveURL(/\/change-password/);
    
    // Try to navigate away
    await page.goto('/my-tickets');
    await expect(page).toHaveURL(/\/change-password/);
  });
});
