import { test, expect } from '@playwright/test';
import { PrismaClient } from '../../server/node_modules/@prisma/client';

const prisma = new PrismaClient();

test.describe('Administrator User Management Flow (Lab 3)', () => {
  let testUserEmail: string;
  let dedicatedUserEmail: string;
  let initialUserName: string;
  let updatedUserName: string;

  // Single constant for the reset password — used in both Admin reset and user login
  const resetPassword = 'NewResetPassword123!';

  // Schema-aware FK-safe cleanup helper: removes dependent relations before deleting user
  async function cleanupUserByEmail(email: string) {
    if (!email) return;
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return;
      await prisma.internalNote.deleteMany({ where: { authorId: user.id } });
      await prisma.publicComment.deleteMany({ where: { authorId: user.id } });
      await prisma.ticket.updateMany({ where: { ownerId: user.id }, data: { ownerId: null } });
      const requestedTickets = await prisma.ticket.findMany({ where: { requesterId: user.id }, select: { id: true } });
      if (requestedTickets.length > 0) {
        const ticketIds = requestedTickets.map(t => t.id);
        await prisma.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
        await prisma.internalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
        await prisma.publicComment.deleteMany({ where: { ticketId: { in: ticketIds } } });
        await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
      }
      await prisma.user.deleteMany({ where: { id: user.id } });
    } catch (err) {
      console.error(`Error cleaning up user ${email}:`, err);
    }
  }

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
        await cleanupUserByEmail(testUserEmail);
      }
      if (dedicatedUserEmail) {
        await cleanupUserByEmail(dedicatedUserEmail);
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
    await expect(page).toHaveURL(/\/user-management/);
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

    // Fill reset password form using the single resetPassword constant
    const resetModal = page.locator('.modal.show');
    await resetModal.locator('input[type="password"]').fill(resetPassword);
    await resetModal.locator('button[type="submit"]:has-text("Reset Password")').click();

    // Verify reset success
    await expect(page.locator('.alert-success')).toContainText('Password reset successfully');
    await page.waitForLoadState('networkidle');
  });

  test('Self-deactivation protection: Admin cannot deactivate own account via UI', async ({ page }) => {
    // 1. Remain in (or re-establish) the Admin session
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', 'admin@toktikit.local');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/user-management/);

    // 2. Clear any active search so the Admin's own row is visible
    const searchInput = page.locator('input[placeholder="Search by name or email..."]');
    await searchInput.fill('');
    await expect(page.locator('tbody tr', { hasText: 'admin@toktikit.local' })).toBeVisible();

    // 3. Locate the Admin's own row using the "(You)" badge indicator
    const adminRow = page.locator('tbody tr', { hasText: 'Admin User' }).filter({ hasText: 'You' });
    await expect(adminRow).toBeVisible();

    // 4. Click Edit on the Admin's own row
    await adminRow.locator('button:has-text("Edit")').click();

    // 5. Verify the Edit User modal is visible
    await expect(page.locator('h5:has-text("Edit User")')).toBeVisible();

    // 6. Uncheck the #isActiveSwitch to attempt self-deactivation
    const isActiveSwitch = page.locator('#isActiveSwitch');
    await expect(isActiveSwitch).toBeChecked(); // currently active
    await isActiveSwitch.uncheck();

    // 7. Verify warning text is shown: "You cannot deactivate your own account."
    await expect(page.locator('text=You cannot deactivate your own account.')).toBeVisible();

    // 8. Click Save Changes to send the request to the server
    await page.locator('button[type="submit"]:has-text("Save Changes")').click();

    // 9. Verify the server-side error is shown in .alert-danger
    await expect(page.locator('.alert-danger')).toContainText('Cannot deactivate your own account');

    // 10. Verify the Edit User modal is still open (backend rejected the request)
    await expect(page.locator('h5:has-text("Edit User")')).toBeVisible();

    // 11. Close the modal using the modal header's close button
    await page.locator('.modal.show button.btn-close').click();

    // 12. Verify the Admin row is still Active in the user list
    await searchInput.fill('admin@toktikit.local');
    const updatedAdminRow = page.locator('tbody tr', { hasText: 'admin@toktikit.local' });
    await expect(updatedAdminRow).toContainText('Active');

    // 13. Verify Admin can still use the application and remains on /user-management
    await expect(page).toHaveURL(/\/user-management/);
  });

  test('Mandatory password change: Reset user must change password before accessing app', async ({ page }) => {
    // Dedicated test user created independently for this test (does not rely on previous tests)
    const timestamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    dedicatedUserEmail = `e2e-pwd-change-${timestamp}@toktikit.local`;
    const initialTempPassword = 'Password123!';
    // Static precomputed bcrypt hash for 'Password123!' (established repository pattern, matching line 47)
    const initialTempPasswordHash = '$2b$10$eV6Mi0kswjPdFZvh5JenAekbL9JgATAQJMly.RGHAwnYij1/hAfMq';

    await prisma.user.create({
      data: {
        email: dedicatedUserEmail,
        fullName: `Reset IT Staff User ${timestamp}`,
        role: 'IT_STAFF',
        isActive: true,
        mustChangePassword: true,
        passwordHash: initialTempPasswordHash,
      },
    });

    try {
      // 1. Log in as the test user using initialTempPassword
      await page.goto('/login');
      await page.waitForSelector('input[type="email"]');
      await page.fill('input[type="email"]', dedicatedUserEmail);
      await page.fill('input[type="password"]', initialTempPassword);
      await page.click('button[type="submit"]');

      // 2. Assert redirect to /change-password (mustChangePassword is set)
      await expect(page).toHaveURL(/\/change-password/);

      // 3. Attempt to navigate to /user-management and assert blocked, redirected back to /change-password
      await page.goto('/user-management');
      await expect(page).toHaveURL(/\/change-password/);

      // 4. Fill the change-password form with a new valid password
      const finalPassword = 'FinalPassword456!';
      await page.fill('#currentPassword', initialTempPassword);
      await page.fill('#newPassword', finalPassword);
      await page.fill('#confirmPassword', finalPassword);

      // 5. Submit the form
      await page.click('button[type="submit"]');

      // 6. Assert the user reaches the landing page after password change.
      // ChangePassword.tsx navigates to /my-tickets after success.
      // IT_STAFF is not redirected away from /my-tickets by ProtectedRoute.
      await expect(page).toHaveURL(/\/my-tickets/);

      // 7. Log out the test user
      await page.click('button:has-text("Logout")');
      await expect(page).toHaveURL(/\/login/);

      // 8. Log back in as Admin
      await page.fill('input[type="email"]', 'admin@toktikit.local');
      await page.fill('input[type="password"]', 'Password123!');
      await page.click('button[type="submit"]');

      // 9. Verify Admin can still access /user-management
      await expect(page).toHaveURL(/\/user-management/);
    } finally {
      await cleanupUserByEmail(dedicatedUserEmail);
    }
  });
});
