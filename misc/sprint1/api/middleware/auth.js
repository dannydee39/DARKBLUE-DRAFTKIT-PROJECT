// middleware/auth.js — API Key authentication middleware
const VALID_KEYS = new Set(
  (process.env.API_KEYS || "DB-2026-DEMO-0001").split(",").map((k) => k.trim())
);

/**
 * Validates X-License-Key header against configured API keys.
 * Returns 401 if key is missing or invalid.
 */
function requireApiKey(req, res, next) {
  const key = req.headers["x-license-key"];

  if (!key) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing X-License-Key header. Register at api.darkblue.io.",
      code: "NO_KEY",
    });
  }

  if (!VALID_KEYS.has(key)) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid license key. Verify your key at api.darkblue.io.",
      code: "INVALID_KEY",
    });
  }

  next();
}

module.exports = { requireApiKey };
