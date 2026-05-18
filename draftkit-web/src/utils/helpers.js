// ─────────────────────────────────────────────────────────────────────────────
// utils/helpers.js — Pure utility functions shared across components
//
// These are stateless helpers with no React dependencies. Import them wherever
// they're needed — keeping them here prevents duplication across components.
// ─────────────────────────────────────────────────────────────────────────────

import { POSITION_COLORS } from "../constants.js";

const DEFAULT_SLOT_SEQUENCE = [
  "C", "C", "1B", "3B", "CI", "2B", "SS", "MI",
  "OF", "OF", "OF", "OF", "OF", "UTIL",
  "P", "P", "P", "P", "P", "P", "P", "P", "P",
];

const ROSTER_FALLBACK_ORDER = [
  "C", "1B", "3B", "CI", "2B", "SS", "MI",
  "OF", "UTIL", "SP", "RP", "P", "BN", "TAXI",
];

const PLAYER_POSITION_ORDER = [
  "C", "1B", "2B", "3B", "SS", "MI", "CI", "OF", "UTIL",
  "SP", "RP", "P", "BN", "TAXI",
];

function normalizePlayerKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function buildPlayerIndexes(players = []) {
  const playerById = new Map();
  const playerByName = new Map();

  (players || []).forEach((player) => {
    playerById.set(player.id, player);
    playerByName.set(normalizePlayerKey(player.name), player);
    (player.aliases || []).forEach((alias) => {
      playerByName.set(normalizePlayerKey(alias), player);
    });
  });

  return { playerById, playerByName };
}

function asFiniteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function primaryPosition(player = {}) {
  return Array.isArray(player.pos) && player.pos.length > 0 ? player.pos[0] : null;
}

function normalizePositionCode(value) {
  return String(value || "").trim().toUpperCase();
}

function positionSortIndex(position) {
  const index = PLAYER_POSITION_ORDER.indexOf(normalizePositionCode(position));
  return index === -1 ? PLAYER_POSITION_ORDER.length : index;
}

export function sortPlayerPositions(positions = []) {
  const uniquePositions = Array.from(
    new Set(
      (Array.isArray(positions) ? positions : [positions])
        .map(normalizePositionCode)
        .filter(Boolean),
    ),
  );

  return uniquePositions.sort((left, right) => {
    const rankDelta = positionSortIndex(left) - positionSortIndex(right);
    return rankDelta !== 0 ? rankDelta : left.localeCompare(right);
  });
}

export function mergePlayerPositions(...positionGroups) {
  return sortPlayerPositions(positionGroups.flat());
}

function normalizeDepthContext(row, team, position) {
  const playerId = asFiniteNumber(row?.id ?? row?.player_id);
  if (playerId == null) return null;

  const volumeProjection = row.volumeProjection || {};
  const depthRank = asFiniteNumber(row.depthRank ?? row.depth_rank);

  return {
    player_id: playerId,
    mlb_team: team?.team || row.team || null,
    depth_position: row.depthPosition || position?.position || primaryPosition(row),
    depth_rank: depthRank,
    depth_role: volumeProjection.role || row.depth || row.tier || null,
    // Roster status comes from the MLB depth payload or the Valuation API news
    // field. Draft Kit does not use static player-pool injury text as a news
    // source because pushed alerts must originate from the Valuation API.
    status:
      row.officialRoster?.statusDescription ||
      row.injury_status ||
      "Active",
    is_starter: depthRank === 1,
    active_roster: Boolean(row.officialRoster?.active),
    role_confidence: volumeProjection.confidence || null,
    volume_score: asFiniteNumber(row.volumeScore ?? volumeProjection.score, 0),
  };
}

function isBetterDepthContext(candidate, current, player) {
  if (!current) return true;

  const playerPrimaryPosition = primaryPosition(player);
  const candidatePrimaryMatch = candidate.depth_position === playerPrimaryPosition;
  const currentPrimaryMatch = current.depth_position === playerPrimaryPosition;
  if (candidatePrimaryMatch !== currentPrimaryMatch) return candidatePrimaryMatch;

  const candidateRank = asFiniteNumber(candidate.depth_rank, Number.MAX_SAFE_INTEGER);
  const currentRank = asFiniteNumber(current.depth_rank, Number.MAX_SAFE_INTEGER);
  if (candidateRank !== currentRank) return candidateRank < currentRank;

  return asFiniteNumber(candidate.volume_score, 0) > asFiniteNumber(current.volume_score, 0);
}

function buildDepthChartContext(players = [], depthCharts = null) {
  const playerById = new Map((players || []).map((player) => [Number(player.id), player]));
  const contextByPlayerId = new Map();

  /*
   * The depth chart page already ranks each real MLB team/position group using
   * projected workload, fantasy value, and active-roster status. Feeding that
   * same ranking into valuation keeps the card value, live valuation panel, and
   * depth chart page aligned after each draft edit.
   */
  (depthCharts?.teams || []).forEach((team) => {
    (team.positions || []).forEach((position) => {
      (position.players || []).forEach((row) => {
        const context = normalizeDepthContext(row, team, position);
        if (!context) return;

        const player = playerById.get(context.player_id) || row;
        const current = contextByPlayerId.get(context.player_id);
        if (isBetterDepthContext(context, current, player)) {
          contextByPlayerId.set(context.player_id, context);
        }
      });
    });
  });

  return Object.fromEntries(contextByPlayerId);
}

// ── posColor ──────────────────────────────────────────────────────────────────
/**
 * Returns the hex color string for a given position code.
 * Falls back to a neutral gray for any unknown position.
 *
 * @param {string} pos - Position code (e.g. "OF", "SP", "C")
 * @returns {string} Hex color string (e.g. "#22c55e")
 *
 * @example
 *   posColor("OF")  // "#22c55e"
 *   posColor("XXX") // "#9ca3af" (fallback gray)
 */
export function posColor(pos) {
  return POSITION_COLORS[pos] || "#9ca3af";
}

export function slotAcceptsPlayer(player, slotPos) {
  const normalizedSlot = String(slotPos || "")
    .trim()
    .toUpperCase();
  const playerPositions = (player?.pos || []).map((pos) =>
    String(pos || "").trim().toUpperCase(),
  );

  if (normalizedSlot === "BN") return true;
  if (normalizedSlot === "UTIL") {
    return playerPositions.some((pos) => !["SP", "RP", "P"].includes(pos));
  }
  if (normalizedSlot === "CI") {
    return playerPositions.some((pos) => ["1B", "3B"].includes(pos));
  }
  if (normalizedSlot === "MI") {
    return playerPositions.some((pos) => ["2B", "SS"].includes(pos));
  }
  if (normalizedSlot === "P") {
    return playerPositions.some((pos) => ["SP", "RP", "P"].includes(pos));
  }
  return playerPositions.includes(normalizedSlot);
}

// ── buildRosterPositions ──────────────────────────────────────────────────────
/**
 * Expands the compact roster-config object into a flat ordered array of
 * position slot strings. This drives the column headers and cell mapping in
 * the draft grid.
 *
 * @param {Object} roster - e.g. { C: 1, OF: 3, SP: 2, BN: 2 }
 * @returns {string[]} Ordered array, e.g. ["C", "1B", "2B", "3B", "SS", "OF", "OF", "OF", ...]
 *
 * @example
 *   buildRosterPositions({ C: 1, OF: 3 })
 *   // ["C", "OF", "OF", "OF"]
 */
export function buildRosterPositions(roster) {
  const remaining = Object.fromEntries(
    Object.entries(roster || {})
      .filter(([slot]) => slot !== "TAXI")
      .map(([slot, count]) => [
        slot,
        Math.max(0, Number(count) || 0),
      ]),
  );
  const slots = [];

  DEFAULT_SLOT_SEQUENCE.forEach((slot) => {
    if ((remaining[slot] || 0) <= 0) return;
    slots.push(slot);
    remaining[slot] -= 1;
  });

  ROSTER_FALLBACK_ORDER.forEach((slot) => {
    while ((remaining[slot] || 0) > 0) {
      slots.push(slot);
      remaining[slot] -= 1;
    }
  });

  Object.entries(remaining).forEach(([slot, count]) => {
    for (let i = 0; i < count; i += 1) {
      slots.push(slot);
    }
  });

  return slots;
}

// ── buildDraftState ───────────────────────────────────────────────────────────
/**
 * Converts the app's internal league object into the API's draft_state payload
 * format. Used when POSTing to POST /v1/valuate.
 *
 * @param {Object} league - Full league state from App component
 * @param {Object[]} players - Current player pool used to resolve roster entries
 * @param {Object|null} depthCharts - Current MLB depth chart snapshot from buildMlbDepthCharts
 * @returns {Object} draft_state payload ready to send to the valuation API
 */
export function buildDraftState(league, players = [], depthCharts = null) {
  const { playerById, playerByName } = buildPlayerIndexes(players);
  const depthContextPayload = buildDepthChartContext(players, depthCharts);
  const scoringCategories = Object.entries(league.scoring || {})
    .filter(([, enabled]) => enabled)
    .map(([category]) => category);
  const playerStatOverrides = Object.fromEntries(
    (players || []).map((player) => [
      player.id,
      {
        player_id: player.id,
        three_year: {
          fpts: player.fpts,
          hr: player.hr,
          rbi: player.rbi,
          r: player.r,
          sb: player.sb,
          avg: player.avg,
          so: player.so,
          w: player.w,
          sv: player.sv,
          era: player.era,
          whip: player.whip,
        },
        predictive: {
          fpts: player.fpts,
          projected_games: player.projected_games,
          projected_plate_appearances: player.projected_plate_appearances,
          projected_innings: player.projected_innings,
        },
      },
    ]),
  );

  return {
    total_teams: league.owners,
    budget_per_team: league.budget,
    valuation_options: {
      stat_window: "THREE_YEAR",
    },
    scoring_categories:
      scoringCategories.length > 0
        ? scoringCategories
        : ["R", "HR", "RBI", "SB", "AVG", "W", "SV", "ERA", "WHIP", "SO"],
    teams: (league.teams || []).map((team) => {
      const unavailableEntries = [
        ...(team.roster || []),
        ...(team.taxiSquad || []),
        ...(team.minorLeague || []),
      ];

      return {
        id: team.id,
        budget_remaining: team.budget_remaining,
        roster: unavailableEntries
        .map((entry) => {
          if (Array.isArray(entry) && entry.length >= 2) {
            if (typeof entry[0] === "string" && typeof entry[1] === "string") {
              return [entry[0], entry[1]];
            }

            const rosterPlayerId = Number(entry[0]);
            const matchedPlayer = playerById.get(rosterPlayerId);
            return matchedPlayer ? [matchedPlayer.name, matchedPlayer.team] : null;
          }

          const fallbackName =
            typeof entry === "string" ? entry : entry?.name || entry?.player || "";
          const matchedPlayer =
            playerById.get(Number(entry?.playerId)) ||
            playerByName.get(normalizePlayerKey(fallbackName));

          if (matchedPlayer) {
            return [matchedPlayer.name, matchedPlayer.team];
          }

          if (fallbackName && typeof entry?.team === "string") {
            return [fallbackName, entry.team];
          }

          return fallbackName ? fallbackName : null;
        })
        .filter(Boolean),
      };
    }),
    roster_config: league.roster,
    depth_chart_context: depthContextPayload,
    player_stat_overrides: playerStatOverrides,
  };
}

// ── calcMaxBid ────────────────────────────────────────────────────────────────
/**
 * Calculates the absolute maximum a team can bid on a player, given their
 * remaining budget and how many more roster spots they must fill.
 *
 * Rule: you must leave at least $1 for each remaining slot after this pick.
 * So if you have $50 budget and 6 open slots, max bid = $50 - 5 = $45.
 *
 * @param {number} budget    - Team's current remaining budget in dollars
 * @param {number} slotsLeft - Number of unfilled roster slots remaining
 * @returns {number} Maximum allowed bid in dollars (minimum $1)
 *
 * @example
 *   calcMaxBid(50, 6) // 45
 *   calcMaxBid(10, 1) // 10 (last slot, can spend it all)
 */
export function calcMaxBid(budget, slotsLeft) {
  return Math.max(budget - Math.max(slotsLeft - 1, 0), 1);
}

// ── getValueClass ─────────────────────────────────────────────────────────────
/**
 * Returns a CSS class name indicating whether a player was a steal, fair value,
 * or overpaid based on the ratio of price-paid to base-value.
 *
 * Used in the draft grid to add a colored left-border to roster cells.
 *
 * @param {number} price     - Price paid at auction
 * @param {number} baseValue - Player's calculated pre-auction base value
 * @returns {"value-steal" | "value-fair" | "value-overpaid"}
 *
 * @example
 *   getValueClass(10, 20) // "value-steal"  (paid 50% of value)
 *   getValueClass(20, 20) // "value-fair"   (paid exactly market)
 *   getValueClass(30, 20) // "value-overpaid" (paid 150% of value)
 */
export function getValueClass(price, baseValue) {
  if (!baseValue || baseValue <= 0) return "value-fair";
  const ratio = price / baseValue;
  if (ratio < 0.8)  return "value-steal";
  if (ratio > 1.2)  return "value-overpaid";
  return "value-fair";
}

// ── formatStat ────────────────────────────────────────────────────────────────
/**
 * Formats a raw stat value for display. Averages (0.xxx) are shown as .xxx,
 * integers are shown as-is, and null/undefined becomes "–".
 *
 * @param {number|string|null} val - Raw stat value
 * @param {string} label           - Stat category label (e.g. "AVG", "HR")
 * @returns {string} Display string
 *
 * @example
 *   formatStat(0.297, "AVG")  // ".297"
 *   formatStat(42, "HR")      // "42"
 *   formatStat(null, "RBI")   // "–"
 */
export function formatStat(val, label) {
  if (val === null || val === undefined || val === "") return "–";
  const n = parseFloat(val);
  if (isNaN(n)) return "–";
  // Averages are displayed without the leading zero (e.g. .297 not 0.297)
  if (["AVG", "OBP", "SLG"].includes(label) && n < 1) {
    return n.toFixed(3).replace("0.", ".");
  }
  // ERA and WHIP get one decimal place
  if (["ERA", "WHIP"].includes(label)) return n.toFixed(2);
  return String(Math.round(n));
}
