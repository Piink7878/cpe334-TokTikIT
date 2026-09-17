import { test, expect } from '@playwright/test';
import { PrismaClient } from '../../server/node_modules/@prisma/client';

const prisma = new PrismaClient();

test.describe('Administrator User Management Flow (Lab 3)', () => {
  let testUserEmail: string;
  let initialUserName: string;
  let updatedUserName: string;

  test.beforeAll(async () => {
    // Ensure admin user exists and is active without mandatory password change
    await prisma.user.upsert({
      where: { email: 'admin@toktikit.local' },
      update: { isActive: true, mustChangePassword: false, role: 'ADMIN' },
      create: {
        email: 'admin@toktikit.local',
        fullName: 'Admin User',
        role: 'ADMIN',
        isActive: true,
        mustChangePassword: false,
        passwordHash: '$2b$10$eV6Mi0kswjPdFZvh5JenAekbL9JgATAQJMly.RGHAwnYij1/hAfMq' // Password123!
      }
    });
  });

  test.afterAll(async () => {
    // Guaranteed teardown even on mid-test failure
    try {
      if (testUserEmail) {
        await prisma.user.deleteMany({
          where: { email: testUserEmail }
        });
      }
      // Restore admin account state
      await prisma.user.updateMany({
        where: { email: 'admin@toktikit.local' },
        data: { isActive: true, mustChangePassword: false }
      });
    } catch (err) {
      console.error('Error in user-administration afterAll teardown:', err);
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Full Admin workflow: Login -> Navigate -> Search/Filter -> Create User -> Edit User -> Reset Password', async ({ page }) => {
    const timestamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    testUserEmail = `e2e-admin-user-${timestamp}@toktikit.local`;
    initialUserName = `E2E New User ${timestamp}`;
    updatedUserName = `E2E Updated User ${timestamp}`;

    // 1. Login as Admin
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', 'admin@toktikit.local');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // Verify redirected to user-management and app shell shows Admin
    await expect(page).toHaveURL(/.*\/user-management/);
    await expect(page.locator('.navbar')).toContainText('Admin User');
    await expect(page.locator('.navbar')).toContainText('ADMIN');

    // 2. Search & Filter the user list
    // Search for existing user
    const searchInput = page.locator('input[placeholder="Search by name or email..."]');
    await searchInput.fill('staff2');
    await expect(page.locator('tbody tr', { hasText: 'staff2@toktikit.local' })).toBeVisible();

    // Clear search
    await searchInput.fill('');
    await expect(page.locator('tbody tr', { hasText: 'admin@toktikit.local' })).toBeVisible();

    // Filter by role
    const roleSelect = page.locator('select.form-select').first();
    await roleSelect.selectOption('IT_STAFF');
    await expect(page.locator('tbody tr', { hasText: 'IT STAFF' }).first()).toBeVisible();

    // Reset filter
    await roleSelect.selectOption('');

    // 3. Create a new user
    await page.click('button:has-text("Create User")');
    await expect(page.locator('h5:has-text("Create New User")')).toBeVisible();

    // Fill Create User modal form
    const createModal = page.locator('.modal.show');
    await createModal.locator('input[type="text"]').fill(initialUserName);
    await createModal.locator('input[type="email"]').fill(testUserEmail);
    await createModal.locator('select').selectOption('REQUESTER');
    await createModal.locator('input[type="password"]').fill('InitialPassword123!');
    await createModal.locator('button[type="submit"]:has-text("Create User")').click();

    // Verify creation success alert
    await expect(page.locator('.alert-success')).toContainText('User created successfully');

    // Verify created user is listed in table
    await searchInput.fill(testUserEmail);
    const createdRow = page.locator('tbody tr', { hasText: testUserEmail });
    await expect(createdRow).toBeVisible();
    await expect(createdRow).toContainText(initialUserName);
    await expect(createdRow).toContainText('REQUESTER');

    // 4. Edit user
    await createdRow.locator('button:has-text("Edit")').click();
    await expect(page.locator('h5:has-text("Edit User")')).toBeVisible();

    const editModal = page.locator('.modal.show');
    await editModal.locator('input[type="text"]').fill(updatedUserName);
    await editModal.locator('select').selectOption('IT_STAFF');
    await editModal.locator('button[type="submit"]:has-text("Save Changes")').click();

    // Verify edit success
    await expect(page.locator('.alert-success')).toContainText('User updated successfully');
    await expect(createdRow).toContainText(updatedUserName);
    await expect(createdRow).toContainText('IT STAFF');

    // 5. Trigger Reset Password action
    await createdRow.locator('button:has-text("Edit")').click();
    await expect(page.locator('h5:has-text("Edit User")')).toBeVisible();

    // Click Set New Initial Password in Edit Modal
    await page.click('button:has-text("Set New Initial Password")');
    await expect(page.locator('h5:has-text("Reset Password")')).toBeVisible();

    // Fill reset password form
    const resetModal = page.locator('.modal.show');
    await resetModal.locator('input[type="password"]').fill('NewResetPassword123!');
    await resetModal.locator('button[type="submit"]:has-text("Reset Password")').click();

    // Verify reset success
    await expect(page.locator('.alert-success')).toContainText('Password reset successfully');
    await page.waitForLoadState('networkidle');
  });
});
