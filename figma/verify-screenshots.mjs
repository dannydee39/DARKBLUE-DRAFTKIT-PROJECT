import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("./screenshots");
const required = [
  "screen1_create_draft.png",
  "screen2_keeper_setup.png",
  "screen3_draft_board.png",
  "screen4_bid_modal.png",
  "screen5_player_dictionary.png",
  "screen6_rosters.png",
  "screen7_league_settings.png",
  "screen8_keeper_tab.png",
  "screen9_api_sandbox.png",
  "screen10_api_response.png",
];

const missing = required.filter((file) => !fs.existsSync(path.join(dir, file)));
if (missing.length > 0) {
  console.error("Missing screenshots:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("All 10 screenshots are present in", dir);
