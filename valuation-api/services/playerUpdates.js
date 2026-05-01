const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const players = require("../data/players.json");

const PLAYER_BY_ID = new Map(players.map((player) => [player.id, player]));
const RISK_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const UPDATE_TYPES = new Set(["INJURY", "NEWS", "LINEUP", "ROLE"]);
const UPDATE_SEVERITIES = new Set(["LOW", "MEDIUM", "HIGH"]);
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
      injury_status: player.injury || null,
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
    injury_status: latestUpdate.injury_status || player.injury || null,
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

  const type = normalizeType(input.type);
  const severity = normalizeSeverity(input.severity);
  const createdAt = input.created_at || new Date().toISOString();

  return {
    id: String(input.id || `upd-${randomUUID()}`),
    player_id: player.id,
    player_name: player.name,
    team: player.team,
    positions: player.pos,
    type,
    severity,
    risk_level: severity,
    headline: cleanText(input.headline) || defaultHeadline(player, type, severity),
    body: cleanText(input.body) || defaultBody(player, type, severity),
    injury_status:
      type === "INJURY"
        ? cleanText(input.injury_status) || defaultInjuryStatus(severity)
        : null,
    impact_summary:
      cleanText(input.impact_summary) || defaultImpactSummary(type, severity),
    source: cleanText(input.source) || "Manual update",
    created_by: cleanText(input.created_by) || "Draft Kit",
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

function normalizeType(value) {
  const next = String(value || "NEWS").trim().toUpperCase();
  return UPDATE_TYPES.has(next) ? next : "NEWS";
}

function normalizeSeverity(value) {
  const next = String(value || "LOW").trim().toUpperCase();
  return UPDATE_SEVERITIES.has(next) ? next : "LOW";
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

function defaultHeadline(player, type, severity) {
  if (type === "INJURY") {
    return `${player.name} moved to ${severity.toLowerCase()} injury risk`;
  }
  return `${player.name} status updated`;
}

function defaultBody(player, type, severity) {
  if (type === "INJURY") {
    return `${player.name} is carrying a ${severity.toLowerCase()} injury risk flag for draft review.`;
  }
  return `${player.name} has an updated draft-day status note.`;
}

function defaultInjuryStatus(severity) {
  if (severity === "HIGH") return "Questionable";
  if (severity === "MEDIUM") return "Day-to-day";
  return "Monitor";
}

function defaultImpactSummary(type, severity) {
  if (type === "INJURY" && severity === "HIGH") {
    return "Consider lowering the max bid or waiting for roster clarity.";
  }
  if (type === "INJURY") {
    return "Keep the player visible, but review injury risk before bidding.";
  }
  return "Player context updated for draft decisions.";
}

module.exports = {
  createPlayerUpdate,
  decoratePlayerWithUpdate,
  getLatestUpdateForPlayer,
  listPlayerUpdates,
  subscribeToPlayerUpdates,
};
