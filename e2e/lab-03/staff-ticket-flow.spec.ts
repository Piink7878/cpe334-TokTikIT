import { test, expect } from '@playwright/test';
import { PrismaClient } from '../../server/node_modules/@prisma/client';

const prisma = new PrismaClient();

test.describe('IT Staff Ticket Flow (Lab 3)', () => {
  let ticketId: number;
  let ticketNumber: string;
  let summaryText: string;

  test.beforeAll(async () => {
    // 1. Ensure clean prerequisites
    const req = await prisma.user.findFirst({ where: { role: 'REQUESTER', isActive: true } });
    const cat = await prisma.category.findFirst();
    const sys = await prisma.relatedSystem.findFirst();

    if (!req || !cat || !sys) {
      throw new Error('Database missing seed data (Requester, Category, or RelatedSystem)');
    }

    const timestamp = Date.now();
    ticketNumber = `STAFF-E2E-${timestamp}`;
    summaryText = `E2E Staff Ticket ${timestamp}`;

    // Seed a fresh unassigned NEW ticket
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        summary: summaryText,
        description: 'Detailed description for testing IT Staff ticket flow end-to-end.',
        currentStatus: 'NEW',
        requestedPriority: 'MEDIUM',
        itPriority: 'MEDIUM',
        categoryId: cat.id,
        relatedSystemId: sys.id,
        requesterId: req.id,
        ownerId: null
      }
    });
    ticketId = ticket.id;
  });

  test.afterAll(async () => {
    // Guaranteed teardown even on mid-test failure
    try {
      if (ticketId) {
        await prisma.internalNote.deleteMany({ where: { ticketId } });
        await prisma.publicComment.deleteMany({ where: { ticketId } });
        await prisma.attachment.deleteMany({ where: { ticketId } });
        await prisma.ticket.deleteMany({ where: { id: ticketId } });
      }
    } catch (err) {
      console.error('Error in staff-ticket-flow afterAll teardown:', err);
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Full IT Staff workflow: Login -> Queue -> Open -> Claim -> Priority -> Status -> Comment -> Note', async ({ page }) => {
    // 1. Login as IT Staff (staff2@toktikit.local does not require password change)
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', 'staff2@toktikit.local');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // Verify redirected to staff-queue and user shell displays IT Staff info
    await expect(page).toHaveURL(/.*\/staff-queue/);
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
    await page.fill('textarea[placeholder="Write a message to the requester..."]', publicCommentText);
    await page.click('button:has-text("Post Comment")');

    // Verify comment is displayed in activity timeline with Public Comment badge
    await expect(page.locator('text=Public Comment').first()).toBeVisible();
    await expect(page.locator(`text=${publicCommentText}`)).toBeVisible();

    // 7. Post an Internal Note
    const internalNoteText = `Internal operational note at ${Date.now()}`;
    await page.fill('textarea[placeholder="Write an internal operational note..."]', internalNoteText);
    await page.click('button:has-text("Save Internal Note")');

    // Verify internal note is displayed in activity timeline with Internal Note badge
    await expect(page.locator('text=Internal Note').first()).toBeVisible();
    await expect(page.locator(`text=${internalNoteText}`)).toBeVisible();
    await page.waitForLoadState('networkidle');
  });
});
