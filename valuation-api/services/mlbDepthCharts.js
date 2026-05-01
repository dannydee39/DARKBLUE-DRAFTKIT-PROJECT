const players = require("../data/players.json");

const MLB_STATS_BASE = "https://statsapi.mlb.com/api/v1";
const CACHE_TTL_MS = Number(process.env.MLB_DEPTH_CACHE_TTL_MS || 15 * 60 * 1000);
const FETCH_TIMEOUT_MS = Number(process.env.MLB_DEPTH_TIMEOUT_MS || 6000);

const TEAM_IDS = {
  ATH: 133,
  ATL: 144,
  AZ: 109,
  BAL: 110,
  BOS: 111,
  CHC: 112,
  CIN: 113,
  CLE: 114,
  COL: 115,
  CWS: 145,
  DET: 116,
  HOU: 117,
  KC: 118,
  LAA: 108,
  LAD: 119,
  MIA: 146,
  MIL: 158,
  MIN: 142,
  NYM: 121,
  NYY: 147,
  PHI: 143,
  PIT: 134,
  SD: 135,
  SEA: 136,
  SF: 137,
  STL: 138,
  TB: 139,
  TEX: 140,
  TOR: 141,
  WSH: 120,
};

const TEAM_CODES_BY_ID = Object.fromEntries(
  Object.entries(TEAM_IDS).map(([code, id]) => [id, code]),
);

let cachedPayload = null;
let cachedAt = 0;
let inFlightPromise = null;

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function buildFallbackPayload(errorMessage = "") {
  const grouped = new Map();

  players.forEach((player) => {
    if (!player?.team) return;
    if (!grouped.has(player.team)) {
      grouped.set(player.team, {
        team: player.team,
        mlbTeamId: TEAM_IDS[player.team] || null,
        teamName: player.team,
        roster: [],
      });
    }

    grouped.get(player.team).roster.push({
      mlbId: player.mlbId || null,
      name: player.name,
      team: player.team,
      jerseyNumber: null,
      positionCode: player.pos?.[0] || null,
      positionName: player.pos?.join("/") || null,
      statusCode: "LOCAL",
      statusDescription: "Local fantasy pool fallback",
      active: false,
      poolPlayerId: player.id,
    });
  });

  return {
    source: "local-player-pool-fallback",
    upstream: MLB_STATS_BASE,
    generated_at: new Date().toISOString(),
    cache: { hit: false, ttl_ms: CACHE_TTL_MS },
    warning:
      errorMessage ||
      "MLB Stats API roster data was unavailable; returned local player pool context.",
    teams: [...grouped.values()].sort((a, b) => a.team.localeCompare(b.team)),
  };
}

function normalizeRosterEntry(entry, teamCode, teamId, teamName) {
  const person = entry.person || {};
  const position = entry.position || {};
  const status = entry.status || {};

  return {
    mlbId: person.id || null,
    name: person.fullName || person.name || "",
    nameKey: normalizeKey(person.fullName || person.name || ""),
    team: teamCode,
    mlbTeamId: teamId,
    teamName,
    jerseyNumber: entry.jerseyNumber || null,
    positionCode: position.abbreviation || position.code || null,
    positionName: position.name || position.type || null,
    statusCode: status.code || entry.statusCode || "A",
    statusDescription: status.description || entry.statusDescription || "Active",
    active: String(status.code || "A").toUpperCase() === "A",
    rosterType: entry.rosterType || "active",
  };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`MLB Stats API returned ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchTeamRoster(teamCode, teamId) {
  const url = `${MLB_STATS_BASE}/teams/${teamId}/roster?rosterType=active`;
  const data = await fetchJson(url);
  const teamName =
    data?.team?.name ||
    data?.team?.clubName ||
    data?.roster?.[0]?.team?.name ||
    teamCode;

  return {
    team: teamCode,
    mlbTeamId: teamId,
    teamName,
    roster: (data.roster || []).map((entry) =>
      normalizeRosterEntry(entry, teamCode, teamId, teamName),
    ),
  };
}

async function fetchLiveDepthCharts() {
  const teams = await Promise.all(
    Object.entries(TEAM_IDS).map(([teamCode, teamId]) =>
      fetchTeamRoster(teamCode, teamId),
    ),
  );

  return {
    source: "mlb-stats-api-active-roster",
    upstream: MLB_STATS_BASE,
    generated_at: new Date().toISOString(),
    cache: { hit: false, ttl_ms: CACHE_TTL_MS },
    teams: teams.sort((a, b) => a.team.localeCompare(b.team)),
  };
}

async function getMlbDepthCharts(options = {}) {
  const now = Date.now();
  const forceRefresh = Boolean(options.forceRefresh);

  if (
    !forceRefresh &&
    cachedPayload &&
    now - cachedAt < CACHE_TTL_MS
  ) {
    return {
      ...cachedPayload,
      cache: {
        ...(cachedPayload.cache || {}),
        hit: true,
        cached_at: new Date(cachedAt).toISOString(),
      },
    };
  }

  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = fetchLiveDepthCharts()
    .then((payload) => {
      cachedPayload = payload;
      cachedAt = Date.now();
      return payload;
    })
    .catch((error) => {
      if (cachedPayload) {
        return {
          ...cachedPayload,
          source: `${cachedPayload.source}-stale-cache`,
          warning: error?.message || "MLB Stats API unavailable; using stale cache.",
          cache: {
            ...(cachedPayload.cache || {}),
            hit: true,
            stale: true,
            cached_at: new Date(cachedAt).toISOString(),
          },
        };
      }
      return buildFallbackPayload(error?.message);
    })
    .finally(() => {
      inFlightPromise = null;
    });

  return inFlightPromise;
}

module.exports = {
  TEAM_IDS,
  TEAM_CODES_BY_ID,
  getMlbDepthCharts,
  normalizeRosterEntry,
};
