import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.DRAFTKIT_WEB_URL || "http://127.0.0.1:5182";
const OUT_DIR =
  process.env.SETTINGS_GUARDRAILS_SCREENSHOT_DIR ||
  "C:/Users/Apple/Documents/Github/my-notes/CSE 416/Final Sprint/League Settings Guardrails/artifacts";
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
    await page
      .getByPlaceholder("e.g. Valuation Test League")
      .fill("Settings Guardrails Sprint 6");
    screenshots.push(await take(page, "01-create-draft-screen.png"));

    await button(page, /INITIALIZE DRAFT/i).click();
    await assertVisible(page, "Keeper contracts are pending", "board-first screen");
    await button(page, /League Settings/i).click();
    await assertVisible(page, "Active Slots", "roster impact summary");
    await assertVisible(page, "Opening Max Bid", "max-bid impact");
    await assertVisible(page, "Active Cats", "scoring summary");
    screenshots.push(await take(page, "02-settings-impact-summary.png"));

    await page.getByText("How roster slots affect the board").click();
    await assertVisible(page, "Taxi slots stay out of the main auction board", "roster help expanded");
    screenshots.push(await take(page, "03-roster-help-expanded.png"));

    await button(page, /Draft Board/i).click();
    await button(page, /Sample Draft/i).click();
    await assertVisible(page, "PICKS SAVED", "sample picks recorded");
    await button(page, /League Settings/i).click();
    await assertVisible(page, "Safety lock active", "mid-draft safety lock");
    await assertVisible(page, "draft started", "locked field reason");
    screenshots.push(await take(page, "04-mid-draft-lock-guardrails.png"));

    await button(page, /Commissioner Override/i).click();
    await assertVisible(page, "Commissioner Override", "commissioner override selected");
    screenshots.push(await take(page, "05-commissioner-override-context.png"));
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
