const fs = require("fs");
const path = require("path");
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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  return response.json();
}

async function main() {
  const app = createApp({ nodeEnv: "test", rateLimitMax: 500 });
  const outputDir = path.join(__dirname, "..", "artifacts", "sample-api-data");
  fs.mkdirSync(outputDir, { recursive: true });

  await withServer(app, async (baseUrl) => {
    const health = await fetchJson(`${baseUrl}/health`);
    const players = await fetchJson(`${baseUrl}/v1/players?league=NL&group_by=tier`, {
      headers: { "X-License-Key": API_KEY },
    });
    const valuation = await fetchJson(`${baseUrl}/v1/valuate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Key": API_KEY },
      body: JSON.stringify({ draft_state: buildDraftState() }),
    });

    fs.writeFileSync(path.join(outputDir, "health.json"), JSON.stringify(health, null, 2));
    fs.writeFileSync(path.join(outputDir, "players.json"), JSON.stringify(players, null, 2));
    fs.writeFileSync(path.join(outputDir, "valuation.json"), JSON.stringify(valuation, null, 2));
  });

  console.log(`Wrote sample API artifacts to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
