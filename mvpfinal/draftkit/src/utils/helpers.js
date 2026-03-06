// ─────────────────────────────────────────────────────────────────────────────
// utils/helpers.js — Pure utility functions shared across components
//
// These are stateless helpers with no React dependencies. Import them wherever
// they're needed — keeping them here prevents duplication across components.
// ─────────────────────────────────────────────────────────────────────────────

import { POSITION_COLORS } from "../constants.js";

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
  // Canonical order for display — mirrors traditional lineup card order.
  const ORDER = ["C", "1B", "2B", "3B", "SS", "OF", "SP", "RP", "UTIL", "BN"];
  return ORDER.flatMap((slot) => Array(roster[slot] || 0).fill(slot));
}

// ── buildDraftState ───────────────────────────────────────────────────────────
/**
 * Converts the app's internal league object into the API's draft_state payload
 * format. Used when POSTing to POST /v1/valuate.
 *
 * @param {Object} league - Full league state from App component
 * @returns {Object} draft_state payload ready to send to the valuation API
 */
export function buildDraftState(league) {
  return {
    total_teams: league.owners,
    budget_per_team: league.budget,
    scoring_categories: Object.entries(league.scoring)
      .filter(([, v]) => v)   // only enabled categories
      .map(([k]) => k),
    teams: league.teams,
    roster_config: league.roster,
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
