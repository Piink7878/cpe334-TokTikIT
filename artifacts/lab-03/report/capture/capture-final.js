const { chromium } = require("@playwright/test");
const fs = require("fs");
const SHOT_BASE = "artifacts/lab-03/screenshots";
const BASE_URL = "http://localhost:5173";

async function shot(page, file) {
  const dir = require("path").dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: file, fullPage: true });
  console.log("OK:", file);
}

async function login(page, email, pass) {
  await page.goto(BASE_URL + "/login", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(pass);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(2500);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // Login staff
  await login(page, "staff1@toktikit.local", "Password123!");
  
  // Wait for queue to fully load (not loading state)
  await page.goto(BASE_URL + "/staff-queue", { waitUntil: "networkidle" });
  await page.waitForSelector('#search', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Search
  await page.fill('#search', "TKT");
  await page.waitForTimeout(1200);
  await shot(page, `${SHOT_BASE}/staff-queue/P06-F02_staff-queue-search_desktop.png`);

  // No results
  await page.fill('#search', "ZZZNOTFOUND999");
  await page.waitForTimeout(1200);
  await shot(page, `${SHOT_BASE}/staff-queue/P06-F03_staff-queue-no-results_desktop.png`);

  // Filter by HIGH priority
  await page.fill('#search', "");
  const selects = await page.locator('.form-select').all();
  if (selects.length >= 2) {
    await selects[1].selectOption("CRITICAL");
    await page.waitForTimeout(1200);
    await shot(page, `${SHOT_BASE}/staff-queue/P06-F04_staff-queue-filter-critical_desktop.png`);
    await selects[1].selectOption("");
    await page.waitForTimeout(500);
  }

  // Sort by IT Priority
  await page.goto(BASE_URL + "/staff-queue", { waitUntil: "networkidle" });
  await page.waitForSelector('#search', { timeout: 10000 });
  await page.waitForTimeout(1000);
  const sortSelects = await page.locator('.form-select').all();
  if (sortSelects.length >= 4) {
    await sortSelects[3].selectOption("itPriority-desc");
    await page.waitForTimeout(1200);
    await shot(page, `${SHOT_BASE}/staff-queue/P06-F05_staff-queue-sorted-priority_desktop.png`);
  }

  // Staff Ticket Detail - find a real ticket link
  await page.goto(BASE_URL + "/staff-queue", { waitUntil: "networkidle" });
  await page.waitForSelector('a[href*="/staff/tickets/"]', { timeout: 10000 });
  await page.waitForTimeout(500);
  const firstLink = page.locator('a[href*="/staff/tickets/"]').first();
  const href = await firstLink.getAttribute('href');
  console.log("First ticket link:", href);

  await page.goto(BASE_URL + href, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await shot(page, `${SHOT_BASE}/staff-ticket-detail/P07-F01_staff-detail-full_desktop.png`);
  
  // Scroll to comments
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(500);
  await shot(page, `${SHOT_BASE}/staff-ticket-detail/P07-F02_staff-detail-comments_desktop.png`);
  
  // Scroll to bottom (notes)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await shot(page, `${SHOT_BASE}/staff-ticket-detail/P07-F03_staff-detail-notes_desktop.png`);

  // Admin - edit user
  await login(page, "admin@toktikit.local", "Password123!");
  await page.goto(BASE_URL + "/user-management", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  
  // Search users
  await page.fill('#search, input[placeholder*="Search"]', "staff");
  await page.waitForTimeout(1000);
  await shot(page, `${SHOT_BASE}/user-management/P08-F02_user-search-staff_desktop.png`);
  await page.fill('#search, input[placeholder*="Search"]', "");
  await page.waitForTimeout(500);

  // Edit modal
  const editBtns = await page.locator('button:has-text("Edit"), button:has-text("Manage")').all();
  if (editBtns.length > 0) {
    await editBtns[0].click();
    await page.waitForTimeout(800);
    await shot(page, `${SHOT_BASE}/user-management/P08-F04_edit-user-modal_desktop.png`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // Create user filled
  const addBtns = await page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New User")').all();
  if (addBtns.length > 0) {
    await addBtns[0].click();
    await page.waitForTimeout(800);
    // Fill fields
    const nameInput = page.locator('input[id*="name"], input[placeholder*="name"], input[placeholder*="Name"]').first();
    const emailInput = page.locator('input[id*="email"], input[placeholder*="email"], input[type="email"]').first();
    await nameInput.fill("Test Evidence User");
    await emailInput.fill("testevidence@test.local");
    await page.waitForTimeout(300);
    await shot(page, `${SHOT_BASE}/user-management/P08-F03b_create-user-filled_desktop.png`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // Requester ticket detail
  await login(page, "req1@toktikit.local", "Password123!");
  await page.goto(BASE_URL + "/my-tickets", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await shot(page, `${SHOT_BASE}/requester/P05-R01_requester-my-tickets_desktop.png`);
  
  const reqTicketLinks = await page.locator('a[href*="/tickets/"]').all();
  if (reqTicketLinks.length > 0) {
    await reqTicketLinks[0].click();
    await page.waitForTimeout(2000);
    await shot(page, `${SHOT_BASE}/requester/P07-R02_requester-ticket-detail_desktop.png`);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, `${SHOT_BASE}/requester/P07-R03_requester-bottom-resolved-btn_desktop.png`);
  }

  await browser.close();
  console.log("DONE all supplemental captures");
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
