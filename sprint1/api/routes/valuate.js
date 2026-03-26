// routes/valuate.js — Valuation endpoints (stateless — client always sends full draft_state)
const express = require("express");
const router = express.Router();
const { requireApiKey } = require("../middleware/auth");
const { calculateValuation, getPlayers } = require("../services/valuation");

/**
 * POST /v1/valuate
 * $ value of a single nominated player given current draft state.
 *
 * Body:
 * {
 *   "draft_state": {
 *     "total_teams": 12,
 *     "budget_per_team": 260,
 *     "scoring_categories": ["HR","RBI","AVG","SB","ERA","SO","WHIP"],
 *     "nominated_player": "Shohei Ohtani",
 *     "teams": [{ "id": 1, "budget_remaining": 248, "roster": ["Juan Soto"] }],
 *     "roster_config": { "C":1,"1B":1,"2B":1,"3B":1,"SS":1,"OF":3,"SP":2,"RP":2,"UTIL":1,"BN":2 }
 *   }
 * }
 */
router.post("/", requireApiKey, (req, res) => {
  const { draft_state } = req.body;

  if (!draft_state) {
    return res.status(400).json({ error: "Bad Request", message: "Missing draft_state in request body." });
  }
  if (!draft_state.nominated_player) {
    return res.status(400).json({ error: "Bad Request", message: "draft_state.nominated_player is required." });
  }

  try {
    const result = calculateValuation(draft_state);
    if (result.error) return res.status(404).json(result);
    res.json(result);
  } catch (err) {
    console.error("Valuation error:", err);
    res.status(500).json({ error: "Internal Server Error", message: "Valuation calculation failed." });
  }
});

/**
 * POST /v1/valuate/batch
 * $ value for a specific collection of players in one request (max 50).
 *
 * Body:
 * {
 *   "players": ["Shohei Ohtani", "Juan Soto", "Kyle Tucker"],
 *   "draft_state": {
 *     "total_teams": 12,
 *     "budget_per_team": 260,
 *     "scoring_categories": ["HR","RBI","AVG","SB","ERA","SO","WHIP"],
 *     "teams": [...],
 *     "roster_config": { ... }
 *   }
 * }
 *
 * Response:
 * {
 *   "count": 3,
 *   "valuations": [ { "player": "...", "true_dollar_value": 75, ... }, ... ],
 *   "errors": []
 * }
 */
router.post("/batch", requireApiKey, (req, res) => {
  const { draft_state, players } = req.body || {};

  if (!draft_state) {
    return res.status(400).json({ error: "Bad Request", message: "Missing draft_state in request body." });
  }
  if (!players || !Array.isArray(players) || players.length === 0) {
    return res.status(400).json({ error: "Bad Request", message: "players array is required and must be non-empty." });
  }
  if (players.length > 50) {
    return res.status(400).json({ error: "Bad Request", message: "Batch size limit is 50 players." });
  }

  const valuations = [];
  const errors = [];

  for (const playerName of players) {
    try {
      const result = calculateValuation({ ...draft_state, nominated_player: playerName });
      if (result.error) {
        errors.push({ player: playerName, error: result.error });
      } else {
        valuations.push(result);
      }
    } catch (_) {
      errors.push({ player: playerName, error: "Valuation calculation failed." });
    }
  }

  res.json({ count: valuations.length, valuations, errors });
});

/**
 * GET /v1/valuate/all
 * $ value of ALL eligible (undrafted) players, sorted by true_dollar_value descending.
 *
 * Query params:
 *   total_teams=12
 *   budget_per_team=260
 *   scoring_categories=HR,RBI,AVG,SB,ERA,SO,WHIP
 *   drafted=PlayerName1,PlayerName2,...   (comma-separated names already drafted)
 *   pos=SP|OF|SS|...                      (optional position filter)
 *   tier=Elite|Starter|Bench              (optional tier filter)
 *   league=AL|NL|ALL                      (optional league filter)
 *
 * Response:
 * {
 *   "count": 87,
 *   "draft_state_summary": { "total_teams": 12, "budget_per_team": 260, "drafted_count": 2 },
 *   "players": [ { "player": "...", "true_dollar_value": 75, ... }, ... ]
 * }
 */
router.get("/all", requireApiKey, (req, res) => {
  const draftedNames = req.query.drafted
    ? req.query.drafted.split(",").map((n) => n.trim()).filter(Boolean)
    : [];

  const scoringCategories = req.query.scoring_categories
    ? req.query.scoring_categories.split(",").map((c) => c.trim())
    : ["HR", "RBI", "AVG", "SB", "ERA", "SO", "WHIP"];

  const draft_state = {
    total_teams: parseInt(req.query.total_teams, 10) || 12,
    budget_per_team: parseInt(req.query.budget_per_team, 10) || 260,
    scoring_categories: scoringCategories,
    teams: draftedNames.length > 0
      ? [{ id: 1, budget_remaining: 260, roster: draftedNames }]
      : [],
    roster_config: { C: 1, "1B": 1, "2B": 1, "3B": 1, SS: 1, OF: 3, SP: 2, RP: 2, UTIL: 1, BN: 2 },
  };

  const draftedSet = new Set(draftedNames);

  const eligiblePlayers = getPlayers({
    league: req.query.league || "ALL",
    pos: req.query.pos || "ALL",
    tier: req.query.tier || "ALL",
    available_only: draftedSet.size > 0,
    drafted_names: [...draftedSet],
  });

  const valuations = [];
  for (const player of eligiblePlayers) {
    try {
      const result = calculateValuation({ ...draft_state, nominated_player: player.name });
      if (!result.error) valuations.push(result);
    } catch (_) {}
  }

  valuations.sort((a, b) => b.true_dollar_value - a.true_dollar_value);

  res.json({
    count: valuations.length,
    draft_state_summary: {
      total_teams: draft_state.total_teams,
      budget_per_team: draft_state.budget_per_team,
      drafted_count: draftedSet.size,
    },
    players: valuations,
  });
});

module.exports = router;
