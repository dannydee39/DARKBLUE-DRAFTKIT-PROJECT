const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const DB_PATH =
  process.env.AUTH_DB_PATH ||
  path.join(__dirname, "../data/draftkit-auth.db");

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

  CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    season TEXT,
    status TEXT NOT NULL DEFAULT 'cloud',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_opened_at TEXT,
    summary_json TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS draft_notes (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    player_id INTEGER,
    player_name TEXT NOT NULL,
    team TEXT,
    positions_json TEXT NOT NULL DEFAULT '[]',
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    headline TEXT NOT NULL,
    body TEXT,
    injury_status TEXT,
    impact_summary TEXT,
    source TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_drafts_user_id_updated_at ON drafts(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_draft_notes_draft_created ON draft_notes(draft_id, user_id, created_at DESC);
`);

function nowIso() {
  return new Date().toISOString();
}

function listUsers() {
  return db.prepare("SELECT id, email, display_name, created_at, updated_at FROM users").all();
}

function findUserByEmail(email) {
  return db
    .prepare(
      "SELECT id, email, display_name, password_hash, created_at, updated_at FROM users WHERE email = ? COLLATE NOCASE"
    )
    .get(email);
}

function findUserById(id) {
  return db
    .prepare(
      "SELECT id, email, display_name, created_at, updated_at FROM users WHERE id = ?"
    )
    .get(id);
}

function createUser({ email, displayName, passwordHash }) {
  const timestamp = nowIso();
  const info = db
    .prepare(
      `INSERT INTO users (email, display_name, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(email, displayName, passwordHash, timestamp, timestamp);
  return findUserById(info.lastInsertRowid);
}

function createSession({ id, userId, tokenHash, expiresAt }) {
  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, updated_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, userId, tokenHash, timestamp, timestamp, expiresAt);
}

function findSessionByTokenHash(tokenHash) {
  return db
    .prepare(
      `SELECT s.id, s.user_id, s.token_hash, s.created_at, s.updated_at, s.expires_at,
              u.email, u.display_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash);
}

function touchSession(id, expiresAt) {
  db.prepare(
    `UPDATE sessions
     SET updated_at = ?, expires_at = ?
     WHERE id = ?`
  ).run(nowIso(), expiresAt, id);
}

function deleteSessionByTokenHash(tokenHash) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

function deleteExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso());
}

function summarizeDraftRecord(record = {}) {
  const league = record.league || {};
  const teams = Array.isArray(league.teams) ? league.teams : [];
  const mainPicks = teams.reduce(
    (total, team) => total + (team.roster || []).length,
    0
  );
  const taxiPicks = teams.reduce(
    (total, team) => total + (team.taxiSquad || []).length,
    0
  );

  return {
    id: record.id,
    name: league.name || "Untitled League",
    season: String(league.season || "2025"),
    pool: league.pool || "MLB",
    owners: Number(league.owners || 0),
    mainPicks,
    taxiPicks,
    updatedAt: record.updatedAt || nowIso(),
    lastOpenedAt: record.lastOpenedAt || record.updatedAt || null,
    source: "cloud",
  };
}

function normalizeDraftRecord(record = {}) {
  const summary = summarizeDraftRecord(record);
  return {
    ...record,
    updatedAt: summary.updatedAt,
    lastOpenedAt: summary.lastOpenedAt,
    source: "cloud",
  };
}

function listDraftsForUser(userId) {
  const rows = db
    .prepare(
      `SELECT payload_json
       FROM drafts
       WHERE user_id = ?
       ORDER BY updated_at DESC`
    )
    .all(userId);

  return rows.map((row) => normalizeDraftRecord(JSON.parse(row.payload_json)));
}

function upsertDraftForUser(userId, draftRecord) {
  const normalized = normalizeDraftRecord(draftRecord);
  const summary = summarizeDraftRecord(normalized);
  const timestamp = nowIso();
  const existing = db
    .prepare("SELECT id FROM drafts WHERE id = ? AND user_id = ?")
    .get(normalized.id, userId);

  if (existing) {
    db.prepare(
      `UPDATE drafts
       SET name = ?,
           season = ?,
           status = 'cloud',
           updated_at = ?,
           last_opened_at = ?,
           summary_json = ?,
           payload_json = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      summary.name,
      summary.season,
      normalized.updatedAt || timestamp,
      normalized.lastOpenedAt || normalized.updatedAt || timestamp,
      JSON.stringify(summary),
      JSON.stringify(normalized),
      normalized.id,
      userId
    );
  } else {
    db.prepare(
      `INSERT INTO drafts (
         id, user_id, name, season, status, created_at, updated_at, last_opened_at, summary_json, payload_json
       ) VALUES (?, ?, ?, ?, 'cloud', ?, ?, ?, ?, ?)`
    ).run(
      normalized.id,
      userId,
      summary.name,
      summary.season,
      normalized.createdAt || timestamp,
      normalized.updatedAt || timestamp,
      normalized.lastOpenedAt || normalized.updatedAt || timestamp,
      JSON.stringify(summary),
      JSON.stringify(normalized)
    );
  }

  return normalized;
}

function deleteDraftForUser(userId, draftId) {
  const info = db
    .prepare("DELETE FROM drafts WHERE id = ? AND user_id = ?")
    .run(draftId, userId);
  return info.changes > 0;
}

function findDraftForUser(userId, draftId) {
  return db
    .prepare("SELECT id, payload_json FROM drafts WHERE id = ? AND user_id = ?")
    .get(draftId, userId);
}

function cleanText(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeNoteType(value) {
  const normalized = cleanText(value).toUpperCase();
  return ["INJURY", "NEWS", "LINEUP", "ROLE"].includes(normalized)
    ? normalized
    : "NEWS";
}

function normalizeSeverity(value) {
  const normalized = cleanText(value).toUpperCase();
  return ["LOW", "MEDIUM", "HIGH"].includes(normalized) ? normalized : "LOW";
}

function defaultImpactSummary(type, severity) {
  if (severity === "HIGH") {
    return "Treat as a meaningful draft risk before bidding.";
  }
  if (severity === "MEDIUM") {
    return "Keep this player on the watch list before committing budget.";
  }
  if (type === "INJURY") {
    return "Low-risk injury context; confirm status before bidding.";
  }
  return "Informational note for draft review.";
}

function rowToDraftNote(row) {
  if (!row) return null;
  let positions = [];
  try {
    positions = JSON.parse(row.positions_json || "[]");
  } catch {
    positions = [];
  }

  return {
    id: row.id,
    draft_id: row.draft_id,
    player_id: row.player_id,
    player_name: row.player_name,
    team: row.team || null,
    positions,
    type: row.type,
    severity: row.severity,
    risk_level: row.risk_level,
    headline: row.headline,
    body: row.body || "",
    injury_status: row.injury_status || null,
    impact_summary: row.impact_summary || null,
    source: row.source,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

function listDraftNotesForUser(userId, draftId, options = {}) {
  if (!findDraftForUser(userId, draftId)) return null;
  const limit = Math.max(1, Math.min(Number(options.limit || 25), 100));
  const rows = db
    .prepare(
      `SELECT *
       FROM draft_notes
       WHERE draft_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(draftId, userId, limit);
  return rows.map(rowToDraftNote);
}

function findDraftNoteForUser(userId, draftId, noteId) {
  const row = db
    .prepare(
      `SELECT *
       FROM draft_notes
       WHERE id = ? AND draft_id = ? AND user_id = ?`
    )
    .get(noteId, draftId, userId);
  return rowToDraftNote(row);
}

function createDraftNoteForUser(userId, draftId, input = {}) {
  const draft = findDraftForUser(userId, draftId);
  if (!draft) return null;

  const playerId = Number(input.player_id);
  const playerName = cleanText(input.player_name);
  if (!Number.isFinite(playerId) && !playerName) {
    const error = new Error("A player_id or player_name is required.");
    error.statusCode = 400;
    throw error;
  }

  const type = normalizeNoteType(input.type);
  const severity = normalizeSeverity(input.severity);
  const timestamp = nowIso();
  let positions = Array.isArray(input.positions) ? input.positions : [];
  positions = positions.map((pos) => cleanText(pos)).filter(Boolean);
  const note = {
    id: input.id || `note-${crypto.randomUUID()}`,
    draft_id: draftId,
    player_id: Number.isFinite(playerId) ? playerId : null,
    player_name: playerName || `Player ${playerId}`,
    team: cleanText(input.team) || null,
    positions,
    type,
    severity,
    risk_level: normalizeSeverity(input.risk_level || severity),
    headline:
      cleanText(input.headline) ||
      `${playerName || `Player ${playerId}`} marked for ${severity.toLowerCase()} ${type.toLowerCase()} review`,
    body: cleanText(input.body),
    injury_status:
      type === "INJURY" ? cleanText(input.injury_status) || "Questionable" : cleanText(input.injury_status) || null,
    impact_summary:
      cleanText(input.impact_summary) || defaultImpactSummary(type, severity),
    source: cleanText(input.source) || "League commissioner note",
    created_by: cleanText(input.created_by) || "Draft Kit commissioner",
    created_at: input.created_at || timestamp,
  };

  db.prepare(
    `INSERT INTO draft_notes (
       id, draft_id, user_id, player_id, player_name, team, positions_json,
       type, severity, risk_level, headline, body, injury_status,
       impact_summary, source, created_by, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    note.id,
    note.draft_id,
    userId,
    note.player_id,
    note.player_name,
    note.team,
    JSON.stringify(note.positions),
    note.type,
    note.severity,
    note.risk_level,
    note.headline,
    note.body,
    note.injury_status,
    note.impact_summary,
    note.source,
    note.created_by,
    note.created_at
  );

  return note;
}

function deleteDraftNoteForUser(userId, draftId, noteId) {
  const info = db
    .prepare("DELETE FROM draft_notes WHERE id = ? AND draft_id = ? AND user_id = ?")
    .run(noteId, draftId, userId);
  return info.changes > 0;
}

function touchDraftOpened(userId, draftId, openedAt = nowIso()) {
  const row = db
    .prepare("SELECT payload_json FROM drafts WHERE id = ? AND user_id = ?")
    .get(draftId, userId);
  if (!row) return null;

  const payload = normalizeDraftRecord(JSON.parse(row.payload_json));
  payload.lastOpenedAt = openedAt;
  payload.updatedAt = payload.updatedAt || openedAt;

  db.prepare(
    `UPDATE drafts
     SET last_opened_at = ?, summary_json = ?, payload_json = ?
     WHERE id = ? AND user_id = ?`
  ).run(
    openedAt,
    JSON.stringify(summarizeDraftRecord(payload)),
    JSON.stringify(payload),
    draftId,
    userId
  );

  return payload;
}

module.exports = {
  DB_PATH,
  db,
  listUsers,
  findUserByEmail,
  findUserById,
  createUser,
  createSession,
  findSessionByTokenHash,
  touchSession,
  deleteSessionByTokenHash,
  deleteExpiredSessions,
  listDraftsForUser,
  upsertDraftForUser,
  deleteDraftForUser,
  findDraftForUser,
  touchDraftOpened,
  listDraftNotesForUser,
  findDraftNoteForUser,
  createDraftNoteForUser,
  deleteDraftNoteForUser,
};
