const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const playerPool = require("../../valuation-api/data/players.json");

function rosterTuple(playerName) {
  const player = playerPool.find((entry) => entry.name === playerName);
  if (!player) {
    throw new Error(`Could not find player "${playerName}" in proxy test dataset.`);
  }
  return [player.name, player.team];
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

async function readSseEvent(url, eventName, trigger) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  const response = await fetch(url, { signal: controller.signal });
  assert.equal(response.status, 200, "proxy SSE stream should connect");
  assert.ok(
    response.headers.get("content-type")?.includes("text/event-stream"),
    "proxy SSE stream should preserve text/event-stream",
  );

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    if (trigger) await trigger();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        const eventLine = chunk
          .split("\n")
          .find((line) => line.startsWith("event:"));
        const dataLines = chunk
          .split("\n")
          .filter((line) => line.startsWith("data:"));
        const parsedEvent = eventLine ? eventLine.slice(6).trim() : "message";

        if (parsedEvent === eventName) {
          const data = dataLines.map((line) => line.slice(5).trim()).join("\n");
          return data ? JSON.parse(data) : null;
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
    await reader.cancel().catch(() => {});
  }

  throw new Error(`Timed out waiting for proxy SSE event ${eventName}`);
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dbdraftkit-proxy-"));
  process.env.AUTH_DB_PATH = path.join(tempDir, "draftkit-auth.db");
  process.env.PLAYER_UPDATES_FILE = path.join(tempDir, "player-updates.json");
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

      const updates = await jsonFetch(`${draftkitBaseUrl}/v1/player-updates?limit=5`);
      assert.equal(updates.response.status, 200, "proxy /v1/player-updates should succeed");
      assert.ok(Array.isArray(updates.body?.updates), "proxy player updates should return an updates array");

      const publishedUpdate = await jsonFetch(`${draftkitBaseUrl}/v1/player-updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_name: "Aaron Judge", type: "INJURY", severity: "HIGH" }),
      });
      assert.equal(
        publishedUpdate.response.status,
        201,
        "proxy /v1/player-updates should create an update",
      );
      assert.equal(publishedUpdate.body?.update?.player_name, "Aaron Judge");

      const streamEvent = await readSseEvent(
        `${draftkitBaseUrl}/v1/player-updates/stream?limit=5`,
        "player-update",
        async () => {
          const response = await jsonFetch(`${draftkitBaseUrl}/v1/player-updates`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              player_name: "Bobby Witt Jr.",
              type: "NEWS",
              severity: "MEDIUM",
            }),
          });
          assert.equal(
            response.response.status,
            201,
            "proxy POST should push to open SSE stream",
          );
        },
      );
      assert.equal(
        streamEvent.update.player_name,
        "Bobby Witt Jr.",
        "proxy SSE stream should emit the newly created update",
      );

      const valuation = await jsonFetch(`${draftkitBaseUrl}/v1/valuate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft_state: {
            total_teams: 12,
            budget_per_team: 260,
            scoring_categories: ["R", "HR", "RBI", "SB", "AVG", "W", "SV", "ERA", "WHIP", "SO"],
            teams: [
              { id: 1, budget_remaining: 248, roster: [rosterTuple("Freddie Freeman"), rosterTuple("Logan Webb")] },
              { id: 2, budget_remaining: 233, roster: [rosterTuple("Francisco Lindor")] },
              { id: 3, budget_remaining: 260, roster: [] },
            ],
            roster_config: { C: 1, "1B": 1, "2B": 1, "3B": 1, SS: 1, OF: 3, SP: 2, RP: 2, UTIL: 1, BN: 2 },
          },
        }),
      });

      assert.equal(valuation.response.status, 200, "proxy /v1/valuate should succeed");
      assert.ok(
        typeof valuation.body?.valuations?.["Juan Soto"]?.max_bid_recommendation === "number",
        "proxy valuation should return a numeric max bid inside the valuation dictionary",
      );
      assert.ok(
        typeof valuation.body?.valuations?.["Juan Soto"]?.true_dollar_value === "number",
        "proxy valuation should return a numeric true dollar value inside the valuation dictionary",
      );
    });
  });

  console.log("Draft Kit valuation proxy regression passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
