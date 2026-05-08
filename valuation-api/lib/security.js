const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function deriveDisplayName(email = "") {
  const normalized = normalizeEmail(email);
  const local = normalized.split("@")[0] || "Buyer";
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Buyer"
  );
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

function createPasswordResetToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function createLicenseKey() {
  const year = new Date().getUTCFullYear();
  return `DB-${year}-LIVE-${crypto.randomBytes(9).toString("base64url").toUpperCase()}`;
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function hashPasswordResetToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function createSessionExpiry() {
  return new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function sanitizeUser(user, license = null) {
  if (!user) return null;
  const displayName = user.display_name || user.displayName || user.email || "Buyer";
  return {
    id: user.id,
    email: user.email,
    displayName,
    initials: displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join(""),
    license: license
      ? {
          id: license.id,
          accountId: license.account_id,
          key: license.key,
          status: license.status,
          plan: license.plan,
          environment: license.environment,
          requestsLimit: license.requests_limit,
          requestsUsed: license.requests_used,
          renewsOn: license.renews_on,
          createdAt: license.created_at,
        }
      : null,
  };
}

module.exports = {
  normalizeEmail,
  deriveDisplayName,
  hashPassword,
  verifyPassword,
  createSessionToken,
  createPasswordResetToken,
  createLicenseKey,
  hashSessionToken,
  hashPasswordResetToken,
  createSessionExpiry,
  sanitizeUser,
};
