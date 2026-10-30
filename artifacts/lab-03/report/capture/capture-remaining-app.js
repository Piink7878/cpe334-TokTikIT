const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:5173";
const SHOT_BASE = "artifacts/lab-03/screenshots";

async function shot(page, file, fullPage = true) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: file, fullPage });
  console.log("OK:", file);
}

async function loginAndWait(page, email, pass, expectedPath, timeout = 8000) {
  await page.goto(BASE_URL + "/login", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(pass);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => url.href.includes(expectedPath), { timeout }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log(`Logged in as ${email}, URL: ${page.url()}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  console.log("=== CAPTURING ADMIN CREATE USER ===");
  await loginAndWait(page, "admin@toktikit.local", "Password123!", "/user-management");
  await page.goto(BASE_URL + "/user-management", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const createBtn = page.locator('button:has-text("Create User")').first();
  if (await createBtn.count() > 0) {
    await createBtn.click();
    await page.waitForTimeout(800);
    await shot(page, `${SHOT_BASE}/user-management/P08-F03_create-user-modal-open_desktop.png`, false);

    const modalInputs = page.locator('.modal input');
    if (await modalInputs.count() >= 3) {
      await modalInputs.nth(0).fill("Evidence Test User");
      await modalInputs.nth(1).fill("evidence@test.local");
      await modalInputs.nth(2).fill("Password123!");
      await page.waitForTimeout(400);
      await shot(page, `${SHOT_BASE}/user-management/P08-F03b_create-user-filled_desktop.png`, false);
    }
  }

  console.log("=== CAPTURING REQUESTER SCREENS (req2) ===");
  await loginAndWait(page, "req2@toktikit.local", "Password123!", "/my-tickets");
  await page.goto(BASE_URL + "/my-tickets", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await shot(page, `${SHOT_BASE}/requester/P05-R01_requester-my-tickets_desktop.png`);

  // Requester ticket detail
  const reqTicketLink = await page.locator('a[href*="/tickets/"]').first().getAttribute('href').catch(() => null);
  console.log("First requester ticket href:", reqTicketLink);
  const reqDetailUrl = reqTicketLink ? BASE_URL + reqTicketLink : BASE_URL + "/tickets/2";
  await page.goto(reqDetailUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await shot(page, `${SHOT_BASE}/requester/P07-R02_requester-ticket-detail_desktop.png`);

  // Problem Appears Resolved button in header
  await shot(page, `${SHOT_BASE}/requester/P07-R03_requester-resolved-btn_desktop.png`, false);

  // Create ticket page
  await page.goto(BASE_URL + "/create-ticket", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await shot(page, `${SHOT_BASE}/requester/P07-R04_create-ticket_desktop.png`);

  // Responsive Create Ticket
  const reqTabCtx = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2 });
  const reqTabPage = await reqTabCtx.newPage();
  await loginAndWait(reqTabPage, "req2@toktikit.local", "Password123!", "/create-ticket");
  await reqTabPage.goto(BASE_URL + "/create-ticket", { waitUntil: "networkidle" });
  await reqTabPage.waitForTimeout(1500);
  await shot(reqTabPage, `${SHOT_BASE}/requester/P07-R04_create-ticket_tablet.png`);
  await reqTabCtx.close();

  const reqMobCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const reqMobPage = await reqMobCtx.newPage();
  await loginAndWait(reqMobPage, "req2@toktikit.local", "Password123!", "/create-ticket");
  await reqMobPage.goto(BASE_URL + "/create-ticket", { waitUntil: "networkidle" });
  await reqMobPage.waitForTimeout(1500);
  await shot(reqMobPage, `${SHOT_BASE}/requester/P07-R04_create-ticket_mobile.png`);
  await reqMobCtx.close();

  // OVERFLOW CHECK
  console.log("=== CHECKING HORIZONTAL OVERFLOW ===");
  const testPages = [
    { name: "login", url: BASE_URL + "/login", auth: null },
    { name: "staff-queue", url: BASE_URL + "/staff-queue", auth: "staff2@toktikit.local" },
    { name: "staff-detail", url: BASE_URL + "/staff/tickets/1091", auth: "staff2@toktikit.local" },
    { name: "user-management", url: BASE_URL + "/user-management", auth: "admin@toktikit.local" },
    { name: "my-tickets", url: BASE_URL + "/my-tickets", auth: "req2@toktikit.local" },
    { name: "create-ticket", url: BASE_URL + "/create-ticket", auth: "req2@toktikit.local" }
  ];

  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 820, height: 1180 },
    { name: "mobile", width: 390, height: 844 }
  ];

  const overflowResults = [];

  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const p = await ctx.newPage();

    for (const tp of testPages) {
      if (tp.auth) {
        await loginAndWait(p, tp.auth, "Password123!", new URL(tp.url).pathname);
      }
      await p.goto(tp.url, { waitUntil: "networkidle" });
      await p.waitForTimeout(1000);

      const overflow = await p.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        };
      });

      overflowResults.push({
        page: tp.name,
        viewport: vp.name,
        width: vp.width,
        scrollWidth: overflow.scrollWidth,
        clientWidth: overflow.clientWidth,
        hasHorizontalOverflow: overflow.hasHorizontalOverflow,
        status: overflow.hasHorizontalOverflow ? "FAIL" : "PASS"
      });
      console.log(`[Overflow Check] ${tp.name} (${vp.name}): ${overflow.hasHorizontalOverflow ? "FAIL" : "PASS"}`);
    }
    await ctx.close();
  }

  const overflowPath = "artifacts/lab-03/report/overflow-check.json";
  fs.writeFileSync(overflowPath, JSON.stringify(overflowResults, null, 2), "utf8");
  console.log("Wrote overflow results to:", overflowPath);

  await browser.close();
  console.log("=== COMPLETED ALL UI CAPTURES AND OVERFLOW CHECKS ===");
})().catch(e => {
  console.error("FATAL ERROR:", e);
  process.exit(1);
});
