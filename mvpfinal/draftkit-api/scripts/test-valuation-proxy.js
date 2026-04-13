const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dbdraftkit-proxy-"));
  process.env.AUTH_DB_PATH = path.join(tempDir, "draftkit-auth.db");
  process.env.NODE_ENV = "test";

  const { createApp: createValuationApp } = require("../../valuation-api/server");
  const valuationApp = createValuationApp({ nodeEnv: "test", rateLimitMax: 500 });

  await withServer(valuationApp, async (valuationBaseUrl) => {
    process.env.VALUATION_API_BASE = valuationBaseUrl;
    process.env.VALUATION_API_KEY = "DB-2026-DEMO-0001";
    process.env.ALLOWED_ORIGINS = "http://localhost:4173,https://draft.anythingavenue.com";

    const { createApp: createDraftkitApp } = require("../server");
    const draftkitApp = createDraftkitApp({
      nodeEnv: "test",
      rateLimitMax: 500,
    });

    await withServer(draftkitApp, async (draftkitBaseUrl) => {
      const health = await jsonFetch(`${draftkitBaseUrl}/health`);
      assert.equal(health.response.status, 200, "draftkit health should be online");
      assert.equal(
        health.body?.dependencies?.valuation?.status,
        "online",
        "draftkit health should report online valuation dependency",
      );

      const players = await jsonFetch(`${draftkitBaseUrl}/v1/players?league=NL`);
      assert.equal(players.response.status, 200, "proxy /v1/players should succeed");
      assert.ok(Array.isArray(players.body?.players), "proxy /v1/players should return player array");
      assert.ok(players.body.players.length > 0, "proxy /v1/players should return at least one player");

      const valuation = await jsonFetch(`${draftkitBaseUrl}/v1/valuate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft_state: {
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
          },
        }),
      });

      assert.equal(valuation.response.status, 200, "proxy /v1/valuate should succeed");
      assert.ok(
        typeof valuation.body?.max_bid_recommendation === "number",
        "proxy valuation should return a numeric max bid",
      );
      assert.ok(
        typeof valuation.body?.true_dollar_value === "number",
        "proxy valuation should return a numeric true dollar value",
      );
    });
  });

  console.log("Draft Kit valuation proxy regression passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
