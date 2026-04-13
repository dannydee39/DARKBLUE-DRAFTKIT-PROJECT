import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = "http://localhost:5173";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, "..", "screenshots");
const VIEWPORT = { width: 1440, height: 900 };

function textButton(page, label) {
  return page.getByRole("button", { name: label });
}

async function take(page, name) {
  await page.screenshot({
    path: path.join(OUT_DIR, name),
    fullPage: true,
  });
  console.log(`saved ${name}`);
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await take(page, "screen1_create_draft.png");

  await page.fill('input[placeholder="My Fantasy League"]', "Valuation Test League");
  await page.fill('input[placeholder="2025"]', "2025");
  await page.fill('input[placeholder="12"]', "12");
  await page.fill('input[placeholder="260"]', "260");
  await textButton(page, /INITIALIZE DRAFT/).click();
  await page.waitForTimeout(1000);
  await take(page, "screen2_keeper_setup.png");

  await textButton(page, /FINALIZE KEEPERS & START DRAFT/i).click();
  await page.waitForTimeout(1000);
  await take(page, "screen3_draft_board.png");

  await page.getByRole("button", { name: /RECORD SALE|PLACE BID|BID NOW/i }).first().click();
  await page.waitForTimeout(500);
  await take(page, "screen4_bid_modal.png");

  const cancelButton = page.getByRole("button", { name: "Cancel" }).last();
  const cancelVisible = await cancelButton.isVisible().catch(() => false);
  if (cancelVisible) {
    await cancelButton.click({ force: true });
  } else {
    await page.keyboard.press("Escape");
  }
  await page.waitForTimeout(300);

  await textButton(page, "Player Dictionary").click();
  await page.waitForTimeout(500);
  await take(page, "screen5_player_dictionary.png");

  await textButton(page, "Rosters").click();
  await page.waitForTimeout(500);
  await take(page, "screen6_rosters.png");

  await textButton(page, "League Settings").click();
  await page.waitForTimeout(500);
  await take(page, "screen7_league_settings.png");

  await textButton(page, "Keeper Setup").click();
  await page.waitForTimeout(500);
  await take(page, "screen8_keeper_tab.png");

  await textButton(page, "Taxi Squad").click();
  await page.waitForTimeout(500);
  await take(page, "screen9_taxi_squad.png");

  await textButton(page, "API Sandbox").click();
  await page.waitForTimeout(500);
  await take(page, "screen10_api_sandbox.png");

  await textButton(page, /SEND REQUEST/i).click();
  await page.waitForTimeout(500);
  await take(page, "screen11_api_response.png");

  await browser.close();
  console.log(`done: ${OUT_DIR}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
