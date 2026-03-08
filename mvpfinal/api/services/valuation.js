// services/valuation.js — Heuristic valuation engine
const players = require("../data/players.json");

/**
 * Calculate the dollar value for a nominated player given live draft state.
 *
 * Algorithm:
 * 1. Compute base SGP-normalized score for the player using scoring_categories.
 * 2. Apply position scarcity multiplier (demand vs. undrafted supply).
 * 3. Apply market inflation (remaining budget vs. expected remaining pool value).
 * 4. Cap to a reasonable min/max and compute max_bid_recommendation.
 */
function calculateValuation(draftState) {
  const {
    total_teams = 12,
    budget_per_team = 260,
    scoring_categories = ["HR", "RBI", "AVG", "SB", "ERA", "SO", "WHIP"],
    teams = [],
    nominated_player,
    roster_config = {
      C: 1, "1B": 1, "2B": 1, "3B": 1, SS: 1, OF: 3, SP: 2, RP: 2, UTIL: 1, BN: 2,
    },
  } = draftState;

  // Find nominated player in database (fuzzy match by name)
  const nominated = findPlayer(nominated_player);
  if (!nominated) {
    return {
      error: "Player not found",
      player: nominated_player,
      message: `Could not find player "${nominated_player}" in database.`,
    };
  }

  // Identify drafted players from team rosters
  const draftedNames = new Set();
  teams.forEach((t) => {
    (t.roster || []).forEach((name) => draftedNames.add(name));
  });

  // Undrafted pool
  const undrafted = players.filter((p) => !draftedNames.has(p.name));

  // ── Market inflation calculation ────────────────────────────────────────
  // Sum known teams' budget_remaining, then add full budget for any teams not
  // yet represented in the payload (e.g. partial teams array from client).
  const knownTeamBudget = teams.reduce((sum, t) => {
    const remaining = t.budget_remaining ?? budget_per_team;
    return sum + remaining;
  }, 0);
  const missingTeams = Math.max(total_teams - teams.length, 0);
  const totalRemainingBudget = knownTeamBudget + missingTeams * budget_per_team;

  // Reserved dollars — each team needs $1 per remaining empty slot
  const totalRosterSlots = Object.values(roster_config).reduce((a, b) => a + b, 0);
  const filledSlots = teams.reduce((sum, t) => sum + (t.roster || []).length, 0);
  const remainingSlots = total_teams * totalRosterSlots - filledSlots;

  // ── Base true dollar value (anchored to pre-computed baseValue) ──────────
  //
  // WHY anchor to baseValue instead of normalising against all undrafted players?
  //
  // The raw SGP normalisation (nominatedScore / totalPoolScore × spendableBudget)
  // distributes the budget across EVERY undrafted player, including hundreds of
  // fringe/depth players. With a large pool (300+ players) this dilutes every
  // player's share — elite players like Ohtani end up valued at $15-22 instead
  // of the realistic $65-80 a drafter would actually bid.
  //
  // The `baseValue` on each player object was computed by generate-players.js
  // using a replacement-level PAR formula that correctly concentrates the budget
  // only on the ~110 draftable players. It is therefore a much better anchor for
  // live auction valuations.
  //
  // This API then applies real-time ADJUSTMENTS on top of that anchor:
  //   • inflationFactor  — how much remaining budget has moved vs. expectation
  //   • scarcityMultiplier — how scarce the player's position is right now
  //
  // Result: accurate, realistic values from pick 1 through the final pick.
  const baseTDV = nominated.baseValue ?? 1;

  // Position scarcity analysis
  const { scarcity, scarcityTier, positionScarcityMap } = analyzeScarcity(
    nominated,
    undrafted,
    teams,
    total_teams,
    roster_config
  );

  // Market inflation factor (compared to start of draft expected values)
  const totalInitialBudget = total_teams * budget_per_team;
  const elapsedFraction = filledSlots / (total_teams * totalRosterSlots);
  const expectedRemaining = totalInitialBudget * (1 - elapsedFraction * 0.9);
  const inflationFactor =
    totalRemainingBudget > 0
      ? Math.min(Math.max(totalRemainingBudget / expectedRemaining, 0.85), 1.45)
      : 1.0;

  // Combine all factors
  const trueDollarValue = Math.round(baseTDV * scarcity * inflationFactor);
  // Cap raised to 120 so elite players ($75 base) still have headroom
  // when scarcity (up to 1.35×) or inflation (up to 1.45×) push values higher.
  const trueDollarValueClamped = Math.min(Math.max(trueDollarValue, 1), 120);

  const maxBidRecommendation = Math.max(
    Math.round(trueDollarValueClamped * 0.92),
    1
  );

  // Draftability score (0-1) — how much value vs. cost
  const draftabilityScore = Math.min(
    parseFloat((trueDollarValueClamped / Math.max(nominated.baseValue, 1)).toFixed(2)),
    1.0
  );

  // Human-readable reasoning
  const reasoning = buildReasoning(
    nominated,
    scarcityTier,
    positionScarcityMap,
    inflationFactor,
    trueDollarValueClamped
  );

  return {
    player: nominated.name,
    true_dollar_value: trueDollarValueClamped,
    max_bid_recommendation: maxBidRecommendation,
    market_inflation: parseFloat(inflationFactor.toFixed(3)),
    scarcity_tier: scarcityTier,
    position_scarcity: positionScarcityMap,
    draftability_score: draftabilityScore,
    reasoning,
    stats: {
      tier: nominated.tier,
      positions: nominated.pos,
      team: nominated.team,
      league: nominated.league,
    },
  };
}

/** Find player by name (case-insensitive, partial match) */
function findPlayer(name) {
  if (!name) return null;
  const q = name.toLowerCase().trim();
  return (
    players.find((p) => p.name.toLowerCase() === q) ||
    players.find((p) => p.name.toLowerCase().includes(q)) ||
    null
  );
}

/** Compute min/max for each stat in the undrafted pool */
function computePoolStats(pool, categories) {
  const stats = {};
  const hitterCats = ["HR", "RBI", "SB", "AVG", "R", "OBP", "SLG"];
  const pitcherCats = ["ERA", "WHIP", "SO", "W", "SV"];

  const activeCats = categories.filter(
    (c) => hitterCats.includes(c) || pitcherCats.includes(c)
  );

  activeCats.forEach((cat) => {
    const values = pool
      .map((p) => getStatForCat(p, cat))
      .filter((v) => v !== null && !isNaN(v));

    if (values.length === 0) {
      stats[cat] = { min: 0, max: 1, mean: 0.5 };
      return;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    stats[cat] = { min, max, mean };
  });

  return stats;
}

/** Get numeric value for a category from a player object */
function getStatForCat(player, cat) {
  switch (cat) {
    case "HR": return player.hr ?? null;
    case "RBI": return player.rbi ?? null;
    case "SB": return player.sb ?? null;
    case "R": return player.r ?? player.rbi ?? null;
    case "AVG": return player.avg ? parseFloat(player.avg) : null;
    case "OBP": return player.obp ? parseFloat(player.obp) : null;
    case "SLG": return player.slg ? parseFloat(player.slg) : null;
    case "ERA":
      return player.era ? -parseFloat(player.era) : null; // invert: lower ERA is better
    case "WHIP":
      return player.whip ? -parseFloat(player.whip) : null; // invert
    case "SO": return player.so ?? null;
    case "W": return player.w ?? null;
    case "SV": return player.sv ?? null;
    default: return null;
  }
}

/** Score a player on the active scoring categories (SGP-like normalized 0-1 scale) */
function scorePlayer(player, categories, poolStats) {
  let total = 0;
  let count = 0;

  categories.forEach((cat) => {
    const val = getStatForCat(player, cat);
    if (val === null || !(cat in poolStats)) return;

    const { min, max } = poolStats[cat];
    const range = max - min;
    if (range === 0) return;

    const normalized = (val - min) / range; // 0-1 scale
    total += normalized;
    count++;
  });

  if (count === 0) return 0.5; // fallback
  return total / count;
}

/** Analyze positional scarcity for the nominated player */
function analyzeScarcity(player, undrafted, teams, totalTeams, rosterConfig) {
  const primaryPos = player.pos[0];

  // How many undrafted players at this position
  const undraftedAtPos = undrafted.filter((p) =>
    p.pos.includes(primaryPos)
  ).length;

  // How many teams still need this position
  const slotsPerTeam = rosterConfig[primaryPos] || 1;
  const ofMultiplier = primaryPos === "OF" ? 3 : 1;
  const totalSlotsNeeded = totalTeams * slotsPerTeam * ofMultiplier;
  const slotsFilled = teams.reduce((sum, t) => {
    return (
      sum +
      (t.roster || []).filter((name) => {
        const p = players.find((pl) => pl.name === name);
        return p && p.pos.includes(primaryPos);
      }).length
    );
  }, 0);
  const remainingSlots = Math.max(totalSlotsNeeded - slotsFilled, 0);

  // Scarcity ratio: if demand > supply, scarcity increases value
  const ratio =
    undraftedAtPos > 0 ? remainingSlots / undraftedAtPos : 2;

  let scarcityMultiplier, scarcityTierLabel, scarcityLevel;
  if (ratio >= 1.5) {
    scarcityMultiplier = 1.35;
    scarcityTierLabel = "CRITICAL";
    scarcityLevel = "CRITICAL";
  } else if (ratio >= 1.0) {
    scarcityMultiplier = 1.20;
    scarcityTierLabel = "HIGH";
    scarcityLevel = "HIGH";
  } else if (ratio >= 0.7) {
    scarcityMultiplier = 1.08;
    scarcityTierLabel = "MEDIUM";
    scarcityLevel = "MEDIUM";
  } else {
    scarcityMultiplier = 1.0;
    scarcityTierLabel = "LOW";
    scarcityLevel = "LOW";
  }

  const positionScarcityMap = {};
  player.pos.forEach((p) => {
    positionScarcityMap[p] = scarcityLevel;
  });

  return {
    scarcity: scarcityMultiplier,
    scarcityTier: scarcityTierLabel,   // bug-fix: was player.tier (wrong field)
    positionScarcityMap,
    scarcityLevel,
    undraftedAtPos,
    remainingSlots,
  };
}

/** Build a concise reasoning string */
function buildReasoning(player, tier, posMap, inflation, tdv) {
  const pos = player.pos[0];
  const scarcityLevel = posMap[pos] || "LOW";
  const inflPct = ((inflation - 1) * 100).toFixed(1);
  const inflSign = inflation >= 1 ? "+" : "";

  const parts = [];
  if (scarcityLevel === "CRITICAL" || scarcityLevel === "HIGH") {
    parts.push(`${pos} scarce — high demand in pool.`);
  }
  if (Math.abs(inflation - 1) > 0.02) {
    parts.push(`Market inflation ${inflSign}${inflPct}%.`);
  }
  parts.push(`Tier: ${tier}. TDV: $${tdv}.`);

  return parts.join(" ");
}

/** Get all players with optional filters */
function getPlayers({ league, pos, tier, available_only, drafted_names }) {
  let result = [...players];

  if (league && league !== "ALL") {
    result = result.filter((p) => p.league === league);
  }
  if (pos && pos !== "ALL") {
    result = result.filter((p) => p.pos.includes(pos));
  }
  if (tier && tier !== "ALL") {
    result = result.filter((p) => p.tier === tier);
  }
  if (available_only && drafted_names) {
    const draftedSet = new Set(drafted_names);
    result = result.filter((p) => !draftedSet.has(p.name));
  }

  return result;
}

module.exports = { calculateValuation, getPlayers, findPlayer };
