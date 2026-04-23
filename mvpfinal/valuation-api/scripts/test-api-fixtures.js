const assert = require("assert/strict");
const { createApp } = require("../server");
const playerPool = require("../data/players.json");

const API_KEY = "DB-2026-DEMO-0001";
const TOP_NAMES = playerPool.slice(0, 180).map((player) => player.name);

function rosterTuple(playerName, teamId) {
  const player = playerPool.find((entry) => entry.name === playerName);
  if (!player) {
    throw new Error(`Could not find player "${playerName}" in fixture dataset.`);
  }
  return [player.name, player.team];
}

function buildTeams(draftedCount) {
  const teams = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    budget_remaining: 260,
    roster: [],
  }));

  for (let i = 0; i < draftedCount; i += 1) {
    const team = teams[i % teams.length];
    team.roster.push(rosterTuple(TOP_NAMES[i], team.id));
    team.budget_remaining = Math.max(1, team.budget_remaining - Math.max(1, Math.round(42 - i * 0.28)));
  }

  return teams;
}

function buildDraftState(draftedCount) {
  return {
    total_teams: 12,
    budget_per_team: 260,
    scoring_categories: ["R", "HR", "RBI", "SB", "AVG", "W", "SV", "ERA", "WHIP", "SO"],
    teams: buildTeams(draftedCount),
    roster_config: { C: 2, "1B": 1, "2B": 2, CI: 1, "3B": 0, SS: 1, MI: 1, OF: 5, SP: 0, RP: 0, P: 9, UTIL: 1, BN: 0, TAXI: 0 },
  };
}

async function withServer(app, run) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { response, body };
}

async function main() {
  const app = createApp({ nodeEnv: "test", rateLimitMax: 500 });
  const checkpoints = [
    { label: "before", draftedCount: 0, playerName: "Shohei Ohtani" },
    { label: "after-10", draftedCount: 10, playerName: "Mookie Betts" },
    { label: "after-50", draftedCount: 50, playerName: "Kyle Tucker" },
    { label: "after-100", draftedCount: 100, playerName: "Ronald Acuña Jr." },
    { label: "after-130", draftedCount: 130, playerName: "Yainer Diaz" },
  ];

  await withServer(app, async (baseUrl) => {
    for (const checkpoint of checkpoints) {
      const valuation = await jsonFetch(`${baseUrl}/v1/valuate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-License-Key": API_KEY,
        },
        body: JSON.stringify({ draft_state: buildDraftState(checkpoint.draftedCount) }),
      });

      assert.equal(
        valuation.response.status,
        200,
        `${checkpoint.label} fixture should return 200`,
      );
      assert.equal(
        typeof valuation.body?.valuations,
        "object",
        `${checkpoint.label} fixture should return a valuation dictionary`,
      );
      assert.ok(
        typeof valuation.body?.valuations?.[checkpoint.playerName]?.true_dollar_value === "number",
        `${checkpoint.label} fixture should expose TDV for ${checkpoint.playerName}`,
      );
      assert.ok(
        typeof valuation.body?.valuations?.[checkpoint.playerName]?.max_bid_recommendation === "number",
        `${checkpoint.label} fixture should expose max bid for ${checkpoint.playerName}`,
      );
    }
  });

  console.log("PASS test:api:fixtures");
}

main().catch((error) => {
  console.error("FAIL test:api:fixtures");
  console.error(error);
  process.exit(1);
});
