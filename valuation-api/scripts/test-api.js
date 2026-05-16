const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const playerPool = require("../data/players.json");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dbvalue-updates-"));
const API_KEY = "DB-2026-DEMO-0001";
process.env.PLAYER_UPDATES_FILE = path.join(tempDir, "player-updates.json");
process.env.API_KEY_IP_WHITELIST = `${API_KEY}=127.0.0.1|198.51.100.0/24`;

const { createApp } = require("../server");

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
    roster_config: { C: 2, "1B": 1, "2B": 1, CI: 1, "3B": 1, SS: 1, MI: 1, OF: 5, SP: 0, RP: 0, P: 9, UTIL: 1, BN: 0, TAXI: 0 },
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

async function readSseEvent(url, options = {}, eventName, trigger) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  const response = await fetch(url, { ...options, signal: controller.signal });
  assert.equal(response.status, 200, "SSE stream should connect");
  assert.ok(
    response.headers.get("content-type")?.includes("text/event-stream"),
    "SSE stream should use text/event-stream",
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
        const lines = chunk.split("\n");
        const eventLine = lines.find((line) => line.startsWith("event:"));
        const dataLines = lines.filter((line) => line.startsWith("data:"));
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

  throw new Error(`Timed out waiting for SSE event ${eventName}`);
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
    assert.ok(
      players.body.players.every((player) => typeof player.risk_level === "string"),
      "players should include live update risk metadata",
    );
    assert.deepEqual(
      players.body.groups.map((group) => group.tier),
      ["Elite", "Core", "Depth"],
      "tier groups should use product-facing Elite/Core/Depth names",
    );

    const corePlayers = await jsonFetch(`${baseUrl}/v1/players?tier=Core`, {
      headers: { "X-License-Key": API_KEY },
    });
    assert.equal(corePlayers.response.status, 200, "GET /v1/players Core tier should return 200");
    assert.ok(corePlayers.body.players.length > 0, "Core tier should include players");
    assert.ok(corePlayers.body.players.every((player) => player.tier === "Core"), "Core filter should return Core players");

    const updates = await jsonFetch(`${baseUrl}/v1/player-updates?limit=5`, {
      headers: { "X-License-Key": API_KEY },
    });
    assert.equal(updates.response.status, 200, "GET /v1/player-updates should return 200");
    assert.ok(Array.isArray(updates.body.updates), "updates payload should include an array");

    const pushedUpdate = await jsonFetch(`${baseUrl}/v1/player-updates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Key": API_KEY },
      body: JSON.stringify({
        player_name: "Aaron Judge",
        type: "INJURY",
        severity: "HIGH",
        source: "Commissioner update",
      }),
    });
    assert.equal(pushedUpdate.response.status, 201, "POST /v1/player-updates should create an update");
    assert.equal(pushedUpdate.body.update.player_name, "Aaron Judge");
    assert.equal(pushedUpdate.body.update.risk_level, "HIGH");

    const pushedStreamEvent = await readSseEvent(
      `${baseUrl}/v1/player-updates/stream?limit=5`,
      { headers: { "X-License-Key": API_KEY } },
      "player-update",
      async () => {
        const response = await jsonFetch(`${baseUrl}/v1/player-updates`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-License-Key": API_KEY },
          body: JSON.stringify({
            player_name: "Bobby Witt Jr.",
            type: "NEWS",
            severity: "MEDIUM",
            headline: "Bobby Witt Jr. lineup status pushed",
          }),
        });
        assert.equal(response.response.status, 201, "POST should push to open SSE stream");
      },
    );
    assert.equal(
      pushedStreamEvent.update.player_name,
      "Bobby Witt Jr.",
      "SSE stream should emit the newly created player update",
    );

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

    const whitelistedIp = await jsonFetch(`${baseUrl}/v1/players`, {
      headers: { "X-License-Key": API_KEY, "X-Forwarded-For": "198.51.100.25" },
    });
    assert.equal(whitelistedIp.response.status, 200, "Whitelisted CIDR IP should be allowed");

    const blockedIp = await jsonFetch(`${baseUrl}/v1/players`, {
      headers: { "X-License-Key": API_KEY, "X-Forwarded-For": "203.0.113.77" },
    });
    assert.equal(blockedIp.response.status, 403, "Non-whitelisted IP should be blocked");
    assert.equal(blockedIp.body.code, "IP_NOT_ALLOWED");

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
    assert.ok(
      valuate.body.valuations?.["Aaron Judge"]?.player_update,
      "valuation dictionary should expose player update context after a published update",
    );
    assert.equal(
      valuate.body.valuations?.["Aaron Judge"]?.risk_level,
      "HIGH",
      "valuation dictionary should expose injury risk level",
    );
    assert.ok(valuate.body.market_context?.label, "valuation batch should include market_context label");
    assert.equal(
      valuate.body.rubric_coverage?.valuation_variation_test_cases,
      5,
      "valuation batch should advertise five valuation variation test cases",
    );
    assert.ok(
      valuate.body.valuations?.["Juan Soto"]?.valuation_breakdown?.formula?.includes("predictive"),
      "valuation should expose the transparent factor formula",
    );
    assert.equal(
      typeof valuate.body.valuations?.["Juan Soto"]?.predictive_adjustment?.multiplier,
      "number",
      "valuation should expose predictive adjustment",
    );
    assert.equal(
      typeof valuate.body.valuations?.["Juan Soto"]?.age_adjustment?.age,
      "number",
      "valuation should expose age adjustment",
    );
    assert.equal(
      typeof valuate.body.valuations?.["Juan Soto"]?.depth_chart_adjustment?.multiplier,
      "number",
      "valuation should expose depth chart adjustment",
    );

    const commissionerNoteValuation = await jsonFetch(`${baseUrl}/v1/valuate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Key": API_KEY },
      body: JSON.stringify({
        draft_state: buildDraftState({
          commissioner_notes: [
            {
              player_id: playerPool.find((entry) => entry.name === "Juan Soto").id,
              player_name: "Juan Soto",
              type: "ROLE",
              severity: "MEDIUM",
              headline: "Juan Soto has a league-only role note",
              source: "League commissioner note",
            },
          ],
        }),
      }),
    });
    assert.equal(
      commissionerNoteValuation.response.status,
      200,
      "commissioner note valuation should return 200",
    );
    assert.equal(
      commissionerNoteValuation.body.valuations?.["Juan Soto"]?.risk_level,
      "MEDIUM",
      "valuation should apply commissioner_notes as local-only risk context",
    );
    assert.equal(
      commissionerNoteValuation.body.valuations?.["Juan Soto"]?.player_update?.source,
      "League commissioner note",
      "valuation should preserve commissioner note source",
    );
    assert.equal(
      commissionerNoteValuation.body.valuations?.["Juan Soto"]?.rubric_checks?.injury_status_used,
      true,
      "valuation should mark injury/news risk context as used for rubric coverage",
    );

    const customStatsValuation = await jsonFetch(`${baseUrl}/v1/valuate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Key": API_KEY },
      body: JSON.stringify({
        draft_state: buildDraftState({
          valuation_options: { stat_window: "ONE_YEAR" },
          player_stat_overrides: {
            [hitter.id]: {
              player_id: hitter.id,
              one_year: { fpts: Math.round(hitter.fpts * 0.8), hr: hitter.hr, rbi: hitter.rbi, r: hitter.r, sb: hitter.sb, avg: hitter.avg },
              three_year: { fpts: hitter.fpts, hr: hitter.hr, rbi: hitter.rbi, r: hitter.r, sb: hitter.sb, avg: hitter.avg },
              predictive: { fpts: Math.round(hitter.fpts * 1.1), projected_games: 150, projected_plate_appearances: 650 },
            },
          },
          depth_chart_context: {
            [hitter.id]: {
              player_id: hitter.id,
              depth_position: hitter.pos[0],
              depth_rank: 1,
              depth_role: "Everyday hitter",
              status: "Active",
              is_starter: true,
              mlb_team: hitter.team,
              active_roster: true,
              role_confidence: "HIGH",
              volume_score: 92,
            },
          },
        }),
      }),
    });
    assert.equal(customStatsValuation.response.status, 200, "custom stats valuation should return 200");
    const customStatsValue = customStatsValuation.body.valuations?.[hitter.name];
    assert.equal(customStatsValue?.stat_profile?.window, "ONE_YEAR", "one-year stat window should be honored");
    assert.equal(
      customStatsValue?.rubric_checks?.custom_one_or_three_year_stats_used,
      true,
      "custom 1/3 year stats rubric check should be true",
    );
    assert.equal(
      customStatsValue?.rubric_checks?.depth_chart_position_used,
      true,
      "depth chart context rubric check should be true",
    );
    assert.equal(
      customStatsValue?.depth_chart_adjustment?.mlb_team,
      hitter.team,
      "depth chart context should preserve MLB team context",
    );
    assert.equal(
      customStatsValue?.depth_chart_adjustment?.volume_score,
      92,
      "depth chart context volume score should drive the depth adjustment response",
    );
    assert.equal(
      customStatsValue?.depth_chart_adjustment?.active_roster,
      true,
      "depth chart context should preserve active-roster status",
    );

    const stringBooleanDepthValuation = await jsonFetch(`${baseUrl}/v1/valuate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Key": API_KEY },
      body: JSON.stringify({
        draft_state: buildDraftState({
          depth_chart_context: {
            [hitter.id]: {
              player_id: hitter.id,
              depth_position: hitter.pos[0],
              depth_rank: 5,
              depth_role: "Reserve role",
              status: "Active",
              is_starter: "false",
              active_roster: "false",
              volume_score: 0,
            },
          },
        }),
      }),
    });
    const stringBooleanDepthValue = stringBooleanDepthValuation.body.valuations?.[hitter.name];
    assert.equal(
      stringBooleanDepthValue?.depth_chart_adjustment?.active_roster,
      false,
      "string false active_roster should normalize to false",
    );
    assert.equal(
      stringBooleanDepthValue?.depth_chart_adjustment?.multiplier,
      0.82,
      "string false is_starter should not receive a starter depth bump",
    );

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
    assert.equal(
      hitterValuation.body.valuations?.[hitter.name]?.rubric_checks?.depth_chart_position_used,
      false,
      "depth chart rubric should require supplied depth_chart_context",
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
