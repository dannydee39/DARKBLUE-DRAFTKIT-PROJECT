const assert = require("assert/strict");
const { createApp } = require("../server");

const API_KEY = "DB-2026-DEMO-0001";

function buildDraftState(overrides = {}) {
  return {
    total_teams: 12,
    budget_per_team: 260,
    scoring_categories: ["R", "HR", "RBI", "SB", "AVG", "W", "SV", "ERA", "WHIP", "SO"],
    teams: [
      { id: 1, budget_remaining: 248, roster: ["Freddie Freeman", "Logan Webb"] },
      { id: 2, budget_remaining: 233, roster: ["Francisco Lindor"] },
      { id: 3, budget_remaining: 260, roster: [] },
    ],
    nominated_player: "Juan Soto",
    roster_config: { C: 1, "1B": 1, "2B": 1, "3B": 1, SS: 1, OF: 3, SP: 2, RP: 2, UTIL: 1, BN: 2 },
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

    const missingState = await jsonFetch(`${baseUrl}/v1/valuate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Key": API_KEY },
      body: JSON.stringify({}),
    });
    assert.equal(missingState.response.status, 400, "POST /v1/valuate without draft_state should return 400");

    const missingPlayer = await jsonFetch(`${baseUrl}/v1/valuate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Key": API_KEY },
      body: JSON.stringify({ draft_state: buildDraftState({ nominated_player: "" }) }),
    });
    assert.equal(missingPlayer.response.status, 400, "POST /v1/valuate without nominated_player should return 400");

    const unknownPlayer = await jsonFetch(`${baseUrl}/v1/valuate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Key": API_KEY },
      body: JSON.stringify({ draft_state: buildDraftState({ nominated_player: "Definitely Not Real" }) }),
    });
    assert.equal(unknownPlayer.response.status, 404, "Unknown player should return 404");

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
    assert.ok(typeof valuate.body.true_dollar_value === "number", "valuation should include true_dollar_value");
    assert.ok(typeof valuate.body.max_bid_recommendation === "number", "valuation should include max_bid_recommendation");
    assert.ok(valuate.body.market_context?.label, "valuation should include market_context label");
    assert.ok(valuate.body.player_tier, "valuation should include player_tier");
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
