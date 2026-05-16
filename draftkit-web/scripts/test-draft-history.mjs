import assert from "node:assert/strict";
import {
  appendDraftHistoryEvent,
  buildDraftHistoryRows,
  createDraftHistoryCsv,
  makeDraftHistoryEvent,
} from "../src/utils/draftHistory.js";

const players = [
  {
    id: 1,
    name: "Aaron Judge",
    team: "NYY",
    pos: ["OF"],
    baseValue: 42,
  },
  {
    id: 2,
    name: "Bobby Witt Jr.",
    team: "KC",
    pos: ["SS"],
    baseValue: 39,
  },
];

const owner = {
  id: 1,
  name: "Owner 1",
  budget_remaining: 260,
  roster: [],
  taxiSquad: [],
};

let league = {
  name: "History Test League",
  season: "2026",
  owners: 2,
  budget: 260,
  roster: { OF: 1, SS: 1, TAXI: 1 },
  draftHistory: [],
  teams: [owner],
};

league = {
  ...league,
  draftHistory: appendDraftHistoryEvent(
    league,
    makeDraftHistoryEvent({
      type: "auction",
      player: players[0],
      team: owner,
      rosterSlot: "OF",
      price: 35,
      timestamp: 1000,
      prePickValue: 42,
      remainingBudgetAfter: 225,
    }),
  ),
};

league = {
  ...league,
  draftHistory: appendDraftHistoryEvent(
    league,
    makeDraftHistoryEvent({
      type: "taxi",
      player: players[1],
      team: owner,
      rosterSlot: "TAXI 1",
      price: 1,
      timestamp: 1001,
      prePickValue: 39,
      remainingBudgetAfter: 225,
      note: "Taxi squad",
    }),
  ),
};

const rows = buildDraftHistoryRows(league, players, ["OF", "SS"]);

assert.equal(rows.length, 2);
assert.equal(rows[0].eventNumber, 1);
assert.equal(rows[0].typeLabel, "Auction Pick");
assert.equal(rows[0].playerName, "Aaron Judge");
assert.equal(rows[0].valueDelta, -7);
assert.equal(rows[1].typeLabel, "Taxi Squad");
assert.equal(rows[1].rosterSlot, "TAXI 1");

const csv = createDraftHistoryCsv(rows, league);
assert.match(csv, /"Scoring Format"/);
assert.match(csv, /"Roster Slots","OF:1, SS:1, TAXI:1"/);
assert.match(csv, /"Event #","Type","Timestamp","Timestamp ISO","Player"/);
assert.match(csv, /"1970-01-01T00:00:01.000Z"/);
assert.match(csv, /"1","Auction Pick"/);
assert.match(csv, /"Aaron Judge"/);
assert.match(csv, /"Bobby Witt Jr\."/);
assert.match(csv, /"-\$38"/);

const fallbackRows = buildDraftHistoryRows(
  {
    ...league,
    draftHistory: [],
    teams: [
      {
        ...owner,
        budget_remaining: 225,
        roster: [
          {
            playerId: 1,
            name: "Aaron Judge",
            price: 35,
            pos: ["OF"],
            slotIndex: 0,
            draftedPos: "OF",
            draftedAt: 1000,
          },
        ],
        taxiSquad: [
          {
            playerId: 2,
            name: "Bobby Witt Jr.",
            price: 1,
            pos: ["SS"],
            draftedAt: 1001,
          },
        ],
      },
    ],
  },
  players,
  ["OF", "SS"],
);

assert.equal(fallbackRows.length, 2);
assert.equal(fallbackRows[0].type, "auction");
assert.equal(fallbackRows[1].type, "taxi");

console.log("draft history utility tests passed");
