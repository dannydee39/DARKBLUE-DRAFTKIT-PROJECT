const fs = require("fs");
const path = require("path");
const { createApp } = require("../server");
const playerPool = require("../data/players.json");

const API_KEY = "DB-2026-DEMO-0001";

function rosterTuple(playerName) {
  const player = playerPool.find((entry) => entry.name === playerName);
  if (!player) {
    throw new Error(`Could not find player "${playerName}" in export dataset.`);
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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  return response.json();
}

async function main() {
  const app = createApp({ nodeEnv: "test", rateLimitMax: 500 });
  const outputDir = path.join(__dirname, "..", "artifacts", "real-api-data");
  fs.mkdirSync(outputDir, { recursive: true });

  await withServer(app, async (baseUrl) => {
    const health = await fetchJson(`${baseUrl}/health`);
    const players = await fetchJson(`${baseUrl}/v1/players?league=NL&group_by=tier`, {
      headers: { "X-License-Key": API_KEY },
    });
    const valuationBatch = await fetchJson(`${baseUrl}/v1/valuate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Key": API_KEY },
      body: JSON.stringify({ draft_state: buildDraftState() }),
    });

    fs.writeFileSync(path.join(outputDir, "health.json"), JSON.stringify(health, null, 2));
    fs.writeFileSync(path.join(outputDir, "players.json"), JSON.stringify(players, null, 2));
    fs.writeFileSync(path.join(outputDir, "valuation-batch.json"), JSON.stringify(valuationBatch, null, 2));
  });

  console.log(`Wrote real API artifacts to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
