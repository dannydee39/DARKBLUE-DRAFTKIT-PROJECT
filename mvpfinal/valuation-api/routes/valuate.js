// routes/valuate.js — POST /v1/valuate endpoint
const express = require("express");
const router = express.Router();
const { requireApiKey } = require("../middleware/auth");
const { calculateValuation } = require("../services/valuation");

/**
 * POST /v1/valuate
 * Stateless valuation — client sends full draft state, receives player valuation.
 *
 * Body:
 * {
 *   "license_key": "DB-2026-XXXX-XXXX",
 *   "draft_state": {
 *     "total_teams": 12,
 *     "budget_per_team": 260,
 *     "scoring_categories": ["HR","RBI","AVG","SB","ERA","SO","WHIP"],
 *     "teams": [{ "id": 1, "budget_remaining": 248, "roster": ["Garrett Crochet"] }],
 *     "nominated_player": "Gerrit Cole",
 *     "roster_config": { "C":1, "1B":1, "2B":1, "3B":1, "SS":1, "OF":3, "SP":2, "RP":2, "UTIL":1, "BN":2 }
 *   }
 * }
 */
router.post("/", requireApiKey, (req, res) => {
  const { draft_state } = req.body;

  if (!draft_state) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Missing draft_state in request body.",
    });
  }

  if (!draft_state.nominated_player) {
    return res.status(400).json({
      error: "Bad Request",
      message: "draft_state.nominated_player is required.",
    });
  }

  try {
    const result = calculateValuation(draft_state);

    if (result.error) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error("Valuation error:", err);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Valuation calculation failed.",
    });
  }
});

module.exports = router;
