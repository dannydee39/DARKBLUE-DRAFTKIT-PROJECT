// routes/valuate.js — Valuation endpoints
const express = require("express");
const router = express.Router();
const { requireApiKey } = require("../middleware/auth");
const { calculateValuation, getPlayers } = require("../services/valuation");
const { sessions } = require("./sessions");

// Helper: resolve draft_state from body or session
function resolveDraftState(req) {
  const { draft_state, session_id } = req.body || {};

  if (session_id) {
    const session = sessions.get(session_id);
    if (!session) return { error: "Session not found or expired.", status: 404 };
    if (session.license_key !== req.headers["x-license-key"]) {
      return { error: "License key does not match session.", status: 403 };
    }
    // Merge any overrides sent alongside session_id
    return { draft_state: { ...session.draft_state, ...draft_state } };
  }

  if (!draft_state) return { error: "Missing draft_state or session_id.", status: 400 };
  return { draft_state };
}

/**
 * POST /v1/valuate
 * $ value of a single player.
 *
 * Body (stateless):
 * {
 *   "draft_state": {
 *     "total_teams": 12,
 *     "budget_per_team": 260,
 *     "scoring_categories": ["HR","RBI","AVG","SB","ERA","SO","WHIP"],
 *     "teams": [{ "id": 1, "budget_remaining": 248, "roster": ["Garrett Crochet"] }],
 *     "nominated_player": "Gerrit Cole",
 *     "roster_config": { "C":1,"1B":1,"2B":1,"3B":1,"SS":1,"OF":3,"SP":2,"RP":2,"UTIL":1,"BN":2 }
 *   }
 * }
 *
 * Body (session-based):
 * {
 *   "session_id": "sess_abc123",
 *   "draft_state": { "nominated_player": "Gerrit Cole" }
 * }
 *
 * Response:
 * {
 *   "player": "Gerrit Cole",
 *   "true_dollar_value": 38,
 *   "max_bid_recommendation": 34,
 *   "market_inflation": 1.05,
 *   "scarcity_tier": "HIGH",
 *   "position_scarcity": { "SP": "HIGH" },
 *   "draftability_score": 0.95,
 *   "reasoning": "SP scarce — high demand in pool. Tier: Elite. TDV: $38.",
 *   "stats": { "tier": "Elite", "positions": ["SP"], "team": "NYY", "league": "AL" }
 * }
 */
router.post("/", requireApiKey, (req, res) => {
  const resolved = resolveDraftState(req);
  if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });

  const { draft_state } = resolved;
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
 * $ value of a specific collection of players in one request.
 *
 * Body (stateless):
 * {
 *   "draft_state": {
 *     "total_teams": 12,
 *     "budget_per_team": 260,
 *     "scoring_categories": ["HR","RBI","AVG","SB","ERA","SO","WHIP"],
 *     "teams": [...],
 *     "roster_config": {...}
 *   },
 *   "players": ["Gerrit Cole", "Shohei Ohtani", "Juan Soto"]
 * }
 *
 * Body (session-based):
 * {
 *   "session_id": "sess_abc123",
 *   "players": ["Gerrit Cole", "Shohei Ohtani"]
 * }
 *
 * Response:
 * {
 *   "count": 2,
 *   "valuations": [
 *     { "player": "Gerrit Cole", "true_dollar_value": 38, "max_bid_recommendation": 34, ... },
 *     { "player": "Shohei Ohtani", "true_dollar_value": 72, "max_bid_recommendation": 66, ... }
 *   ],
 *   "errors": []
 * }
 */
router.post("/batch", requireApiKey, (req, res) => {
  const { players } = req.body || {};

  if (!players || !Array.isArray(players) || players.length === 0) {
    return res.status(400).json({ error: "Bad Request", message: "players array is required and must be non-empty." });
  }
  if (players.length > 50) {
    return res.status(400).json({ error: "Bad Request", message: "Batch size limit is 50 players." });
  }

  const resolved = resolveDraftState(req);
  if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });

  const { draft_state } = resolved;
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
    } catch (err) {
      errors.push({ player: playerName, error: "Valuation calculation failed." });
    }
  }

  res.json({ count: valuations.length, valuations, errors });
});

/**
 * GET /v1/valuate/all
 * $ value of ALL eligible (undrafted) players given current draft state.
 * Results are sorted by true_dollar_value descending.
 *
 * Query params (stateless):
 *   total_teams=12
 *   budget_per_team=260
 *   scoring_categories=HR,RBI,AVG,SB,ERA,SO,WHIP
 *   drafted=PlayerName1,PlayerName2,...   (comma-separated names of drafted players)
 *   pos=SP|OF|SS|...                      (filter by position, optional)
 *   tier=Elite|Starter|Bench              (filter by tier, optional)
 *
 * OR session-based (POST body is not supported on GET, so session_id as query param):
 *   session_id=sess_abc123
 *
 * Response:
 * {
 *   "count": 87,
 *   "draft_state_summary": {
 *     "total_teams": 12,
 *     "budget_per_team": 260,
 *     "drafted_count": 23
 *   },
 *   "players": [
 *     { "player": "Shohei Ohtani", "true_dollar_value": 72, "max_bid_recommendation": 66, ... },
 *     ...
 *   ]
 * }
 */
router.get("/all", requireApiKey, (req, res) => {
  let draft_state;

  // Session-based
  if (req.query.session_id) {
    const session = sessions.get(req.query.session_id);
    if (!session) return res.status(404).json({ error: "Session not found or expired." });
    if (session.license_key !== req.headers["x-license-key"]) {
      return res.status(403).json({ error: "License key does not match session." });
    }
    draft_state = session.draft_state;
  } else {
    // Stateless — build draft_state from query params
    const draftedNames = req.query.drafted
      ? req.query.drafted.split(",").map((n) => n.trim()).filter(Boolean)
      : [];

    const scoringCategories = req.query.scoring_categories
      ? req.query.scoring_categories.split(",").map((c) => c.trim())
      : ["HR", "RBI", "AVG", "SB", "ERA", "SO", "WHIP"];

    draft_state = {
      total_teams: parseInt(req.query.total_teams, 10) || 12,
      budget_per_team: parseInt(req.query.budget_per_team, 10) || 260,
      scoring_categories: scoringCategories,
      teams: draftedNames.length > 0
        ? [{ id: 1, budget_remaining: 260, roster: draftedNames }]
        : [],
      roster_config: { C: 1, "1B": 1, "2B": 1, "3B": 1, SS: 1, OF: 3, SP: 2, RP: 2, UTIL: 1, BN: 2 },
    };
  }

  // Collect all drafted player names
  const draftedSet = new Set();
  (draft_state.teams || []).forEach((t) => (t.roster || []).forEach((n) => draftedSet.add(n)));

  // Get undrafted pool with optional position/tier filters
  const eligiblePlayers = getPlayers({
    league: req.query.league || "ALL",
    pos: req.query.pos || "ALL",
    tier: req.query.tier || "ALL",
    available_only: draftedSet.size > 0,
    drafted_names: [...draftedSet],
  });

  const valuations = [];
  const errors = [];

  for (const player of eligiblePlayers) {
    try {
      const result = calculateValuation({ ...draft_state, nominated_player: player.name });
      if (!result.error) valuations.push(result);
    } catch (_) {
      errors.push(player.name);
    }
  }

  // Sort by true_dollar_value descending
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
