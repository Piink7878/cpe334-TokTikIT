import { test, expect, request } from '@playwright/test';

test.describe('IT Staff Ticket Flow (Lab 3)', () => {
  let ticketId: number;
  let ticketNumber: string;
  let summaryText: string;

  test.beforeAll(async () => {
    const timestamp = Date.now();
    summaryText = `E2E Staff Ticket ${timestamp}`;

    // Create an API context using a valid seeded requester account (req2@toktikit.local)
    const apiContext = await request.newContext({ baseURL: 'http://localhost:5173' });

    // 1. Log in as Requester
    const loginRes = await apiContext.post('/api/auth/login', {
      data: {
        email: 'req2@toktikit.local',
        password: 'Password123!'
      }
    });
    expect(loginRes.ok()).toBeTruthy();

    // 2. Fetch categories and related systems for valid foreign key IDs
    const catRes = await apiContext.get('/api/categories');
    expect(catRes.ok()).toBeTruthy();
    const categories = await catRes.json();
    const categoryId = categories[0].id;

    const sysRes = await apiContext.get('/api/related-systems');
    expect(sysRes.ok()).toBeTruthy();
    const sysData = await sysRes.json();
    const relatedSystemId = sysData.data[0].id;

    // 3. Dynamically create a fresh unassigned NEW ticket via API (pure black-box)
    const ticketRes = await apiContext.post('/api/tickets', {
      multipart: {
        categoryId: String(categoryId),
        relatedSystemId: String(relatedSystemId),
        summary: summaryText,
        description: 'Detailed description for testing IT Staff ticket flow end-to-end.',
        requestedPriority: 'MEDIUM'
      }
    });
    expect(ticketRes.ok()).toBeTruthy();
    const ticketJson = await ticketRes.json();
    ticketId = ticketJson.data.id;
    ticketNumber = ticketJson.data.ticketNumber;

    await apiContext.dispose();
  });

  test('Full IT Staff workflow: Login -> Queue -> Open -> Claim -> Priority -> Status -> Comment -> Note -> Persistence Check -> Requester Note Authorization (BR-04)', async ({ page }) => {
    test.slow();

    // 1. Login as IT Staff (staff2@toktikit.local does not require password change)
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', 'staff2@toktikit.local');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // Verify redirected to staff-queue and user shell displays IT Staff info (typo-free regex)
    await expect(page).toHaveURL(/\/staff-queue/);
    await expect(page.locator('.navbar')).toContainText('IT Staff Two');
    await expect(page.locator('.navbar')).toContainText('IT_STAFF');

    // 2. Locate ticket in the queue and open Ticket Detail
    // Search for ticket to ensure it is visible regardless of pagination
    await page.fill('input[placeholder*="Search"]', ticketNumber);
    await page.click('button[type="submit"]');

    // Click Open Detail (matching visible link for both desktop table and responsive cards)
    const openDetailLink = page.locator(`a[href="/staff/tickets/${ticketId}"]`).filter({ visible: true }).first();
    await expect(openDetailLink).toBeVisible();
    await openDetailLink.click();

    // Verify Ticket Detail view is loaded
    await expect(page).toHaveURL(new RegExp(`/staff/tickets/${ticketId}`));
    await expect(page.locator('h2')).toContainText(ticketNumber);
    await expect(page.locator('h2')).toContainText('NEW');
    await expect(page.locator('text=Unassigned').first()).toBeVisible();

    // 3. Claim the ticket
    const claimButton = page.locator('button', { hasText: 'Claim Ticket' });
    await expect(claimButton).toBeVisible();
    await claimButton.click();

    // Expect status to become OPEN and owner to become IT Staff Two
    await expect(page.locator('h2')).toContainText('OPEN');
    await expect(page.locator('text=IT Staff Two').first()).toBeVisible();

    // 4. Change IT Priority to CRITICAL
    await page.selectOption('#priority-select', 'CRITICAL');
    const updatePriorityButton = page.locator('button', { hasText: 'Update' });
    await updatePriorityButton.click();

    // Verify priority badge updated
    await expect(page.locator('.alert-success')).toContainText('Priority updated successfully');

    // 5. Update Status to IN_PROGRESS
    await page.selectOption('#status-select', 'IN_PROGRESS');
    const changeStatusButton = page.locator('button', { hasText: 'Change' });
    await changeStatusButton.click();

    // Verify status badge changed
    await expect(page.locator('h2')).toContainText('IN PROGRESS');

    // 6. Post a Public Comment
    const publicCommentText = `Public update from staff at ${Date.now()}`;
    const commentTextarea = page.locator('textarea[placeholder="Write a message to the requester..."]');
    await commentTextarea.fill(publicCommentText);
    await page.click('button:has-text("Post Comment")');

    // Verify public comment posted successfully and appears in activity timeline
    await expect(page.locator('.alert-success')).toContainText('Public comment added successfully');
    await expect(commentTextarea).toHaveValue('');
    await expect(page.locator('.card:has-text("Activity & Communication")').locator(`text=${publicCommentText}`)).toBeVisible();

    // 7. Post an Internal Note
    const internalNoteText = `Internal operational note at ${Date.now()}`;
    const noteTextarea = page.locator('textarea[placeholder="Write an internal operational note..."]');
    await expect(noteTextarea).toBeVisible();
    await noteTextarea.fill(internalNoteText);
    const saveNoteButton = page.locator('button:has-text("Save Internal Note")');
    await expect(saveNoteButton).toBeEnabled();
    await saveNoteButton.click();

    // Verify internal note saved successfully and appears in activity timeline
    await expect(page.locator('.alert-success')).toContainText('Internal note added successfully');
    await expect(noteTextarea).toHaveValue('');
    await expect(page.locator('.card:has-text("Activity & Communication")').locator(`text=${internalNoteText}`)).toBeVisible();

    // 8. Persistence check (No direct DB connections): Reload page and assert values persist in UI
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h2')).toContainText(ticketNumber);
    await expect(page.locator('h2')).toContainText('IN PROGRESS');
    await expect(page.locator('text=IT Staff Two').first()).toBeVisible();
    await expect(page.locator('#priority-select')).toHaveValue('CRITICAL');
    await expect(page.locator('.card:has-text("Activity & Communication")').locator(`text=${publicCommentText}`)).toBeVisible();
    await expect(page.locator('.card:has-text("Activity & Communication")').locator(`text=${internalNoteText}`)).toBeVisible();

    // 9. Requester Note Authorization (BR-04):
    // Logout as IT Staff
    await page.click('button:has-text("Logout")');
    await expect(page).toHaveURL(/\/login/);

    // Log in as the Ticket's Requester (req2@toktikit.local)
    await page.fill('input[type="email"]', 'req2@toktikit.local');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/my-tickets/);

    // Navigate to that specific Ticket Detail page
    await page.goto(`/tickets/${ticketId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`text=${ticketNumber}`).first()).toBeVisible();

    // Open Public Comments tab to view comments
    const commentsTab = page.locator('button:has-text("Public Comments")');
    await commentsTab.click();
    await expect(page.locator(`text=${publicCommentText}`)).toBeVisible();

    // Explicitly assert that the Internal Note is NOT visible/rendered in the DOM (BR-04)
    await expect(page.locator(`text=${internalNoteText}`)).toHaveCount(0);
    await expect(page.locator('text=Internal Note')).toHaveCount(0);
  });
});
