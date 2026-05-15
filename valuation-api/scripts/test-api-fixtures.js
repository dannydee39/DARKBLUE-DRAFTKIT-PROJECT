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
    roster_config: { C: 2, "1B": 1, "2B": 1, CI: 1, "3B": 1, SS: 1, MI: 1, OF: 5, SP: 0, RP: 0, P: 9, UTIL: 1, BN: 0, TAXI: 0 },
  };
}

function mergeDraftState(draftedCount, overrides = {}) {
  const base = buildDraftState(draftedCount);
  return {
    ...base,
    ...overrides,
    teams: overrides.teams || base.teams,
    roster_config: overrides.roster_config || base.roster_config,
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
    const target = playerPool.find((player) => player.name === "Juan Soto") || playerPool[2];

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

    const oneYearStats = {
      fpts: Math.round((target.fpts || 500) * 0.72),
      hr: Math.round((target.hr || 30) * 0.7),
      rbi: Math.round((target.rbi || 90) * 0.7),
      r: Math.round((target.r || 90) * 0.7),
      sb: Math.round((target.sb || 15) * 0.7),
      avg: Number(target.avg || 0.27) - 0.02,
    };
    const threeYearStats = {
      fpts: target.fpts,
      hr: target.hr,
      rbi: target.rbi,
      r: target.r,
      sb: target.sb,
      avg: target.avg,
    };
    const predictiveStats = {
      fpts: Math.round((target.fpts || 500) * 1.15),
      projected_games: 158,
      projected_plate_appearances: 710,
    };

    const variationCases = [
      {
        label: "baseline-transparent-breakdown",
        state: mergeDraftState(0),
      },
      {
        label: "scarcity-roster-config",
        state: mergeDraftState(0, {
          roster_config: {
            ...buildDraftState(0).roster_config,
            OF: 80,
          },
        }),
      },
      {
        label: "injury-commissioner-note",
        state: mergeDraftState(0, {
          commissioner_notes: [
            {
              player_id: target.id,
              player_name: target.name,
              type: "INJURY",
              severity: "HIGH",
              headline: `${target.name} has a high-risk injury flag`,
              injury_status: "Questionable",
            },
          ],
        }),
      },
      {
        label: "custom-one-year-stats",
        state: mergeDraftState(0, {
          stat_window: "ONE_YEAR",
          player_stat_overrides: {
            [target.id]: {
              player_id: target.id,
              one_year: oneYearStats,
              three_year: threeYearStats,
            },
          },
        }),
      },
      {
        label: "custom-three-year-plus-predictive",
        state: mergeDraftState(0, {
          stat_window: "THREE_YEAR",
          player_stat_overrides: {
            [target.id]: {
              player_id: target.id,
              three_year: threeYearStats,
              predictive: predictiveStats,
            },
          },
        }),
      },
    ];

    const values = [];
    for (const variation of variationCases) {
      const response = await jsonFetch(`${baseUrl}/v1/valuate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-License-Key": API_KEY,
        },
        body: JSON.stringify({ draft_state: variation.state }),
      });

      assert.equal(response.response.status, 200, `${variation.label} should return 200`);
      const targetValue = response.body?.valuations?.[target.name];
      assert.ok(targetValue, `${variation.label} should include ${target.name}`);
      assert.equal(
        targetValue.valuation_breakdown?.formula,
        "stat_baseline_value * scoring * scarcity * predictive * age * depth_chart * market_inflation * injury_risk",
        `${variation.label} should expose the transparent formula`,
      );
      assert.equal(
        typeof targetValue.true_dollar_value,
        "number",
        `${variation.label} should expose numeric true dollar value`,
      );
      values.push(targetValue.true_dollar_value);
    }

    const customCase = variationCases.find((entry) => entry.label === "custom-one-year-stats");
    const customResponse = await jsonFetch(`${baseUrl}/v1/valuate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Key": API_KEY },
      body: JSON.stringify({ draft_state: customCase.state }),
    });
    const customValue = customResponse.body.valuations[target.name];
    assert.equal(customValue.stat_profile.window, "ONE_YEAR", "custom one-year window should be used");
    assert.equal(
      customValue.rubric_checks.custom_one_or_three_year_stats_used,
      true,
      "custom 1/3 year stats rubric check should be true",
    );
    assert.equal(
      customValue.rubric_checks.predictive_stats_used,
      true,
      "predictive stats rubric check should be true",
    );
    assert.equal(customValue.rubric_checks.age_used, true, "age rubric check should be true");
    assert.equal(customValue.rubric_checks.scarcity_used, true, "scarcity rubric check should be true");
    assert.equal(
      customValue.rubric_checks.depth_chart_position_used,
      true,
      "depth chart rubric check should be true",
    );

    const injuryCase = variationCases.find((entry) => entry.label === "injury-commissioner-note");
    const injuryResponse = await jsonFetch(`${baseUrl}/v1/valuate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-License-Key": API_KEY },
      body: JSON.stringify({ draft_state: injuryCase.state }),
    });
    assert.equal(
      injuryResponse.body.valuations[target.name].rubric_checks.injury_status_used,
      true,
      "injury status rubric check should be true when commissioner note supplies injury risk",
    );

    assert.ok(
      new Set(values).size === variationCases.length,
      `five valuation scenarios should create five distinct values; saw ${values.join(", ")}`,
    );
  });

  console.log("PASS test:api:fixtures");
}

main().catch((error) => {
  console.error("FAIL test:api:fixtures");
  console.error(error);
  process.exit(1);
});
