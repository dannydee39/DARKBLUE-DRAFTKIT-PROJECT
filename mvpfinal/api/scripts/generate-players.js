/**
 * generate-players.js
 * ─────────────────────────────────────────────────────────────────
 * Converts the NL sample CSV files into the players.json database
 * used by the Dark Blue Auction Draft Kit API.
 *
 * Source files (from /sample/data/):
 *   projections-NL.csv       — projected 2025 stats (PRIMARY source)
 *   3Year-average-NL-stats.csv — 3-year historical averages (FALLBACK)
 *   2025-player-NL-stats.csv   — 2025 actuals/estimates (FALLBACK)
 *
 * Output:
 *   mvpfinal/api/data/players.json
 *
 * Run:
 *   node mvpfinal/api/scripts/generate-players.js
 * ─────────────────────────────────────────────────────────────────
 */

const fs   = require("fs");
const path = require("path");

// ── Path configuration ────────────────────────────────────────────
const SAMPLE_DIR = path.join(__dirname, "../../../sample/data");
const OUT_FILE   = path.join(__dirname, "../data/players.json");

// ── Position abbreviation map ─────────────────────────────────────
// Maps CSV position codes → our internal position keys
const POS_MAP = {
  C:   "C",
  "1B": "1B",
  "2B": "2B",
  "3B": "3B",
  SS:  "SS",
  OF:  "OF",
  DH:  "DH",
  U:   "DH",  // "Universal" DH eligible (NL designation)
  P:   "SP",  // Pitcher — only has batting stats in these files (e.g. Ohtani)
};

// ── Tier thresholds (by rank in sorted FPTS list) ─────────────────
const TIER_ELITE   = 20;   // Top 20 = Elite
const TIER_STARTER = 75;   // Rank 21–75 = Starter
// Rank 76+ = Bench

// ── Minimum FPTS to include a player ─────────────────────────────
// Filters out extreme depth players unlikely to be drafted in a 12-team league
const MIN_FPTS = 100;

// ── Auction budget allocation ──────────────────────────────────────
// NL-only 12-team auction: 12 × $260 total budget.
// Hitter split ≈ 70% since NL rosters are heavier on bats than pitchers.
const TOTAL_HITTER_BUDGET = 12 * 260 * 0.70; // ≈ $2,184

// ── Replacement level player rank ─────────────────────────────────
// In a 12-team NL-only auction, ~108 hitters are rostered (9 per team).
// Setting replacement at rank 110 concentrates budget on draftable players,
// producing realistic top-player values ($50–80 for elite NL-only hitters).
const REPLACEMENT_RANK = 110;

// ── Utility: parse a single CSV line respecting quoted fields ─────
/**
 * Splits a CSV line into fields, correctly handling quoted strings
 * that may contain commas (e.g., `"Shohei Ohtani U,P | LAD"`).
 *
 * @param {string} line - Raw CSV line
 * @returns {string[]} Array of trimmed field values
 */
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes; // toggle quote mode
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim()); // push final field
  return result;
}

// ── Utility: parse a full CSV file into an array of row objects ───
/**
 * Reads a CSV string and returns an array of objects keyed by header.
 *
 * @param {string} text - Raw CSV file content
 * @returns {Object[]} Array of row objects: { Header: value, ... }
 */
function parseCSV(text) {
  const lines = text.split("\n");
  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (cols[idx] || "").trim();
    });
    rows.push(row);
  }

  return rows;
}

// ── Utility: parse the "Player" column value ───────────────────────
/**
 * The CSV Player column has the format:
 *   "FirstName LastName POS | TEAM"
 *   "FirstName LastName POS1,POS2 | TEAM"
 *
 * Examples:
 *   "Juan Soto OF | NYM"
 *   "Shohei Ohtani U,P | LAD"   (was quoted in CSV due to comma)
 *   "Otto Lopez 2B,SS | MIA"    (multi-position)
 *
 * @param {string} raw - The raw Player column string
 * @returns {{ name: string, team: string, positions: string[] } | null}
 */
function parsePlayerString(raw) {
  // Split on the " | " separator between name+pos and team
  const pipeIdx = raw.indexOf(" | ");
  if (pipeIdx === -1) return null;

  const nameAndPos = raw.substring(0, pipeIdx).trim();
  const team = raw.substring(pipeIdx + 3).trim();

  // The position string is the LAST space-delimited token
  // e.g. "Juan Soto OF" → pos = "OF", name = "Juan Soto"
  // e.g. "Otto Lopez 2B,SS" → pos = "2B,SS", name = "Otto Lopez"
  const lastSpaceIdx = nameAndPos.lastIndexOf(" ");
  if (lastSpaceIdx === -1) return null;

  const posStr = nameAndPos.substring(lastSpaceIdx + 1).trim();
  const name   = nameAndPos.substring(0, lastSpaceIdx).trim();

  // Map position codes and deduplicate
  const positions = [...new Set(
    posStr.split(",")
      .map((p) => POS_MAP[p.trim()] || p.trim())
      .filter(Boolean)
  )];

  return { name, team, positions };
}

// ── Utility: parse a numeric field safely ─────────────────────────
/**
 * Returns a float from a CSV string, or 0 if missing/invalid.
 *
 * @param {string} val - Raw CSV string value
 * @returns {number}
 */
function num(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

// ── Main conversion logic ─────────────────────────────────────────

/**
 * processRows — reads an array of CSV row objects and upserts
 * each player into `playerMap`. Higher-priority sources overwrite.
 *
 * Priority order (called in reverse, so last wins):
 *   1. avg3 (lowest priority, most historical)
 *   2. stats2025
 *   3. proj (highest priority — projections are most forward-looking)
 *
 * @param {Object[]} rows   - Parsed CSV rows from parseCSV()
 * @param {string}   source - Source label: 'avg3' | '2025' | 'proj'
 * @param {Map}      map    - playerMap to upsert into
 */
function processRows(rows, source, map) {
  rows.forEach((row) => {
    const parsed = parsePlayerString(row["Player"]);
    if (!parsed) return;

    const { name, team, positions } = parsed;
    const fpts = num(row["FPTS"]);

    // Skip players with no meaningful fantasy value
    if (fpts < MIN_FPTS) return;

    const key = name.toLowerCase(); // case-insensitive dedup

    // Always overwrite with higher-priority source data
    map.set(key, {
      name,
      team,
      positions,
      fpts,

      // --- Batting stats (all hitter files provide these) ---
      hr:  parseInt(row["HR"])  || 0,
      rbi: parseInt(row["RBI"]) || 0,
      r:   parseInt(row["R"])   || 0,
      sb:  parseInt(row["SB"])  || 0,
      h:   parseInt(row["H"])   || 0,
      ab:  parseInt(row["AB"])  || 0,
      bb:  parseInt(row["BB"])  || 0,
      k:   parseInt(row["K"])   || 0,
      avg: num(row["AVG"]),
      obp: num(row["OBP"]),
      slg: num(row["SLG"]),

      source, // for debugging
    });
  });
}

// ── Read CSV files ────────────────────────────────────────────────
console.log("Reading CSV files from:", SAMPLE_DIR);

const projRows     = parseCSV(fs.readFileSync(path.join(SAMPLE_DIR, "projections-NL.csv"),       "utf8"));
const avg3Rows     = parseCSV(fs.readFileSync(path.join(SAMPLE_DIR, "3Year-average-NL-stats.csv"), "utf8"));
const stats2025Rows = parseCSV(fs.readFileSync(path.join(SAMPLE_DIR, "2025-player-NL-stats.csv"), "utf8"));

console.log(`  projections-NL.csv:       ${projRows.length} rows`);
console.log(`  3Year-average-NL-stats.csv: ${avg3Rows.length} rows`);
console.log(`  2025-player-NL-stats.csv:  ${stats2025Rows.length} rows`);

// ── Build player map ──────────────────────────────────────────────
// Process in ASCENDING priority order so last write wins.
// projections override 2025 stats override 3yr averages.
const playerMap = new Map();

processRows(avg3Rows,      "avg3", playerMap);
processRows(stats2025Rows, "2025", playerMap);
processRows(projRows,      "proj", playerMap);  // Highest priority

console.log(`\nUnique players after merge (FPTS >= ${MIN_FPTS}): ${playerMap.size}`);

// ── Sort by projected FPTS descending ────────────────────────────
const sorted = [...playerMap.values()].sort((a, b) => b.fpts - a.fpts);

// ── Assign tiers by rank ─────────────────────────────────────────
sorted.forEach((p, i) => {
  if (i < TIER_ELITE)         p.tier = "Elite";
  else if (i < TIER_STARTER)  p.tier = "Starter";
  else                        p.tier = "Bench";
});

// ── Compute auction dollar values using Points Above Replacement ──
/**
 * Replacement-level SGP auction formula:
 *   1. Replacement level = FPTS of the player at REPLACEMENT_RANK
 *   2. PAR (Points Above Replacement) = player FPTS - replacement FPTS
 *   3. Each player's value = (PAR / total PAR) × total hitter budget
 *   4. Players at or below replacement get $1 (minimum bid)
 *
 * This produces realistic auction values (e.g. Ohtani ~$65-80)
 * by only distributing budget across players who would actually be drafted.
 */
const replacementFPTS = sorted[REPLACEMENT_RANK - 1]?.fpts ?? 0;
const pars = sorted.map((p) => Math.max(0, p.fpts - replacementFPTS));
const totalPAR = pars.reduce((sum, v) => sum + v, 0);

sorted.forEach((p, i) => {
  if (pars[i] <= 0 || totalPAR === 0) {
    p.baseValue = 1; // replacement-level or below: $1 min
  } else {
    const rawVal = (pars[i] / totalPAR) * TOTAL_HITTER_BUDGET;
    p.baseValue = Math.max(1, Math.round(rawVal));
  }
});

// ── Build final JSON array ───────────────────────────────────────
/**
 * Player object schema:
 *
 * id          — Sequential integer ID (1-based)
 * name        — Full display name
 * team        — MLB team abbreviation (e.g. "NYM")
 * league      — "NL" for all players in this dataset
 * pos         — Array of position strings (["OF"], ["SS", "2B"], etc.)
 * tier        — "Elite" | "Starter" | "Bench"
 * baseValue   — Auction dollar value ($1–$80)
 *
 * --- Batting stats (projected) ---
 * hr, rbi, r, sb, avg, obp, slg
 *
 * --- Pitching stats ---
 * era, so, whip, w, sv — null for hitters (set manually for two-way players)
 *
 * --- Future use ---
 * photoUrl    — Set to null; replace with a player headshot CDN URL
 *               to enable real photo display in PlayerAvatar component.
 *               Format: "https://your-cdn.com/headshots/{name-slug}.jpg"
 *
 * injury      — Injury note string or null
 * note        — Scout/analyst note or null
 * depth       — Depth chart label (mirrors tier)
 * fpts        — Raw FPTS score (used for sorting/display)
 */
const playersJson = sorted.map((p, i) => ({
  id: i + 1,
  name: p.name,
  team: p.team,
  league: "NL",  // All sample files are NL-only
  pos: p.positions.length > 0 ? p.positions : ["OF"], // default fallback

  tier: p.tier,
  baseValue: p.baseValue,

  // ── Batting stats ──
  hr:  p.hr,
  rbi: p.rbi,
  r:   p.r,
  sb:  p.sb,
  avg: p.avg.toFixed(3),
  obp: p.obp.toFixed(3),
  slg: p.slg.toFixed(3),

  // ── Pitching stats ──
  // These files only contain batting stats.
  // Two-way players (e.g. Ohtani) would need ERA/SO/WHIP added separately
  // from a pitcher-specific data source.
  era:  null,
  so:   null,
  whip: null,
  w:    null,
  sv:   null,

  // ── Future photo integration ──
  // Replace null with a URL to display real player headshots in the UI.
  // The PlayerAvatar component in App.jsx checks this field first before
  // falling back to the initials-circle avatar.
  // Example: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${mlbPlayerId}/headshot/67/current`
  photoUrl: null,

  // ── Metadata ──
  injury: null,
  note:   null,
  depth:  p.tier,
  fpts:   Math.round(p.fpts),
}));

// ── Write output ─────────────────────────────────────────────────
fs.writeFileSync(OUT_FILE, JSON.stringify(playersJson, null, 2), "utf8");

console.log(`\n✓ Generated ${playersJson.length} players`);
console.log(`  Elite:   ${playersJson.filter(p => p.tier === "Elite").length}`);
console.log(`  Starter: ${playersJson.filter(p => p.tier === "Starter").length}`);
console.log(`  Bench:   ${playersJson.filter(p => p.tier === "Bench").length}`);
console.log(`  Output:  ${OUT_FILE}`);
