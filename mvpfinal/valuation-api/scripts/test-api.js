const assert = require("assert/strict");
const { createApp } = require("../server");
const playerPool = require("../data/players.json");

const API_KEY = "DB-2026-DEMO-0001";

function rosterTuple(playerName) {
  const player = playerPool.find((entry) => entry.name === playerName);
  if (!player) {
    throw new Error(`Could not find player "${playerName}" in test dataset.`);
  }
  return [player.name, player.team];
}

function buildDraftState(overrides = {}) {
  return {
    total_teams: 12,
    budget_per_team: 260,
    scoring_categories: ["R", "HR", "RBI", "SB", "AVG", "W", "SV", "ERA", "WHIP", "SO"],
    teams: [
      { id: 1, budget_remaining: 248, roster: [rosterTuple("Freddie Freeman"), rosterTuple("Logan Webb")] },
      { id: 2, budget_remaining: 233, roster: [rosterTuple("Francisco Lindor")] },
      { id: 3, budget_remaining: 260, roster: [] },
    ],
    roster_config: { C: 2, "1B": 1, "2B": 2, CI: 1, "3B": 0, SS: 1, MI: 1, OF: 5, SP: 0, RP: 0, P: 9, UTIL: 1, BN: 0, TAXI: 0 },
    ...overrides,
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
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_err) {
    body = text;
  }
  return { response, body };
}

async function runGeneralRegressionSuite() {
  const app = createApp({ nodeEnv: "test", rateLimitMax: 500 });
  await withServer(app, async (baseUrl) => {
    const hitter = playerPool.find((player) => !["SP", "RP"].includes(player.pos[0]));
    const pitcher = playerPool.find((player) => ["SP", "RP"].includes(player.pos[0]));
    assert.ok(hitter, "dataset should contain at least one hitter");
    assert.ok(pitcher, "dataset should contain at least one pitcher");

    const health = await jsonFetch(`${baseUrl}/health`);
    assert.equal(health.response.status, 200, "GET /health should return 200");
    assert.equal(health.body.status, "online");

    const missingKey = await jsonFetch(`${baseUrl}/v1/players`);
    assert.equal(missingKey.response.status, 401, "GET /v1/players without key should return 401");
    assert.equal(missingKey.body.code, "NO_KEY");

    const players = await jsonFetch(
      `${baseUrl}/v1/players?league=NL&group_by=tier&drafted=${encodeURIComponent("Juan Soto,Logan Webb")}`,
      { headers: { "X-License-Key": API_KEY } }
    );
    assert.equal(players.response.status, 200, "GET /v1/players with key should return 200");
    assert.equal(players.body.grouped_by, "tier");
    assert.ok(Array.isArray(players.body.players), "players payload should be an array");
    assert.ok(players.body.players.length > 0, "players payload should not be empty");
    assert.ok(!players.body.players.some((player) => player.name === "Juan Soto"), "drafted players should be excluded");
    assert.ok(players.body.players[0].overall_rank >= 1, "players should include rank metadata");
    assert.ok(players.body.players.some((player) => player.photoUrl), "players should include headshots");

    const nlPitchers = await jsonFetch(
      `${baseUrl}/v1/players?league=NL&pos=SP`,
      { headers: { "X-License-Key": API_KEY } }
    );
    assert.equal(nlPitchers.response.status, 200, "GET /v1/players NL SP should return 200");
    assert.ok(
      nlPitchers.body.players.every((player) => player.league === "NL" && player.pos.includes("SP")),
      "league and position filters should hold for NL SP query"
    );

    const missingState = await jsonFetch(`${baseUrl}/v1/valuate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Key": API_KEY },
      body: JSON.stringify({}),
    });
    assert.equal(missingState.response.status, 400, "POST /v1/valuate without draft_state should return 400");

    const invalidKey = await jsonFetch(`${baseUrl}/v1/valuate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Key": "DB-INVALID-KEY" },
      body: JSON.stringify({ draft_state: buildDraftState() }),
    });
    assert.equal(invalidKey.response.status, 401, "Invalid key should return 401");

    const valuate = await jsonFetch(`${baseUrl}/v1/valuate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Key": API_KEY },
      body: JSON.stringify({ draft_state: buildDraftState() }),
    });
    assert.equal(valuate.response.status, 200, "POST /v1/valuate should return 200");
    assert.ok(typeof valuate.body.count === "number", "valuation batch should include player count");
    assert.ok(typeof valuate.body.valuations === "object", "valuation batch should include a valuation dictionary");
    assert.ok(
      typeof valuate.body.valuations?.["Juan Soto"]?.true_dollar_value === "number",
      "valuation dictionary should expose Juan Soto TDV",
    );
    assert.ok(
      typeof valuate.body.valuations?.["Juan Soto"]?.max_bid_recommendation === "number",
      "valuation dictionary should expose Juan Soto max bid",
    );
    assert.ok(valuate.body.market_context?.label, "valuation batch should include market_context label");

    const hitterValuation = await jsonFetch(`${baseUrl}/v1/valuate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Key": API_KEY },
      body: JSON.stringify({ draft_state: buildDraftState() }),
    });
    assert.equal(hitterValuation.response.status, 200, "hitter valuation should return 200");
    assert.ok(
      hitterValuation.body.valuations?.[hitter.name]?.stats?.positions?.length > 0,
      "hitter valuation batch should expose hitter positions",
    );

    const pitcherValuation = await jsonFetch(`${baseUrl}/v1/valuate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Key": API_KEY },
      body: JSON.stringify({
        draft_state: buildDraftState({
          teams: [
            { id: 1, budget_remaining: 190, roster: [rosterTuple(pitcher.name)] },
            { id: 2, budget_remaining: 170, roster: [rosterTuple("Juan Soto"), rosterTuple("Shohei Ohtani")] },
            { id: 3, budget_remaining: 140, roster: [rosterTuple("Tarik Skubal"), rosterTuple("Paul Skenes")] },
          ],
        }),
      }),
    });
    assert.equal(pitcherValuation.response.status, 200, "pitcher valuation should return 200");
    assert.ok(
      typeof pitcherValuation.body.valuations?.[pitcher.name]?.true_dollar_value === "number",
      "pitcher valuation batch should include numeric tdv",
    );
  });
}

async function runRateLimitSuite() {
  const app = createApp({ nodeEnv: "test", rateLimitMax: 3, rateLimitWindowMs: 60_000 });
  await withServer(app, async (baseUrl) => {
    const headers = { "X-License-Key": API_KEY };
    for (let i = 0; i < 3; i += 1) {
      const ok = await jsonFetch(`${baseUrl}/v1/players`, { headers });
      assert.equal(ok.response.status, 200, `Allowed request ${i + 1} should succeed before rate limit`);
    }
    const limited = await jsonFetch(`${baseUrl}/v1/players`, { headers });
    assert.equal(limited.response.status, 429, "Fourth request should trip the rate limit");
    assert.equal(limited.body.error, "Too Many Requests");
  });
}

async function main() {
  await runGeneralRegressionSuite();
  await runRateLimitSuite();
  console.log("PASS test:api");
}

main().catch((error) => {
  console.error("FAIL test:api");
  console.error(error);
  process.exit(1);
});
