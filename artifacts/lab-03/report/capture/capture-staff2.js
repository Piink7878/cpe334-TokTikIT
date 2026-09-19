const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const SHOT_BASE = "artifacts/lab-03/screenshots";
const BASE_URL = "http://localhost:5173";

async function shot(page, file) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: file, fullPage: true });
  console.log("OK:", file);
}

async function loginAndWait(page, email, pass, expectedPath, timeout = 8000) {
  await page.goto(BASE_URL + "/login", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(pass);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => url.href.includes(expectedPath), { timeout }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log("After login, URL:", page.url());
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // Staff queue - use staff2 (mustChangePassword=false)
  await loginAndWait(page, "staff2@toktikit.local", "Password123!", "/staff-queue");
  console.log("Queue URL:", page.url());
  await page.goto(BASE_URL + "/staff-queue", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await shot(page, `${SHOT_BASE}/staff-queue/P06-F01_staff-queue-full_desktop.png`);

  // Search
  const searchInput = page.locator('#search');
  await searchInput.waitFor({ state: 'visible', timeout: 8000 });
  await searchInput.fill("TKT");
  await page.waitForTimeout(1200);
  await shot(page, `${SHOT_BASE}/staff-queue/P06-F02_staff-queue-search_desktop.png`);

  // No results
  await searchInput.fill("ZZZNOTFOUND9999");
  await page.waitForTimeout(1200);
  await shot(page, `${SHOT_BASE}/staff-queue/P06-F03_staff-queue-no-results_desktop.png`);

  // Clear search
  await searchInput.fill("");
  await page.waitForTimeout(500);

  // Filter by status
  const selects = await page.locator('.form-select').all();
  if (selects.length >= 1) {
    await selects[0].selectOption("IN_PROGRESS");
    await page.waitForTimeout(1200);
    await shot(page, `${SHOT_BASE}/staff-queue/P06-F04_staff-queue-filter-status_desktop.png`);
    await selects[0].selectOption("");
    await page.waitForTimeout(500);
  }

  // Sort by IT Priority  
  if (selects.length >= 4) {
    await selects[3].selectOption("itPriority-desc");
    await page.waitForTimeout(1200);
    await shot(page, `${SHOT_BASE}/staff-queue/P06-F05_staff-queue-sorted-priority_desktop.png`);
  }

  // Staff ticket detail
  await page.goto(BASE_URL + "/staff-queue", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  let firstLink = null;
  try {
    firstLink = await page.locator('a[href*="/staff/tickets/"]').first().getAttribute('href');
  } catch(e) {}
  
  if (firstLink) {
    console.log("Ticket href:", firstLink);
    await page.goto(BASE_URL + firstLink, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    await shot(page, `${SHOT_BASE}/staff-ticket-detail/P07-F01_staff-detail-full_desktop.png`);
    
    await page.evaluate(() => window.scrollTo(0, Math.round(document.body.scrollHeight * 0.45)));
    await page.waitForTimeout(500);
    await shot(page, `${SHOT_BASE}/staff-ticket-detail/P07-F02_staff-detail-comments_desktop.png`);
    
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, `${SHOT_BASE}/staff-ticket-detail/P07-F03_staff-detail-notes_desktop.png`);
  }

  // Admin pages
  await loginAndWait(page, "admin@toktikit.local", "Password123!", "/user-management");
  await page.goto(BASE_URL + "/user-management", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Search users
  const uSearch = page.locator('#search, [placeholder*="Search"], [placeholder*="search"]').first();
  await uSearch.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  await uSearch.fill("staff").catch(() => {});
  await page.waitForTimeout(1000);
  await shot(page, `${SHOT_BASE}/user-management/P08-F02_user-search-staff_desktop.png`);
  await uSearch.fill("").catch(() => {});
  await page.waitForTimeout(500);

  // Edit button - find and click
  const editBtns = await page.locator('button:has-text("Edit"), button:has-text("Manage"), [data-action="edit"]').all();
  if (editBtns.length > 0) {
    await editBtns[0].click();
    await page.waitForTimeout(1000);
    await shot(page, `${SHOT_BASE}/user-management/P08-F04_edit-user-modal_desktop.png`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  } else {
    console.log("No Edit buttons found");
  }

  // Create user modal
  const addBtn = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("+ Add"), button:has-text("Add User")').first();
  try {
    await addBtn.click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    await shot(page, `${SHOT_BASE}/user-management/P08-F03_create-user-modal-open_desktop.png`);
    
    // Try filling
    const nameF = page.locator('input[name="fullName"], input[placeholder*="name"], input[placeholder*="Name"]').first();
    const emailF = page.locator('input[name="email"], input[placeholder*="email"], input[type="email"]').first();
    await nameF.fill("Evidence Test User").catch(() => {});
    await emailF.fill("evidence@test.local").catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, `${SHOT_BASE}/user-management/P08-F03b_create-user-filled_desktop.png`);
    await page.keyboard.press("Escape");
  } catch(e) { console.log("Add btn:", e.message.substring(0, 80)); }

  // Requester pages - use req1
  await loginAndWait(page, "req1@toktikit.local", "Password123!", "/my-tickets");
  await page.goto(BASE_URL + "/my-tickets", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await shot(page, `${SHOT_BASE}/requester/P05-R01_requester-my-tickets_desktop.png`);

  const reqLinks = await page.locator('a[href*="/tickets/"]').all();
  if (reqLinks.length > 0) {
    await reqLinks[0].click();
    await page.waitForTimeout(2500);
    await shot(page, `${SHOT_BASE}/requester/P07-R02_requester-ticket-detail_desktop.png`);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, `${SHOT_BASE}/requester/P07-R03_requester-bottom-resolved-btn_desktop.png`);
  }

  await browser.close();
  console.log("SUCCESS: All final captures done");
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
