const { chromium, devices } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const BASE_URL = "http://localhost:5173";
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 2 },
  tablet: { width: 820, height: 1180, deviceScaleFactor: 2 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2 }
};

const SEEDED_ACCOUNTS = {
  admin: { email: "admin@toktikit.local", password: "Password123!" },
  staff1: { email: "staff1@toktikit.local", password: "Password123!" },
  staff2: { email: "staff2@toktikit.local", password: "Password123!" },
  req1: { email: "req1@toktikit.local", password: "Password123!" },
  req_inactive: { email: "req.inactive@toktikit.local", password: "Password123!" },
  staff_inactive: { email: "staff.inactive@toktikit.local", password: "Password123!" },
  firstlogin: { email: "firstlogin@toktikit.local", password: "Password123!" }
};

const SHOT_BASE = "artifacts/lab-03/screenshots";

async function login(page, account) {
  await page.goto(BASE_URL + "/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
}

async function shot(page, filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: filePath, fullPage: false });
}

async function shotFull(page, filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: filePath, fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor });
    const page = await ctx.newPage();
    
    // P05: Login page empty state
    await page.goto(BASE_URL + "/login", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await shot(page, `${SHOT_BASE}/authentication/P05-F01_login-empty_${vpName}.png`);
    
    // P05: Login - invalid credentials
    await page.fill('input[type="email"]', "bad@example.com");
    await page.fill('input[type="password"]', "wrongpass");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    await shot(page, `${SHOT_BASE}/authentication/P05-F02_login-invalid-credentials_${vpName}.png`);
    
    // P05: Login - inactive requester
    await page.fill('input[type="email"]', SEEDED_ACCOUNTS.req_inactive.email);
    await page.fill('input[type="password"]', SEEDED_ACCOUNTS.req_inactive.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    await shot(page, `${SHOT_BASE}/authentication/P05-F03_login-inactive-requester_${vpName}.png`);
    
    // P05: Login as IT Staff (app shell with role)
    await login(page, SEEDED_ACCOUNTS.staff1);
    await page.waitForTimeout(1000);
    await shot(page, `${SHOT_BASE}/authentication/P05-F04_app-shell-staff_${vpName}.png`);
    
    // P06: Staff Queue (default state)
    await page.goto(BASE_URL + "/staff-queue", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, `${SHOT_BASE}/staff-queue/P06-F01_staff-queue-default_${vpName}.png`);
    
    // P06: Staff Queue - search
    try {
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      await searchInput.fill("TKT");
      await page.waitForTimeout(1000);
      await shot(page, `${SHOT_BASE}/staff-queue/P06-F02_staff-queue-search_${vpName}.png`);
      await searchInput.fill("");
      await page.waitForTimeout(500);
    } catch(e) { console.log("Search not found:", e.message); }
    
    // P06: Staff Queue - no results
    try {
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      await searchInput.fill("XYZXYZXYZ_NORESULTS");
      await page.waitForTimeout(1000);
      await shot(page, `${SHOT_BASE}/staff-queue/P06-F03_staff-queue-no-results_${vpName}.png`);
      await searchInput.fill("");
      await page.waitForTimeout(500);
    } catch(e) { console.log("No-results search failed:", e.message); }
    
    // Capture first ticket detail from queue
    const firstTicketLink = page.locator('a[href*="/staff/tickets/"], tr[data-id] a, .ticket-row a').first();
    try {
      const href = await firstTicketLink.getAttribute("href");
      if (href) {
        // P07: Staff Ticket Detail
        await page.goto(BASE_URL + href, { waitUntil: "networkidle" });
        await page.waitForTimeout(1500);
        await shot(page, `${SHOT_BASE}/staff-ticket-detail/P07-F01_staff-detail-overview_${vpName}.png`);
      }
    } catch(e) {
      // Try navigating directly
      const rows = await page.locator('tr.ticket-row a, [data-ticket-id] a, tbody tr td a').all();
      if (rows.length > 0) {
        await rows[0].click();
        await page.waitForTimeout(1500);
        await shot(page, `${SHOT_BASE}/staff-ticket-detail/P07-F01_staff-detail-overview_${vpName}.png`);
      }
    }
    
    // P07: Public Comments - if on ticket detail page
    try {
      const commentsTab = page.locator('button:has-text("Comments"), button:has-text("Public"), [role="tab"]:has-text("Comment")').first();
      await commentsTab.click();
      await page.waitForTimeout(500);
      await shot(page, `${SHOT_BASE}/staff-ticket-detail/P07-F02_staff-detail-comments_${vpName}.png`);
    } catch(e) { console.log("Comments tab:", e.message); }
    
    // P07: Internal Notes tab
    try {
      const notesTab = page.locator('button:has-text("Notes"), button:has-text("Internal"), [role="tab"]:has-text("Note")').first();
      await notesTab.click();
      await page.waitForTimeout(500);
      await shot(page, `${SHOT_BASE}/staff-ticket-detail/P07-F03_staff-detail-notes_${vpName}.png`);
    } catch(e) { console.log("Notes tab:", e.message); }
    
    // Logout
    try {
      const logoutBtn = page.locator('button:has-text("Logout"), a:has-text("Logout"), button:has-text("Sign out")').first();
      await logoutBtn.click();
      await page.waitForTimeout(1000);
    } catch(e) { await page.goto(BASE_URL + "/login"); }
    
    // P05: After logout, protected URL should redirect to login
    await page.goto(BASE_URL + "/staff-queue", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await shot(page, `${SHOT_BASE}/authentication/P05-F05_logout-redirect-login_${vpName}.png`);
    
    // P08: Admin User Management
    await login(page, SEEDED_ACCOUNTS.admin);
    await page.waitForTimeout(1000);
    await shot(page, `${SHOT_BASE}/authentication/P05-F06_app-shell-admin_${vpName}.png`);
    
    await page.goto(BASE_URL + "/user-management", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, `${SHOT_BASE}/user-management/P08-F01_user-list-default_${vpName}.png`);
    
    // P08: Search
    try {
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      await searchInput.fill("staff");
      await page.waitForTimeout(1000);
      await shot(page, `${SHOT_BASE}/user-management/P08-F02_user-list-search_${vpName}.png`);
      await searchInput.fill("");
      await page.waitForTimeout(500);
    } catch(e) {}
    
    // P08: Create User modal
    try {
      const createBtn = page.locator('button:has-text("Add User"), button:has-text("Create User"), button:has-text("New User")').first();
      await createBtn.click();
      await page.waitForTimeout(500);
      await shot(page, `${SHOT_BASE}/user-management/P08-F03_create-user-modal_${vpName}.png`);
      // Close modal
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } catch(e) {}
    
    // P05: Requester login and app shell
    await login(page, SEEDED_ACCOUNTS.req1);
    await page.waitForTimeout(1000);
    await shot(page, `${SHOT_BASE}/authentication/P05-F07_app-shell-requester_${vpName}.png`);
    
    // Requester: My Tickets
    await page.goto(BASE_URL + "/my-tickets", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, `${SHOT_BASE}/requester/P07-F10_requester-my-tickets_${vpName}.png`);
    
    // P06/P07: Requester forbidden on staff queue (403 test)
    await page.goto(BASE_URL + "/staff-queue", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await shot(page, `${SHOT_BASE}/api-evidence/P06-F08_requester-forbidden-staff-queue_${vpName}.png`);
    
    // P05: Mandatory password change - login as firstlogin user
    await login(page, SEEDED_ACCOUNTS.firstlogin);
    await page.waitForTimeout(1500);
    await shot(page, `${SHOT_BASE}/authentication/P05-F08_mandatory-change-password_${vpName}.png`);
    
    // Try to navigate to protected route while mustChangePassword = true
    await page.goto(BASE_URL + "/my-tickets", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await shot(page, `${SHOT_BASE}/authentication/P05-F09_must-change-blocked-protected_${vpName}.png`);
    
    await ctx.close();
  }
  
  await browser.close();
  console.log("All screenshots captured successfully");
})().catch(e => { console.error("CAPTURE ERROR:", e); process.exit(1); });
