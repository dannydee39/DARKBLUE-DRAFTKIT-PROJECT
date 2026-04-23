// routes/valuate.js — POST /v1/valuate endpoint
const express = require("express");
const router = express.Router();
const { requireApiKey } = require("../middleware/auth");
const { calculateValuations } = require("../services/valuation");

/**
 * POST /v1/valuate
 * Stateless valuation — client sends full draft state, receives valuations for the full player pool.
 *
 * Body:
 * {
 *   "license_key": "DB-2026-XXXX-XXXX",
 *   "draft_state": {
 *     "total_teams": 12,
 *     "budget_per_team": 260,
 *     "scoring_categories": ["HR","RBI","AVG","SB","ERA","SO","WHIP"],
 *     "teams": [{ "id": 1, "budget_remaining": 248, "roster": [["Garrett Crochet", "BOS"]] }],
 *     "roster_config": { "C":2, "1B":1, "2B":1, "CI":1, "3B":1, "SS":1, "MI":1, "OF":5, "SP":0, "RP":0, "P":9, "UTIL":1, "BN":0, "TAXI":0 }
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

  try {
    const result = calculateValuations(draft_state);
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
