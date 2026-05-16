import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildMlbDepthCharts,
  buildOwnerRankings,
  sortOwnerRankings,
} from "../src/utils/teamInsights.js";
import { buildDraftState } from "../src/utils/helpers.js";

const players = JSON.parse(
  await readFile(new URL("../../valuation-api/data/players.json", import.meta.url), "utf8"),
);

const league = {
  name: "Insight Test",
  owners: 3,
  budget: 260,
  roster: {
    C: 1,
    "1B": 1,
    "2B": 1,
    "3B": 1,
    SS: 1,
    OF: 2,
    P: 2,
    UTIL: 1,
    TAXI: 2,
  },
  teams: [
    {
      id: 1,
      name: "Alpha",
      budget_remaining: 173,
      roster: [
        { playerId: 1, name: "Shohei Ohtani", price: 65, draftedPos: "UTIL" },
        { playerId: 2, name: "Aaron Judge", price: 52, draftedPos: "OF" },
      ],
      taxiSquad: [{ playerId: 20, name: players[19]?.name || "Taxi Player", price: 1 }],
    },
    {
      id: 2,
      name: "Bravo",
      budget_remaining: 190,
      roster: [{ playerId: 3, name: "Juan Soto", price: 72, draftedPos: "OF" }],
      taxiSquad: [],
    },
    {
      id: 3,
      name: "Charlie",
      budget_remaining: 260,
      roster: [],
      taxiSquad: [],
    },
  ],
};

const playerPool = players.map((player) =>
  player.id === 2
    ? {
        ...player,
        drafted: true,
        draftedBy: 1,
        risk_level: "HIGH",
        injury_status: "Questionable",
        news_headline: "Aaron Judge moved to high injury risk",
      }
    : player,
);

const liveDepthData = {
  source: "mlb-stats-api-active-roster",
  generated_at: "2026-04-30T22:00:00.000Z",
  teams: [
    {
      team: "NYY",
      mlbTeamId: 147,
      teamName: "New York Yankees",
      roster: [
        {
          mlbId: 592450,
          name: "Aaron Judge",
          team: "NYY",
          active: true,
          statusCode: "A",
          statusDescription: "Active",
          positionCode: "OF",
          positionName: "Outfielder",
        },
      ],
    },
  ],
};

const rosterPositions = [
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "OF",
  "OF",
  "P",
  "P",
  "UTIL",
];
const depthCharts = buildMlbDepthCharts(playerPool, league, liveDepthData);
const rankings = buildOwnerRankings(league, playerPool, rosterPositions);
const draftState = buildDraftState(league, playerPool, depthCharts);

assert.ok(depthCharts.teams.length >= 20, "expected MLB teams to be grouped");
assert.ok(depthCharts.positionOptions.includes("OF"), "expected OF depth option");

const yankees = depthCharts.teams.find((team) => team.team === "NYY");
assert.ok(yankees, "expected NYY depth chart");
const yankeesOutfield = yankees.positions.find((position) => position.position === "OF");
assert.ok(yankeesOutfield?.players.length > 0, "expected NYY OF players");
assert.equal(yankeesOutfield.players[0].depthRank, 1, "expected rank assignment");
assert.ok(
  yankeesOutfield.players.some(
    (player) => player.name === "Aaron Judge" && player.riskLevel === "HIGH",
  ),
  "expected pushed risk to appear in depth rows",
);
assert.ok(
  yankeesOutfield.players.some(
    (player) =>
      player.name === "Aaron Judge" &&
      player.officialRoster?.source === "mlb-stats-api-active-roster" &&
      player.officialRoster?.active === true,
  ),
  "expected MLB active roster enrichment to appear in depth rows",
);

const judge = yankeesOutfield.players.find((player) => player.name === "Aaron Judge");
assert.ok(judge, "expected Aaron Judge in NYY OF depth chart");
const judgeDepthContext = draftState.depth_chart_context[judge.id];
assert.equal(
  judgeDepthContext.depth_rank,
  judge.depthRank,
  "valuation payload should use the depth chart rank",
);
assert.equal(
  judgeDepthContext.depth_position,
  "OF",
  "valuation payload should include the depth chart position",
);
assert.equal(
  judgeDepthContext.active_roster,
  true,
  "valuation payload should include active-roster context",
);
assert.equal(
  judgeDepthContext.mlb_team,
  "NYY",
  "valuation payload should include MLB team context",
);

assert.equal(rankings.length, 3, "expected all fantasy teams ranked");
assert.ok(rankings[0].strengthScore >= rankings[1].strengthScore, "expected descending score");
assert.ok(rankings.some((team) => team.highRiskCount > 0), "expected risk to affect owner data");

const sortedByMoney = sortOwnerRankings(rankings, "budgetRemaining", "desc");
assert.equal(sortedByMoney[0].name, "Charlie", "expected money sort to work");

console.log("Depth charts and owner rankings utility tests passed.");
