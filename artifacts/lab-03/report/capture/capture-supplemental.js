const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const BASE_URL = "http://localhost:5173";
const SHOT_BASE = "artifacts/lab-03/screenshots";
const ACCOUNTS = {
  staff1: { email: "staff1@toktikit.local", password: "Password123!" },
  admin: { email: "admin@toktikit.local", password: "Password123!" },
  req1: { email: "req1@toktikit.local", password: "Password123!" }
};

async function login(page, account) {
  await page.goto(BASE_URL + "/login", { waitUntil: "networkidle" });
  await page.fill('#email, input[type="email"]', account.email);
  await page.fill('#password, input[type="password"]', account.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
}

async function shot(page, filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: filePath, fullPage: true });
  console.log("Captured:", filePath);
}

(async () => {
  const VIEWPORTS = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 820, height: 1180 },
    { name: "mobile", width: 390, height: 844 }
  ];

  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();

    // Staff Queue - with corrected selectors
    await login(page, ACCOUNTS.staff1);
    await page.goto(BASE_URL + "/staff-queue", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Search using correct ID
    await page.fill('#search', "TKT");
    await page.waitForTimeout(800);
    await shot(page, `${SHOT_BASE}/staff-queue/P06-F02_staff-queue-search_${vp.name}.png`);

    // No results
    await page.fill('#search', "XYZXYZXYZ9999NORESULTS");
    await page.waitForTimeout(800);
    await shot(page, `${SHOT_BASE}/staff-queue/P06-F03_staff-queue-no-results_${vp.name}.png`);

    // Clear and capture sort dropdown
    await page.fill('#search', "");
    await page.waitForTimeout(500);
    try {
      const sortSelect = page.locator('select#sortBy, select[aria-label*="Sort"], select').first();
      await sortSelect.selectOption({ index: 1 });
      await page.waitForTimeout(800);
      await shot(page, `${SHOT_BASE}/staff-queue/P06-F04_staff-queue-sorted_${vp.name}.png`);
    } catch(e) { console.log("Sort selector:", e.message.substring(0, 80)); }

    // Navigate to first ticket detail
    try {
      const ticketLinks = await page.locator('a[href*="/staff/tickets/"]').all();
      if (ticketLinks.length > 0) {
        await ticketLinks[0].click();
        await page.waitForTimeout(2000);
        await shot(page, `${SHOT_BASE}/staff-ticket-detail/P07-F01_staff-detail-full_${vp.name}.png`);

        // Scroll down to see comments/notes
        await page.evaluate(() => window.scrollBy(0, 400));
        await page.waitForTimeout(500);
        await shot(page, `${SHOT_BASE}/staff-ticket-detail/P07-F02_staff-detail-comments-section_${vp.name}.png`);

        // Scroll to notes
        await page.evaluate(() => window.scrollBy(0, 600));
        await page.waitForTimeout(500);
        await shot(page, `${SHOT_BASE}/staff-ticket-detail/P07-F03_staff-detail-notes-section_${vp.name}.png`);
      } else {
        console.log("No ticket links found in queue");
      }
    } catch(e) { console.log("Ticket detail:", e.message.substring(0, 100)); }

    // Requester - ticket detail with Problem Appears Resolved
    await login(page, ACCOUNTS.req1);
    await page.waitForTimeout(1000);
    await page.goto(BASE_URL + "/my-tickets", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, `${SHOT_BASE}/requester/P05-R01_requester-my-tickets_${vp.name}.png`);

    // Open first ticket
    try {
      const ticketLinks = await page.locator('a[href*="/tickets/"]').all();
      if (ticketLinks.length > 0) {
        await ticketLinks[0].click();
        await page.waitForTimeout(2000);
        await shot(page, `${SHOT_BASE}/requester/P07-R02_requester-ticket-detail_${vp.name}.png`);
        // Scroll to see resolved button
        await page.evaluate(() => window.scrollBy(0, 500));
        await page.waitForTimeout(300);
        await shot(page, `${SHOT_BASE}/requester/P07-R03_requester-appears-resolved-btn_${vp.name}.png`);
      }
    } catch(e) { console.log("Requester ticket:", e.message.substring(0, 100)); }

    // Admin - create user form submit (to show initial password reveal)
    await login(page, ACCOUNTS.admin);
    await page.goto(BASE_URL + "/user-management", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Open create user modal and fill it
    try {
      const addBtn = page.locator('button:has-text("Add User"), button:has-text("Create"), button:has-text("New User")').first();
      await addBtn.click();
      await page.waitForTimeout(500);
      // Fill the form
      await page.fill('#fullName, input[placeholder*="Full Name"], input[name="fullName"]', "Test Evidence User");
      await page.fill('#email, input[placeholder*="Email"], input[name="email"]', "evidence-user@test.local");
      await page.waitForTimeout(300);
      await shot(page, `${SHOT_BASE}/user-management/P08-F03b_create-user-filled_${vp.name}.png`);
      // Close
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    } catch(e) { console.log("Create user form:", e.message.substring(0, 100)); }

    // Edit user button
    try {
      const editBtns = await page.locator('button:has-text("Edit"), button[aria-label*="Edit"]').all();
      if (editBtns.length > 0) {
        await editBtns[0].click();
        await page.waitForTimeout(500);
        await shot(page, `${SHOT_BASE}/user-management/P08-F04_edit-user-modal_${vp.name}.png`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    } catch(e) { console.log("Edit user:", e.message.substring(0, 100)); }

    await ctx.close();
  }

  await browser.close();
  console.log("Supplemental capture complete.");
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
