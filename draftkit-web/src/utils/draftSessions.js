import { DEFAULT_ROSTER, DEFAULT_SCORING } from "../constants.js";

export const DRAFT_LIBRARY_STORAGE_KEY = "darkblue-draft-library-v1";

export function createDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function clonePlayers(players = []) {
  return players.map((player) => ({ ...player }));
}

export function normalizeTeamName(value, index = 0) {
  const trimmed = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  return trimmed || `Owner ${index + 1}`;
}

export function buildTeamNameList(source = {}, ownerCount = source.owners || 12) {
  const count = Math.max(0, Number(ownerCount) || 0);
  const explicitNames = Array.isArray(source.teamNames) ? source.teamNames : [];
  const teamNames = Array.isArray(source.teams)
    ? source.teams.map((team) => team?.name)
    : [];

  return Array.from({ length: count }, (_, index) =>
    normalizeTeamName(explicitNames[index] || teamNames[index], index),
  );
}

export function cloneLeagueConfig(source = {}) {
  const teams = Array.isArray(source.teams)
    ? source.teams.map((team) => ({
        ...team,
        roster: [...(team.roster || [])],
        taxiSquad: [...(team.taxiSquad || [])],
        minorLeague: [...(team.minorLeague || team.prospects || [])],
      }))
    : [];

  return {
    name: source.name || "",
    season: String(source.season || "2025"),
    owners: Number(source.owners || 12),
    budget: Number(source.budget || 260),
    pool: source.pool || "MLB",
    teamNames: buildTeamNameList(source, Number(source.owners || 12)),
    roster: { ...DEFAULT_ROSTER, ...(source.roster || {}) },
    scoring: { ...DEFAULT_SCORING, ...(source.scoring || {}) },
    keeperLeague: source.keeperLeague ?? true,
    commissionerUnlocked: source.commissionerUnlocked ?? false,
    draftHistory: Array.isArray(source.draftHistory)
      ? source.draftHistory.map((event) => ({ ...event }))
      : [],
    teams,
  };
}

export function buildTeamsFromConfig(config, previousTeams = []) {
  const teamNames = buildTeamNameList(config, config.owners);
  return Array.from({ length: config.owners }, (_, index) => {
    const existing = previousTeams[index];
    return {
      id: index + 1,
      name: normalizeTeamName(teamNames[index] || existing?.name, index),
      budget_remaining: config.budget,
      roster: [],
      taxiSquad: [],
      minorLeague: [],
    };
  });
}

export function countDraftEntries(league) {
  return (league?.teams || []).reduce(
    (total, team) => total + (team.roster || []).length,
    0
  );
}

export function countTaxiEntries(league) {
  return (league?.teams || []).reduce(
    (total, team) => total + (team.taxiSquad || []).length,
    0
  );
}

export function countMinorLeagueEntries(league) {
  return (league?.teams || []).reduce(
    (total, team) => total + (team.minorLeague || []).length,
    0
  );
}

export function hasDraftStarted(league) {
  return (
    countDraftEntries(league) +
      countTaxiEntries(league) +
      countMinorLeagueEntries(league) >
    0
  );
}

export function formatPoolLabel(pool) {
  if (pool === "AL") return "AL Only";
  if (pool === "NL") return "NL Only";
  return "MLB (All)";
}

export function formatDraftTimestamp(timestamp) {
  if (!timestamp) return "Not saved yet";
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return String(timestamp);
  }
}

export function validateLeagueConfig(config) {
  const errors = [];
  const warnings = [];

  if (!config.name?.trim()) {
    errors.push("League name is required.");
  }

  if (!/^\d{4}$/.test(String(config.season || "").trim())) {
    errors.push("Season year should be a 4-digit year.");
  }

  if (!Number.isFinite(config.owners) || config.owners < 2 || config.owners > 20) {
    errors.push("Owners must be between 2 and 20.");
  }

  const teamNames = buildTeamNameList(config, config.owners);
  const uniqueTeamNames = new Set(
    teamNames.map((name) => name.trim().toLowerCase()),
  );
  if (teamNames.length > 0 && uniqueTeamNames.size < teamNames.length) {
    warnings.push("Two or more fantasy teams share the same name.");
  }

  if (!Number.isFinite(config.budget) || config.budget < 50 || config.budget > 1000) {
    errors.push("Budget per owner must be between $50 and $1000.");
  }

  const scoringCount = Object.values(config.scoring || {}).filter(Boolean).length;
  if (scoringCount === 0) {
    errors.push("Enable at least one scoring category.");
  }

  const activeRosterSlots = Object.entries(config.roster || {})
    .filter(([slot]) => slot !== "TAXI")
    .reduce((total, [, count]) => total + Math.max(0, count || 0), 0);

  if (activeRosterSlots === 0) {
    errors.push("Add at least one active roster slot before starting the draft.");
  }

  return { errors, warnings };
}

export function buildDraftRecord({
  id,
  league,
  players,
  notes,
  favorites,
  currentOwnerIdx = 0,
  createdAt,
}) {
  const now = new Date().toISOString();

  return {
    id,
    createdAt: createdAt || now,
    updatedAt: now,
    lastOpenedAt: now,
    league: cloneLeagueConfig(league),
    players: clonePlayers(players),
    notes: { ...(notes || {}) },
    favorites: { ...(favorites || {}) },
    currentOwnerIdx,
  };
}

export function buildCloudDraftPayload(record = {}) {
  return {
    ...record,
    players: [],
    source: "cloud",
  };
}

export function hydratePlayersFromLeague(players = [], league = {}) {
  const mainAssignments = new Map();
  const taxiAssignments = new Map();
  const minorLeagueAssignments = new Map();

  (league.teams || []).forEach((team) => {
    (team.roster || []).forEach((entry) => {
      if (entry?.playerId == null) return;
      mainAssignments.set(entry.playerId, {
        drafted: true,
        draftedBy: team.id,
        draftPrice: entry.price ?? null,
        draftedAt: entry.draftedAt ?? null,
        taxi: false,
        minorLeague: false,
      });
    });

    (team.taxiSquad || []).forEach((entry) => {
      if (entry?.playerId == null) return;
      taxiAssignments.set(entry.playerId, {
        drafted: true,
        draftedBy: team.id,
        draftPrice: entry.price ?? 1,
        draftedAt: entry.draftedAt ?? null,
        taxi: true,
        minorLeague: false,
      });
    });

    (team.minorLeague || []).forEach((entry) => {
      if (entry?.playerId == null) return;
      minorLeagueAssignments.set(entry.playerId, {
        drafted: true,
        draftedBy: team.id,
        draftPrice: 0,
        draftedAt: entry.draftedAt ?? null,
        taxi: false,
        minorLeague: true,
      });
    });
  });

  return players.map((player) => {
    const mainEntry = mainAssignments.get(player.id);
    const taxiEntry = taxiAssignments.get(player.id);
    const minorLeagueEntry = minorLeagueAssignments.get(player.id);
    const assignment = mainEntry || taxiEntry || minorLeagueEntry;

    if (!assignment) {
      return {
        ...player,
        drafted: false,
        draftedBy: null,
        draftPrice: null,
        draftedAt: null,
        taxi: false,
        minorLeague: false,
      };
    }

    return {
      ...player,
      ...assignment,
    };
  });
}
