const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const players = require("../data/players.json");

const PLAYER_BY_ID = new Map(players.map((player) => [player.id, player]));
const RISK_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const UPDATE_TYPES = new Set(["INJURY", "TRANSACTION", "CONTRACT", "NEWS", "LINEUP", "ROLE"]);
const UPDATE_SEVERITIES = new Set(["LOW", "MEDIUM", "HIGH"]);
const SOURCE_TYPES = new Set(["LIVE_FEED", "MANUAL_DEMO"]);
const DEFAULT_UPDATES_FILE = path.join(__dirname, "..", "data", "player-updates.json");
const UPDATES_FILE = process.env.PLAYER_UPDATES_FILE || DEFAULT_UPDATES_FILE;

let playerUpdates = loadPlayerUpdates();
const subscribers = new Set();

function listPlayerUpdates(options = {}) {
  const limit = clamp(Number(options.limit || 10), 1, 50);
  const since = options.since ? Date.parse(options.since) : null;

  return playerUpdates
    .filter((update) => !Number.isFinite(since) || Date.parse(update.created_at) > since)
    .slice()
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, limit);
}

function createPlayerUpdate(input = {}) {
  const update = normalizeUpdate(input);
  playerUpdates = [update, ...playerUpdates].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  savePlayerUpdates(playerUpdates);
  broadcastPlayerUpdate(update);
  return update;
}

function getLatestUpdateForPlayer(playerId) {
  const id = Number(playerId);
  if (!Number.isFinite(id)) return null;

  return playerUpdates
    .filter((update) => update.player_id === id)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] || null;
}

function decoratePlayerWithUpdate(player) {
  const latestUpdate = getLatestUpdateForPlayer(player.id);
  if (!latestUpdate) {
    return {
      ...player,
      risk_level: "LOW",
      injury_status: null,
      news_headline: null,
      update_impact_summary: null,
      last_update_at: null,
      latest_update: null,
      updates_count: 0,
    };
  }

  const updatesForPlayer = playerUpdates.filter((update) => update.player_id === player.id);
  const highestRisk = updatesForPlayer.reduce(
    (current, update) =>
      RISK_ORDER[update.risk_level] > RISK_ORDER[current] ? update.risk_level : current,
    latestUpdate.risk_level,
  );

  return {
    ...player,
    risk_level: highestRisk,
    injury_status: latestUpdate.injury_status || null,
    news_headline: latestUpdate.headline,
    update_impact_summary: latestUpdate.impact_summary,
    last_update_at: latestUpdate.created_at,
    latest_update: latestUpdate,
    updates_count: updatesForPlayer.length,
  };
}

function normalizeUpdate(input) {
  const player = findPlayer(input.player_id, input.player_name);
  if (!player) {
    const error = new Error("Player update requires a valid player_id or player_name.");
    error.status = 400;
    error.code = "PLAYER_REQUIRED";
    throw error;
  }

  const type = requireType(input.type);
  const severity = requireSeverity(input.severity);
  const createdAt = input.created_at || new Date().toISOString();
  const headline = cleanText(input.headline);
  const body = cleanText(input.body);
  const sourceType = requireSourceType(input.source_type);

  /*
   * Player news is intentionally API-authored. Draft Kit is a subscriber, not
   * a creator, so every notification-worthy update must enter through this
   * Valuation API ingestion boundary. A future live feed adapter should call
   * createPlayerUpdate with source_type="LIVE_FEED"; the API website demo calls
   * the same function with source_type="MANUAL_DEMO".
   */
  if (!headline || !body) {
    const error = new Error("Player update requires headline and body from the Valuation API news source.");
    error.status = 400;
    error.code = "NEWS_CONTENT_REQUIRED";
    throw error;
  }

  return {
    id: String(input.id || `upd-${randomUUID()}`),
    player_id: player.id,
    player_name: player.name,
    team: player.team,
    positions: player.pos,
    type,
    severity,
    risk_level: severity,
    headline,
    body,
    injury_status: type === "INJURY" ? cleanText(input.injury_status) || null : null,
    transaction_status:
      ["TRANSACTION", "LINEUP", "ROLE"].includes(type)
        ? cleanText(input.transaction_status)
        : null,
    contract_status: type === "CONTRACT" ? cleanText(input.contract_status) : null,
    depth_chart_note: cleanText(input.depth_chart_note) || null,
    impact_summary: cleanText(input.impact_summary) || null,
    source: cleanText(input.source) || "Dark Blue Valuation API",
    source_type: sourceType,
    origin: "VALUATION_API",
    notification_worthy: true,
    created_by: cleanText(input.created_by) || "Valuation API ingestion",
    created_at: createdAt,
  };
}

function loadPlayerUpdates() {
  try {
    if (!fs.existsSync(UPDATES_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(UPDATES_FILE, "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        try {
          return normalizeUpdate(entry);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  } catch {
    return [];
  }
}

function savePlayerUpdates(updates) {
  const directory = path.dirname(UPDATES_FILE);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    UPDATES_FILE,
    `${JSON.stringify(updates.slice(0, 500), null, 2)}\n`,
    "utf8",
  );
}

function subscribeToPlayerUpdates(listener) {
  if (typeof listener !== "function") {
    throw new TypeError("Player update subscriber must be a function.");
  }

  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

function broadcastPlayerUpdate(update) {
  for (const listener of subscribers) {
    try {
      listener(update);
    } catch {
      // SSE subscribers clean themselves up on disconnect.
    }
  }
}

function findPlayer(playerId, playerName) {
  const id = Number(playerId);
  if (Number.isFinite(id) && PLAYER_BY_ID.has(id)) {
    return PLAYER_BY_ID.get(id);
  }

  const normalizedName = normalizeName(playerName);
  if (normalizedName) {
    return players.find((player) => normalizeName(player.name) === normalizedName) || null;
  }

  return null;
}

function requireType(value) {
  const next = String(value || "").trim().toUpperCase();
  if (UPDATE_TYPES.has(next)) return next;
  const error = new Error(
    `Player update type is required and must be one of: ${Array.from(UPDATE_TYPES).join(", ")}.`,
  );
  error.status = 400;
  error.code = "NEWS_TYPE_REQUIRED";
  throw error;
}

function requireSourceType(value) {
  const next = String(value || "").trim().toUpperCase();
  if (SOURCE_TYPES.has(next)) return next;
  const error = new Error(
    `Player update source_type is required and must be one of: ${Array.from(SOURCE_TYPES).join(", ")}.`,
  );
  error.status = 400;
  error.code = "NEWS_SOURCE_TYPE_REQUIRED";
  throw error;
}

function requireSeverity(value) {
  const next = String(value || "").trim().toUpperCase();
  if (UPDATE_SEVERITIES.has(next)) return next;
  const error = new Error(
    `Player update severity is required and must be one of: ${Array.from(UPDATE_SEVERITIES).join(", ")}.`,
  );
  error.status = 400;
  error.code = "NEWS_SEVERITY_REQUIRED";
  throw error;
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function cleanText(value) {
  return String(value || "").trim();
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

module.exports = {
  createPlayerUpdate,
  decoratePlayerWithUpdate,
  getLatestUpdateForPlayer,
  listPlayerUpdates,
  subscribeToPlayerUpdates,
};
