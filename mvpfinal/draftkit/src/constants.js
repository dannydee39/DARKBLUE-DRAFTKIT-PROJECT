// ─────────────────────────────────────────────────────────────────────────────
// constants.js — Shared application constants
//
// All magic numbers, lookup tables, and default values live here so they're
// easy to find and update in one place. Import from any component as needed.
// ─────────────────────────────────────────────────────────────────────────────

// ── API Config ────────────────────────────────────────────────────────────────
// API_BASE: the local address of the running Express server (mvpfinal/api).
// Change this to your production URL when deploying (e.g. https://api.darkblue.io).
export const API_BASE = "http://localhost:3001";

// PROD_DISPLAY_URL: shown in the API Sandbox UI so users know what endpoint
// they're hitting in production. Does NOT affect actual fetch() calls.
export const PROD_DISPLAY_URL = "https://api.darkblue.io";

// DEMO_KEY: Hardcoded demo license key used while the API server is local.
// In production this would come from the user's account settings or env vars.
export const DEMO_KEY = "DB-2026-DEMO-0001";

// ── Player Pool ────────────────────────────────────────────────────────────────
// POSITIONS: all valid player-facing position codes used throughout the app.
// These drive filter buttons, column headers, and position badge rendering.
export const POSITIONS = ["C", "1B", "2B", "3B", "SS", "OF", "SP", "RP"];

// TIERS: the three performance tiers assigned by the generate-players.js script.
// Elite = top 20 by FPTS, Starter = 21-75, Bench = 76+.
export const TIERS = ["Elite", "Starter", "Bench"];

// ── Default Roster Configuration ─────────────────────────────────────────────
// DEFAULT_ROSTER: the starting roster slot counts for a new draft instance.
// Each key maps to the number of roster slots for that position.
// UTIL = utility (any non-pitcher), BN = bench, TAXI = minor-league reserve.
export const DEFAULT_ROSTER = {
  C: 1,
  "1B": 1,
  "2B": 1,
  "3B": 1,
  SS: 1,
  OF: 3,
  SP: 2,
  RP: 2,
  UTIL: 1,
  BN: 2,
  TAXI: 3,
};

// ── Default Scoring Categories ────────────────────────────────────────────────
// DEFAULT_SCORING: which scoring categories are enabled by default.
// true = active, false = inactive. Users can toggle on the League Settings tab.
// Hitting categories are standard 5x5 (R, HR, RBI, SB, AVG).
// Pitching categories are standard 5x5 (W, SV, ERA, WHIP, SO).
export const DEFAULT_SCORING = {
  // ── Hitting ──
  R: true,
  H: false,
  HR: true,
  RBI: true,
  SB: true,
  AVG: true,
  OBP: false,
  BB: false,
  TB: false,
  XBH: false,
  // ── Pitching ──
  W: true,
  SV: true,
  ERA: true,
  WHIP: true,
  SO: true,
  HLD: false,
  "K/9": false,
  "BB/9": false,
  QS: false,
};

// HITTING_CATS / PITCHING_CATS: used to render two groups on the settings screen.
export const HITTING_CATS = ["R", "H", "HR", "RBI", "SB", "AVG", "OBP", "BB", "TB", "XBH"];
export const PITCHING_CATS = ["W", "SV", "ERA", "WHIP", "SO", "HLD", "K/9", "BB/9", "QS"];

// ── Position Color Map ────────────────────────────────────────────────────────
// Maps each position code to a unique hex color used for badges and highlights.
// Used in PlayerAvatar palette selection, position badges, and grid indicators.
// To change a position color, edit the value here — it will update everywhere.
export const POSITION_COLORS = {
  C:    "#f59e0b",  // amber
  "1B": "#ef4444",  // red
  "2B": "#f97316",  // orange
  "3B": "#a855f7",  // purple
  SS:   "#06b6d4",  // cyan
  OF:   "#22c55e",  // green
  SP:   "#3b82f6",  // blue
  RP:   "#ec4899",  // pink
  DH:   "#6366f1",  // indigo
  UTIL: "#84cc16",  // lime
  BN:   "#6b7280",  // gray
  TAXI: "#8b5cf6",  // violet
};

// AVATAR_PALETTE: colors used in PlayerAvatar initials circles.
// When a player has no photoUrl, we pick a color from this list based on
// a hash of the player's name for consistent per-player color assignment.
export const AVATAR_PALETTE = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#a855f7", // purple
  "#ef4444", // red
  "#f97316", // orange
];

// ── Value Assessment Thresholds ───────────────────────────────────────────────
// Used in the draft grid to color-code each cell based on how much was paid
// vs. the player's calculated base value. Helps identify steals and overpays.
//
// price / baseValue ratio:
//   < VALUE_STEAL_THRESHOLD  → green border (great deal, underpaid)
//   < VALUE_FAIR_THRESHOLD   → default (fair market price)
//   otherwise               → red/orange border (overpaid)
export const VALUE_STEAL_THRESHOLD = 0.8;  // paid less than 80% of baseValue
export const VALUE_FAIR_THRESHOLD  = 1.2;  // paid more than 120% of baseValue = overpaid
