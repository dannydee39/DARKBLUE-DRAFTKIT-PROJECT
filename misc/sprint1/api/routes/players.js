// routes/players.js — GET /v1/players endpoint
const express = require("express");
const router = express.Router();
const { requireApiKey } = require("../middleware/auth");
const { getPlayers } = require("../services/valuation");

/**
 * GET /v1/players
 * Returns the player pool with optional filters.
 *
 * Query params:
 *   league=NL|AL|ALL
 *   pos=SP|OF|SS|... (any position)
 *   tier=Elite|Starter|Bench
 *   drafted=comma,separated,player,names (to mark as unavailable)
 */
router.get("/", requireApiKey, (req, res) => {
  const { league, pos, tier, drafted } = req.query;

  const drafted_names = drafted
    ? drafted.split(",").map((n) => n.trim())
    : [];

  const result = getPlayers({
    league: league || "ALL",
    pos: pos || "ALL",
    tier: tier || "ALL",
    available_only: drafted_names.length > 0,
    drafted_names,
  });

  res.json({
    count: result.length,
    players: result,
  });
});

module.exports = router;
