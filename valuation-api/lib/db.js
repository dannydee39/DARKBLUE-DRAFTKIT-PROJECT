const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const DB_PATH =
  process.env.VALUATION_AUTH_DB_PATH ||
  path.join(__dirname, "../data/valuation-auth.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 3000");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    request_ip TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    account_id TEXT NOT NULL UNIQUE,
    key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    plan TEXT NOT NULL,
    environment TEXT NOT NULL,
    requests_limit INTEGER NOT NULL,
    requests_used INTEGER NOT NULL DEFAULT 0,
    renews_on TEXT,
    allowed_ips TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);
  CREATE INDEX IF NOT EXISTS idx_licenses_user_status ON licenses(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_licenses_key_status ON licenses(key, status);
`);

function nowIso() {
  return new Date().toISOString();
}

function oneYearFromNowIsoDate() {
  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function findUserByEmail(email) {
  return db
    .prepare(
      "SELECT id, email, display_name, password_hash, created_at, updated_at FROM users WHERE email = ? COLLATE NOCASE",
    )
    .get(email);
}

function findUserById(id) {
  return db
    .prepare(
      "SELECT id, email, display_name, password_hash, created_at, updated_at FROM users WHERE id = ?",
    )
    .get(id);
}

function createUser({ email, displayName, passwordHash }) {
  const timestamp = nowIso();
  const info = db
    .prepare(
      `INSERT INTO users (email, display_name, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(email, displayName, passwordHash, timestamp, timestamp);
  return findUserById(info.lastInsertRowid);
}

function createSession({ id, userId, tokenHash, expiresAt }) {
  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, updated_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, tokenHash, timestamp, timestamp, expiresAt);
}

function findSessionByTokenHash(tokenHash) {
  return db
    .prepare(
      `SELECT s.id, s.user_id, s.token_hash, s.created_at, s.updated_at, s.expires_at,
              u.email, u.display_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(tokenHash);
}

function touchSession(id, expiresAt) {
  db.prepare(
    `UPDATE sessions
     SET updated_at = ?, expires_at = ?
     WHERE id = ?`,
  ).run(nowIso(), expiresAt, id);
}

function deleteSessionByTokenHash(tokenHash) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

function deleteExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso());
}

function createPasswordResetToken({
  id,
  userId,
  tokenHash,
  expiresAt,
  requestIp = null,
  userAgent = null,
}) {
  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO password_reset_tokens (
       id, user_id, token_hash, created_at, expires_at, request_ip, user_agent
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, tokenHash, timestamp, expiresAt, requestIp, userAgent);
}

function findPasswordResetToken(tokenHash) {
  return db
    .prepare(
      `SELECT prt.id, prt.user_id, prt.token_hash, prt.created_at,
              prt.expires_at, prt.used_at, u.email, u.display_name
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = ?`,
    )
    .get(tokenHash);
}

function markPasswordResetTokenUsed(id) {
  db.prepare(
    `UPDATE password_reset_tokens
     SET used_at = ?
     WHERE id = ?`,
  ).run(nowIso(), id);
}

function deletePasswordResetTokensForUser(userId) {
  db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(userId);
}

function deleteExpiredPasswordResetTokens() {
  db.prepare("DELETE FROM password_reset_tokens WHERE expires_at <= ? OR used_at IS NOT NULL").run(nowIso());
}

function updateUserPassword(userId, passwordHash) {
  const info = db
    .prepare(
      `UPDATE users
       SET password_hash = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(passwordHash, nowIso(), userId);
  return info.changes > 0;
}

function deleteSessionsForUser(userId) {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

function createLicenseForUser(userId, key) {
  const timestamp = nowIso();
  const license = {
    id: crypto.randomUUID(),
    userId,
    accountId: `acct_${crypto.randomBytes(6).toString("hex")}`,
    key,
    status: "active",
    plan: "DraftKit License",
    environment: "Production",
    requestsLimit: Number(process.env.DEFAULT_LICENSE_REQUEST_LIMIT || 25000),
    requestsUsed: 0,
    renewsOn: oneYearFromNowIsoDate(),
    allowedIps: "",
  };

  db.prepare(
    `INSERT INTO licenses (
       id, user_id, account_id, key, status, plan, environment,
       requests_limit, requests_used, renews_on, allowed_ips, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    license.id,
    license.userId,
    license.accountId,
    license.key,
    license.status,
    license.plan,
    license.environment,
    license.requestsLimit,
    license.requestsUsed,
    license.renewsOn,
    license.allowedIps,
    timestamp,
    timestamp,
  );

  return findPrimaryLicenseForUser(userId);
}

function rowToLicense(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    account_id: row.account_id,
    key: row.key,
    status: row.status,
    plan: row.plan,
    environment: row.environment,
    requests_limit: row.requests_limit,
    requests_used: row.requests_used,
    renews_on: row.renews_on,
    allowed_ips: row.allowed_ips || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function findPrimaryLicenseForUser(userId) {
  const row = db
    .prepare(
      `SELECT *
       FROM licenses
       WHERE user_id = ? AND status = 'active'
       ORDER BY created_at ASC
       LIMIT 1`,
    )
    .get(userId);
  return rowToLicense(row);
}

function findLicenseByKey(key) {
  const row = db
    .prepare(
      `SELECT *
       FROM licenses
       WHERE key = ? AND status = 'active'
       LIMIT 1`,
    )
    .get(key);
  return rowToLicense(row);
}

module.exports = {
  DB_PATH,
  db,
  findUserByEmail,
  findUserById,
  createUser,
  createSession,
  findSessionByTokenHash,
  touchSession,
  deleteSessionByTokenHash,
  deleteExpiredSessions,
  createPasswordResetToken,
  findPasswordResetToken,
  markPasswordResetTokenUsed,
  deletePasswordResetTokensForUser,
  deleteExpiredPasswordResetTokens,
  updateUserPassword,
  deleteSessionsForUser,
  createLicenseForUser,
  findPrimaryLicenseForUser,
  findLicenseByKey,
};
