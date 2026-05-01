import assert from "node:assert/strict";
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

console.log("Settings guardrail tests passed.");
