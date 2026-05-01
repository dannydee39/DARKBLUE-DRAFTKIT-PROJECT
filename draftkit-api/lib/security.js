const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function deriveDisplayName(email = "") {
  const normalized = normalizeEmail(email);
  const local = normalized.split("@")[0] || "Draft Kit User";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Draft Kit User";
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createSessionExpiry() {
  return new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name || user.displayName,
    initials: (user.display_name || user.displayName || user.email || "U")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join(""),
  };
}

module.exports = {
  normalizeEmail,
  deriveDisplayName,
  hashPassword,
  verifyPassword,
  createSessionToken,
  hashSessionToken,
  createSessionExpiry,
  sanitizeUser,
};
