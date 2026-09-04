import { test, expect } from '@playwright/test';

test.describe('Requester Ticket Flow', () => {
  test('Complete flow: Select requester -> Create Ticket -> Search -> View Detail', async ({ page }, testInfo) => {
    const viewName = testInfo.project.name.split(' ')[0].toLowerCase();
    // 1. Visit the app and select a Development Requester
    await page.goto('/');
    await expect(page.locator('h2', { hasText: 'Select Development Requester' })).toBeVisible();
    
    // Select the first available requester
    await page.waitForSelector('select');
    await page.locator('button', { hasText: 'Continue' }).click();

    // Verify we are on My Tickets
    await expect(page.locator('h2', { hasText: 'My Tickets' })).toBeVisible();

    // 2. Navigate to 'Create Ticket', fill in the form with valid data, and submit
    await page.locator('a', { hasText: '+ Create Ticket' }).click();
    await expect(page.locator('h2', { hasText: 'Create Support Ticket' })).toBeVisible();

    // Fill Category (using index 1 to select the first valid option)
    await page.locator('select[name="categoryId"]').selectOption({ index: 1 });
    // Fill Related System
    await page.locator('select[name="relatedSystemId"]').selectOption({ index: 1 });
    // Fill Priority
    await page.locator('select[name="requestedPriority"]').selectOption('HIGH');

    // Fill Summary
    const summaryText = 'Test E2E Ticket Summary ' + Date.now();
    await page.locator('input[name="summary"]').fill(summaryText);

    // Fill Description
    const descriptionText = 'This is a description for the E2E test ticket. It must be at least 10 chars.';
    await page.locator('textarea[name="description"]').fill(descriptionText);

    // Wait for the form to be fully rendered with all values filled
    await expect(page.locator('textarea[name="description"]')).toHaveValue(descriptionText);
    
    // Verify there is no horizontal overflow before capturing screenshot
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
    await page.screenshot({ path: `artifacts/lab-02/screenshots/create-ticket/${viewName}.png` });

    // Submit
    await page.locator('button', { hasText: 'Submit Ticket' }).click();

    // 3. Verify success state and extract Ticket Number
    await expect(page.locator('h2', { hasText: 'Ticket Created Successfully' })).toBeVisible();
    
    // Extract Ticket Number
    const ticketNumberElement = page.locator('.font-monospace');
    const ticketNumber = await ticketNumberElement.textContent();
    expect(ticketNumber).toBeTruthy();
    const tktNum = ticketNumber?.trim() || '';

    // 4. Navigate to 'My Tickets', search for generated Ticket Number, verify it appears
    await page.locator('a', { hasText: 'Back to My Tickets' }).click();
    await expect(page.locator('h2', { hasText: 'My Tickets' })).toBeVisible();

    // Search
    await page.locator('input[name="search"]').fill(tktNum);
    
    // Verify it appears in the list (click the link with the ticket number)
    // We use :visible because MyTickets renders both desktop and mobile views (one is hidden via CSS)
    const ticketLink = page.locator(`a:visible:has-text("${tktNum}")`);
    await expect(ticketLink).toBeVisible();

    // Wait for list to fully render and take screenshot of My Tickets page
    // (The visibility of ticketLink above confirms the list has rendered)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
    await page.screenshot({ path: `artifacts/lab-02/screenshots/my-tickets/${viewName}.png` });

    // 5. Click the ticket to open the 'Requester Ticket Detail' screen and verify the read-only data matches the submission.
    // We wrap this in a retry block because filling the search input triggers multiple API requests
    // which can cause React to re-render the list and lose the click event on Mobile Safari.
    await expect(async () => {
      await ticketLink.click();
      await expect(page.locator('h1', { hasText: 'Ticket Details' })).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 10000 });

    // Verify the data
    await expect(page.locator('div.form-control', { hasText: tktNum })).toBeVisible();
    await expect(page.locator('div.form-control', { hasText: summaryText })).toBeVisible();
    await expect(page.locator('div.form-control', { hasText: descriptionText })).toBeVisible();
    
    // Verify High Priority badge
    await expect(page.locator('.badge', { hasText: 'HIGH' }).first()).toBeVisible();

    // Wait for the attachments tab to render properly then take a screenshot of Ticket Detail page
    await expect(page.locator('.nav-tabs')).toBeVisible();
    
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
    await page.screenshot({ path: `artifacts/lab-02/screenshots/ticket-detail/${viewName}.png` });

    // --- Attachment Lifecycle Test ---
    // 1. Create a small dummy file (using PDF since it's an allowed MIME type)
    const dummyFilename = `dummy-${Date.now()}.pdf`;
    const dummyFileContent = Buffer.from('%PDF-1.4\\n%Dummy PDF content for E2E testing\\n');
    
    // 2. Upload the file using the file input
    await page.setInputFiles('input[type="file"]', {
      name: dummyFilename,
      mimeType: 'application/pdf',
      buffer: dummyFileContent,
    });
    
    // 3. Verify the attachment's metadata (filename) is visible on the screen
    // We use .first() to prevent strict mode violation, though filename should be unique via timestamp
    const attachmentItem = page.locator('.card', { hasText: dummyFilename }).first();
    await expect(attachmentItem).toBeVisible();
    
    // 4. Soft-remove the file by clicking 'Remove', filling in a removal reason, and confirming.
    await attachmentItem.locator('button', { hasText: 'Remove' }).first().click();
    await page.locator('[data-testid="removal-reason-input"]').fill('Removed during E2E test verification');
    await page.locator('[data-testid="confirm-remove-btn"]').click();
    
    // Wait for modal to close
    await expect(page.locator('[data-testid="removal-reason-input"]')).toBeHidden();
    
    // Verify the download button is no longer available and file unavailable text is shown
    const removedItem = page.locator('.card', { hasText: dummyFilename }).first();
    await expect(removedItem.locator('button', { hasText: 'Download' })).toBeHidden();
    await expect(removedItem.locator('span', { hasText: 'File unavailable' }).first()).toBeVisible();
  });
});
