import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.DRAFTKIT_WEB_URL || "http://127.0.0.1:5182";
const OUT_DIR =
  process.env.DEPTH_RANKINGS_SCREENSHOT_DIR ||
  "C:/Users/Apple/Documents/Github/my-notes/CSE 416/Final Sprint/Depth Charts and Rankings/artifacts";
const VIEWPORT = { width: 1440, height: 920 };

function button(page, name) {
  return page.getByRole("button", { name });
}

async function take(page, name) {
  const filePath = path.join(OUT_DIR, name);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

function readPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  const isPng =
    buffer.length > 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  if (!isPng) return null;

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bytes: buffer.length,
  };
}

async function assertVisible(page, text, label) {
  const locator = page.getByText(text, { exact: false }).first();
  await locator.waitFor({ state: "visible", timeout: 10000 });
  console.log(`visible: ${label}`);
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const screenshots = [];

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    screenshots.push(await take(page, "01-create-draft-screen.png"));

    await page
      .getByPlaceholder("e.g. Valuation Test League")
      .fill("Depth Rankings Sprint 6");
    await button(page, /INITIALIZE DRAFT/i).click();
    await assertVisible(page, "Team strength rankings", "ranked banner on board");
    screenshots.push(await take(page, "02-board-first-ranked-banner.png"));

    await button(page, /Sample Draft/i).click();
    await assertVisible(page, "PICKS SAVED", "sample draft saved");
    await assertVisible(page, "leads with", "rankings recalculated after picks");
    screenshots.push(await take(page, "03-sample-draft-rankings-updated.png"));

    await button(page, /Open Rankings/i).click();
    await assertVisible(page, "MLB Depth Charts", "depth chart tab");
    await assertVisible(page, "Owner Strength", "owner rankings table");
    await assertVisible(page, "mlb-stats-api", "live MLB roster source");
    screenshots.push(await take(page, "04-depth-rankings-overview.png"));

    await page.locator("select").first().selectOption("NYY");
    await page.locator("select").nth(1).selectOption("OF");
    await page.getByPlaceholder("Player or owner").fill("Aaron");
    await assertVisible(page, "Aaron Judge", "NYY OF depth row");
    await assertVisible(page, "HIGH", "risk context visible");
    await assertVisible(page, "Active", "MLB active roster badge visible");
    screenshots.push(await take(page, "05-yankees-outfield-risk-depth.png"));

    await button(page, /^Money$/i).click();
    await assertVisible(page, "Current sort: Budget", "sortable team money comparison");
    screenshots.push(await take(page, "06-owner-rankings-money-sort.png"));
  } finally {
    await browser.close();
  }

  const results = screenshots.map((filePath) => {
    const stat = fs.statSync(filePath);
    const size = readPngSize(filePath);
    if (!size || stat.size < 10000 || size.width < 400 || size.height < 300) {
      throw new Error(`Screenshot validation failed for ${filePath}`);
    }
    return { filePath, ...size };
  });

  console.log(JSON.stringify({ outDir: OUT_DIR, screenshots: results }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
