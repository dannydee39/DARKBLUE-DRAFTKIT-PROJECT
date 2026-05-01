import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.DRAFTKIT_WEB_URL || "http://127.0.0.1:5182";
const OUT_DIR =
  process.env.DRAFT_HISTORY_SCREENSHOT_DIR ||
  "C:/Users/Apple/Documents/Github/my-notes/CSE 416/Final Sprint/Draft History Export/artifacts";
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
  const context = await browser.newContext({
    viewport: VIEWPORT,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const screenshots = [];

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    screenshots.push(await take(page, "01-create-draft-screen.png"));

    await page
      .getByPlaceholder("e.g. Valuation Test League")
      .fill("Draft History Export League");
    await button(page, /INITIALIZE DRAFT/i).click();
    await assertVisible(page, "Keeper contracts are pending", "board-first keeper prompt");
    screenshots.push(await take(page, "02-board-first-impression.png"));

    await button(page, /Set Up Keepers/i).click();
    await assertVisible(page, "PRE-DRAFT KEEPER INITIALIZATION", "keeper setup screen");
    await page.getByPlaceholder("Search player name").fill("Aaron Judge");
    await assertVisible(page, "Aaron Judge", "keeper player resolved");
    await page.getByPlaceholder("e.g. 25").fill("31");
    await button(page, /^Add Keeper$/i).click();
    await assertVisible(page, "Aaron Judge", "keeper saved");
    screenshots.push(await take(page, "03-keeper-event-created.png"));

    await button(page, /Return to Board/i).click();
    await button(page, /Sample Draft/i).click();
    await assertVisible(page, "PICKS SAVED", "sample auction picks saved");
    screenshots.push(await take(page, "04-auction-events-created.png"));

    await button(page, /Taxi Squad/i).click();
    await assertVisible(page, "TAXI SQUAD MODE", "taxi setup screen");
    await page.getByPlaceholder("Search available players for taxi pick").fill("Mike");
    await page.locator(".taxi-search-result").first().click();
    await page.locator(".taxi-pick").first().waitFor({ state: "visible", timeout: 10000 });
    screenshots.push(await take(page, "05-taxi-event-created.png"));

    await button(page, /Draft History/i).click();
    await assertVisible(page, "Ordered Draft History", "draft history tab");
    await assertVisible(page, "Auction Pick", "auction rows visible");
    await assertVisible(page, "Keeper", "keeper rows visible");
    await assertVisible(page, "Taxi Squad", "taxi rows visible");
    screenshots.push(await take(page, "06-ordered-history-table.png"));

    await button(page, /Keepers/i).click();
    await assertVisible(page, "Aaron Judge", "keeper filter row");
    screenshots.push(await take(page, "07-history-filter-keepers.png"));

    await button(page, /All Events/i).click();
    const downloadPromise = page.waitForEvent("download");
    await button(page, /Export CSV/i).click();
    const download = await downloadPromise;
    const csvPath = path.join(OUT_DIR, "draft-history-export.csv");
    await download.saveAs(csvPath);
    const csvText = fs.readFileSync(csvPath, "utf8");
    if (
      !csvText.includes("Event #") ||
      !csvText.includes("Aaron Judge") ||
      !csvText.includes("Auction Pick") ||
      !csvText.includes("Taxi Squad")
    ) {
      throw new Error("CSV export validation failed");
    }
    console.log(`downloaded: ${csvPath}`);
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
