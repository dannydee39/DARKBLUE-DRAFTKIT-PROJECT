import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.DRAFTKIT_WEB_URL || "http://127.0.0.1:5180";
const OUT_DIR =
  process.env.PUSH_INJURY_SCREENSHOT_DIR ||
  "C:/Users/Apple/Documents/Github/my-notes/CSE 416/Final Sprint/Push News Injury/artifacts";
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
  await locator.waitFor({ state: "visible", timeout: 8000 });
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
      .fill("Push Injury Production League");
    await button(page, /INITIALIZE DRAFT/i).click();
    await assertVisible(page, "Push news and injury alerts", "board update center");
    await assertVisible(page, "Push connected", "SSE push stream connected");
    await assertVisible(page, "Keeper contracts are pending", "board-first keeper prompt");
    await page.waitForTimeout(700);
    screenshots.push(await take(page, "02-board-update-feed-loaded.png"));

    await page.locator(".search-result", { hasText: "Aaron Judge" }).click();
    await assertVisible(page, "Publishing target", "publishing target visible");
    await assertVisible(page, "Aaron Judge", "Aaron Judge selected");
    await button(page, /Publish Injury Alert/i).click();
    await assertVisible(page, "Aaron Judge", "published Aaron Judge update");
    await assertVisible(page, "HIGH", "high risk feed item");
    await page.waitForTimeout(900);
    screenshots.push(await take(page, "03-injury-alert-published.png"));

    await button(page, /Inspect Updated Player/i).first().click();
    await page
      .locator(".search-result", { hasText: "Aaron Judge" })
      .getByRole("button", { name: "Open Card" })
      .click();
    await assertVisible(page, "LIVE UPDATE", "player-card live update panel");
    await page.waitForTimeout(600);
    screenshots.push(await take(page, "04-updated-player-card.png"));
    await button(page, "Close").click();

    await button(page, /Sample Draft/i).click();
    await assertVisible(page, "10 PICKS SAVED", "sample draft recorded picks");
    await page.waitForTimeout(700);
    screenshots.push(await take(page, "05-sample-draft-with-feed.png"));

    await button(page, "Player Dictionary").click();
    await assertVisible(page, "Player Dictionary", "dictionary tab");
    await assertVisible(page, "Aaron Judge", "updated player retained in dictionary");
    await page.waitForTimeout(700);
    screenshots.push(await take(page, "06-dictionary-update-context.png"));
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
