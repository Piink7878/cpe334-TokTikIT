const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const composites = [
  {
    name: "P09-F02_login-composite.png",
    title: "Login Screen (Desktop | Tablet | Mobile)",
    d: "artifacts/lab-03/screenshots/authentication/P05-F01_login-empty_desktop.png",
    t: "artifacts/lab-03/screenshots/authentication/P05-F01_login-empty_tablet.png",
    m: "artifacts/lab-03/screenshots/authentication/P05-F01_login-empty_mobile.png"
  },
  {
    name: "P09-F03_staff-queue-composite.png",
    title: "Staff Ticket Queue (Desktop | Tablet | Mobile)",
    d: "artifacts/lab-03/screenshots/staff-queue/P06-F01_staff-queue-full_desktop.png",
    t: "artifacts/lab-03/screenshots/staff-queue/tablet.png",
    m: "artifacts/lab-03/screenshots/staff-queue/mobile.png"
  },
  {
    name: "P09-F04_staff-detail-composite.png",
    title: "Staff Ticket Detail (Desktop | Tablet | Mobile)",
    d: "artifacts/lab-03/screenshots/staff-ticket-detail/P07-F01_staff-detail-full_desktop.png",
    t: "artifacts/lab-03/screenshots/staff-ticket-detail/P07-F01_staff-detail-overview_tablet.png",
    m: "artifacts/lab-03/screenshots/staff-ticket-detail/P07-F01_staff-detail-overview_mobile.png"
  },
  {
    name: "P09-F05_user-management-composite.png",
    title: "Admin User Management (Desktop | Tablet | Mobile)",
    d: "artifacts/lab-03/screenshots/user-management/P08-F01_user-list-default_desktop.png",
    t: "artifacts/lab-03/screenshots/user-management/tablet.png",
    m: "artifacts/lab-03/screenshots/user-management/mobile.png"
  },
  {
    name: "P09-F06_create-ticket-composite.png",
    title: "Requester Create Ticket (Desktop | Tablet | Mobile)",
    d: "artifacts/lab-03/screenshots/requester/P07-R04_create-ticket_desktop.png",
    t: "artifacts/lab-03/screenshots/requester/P07-R04_create-ticket_tablet.png",
    m: "artifacts/lab-03/screenshots/requester/P07-R04_create-ticket_mobile.png"
  }
];

function toBase64(file) {
  if (!fs.existsSync(file)) return null;
  const b = fs.readFileSync(file);
  return `data:image/png;base64,${b.toString('base64')}`;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1.5 });

  for (const c of composites) {
    const dUri = toBase64(c.d);
    const tUri = toBase64(c.t);
    const mUri = toBase64(c.m);

    if (!dUri || !tUri || !mUri) {
      console.log(`Skipping ${c.name}, missing input image`);
      continue;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #0E2417; padding: 24px; color: #FFFFFF; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h2 { font-size: 20px; font-weight: 600; color: #E8F5E9; }
          .grid { display: flex; gap: 20px; align-items: flex-start; justify-content: center; }
          .card { background: #1A3B28; border-radius: 8px; padding: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 1px solid #2E5C3E; }
          .card h4 { font-size: 14px; margin-bottom: 8px; color: #A5D6A7; text-align: center; }
          .desktop-wrap { width: 900px; }
          .tablet-wrap { width: 500px; }
          .mobile-wrap { width: 280px; }
          img { width: 100%; border-radius: 4px; display: block; border: 1px solid #3B7A54; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${c.title}</h2>
        </div>
        <div class="grid">
          <div class="card desktop-wrap">
            <h4>Desktop (1440 × 900)</h4>
            <img src="${dUri}" />
          </div>
          <div class="card tablet-wrap">
            <h4>Tablet (820 × 1180)</h4>
            <img src="${tUri}" />
          </div>
          <div class="card mobile-wrap">
            <h4>Mobile (390 × 844)</h4>
            <img src="${mUri}" />
          </div>
        </div>
      </body>
      </html>
    `;

    await page.setContent(html);
    await page.waitForTimeout(500);

    const outPath = path.join("artifacts/lab-03/screenshots/zen-green-responsive", c.name);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log("Created composite:", outPath);
  }

  await browser.close();
  console.log("All composites generated successfully!");
})().catch(e => {
  console.error(e);
  process.exit(1);
});
