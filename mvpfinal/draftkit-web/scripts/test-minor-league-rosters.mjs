import assert from "node:assert/strict";
import {
  cloneLeagueConfig,
  countMinorLeagueEntries,
  hasDraftStarted,
  hydratePlayersFromLeague,
} from "../src/utils/draftSessions.js";
import {
  appendDraftHistoryEvent,
  buildDraftHistoryRows,
  makeDraftHistoryEvent,
} from "../src/utils/draftHistory.js";

const players = [
  {
    id: 101,
    name: "Prospect One",
    team: "NYY",
    league: "AL",
    pos: ["OF"],
    baseValue: 12,
  },
  {
    id: 102,
    name: "Prospect Two",
    team: "LAD",
    league: "NL",
    pos: ["SS"],
    baseValue: 10,
  },
];

let league = cloneLeagueConfig({
  name: "Minor League Test",
  season: "2026",
  owners: 2,
  budget: 260,
  roster: { OF: 1, SS: 1, TAXI: 1 },
  teams: [
    {
      id: 1,
      name: "Owner 1",
      budget_remaining: 260,
      roster: [],
      taxiSquad: [],
      minorLeague: [
        {
          playerId: 101,
          name: "Prospect One",
          pos: ["OF"],
          draftedAt: 1000,
        },
      ],
    },
    {
      id: 2,
      name: "Owner 2",
      budget_remaining: 260,
      roster: [],
      taxiSquad: [],
      minorLeague: [],
    },
  ],
});

assert.equal(countMinorLeagueEntries(league), 1);
assert.equal(hasDraftStarted(league), true);
assert.equal(league.teams[0].minorLeague[0].name, "Prospect One");

const hydrated = hydratePlayersFromLeague(players, league);
const protectedPlayer = hydrated.find((player) => player.id === 101);
const availablePlayer = hydrated.find((player) => player.id === 102);

assert.equal(protectedPlayer.drafted, true);
assert.equal(protectedPlayer.draftedBy, 1);
assert.equal(protectedPlayer.minorLeague, true);
assert.equal(protectedPlayer.taxi, false);
assert.equal(availablePlayer.drafted, false);

league = {
  ...league,
  draftHistory: appendDraftHistoryEvent(
    league,
    makeDraftHistoryEvent({
      type: "minor_league",
      player: players[0],
      team: league.teams[0],
      rosterSlot: "MiLB 1",
      price: 0,
      timestamp: 1000,
      prePickValue: 12,
      remainingBudgetAfter: 260,
      note: "Minor league/prospect roster",
    }),
  ),
};

league = {
  ...league,
  draftHistory: appendDraftHistoryEvent(
    league,
    makeDraftHistoryEvent({
      type: "minor_league_transfer",
      player: players[0],
      team: league.teams[1],
      rosterSlot: "MiLB",
      price: 0,
      timestamp: 1001,
      prePickValue: 12,
      remainingBudgetAfter: 260,
      note: "Transferred from Owner 1",
    }),
  ),
};

const rows = buildDraftHistoryRows(league, players, ["OF", "SS"]);
assert.equal(rows.length, 2);
assert.equal(rows[0].typeLabel, "Minor League");
assert.equal(rows[1].typeLabel, "Minor League Transfer");
assert.equal(rows[1].fantasyOwner, "Owner 2");
assert.equal(rows[1].note, "Transferred from Owner 1");

console.log("minor league roster utility tests passed");
