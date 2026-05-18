import assert from "node:assert/strict";
import {
  buildRosterPositions,
  remapRosterSlotIndex,
} from "../src/utils/helpers.js";
import {
  buildRosterImpact,
  getPositionHelp,
  getScoringHelp,
  summarizeScoring,
} from "../src/utils/settingsHelp.js";

const defaultRoster = {
  C: 2,
  "1B": 1,
  "2B": 1,
  CI: 1,
  "3B": 1,
  SS: 1,
  MI: 1,
  OF: 5,
  P: 9,
  UTIL: 1,
  TAXI: 3,
};

const impact = buildRosterImpact(defaultRoster, 12, 260);
assert.equal(impact.activeSlots, 23, "TAXI should not count as active slot");
assert.equal(impact.taxiSlots, 3, "taxi slot count should be preserved");
assert.equal(impact.leagueActiveSlots, 276, "league active slots should scale by owners");
assert.equal(impact.leagueTaxiSlots, 36, "league taxi slots should scale by owners");
assert.equal(impact.openingMaxBid, 238, "opening max bid should reserve one dollar per remaining slot");

assert.equal(getPositionHelp("CI").label, "Corner Infield");
assert.ok(
  getPositionHelp("TAXI").draftImpact.includes("Does not create"),
  "taxi help should explain board impact",
);
assert.ok(getScoringHelp("OBP").includes("On-base"), "scoring help should describe OBP");

const scoring = summarizeScoring({
  R: true,
  HR: true,
  RBI: true,
  SB: true,
  AVG: true,
  W: true,
  SV: true,
  ERA: true,
  WHIP: true,
  SO: true,
  OBP: false,
});

assert.equal(scoring.totalCount, 10, "expected 10 active scoring categories");
assert.equal(scoring.hittingCount, 5, "expected 5 hitting categories");
assert.equal(scoring.pitchingCount, 5, "expected 5 pitching categories");

const expandedRoster = {
  ...defaultRoster,
  "2B": 2,
  OF: 6,
};
const expandedSlots = buildRosterPositions(expandedRoster);
assert.deepEqual(
  expandedSlots.slice(expandedSlots.indexOf("2B"), expandedSlots.indexOf("2B") + 2),
  ["2B", "2B"],
  "extra 2B slot should join the existing 2B board group",
);
assert.deepEqual(
  expandedSlots.slice(expandedSlots.indexOf("OF"), expandedSlots.indexOf("OF") + 6),
  ["OF", "OF", "OF", "OF", "OF", "OF"],
  "extra OF slot should join the existing OF board group",
);

const originalSlots = buildRosterPositions(defaultRoster);
const oldThreeBaseIndex = originalSlots.indexOf("3B");
const newThreeBaseIndex = remapRosterSlotIndex(
  oldThreeBaseIndex,
  defaultRoster,
  expandedRoster,
);
assert.equal(
  expandedSlots[newThreeBaseIndex],
  "3B",
  "mid-draft roster expansion should preserve existing players under their original slot label",
);

console.log("Settings guardrail tests passed.");
