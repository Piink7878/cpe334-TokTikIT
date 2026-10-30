const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const SHA = "b3e46a220ff604b78dbbc3c0b683a94fed26f4b6";
const REPO_URL = "https://github.com/Piink7878/cpe334-TokTikIT";

async function shot(page, file, fullPage = false) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: file, fullPage });
  console.log("OK:", file);
}

async function captureSlices(page, url, filePrefix, numSlices = 2) {
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);

  // Measure total height
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  console.log(`Total height for ${url}: ${totalHeight}px`);
  
  const viewportHeight = 850;
  const step = Math.max(viewportHeight, Math.floor((totalHeight - viewportHeight) / (numSlices - 1 || 1)));

  for (let i = 0; i < numSlices; i++) {
    const scrollY = i * step;
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(600);
    const targetFile = `${filePrefix}_part${i + 1}of${numSlices}.png`;
    await shot(page, targetFile, false);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  // 1. Part 1 Git Workflow
  console.log("=== CAPTURING PART 1: GIT WORKFLOW ===");
  if (!fs.existsSync("artifacts/lab-03/screenshots/git-workflow/P01-F01_commits-history_desktop.png")) {
    await page.goto(`${REPO_URL}/commits/main`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    await shot(page, "artifacts/lab-03/screenshots/git-workflow/P01-F01_commits-history_desktop.png", false);
  }

  if (!fs.existsSync("artifacts/lab-03/screenshots/git-workflow/P01-F02_pr-table_desktop.png")) {
    await page.goto(`${REPO_URL}/pulls?q=is%3Apr+is%3Amerged`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    await shot(page, "artifacts/lab-03/screenshots/git-workflow/P01-F02_pr-table_desktop.png", false);
  }

  if (!fs.existsSync("artifacts/lab-03/screenshots/git-workflow/P01-F04_reviewer-md_desktop.png")) {
    await page.goto(`${REPO_URL}/blob/${SHA}/docs/lab-03/reviewer.md`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    await shot(page, "artifacts/lab-03/screenshots/git-workflow/P01-F04_reviewer-md_desktop.png", false);
  }

  await page.goto(`${REPO_URL}/blob/${SHA}/README.md`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  await shot(page, "artifacts/lab-03/screenshots/git-workflow/P01-F05_readme-main_desktop.png", false);

  // 2. Part 2 Spec DD
  console.log("=== CAPTURING PART 2: SPEC DD ===");
  await captureSlices(
    page,
    `${REPO_URL}/blob/${SHA}/docs/lab-03/specification.md`,
    "artifacts/lab-03/screenshots/spec-dd/P02-F01_specification",
    3
  );

  // 3. Part 3 Test DD
  console.log("=== CAPTURING PART 3: TEST DD ===");
  await captureSlices(
    page,
    `${REPO_URL}/blob/${SHA}/docs/lab-03/tests.md`,
    "artifacts/lab-03/screenshots/test-dd/P03-F01_tests-matrix",
    2
  );

  // 4. Part 4 AI Use
  console.log("=== CAPTURING PART 4: AI USE ===");
  await captureSlices(
    page,
    `${REPO_URL}/blob/${SHA}/docs/lab-03/ai-use.md`,
    "artifacts/lab-03/screenshots/ai-use/P04-F01_ai-use",
    2
  );

  // 5. Part 9 UI Spec
  console.log("=== CAPTURING PART 9: UI SPEC ===");
  await captureSlices(
    page,
    `${REPO_URL}/blob/${SHA}/docs/lab-03/ui-spec.md`,
    "artifacts/lab-03/screenshots/zen-green-responsive/P09-F01_ui-spec",
    3
  );

  await browser.close();
  console.log("=== ALL GITHUB DOC CAPTURES COMPLETED ===");
})().catch(e => {
  console.error("FATAL ERROR IN GITHUB DOC CAPTURES:", e);
  process.exit(1);
});
