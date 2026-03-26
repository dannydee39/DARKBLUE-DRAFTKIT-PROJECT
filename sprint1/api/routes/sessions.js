// routes/sessions.js — Session-based draft state management
// Clients open a session once with full league + draft state, then
// subsequent valuation requests reference the session_id instead of
// re-sending all draft state every time.
const express = require("express");
const router = express.Router();
const { requireApiKey } = require("../middleware/auth");
const crypto = require("crypto");

// In-memory session store (replace with DB in production)
// Key: session_id, Value: { license_key, draft_state, created_at, updated_at }
const sessions = new Map();

// Session TTL: 6 hours
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

function cleanExpired() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.created_at > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

/**
 * POST /v1/sessions
 * Create a new draft session with initial league + draft state.
 *
 * Headers:
 *   X-License-Key: <key>
 *
 * Body:
 * {
 *   "draft_state": {
 *     "total_teams": 12,
 *     "budget_per_team": 260,
 *     "scoring_categories": ["HR","RBI","AVG","SB","ERA","SO","WHIP"],
 *     "teams": [],
 *     "roster_config": { "C":1, "1B":1, "2B":1, "3B":1, "SS":1, "OF":3, "SP":2, "RP":2, "UTIL":1, "BN":2 }
 *   }
 * }
 *
 * Response:
 * {
 *   "session_id": "sess_abc123",
 *   "expires_at": "2026-03-26T18:00:00Z"
 * }
 */
router.post("/", requireApiKey, (req, res) => {
  cleanExpired();
  const { draft_state } = req.body;

  if (!draft_state) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Missing draft_state in request body.",
    });
  }

  const session_id = "sess_" + crypto.randomBytes(12).toString("hex");
  const license_key = req.headers["x-license-key"];
  const now = Date.now();

  sessions.set(session_id, {
    license_key,
    draft_state,
    created_at: now,
    updated_at: now,
  });

  res.status(201).json({
    session_id,
    expires_at: new Date(now + SESSION_TTL_MS).toISOString(),
  });
});

/**
 * PUT /v1/sessions/:session_id
 * Update draft state in an existing session (e.g. after a player is drafted).
 *
 * Body: same shape as POST — full or partial draft_state
 */
router.put("/:session_id", requireApiKey, (req, res) => {
  const { session_id } = req.params;
  const session = sessions.get(session_id);

  if (!session) {
    return res.status(404).json({
      error: "Not Found",
      message: "Session not found or expired.",
    });
  }

  if (session.license_key !== req.headers["x-license-key"]) {
    return res.status(403).json({
      error: "Forbidden",
      message: "License key does not match session owner.",
    });
  }

  const { draft_state } = req.body;
  if (!draft_state) {
    return res.status(400).json({ error: "Bad Request", message: "Missing draft_state." });
  }

  session.draft_state = { ...session.draft_state, ...draft_state };
  session.updated_at = Date.now();

  res.json({ session_id, updated: true });
});

/**
 * DELETE /v1/sessions/:session_id
 * Explicitly end a session.
 */
router.delete("/:session_id", requireApiKey, (req, res) => {
  const { session_id } = req.params;
  const session = sessions.get(session_id);

  if (!session) {
    return res.status(404).json({ error: "Not Found", message: "Session not found." });
  }
  if (session.license_key !== req.headers["x-license-key"]) {
    return res.status(403).json({ error: "Forbidden", message: "License key mismatch." });
  }

  sessions.delete(session_id);
  res.json({ session_id, deleted: true });
});

/**
 * GET /v1/sessions/:session_id
 * Retrieve current draft state stored in a session.
 */
router.get("/:session_id", requireApiKey, (req, res) => {
  const { session_id } = req.params;
  const session = sessions.get(session_id);

  if (!session) {
    return res.status(404).json({ error: "Not Found", message: "Session not found or expired." });
  }
  if (session.license_key !== req.headers["x-license-key"]) {
    return res.status(403).json({ error: "Forbidden", message: "License key mismatch." });
  }

  res.json({
    session_id,
    draft_state: session.draft_state,
    created_at: new Date(session.created_at).toISOString(),
    updated_at: new Date(session.updated_at).toISOString(),
  });
});

module.exports = { router, sessions };
