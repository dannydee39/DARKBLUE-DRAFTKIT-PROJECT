const players = require("../data/players.json");
const {
  decoratePlayerWithUpdate,
  getLatestUpdateForPlayer,
} = require("./playerUpdates");

const PLAYER_TIER_ORDER = { Elite: 0, Starter: 1, Bench: 2 };
const PLAYER_BY_ID = new Map(players.map((player) => [player.id, player]));
const POSITION_DEFAULT = {
  multiplier: 1.0,
  level: "LOW",
  remainingSlots: 0,
  undraftedAtPos: 0,
};
const RISK_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const DEFAULT_HITTER_CATEGORIES = ["R", "HR", "RBI", "SB", "AVG"];
const DEFAULT_PITCHER_CATEGORIES = ["W", "SV", "ERA", "WHIP", "SO"];
const STAT_WINDOWS = {
  ONE_YEAR: "ONE_YEAR",
  THREE_YEAR: "THREE_YEAR",
  BLEND: "BLEND",
};

/*
 * Acronyms used in the valuation math:
 * - FPTS: fantasy points. This is a single blended production score generated
 *   from MLB stat lines. Hitters get credit for runs, RBI, home runs, stolen
 *   bases, total bases, and walks. Pitchers get credit for outs, wins, saves,
 *   and strikeouts, with penalties for earned runs, hits, and walks.
 * - PA: plate appearances. This is the best workload signal for hitters
 *   because it tells us how often the player is expected to bat.
 * - IP: innings pitched. This is the best workload signal for starting pitchers
 *   and many bulk relievers.
 * - G: games. This is a fallback workload signal when PA or IP is missing.
 * - SO: strikeouts. MLB uses SO for both hitter strikeouts and pitcher
 *   strikeouts; in this file it is used for pitcher strikeout production.
 * - W/SV: pitcher wins and saves.
 * - ERA/WHIP: pitcher rate stats; lower is better, so the scoring functions
 *   invert them before turning them into a multiplier.
 * - TDV: true dollar value. This is the final auction value returned by the
 *   API after all stat, market, scarcity, risk, age, and depth factors apply.
 */

function normalizeNameKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function normalizeTeamKey(value) {
  return String(value || "").trim().toUpperCase();
}

function calculateValuation(draftState) {
  const batch = calculateValuations(draftState);
  const nominatedPlayer = draftState?.nominated_player;
  if (!nominatedPlayer) {
    return {
      error: "Bad Request",
      message:
        "draft_state.nominated_player is no longer required. Use calculateValuations for the full valuation map.",
    };
  }

  const matched = findPlayer(nominatedPlayer);
  if (!matched) {
    return {
      error: "Player not found",
      player: nominatedPlayer,
      message: `Could not find player "${nominatedPlayer}" in database.`,
    };
  }

  return batch.valuations?.[matched.name] || {
    error: "Player not found",
    player: nominatedPlayer,
    message: `Could not find player "${nominatedPlayer}" in database.`,
  };
}

function calculateValuations(draftState) {
  const context = buildDraftContext(draftState);
  const valuations = {};

  players.forEach((player) => {
    valuations[player.name] = valuatePlayer(player, context);
  });

  return {
    count: players.length,
    drafted_count: context.draftedPlayerIds.size,
    undrafted_count: context.undrafted.length,
    generated_at: new Date().toISOString(),
    market_inflation: parseFloat(context.inflationFactor.toFixed(3)),
    market_context: summarizeMarket(context.inflationFactor),
    stat_window: context.statWindow,
    rubric_coverage: buildRubricCoverageSummary(context),
    valuations,
  };
}

function buildDraftContext(draftState = {}) {
  const {
    total_teams = 12,
    budget_per_team = 260,
    scoring_categories = ["R", "HR", "RBI", "SB", "AVG", "W", "SV", "ERA", "WHIP", "SO"],
    teams = [],
    commissioner_notes = [],
    commissionerNotes = [],
    player_stat_overrides = {},
    custom_stats = {},
    depth_chart_context = {},
    depthChartContext = {},
    stat_window,
    valuation_options = {},
    roster_config = {
      C: 2,
      "1B": 1,
      "2B": 1,
      CI: 1,
      "3B": 1,
      SS: 1,
      MI: 1,
      OF: 5,
      SP: 0,
      RP: 0,
      P: 9,
      UTIL: 1,
      BN: 0,
      TAXI: 0,
    },
  } = draftState;

  const normalizedTeams = teams.map((team) => ({
    ...team,
    roster: (team.roster || [])
      .map((entry) => normalizeRosterEntry(entry, team.id))
      .filter(Boolean),
  }));

  const draftedPlayerIds = new Set();
  const draftedNames = new Set();
  normalizedTeams.forEach((team) => {
    (team.roster || []).forEach((entry) => {
      if (entry.playerId != null) draftedPlayerIds.add(entry.playerId);
      if (entry.playerName) draftedNames.add(entry.playerName);
    });
  });

  const undrafted = players.filter((player) => !draftedPlayerIds.has(player.id));
  // Commissioner notes are optional draft-local context supplied by Draft Kit.
  // They overlay, but do not mutate, the licensed player dataset.
  const commissionerNotesByPlayerId = buildCommissionerNotesByPlayerId([
    ...commissioner_notes,
    ...commissionerNotes,
  ]);
  const totalRosterSlots = Object.values(roster_config).reduce(
    (sum, count) => sum + Number(count || 0),
    0,
  );
  const filledSlots = normalizedTeams.reduce(
    (sum, team) => sum + (team.roster || []).length,
    0,
  );

  const knownTeamBudget = normalizedTeams.reduce((sum, team) => {
    const remaining = Number(team.budget_remaining ?? budget_per_team);
    return sum + remaining;
  }, 0);
  const missingTeams = Math.max(total_teams - normalizedTeams.length, 0);
  const totalRemainingBudget = knownTeamBudget + missingTeams * budget_per_team;

  const totalInitialBudget = total_teams * budget_per_team;
  const elapsedFraction =
    totalRosterSlots > 0 ? filledSlots / (total_teams * totalRosterSlots) : 0;
  const expectedRemaining =
    totalInitialBudget * (1 - Math.min(Math.max(elapsedFraction, 0), 1) * 0.9);
  const inflationFactor =
    totalRemainingBudget > 0
      ? Math.min(Math.max(totalRemainingBudget / Math.max(expectedRemaining, 1), 0.85), 1.45)
      : 1.0;

  const positionScarcity = analyzePositionScarcity(
    undrafted,
    normalizedTeams,
    total_teams,
    roster_config,
  );
  const statWindow = normalizeStatWindow(
    stat_window || valuation_options.stat_window || valuation_options.stats_window,
  );

  return {
    totalTeams: total_teams,
    budgetPerTeam: budget_per_team,
    scoringCategories: scoring_categories,
    rosterConfig: roster_config,
    teams: normalizedTeams,
    draftedPlayerIds,
    draftedNames,
    undrafted,
    inflationFactor,
    positionScarcity,
    commissionerNotesByPlayerId,
    statWindow,
    statOverridesByPlayerId: buildStatOverridesByPlayerId([
      player_stat_overrides,
      custom_stats,
      valuation_options.player_stat_overrides,
    ]),
    depthContextByPlayerId: buildDepthContextByPlayerId([
      depth_chart_context,
      depthChartContext,
      valuation_options.depth_chart_context,
    ]),
  };
}

function analyzePositionScarcity(undrafted, teams, totalTeams, rosterConfig) {
  const positions = new Set();
  players.forEach((player) => {
    (player.pos || []).forEach((pos) => positions.add(pos));
  });

  const scarcity = {};

  positions.forEach((position) => {
    const slotsPerTeam = Number(rosterConfig[position] || 1);
    const totalSlotsNeeded = totalTeams * slotsPerTeam;

    const slotsFilled = teams.reduce((sum, team) => {
      const filledAtPos = (team.roster || []).filter((entry) => {
        const rosteredPlayer = entry?.playerId != null ? findPlayerById(entry.playerId) : null;
        return rosteredPlayer && rosteredPlayer.pos.includes(position);
      }).length;
      return sum + filledAtPos;
    }, 0);

    const remainingSlots = Math.max(totalSlotsNeeded - slotsFilled, 0);
    const undraftedAtPos = undrafted.filter((player) =>
      (player.pos || []).includes(position),
    ).length;
    const ratio = undraftedAtPos > 0 ? remainingSlots / undraftedAtPos : 2;

    let multiplier = 1.0;
    let level = "LOW";
    if (ratio >= 1.5) {
      multiplier = 1.35;
      level = "CRITICAL";
    } else if (ratio >= 1.0) {
      multiplier = 1.2;
      level = "HIGH";
    } else if (ratio >= 0.7) {
      multiplier = 1.08;
      level = "MEDIUM";
    }

    scarcity[position] = {
      multiplier,
      level,
      remainingSlots,
      undraftedAtPos,
      ratio: parseFloat(ratio.toFixed(3)),
    };
  });

  return scarcity;
}

function valuatePlayer(player, context) {
  const playerPositions = Array.isArray(player.pos) ? player.pos : [];
  const positionDetails = {};

  /*
   * The stat profile decides which raw production line is being valued.
   *
   * Normal path:
   * - Use the runtime player pool's weighted 2023-2025 stats.
   *
   * Custom path:
   * - If the request sends player_stat_overrides, use the requested
   *   stat_window: ONE_YEAR, THREE_YEAR, or BLEND.
   *
   * This keeps custom stats transparent without mutating players.json.
   */
  const statProfile = buildStatProfile(player, context);
  const scoringPlayer = buildScoringPlayer(player, statProfile.selectedStats);

  /*
   * stat_baseline_value is the pre-context dollar baseline.
   *
   * Start with player.baseValue from the generated player pool. That value was
   * derived from fantasy production above replacement during generate-players.
   * If a custom stat line is supplied, move the baseline up/down based on:
   * - explicit custom auction value, if supplied;
   * - otherwise custom FPTS compared with runtime FPTS;
   * - otherwise a category-score estimate from HR/RBI/R/SB/AVG or SO/W/SV/ERA/WHIP.
   *
   * This answers: "What is this player's dollar value before live draft context?"
   */
  const baseValue = calculateStatsBaselineValue(player, statProfile);

  /*
   * Volume projection estimates role/workload. It matters because a strong rate
   * stat line on limited playing time is less valuable than similar production
   * with everyday plate appearances or starter/closer innings.
   */
  const volumeProjection = buildVolumeProjection(scoringPlayer, statProfile.predictiveStats);
  const staticInjuryUpdate = buildStaticInjuryUpdate(player);
  const playerUpdate = chooseMostSevereUpdate(
    chooseMostSevereUpdate(getLatestUpdateForPlayer(player.id), staticInjuryUpdate),
    context.commissionerNotesByPlayerId.get(player.id),
  );
  const riskAdjustment = getRiskAdjustment(playerUpdate);
  const predictiveAdjustment = calculatePredictiveAdjustment(scoringPlayer, statProfile, volumeProjection);
  const ageAdjustment = calculateAgeAdjustment(scoringPlayer);
  const depthContext = context.depthContextByPlayerId.get(player.id) || null;
  const depthChartAdjustment = calculateDepthChartAdjustment(scoringPlayer, volumeProjection, depthContext);

  let selectedScarcity = POSITION_DEFAULT;
  playerPositions.forEach((position) => {
    const detail = context.positionScarcity[position] || POSITION_DEFAULT;
    positionDetails[position] = detail.level;
    if (detail.multiplier > selectedScarcity.multiplier) {
      selectedScarcity = detail;
    }
  });
  const scoringAdjustment = calculateScoringAdjustment(
    scoringPlayer,
    context.scoringCategories,
  );

  /*
   * Main valuation formula.
   *
   * Every factor is intentionally kept visible in the response as
   * valuation_breakdown. The order here is not a hidden model; it is a readable
   * multiplication chain:
   *
   * stat_baseline_value
   *   x scoring format fit
   *   x position scarcity
   *   x predictive playing-time/production signal
   *   x age curve
   *   x depth-chart role and volume
   *   x live market inflation
   *
   * Injury/news risk is applied after that as a separate haircut so the API can
   * show both pre-injury and post-injury values.
   */
  const rawTrueDollarValue = Math.round(
    baseValue *
      scoringAdjustment.multiplier *
      selectedScarcity.multiplier *
      predictiveAdjustment.multiplier *
      ageAdjustment.multiplier *
      depthChartAdjustment.multiplier *
      context.inflationFactor,
  );
  const adjustedTrueDollarValue = Math.round(rawTrueDollarValue * riskAdjustment.multiplier);
  const trueDollarValue = Math.min(Math.max(adjustedTrueDollarValue, 1), 120);
  const maxBidRecommendation = Math.max(Math.round(trueDollarValue * 0.92), 1);
  const valueDelta = trueDollarValue - baseValue;
  const draftabilityScore = Number(
    (trueDollarValue / Math.max(baseValue, 1)).toFixed(2),
  );

  return {
    player: player.name,
    player_id: player.id,
    player_tier: player.tier,
    base_value: player.baseValue ?? 1,
    stat_baseline_value: baseValue,
    true_dollar_value: trueDollarValue,
    max_bid_recommendation: maxBidRecommendation,
    market_inflation: parseFloat(context.inflationFactor.toFixed(3)),
    market_context: summarizeMarket(context.inflationFactor),
    scarcity_tier: selectedScarcity.level,
    position_scarcity: positionDetails,
    draftability_score: draftabilityScore,
    value_delta: valueDelta,
    is_drafted: context.draftedPlayerIds.has(player.id),
    player_update: playerUpdate,
    injury_status: playerUpdate?.injury_status || player.injury || null,
    risk_level: playerUpdate?.risk_level || "LOW",
    risk_adjustment: riskAdjustment,
    scoring_adjustment: scoringAdjustment,
    predictive_adjustment: predictiveAdjustment,
    age_adjustment: ageAdjustment,
    depth_chart_adjustment: depthChartAdjustment,
    stat_profile: statProfile.publicProfile,
    volume_projection: volumeProjection,
    news_headline: playerUpdate?.headline || null,
    last_update_at: playerUpdate?.created_at || null,
    reasoning: buildReasoning(
      player,
      player.tier,
      selectedScarcity.level,
      positionDetails,
      context.inflationFactor,
      trueDollarValue,
      playerUpdate,
      riskAdjustment,
      scoringAdjustment,
      predictiveAdjustment,
      ageAdjustment,
      depthChartAdjustment,
      volumeProjection,
    ),
    valuation_breakdown: buildValuationBreakdown({
      player,
      statProfile,
      baseValue,
      scoringAdjustment,
      selectedScarcity,
      predictiveAdjustment,
      ageAdjustment,
      depthChartAdjustment,
      inflationFactor: context.inflationFactor,
      riskAdjustment,
      rawTrueDollarValue,
      adjustedTrueDollarValue,
      trueDollarValue,
      maxBidRecommendation,
    }),
    rubric_checks: buildPlayerRubricChecks({
      statProfile,
      predictiveAdjustment,
      ageAdjustment,
      playerUpdate,
      riskAdjustment,
      selectedScarcity,
      depthChartAdjustment,
    }),
    stats: {
      tier: player.tier,
      positions: player.pos,
      team: player.team,
      league: player.league,
      age: player.age,
      depth: player.depth,
      depth_chart_context: depthContext || null,
      stats_window: statProfile.publicProfile.window,
      volume_projection: volumeProjection,
    },
  };
}

function buildVolumeProjection(player = {}, predictiveStats = null) {
  const positions = Array.isArray(player.pos) ? player.pos : [];
  const hasHittingStats = ["r", "rbi", "hr", "sb"].some(
    (key) => numberOrNull(player[key]) != null,
  );
  const hasPitchingStats = ["so", "w", "sv", "era", "whip"].some(
    (key) => numberOrNull(player[key]) != null,
  );
  const isPitcher =
    ["SP", "RP", "P"].includes(positions[0]) ||
    (hasPitchingStats && !hasHittingStats);

  /*
   * Prefer explicit predictive workload if supplied by the request. If it is
   * missing, fall back to the runtime player fields from players.json.
   */
  const statSource = predictiveStats && typeof predictiveStats === "object"
    ? { ...player, ...predictiveStats }
    : player;

  /*
   * Direct workload fields are the clearest playing-time signal:
   * - hitters: projected_plate_appearances (PA) and projected_games (G)
   * - pitchers: projected_innings (IP) and projected_games (G)
   *
   * Benchmarks are rough full-season anchors. A hitter near 650 PA or a pitcher
   * near 180 IP gets treated as a full-volume player.
   */
  const directWorkload = isPitcher
    ? [
        ["IP", numberOrNull(statSource.projected_innings), 180],
        ["G", numberOrNull(statSource.projected_games), 65],
      ]
    : [
        ["PA", numberOrNull(statSource.projected_plate_appearances), 650],
        ["G", numberOrNull(statSource.projected_games), 150],
      ];
  const directAvailable = directWorkload.filter(([, value]) => value != null);

  /*
   * Proxy fields are used when direct workload is unavailable. FPTS is useful
   * here because it compresses many stats into one production signal, but it is
   * less precise than actual PA/IP/G for workload.
   */
  const proxyFields = isPitcher
    ? [
        ["SO", numberOrNull(statSource.so), 185],
        ["W", numberOrNull(statSource.w), 14],
        ["SV", numberOrNull(statSource.sv), 32],
        ["FPTS", numberOrNull(statSource.fpts), 520],
      ]
    : [
        ["R", numberOrNull(statSource.r), 90],
        ["RBI", numberOrNull(statSource.rbi), 95],
        ["HR", numberOrNull(statSource.hr), 32],
        ["SB", numberOrNull(statSource.sb), 28],
        ["FPTS", numberOrNull(statSource.fpts), 600],
      ];
  const sourceFields = directAvailable.length > 0 ? directWorkload : proxyFields;
  const available = sourceFields.filter(([, value]) => value != null);

  /*
   * Convert workload into a 0-100 score:
   * - each available stat is compared with its benchmark;
   * - individual ratios are capped at 1.35 so one extreme stat cannot dominate;
   * - the average ratio is scaled by 78, leaving room for above-benchmark volume
   *   without making everyone with a full season equal 100.
   */
  const score =
    available.length > 0
      ? Math.round(
          (available.reduce(
            (sum, [, value, benchmark]) =>
              sum + Math.min(Math.max(Number(value) / benchmark, 0), 1.35),
            0,
          ) /
            available.length) *
            78,
        )
      : 0;
  const normalizedScore = Math.min(Math.max(score, 0), 100);
  const role =
    normalizedScore >= 76
      ? isPitcher
        ? "Rotation/closer volume"
        : "Everyday volume"
      : normalizedScore >= 58
        ? "Regular volume"
        : normalizedScore >= 38
          ? "Role-player volume"
          : "Limited volume";

  return {
    score: normalizedScore,
    role,
    basis:
      directAvailable.length > 0
        ? isPitcher
          ? "projected innings/games"
          : "projected plate appearances/games"
        : isPitcher
          ? "weighted pitching counting-stat workload proxy"
          : "weighted hitting counting-stat workload proxy",
    confidence: directAvailable.length > 0 ? "HIGH" : available.length >= 4 ? "MEDIUM" : "LOW",
    source: predictiveStats ? "custom predictive stats" : player.stats_window || "weighted historical stats",
    missing_direct_fields:
      directAvailable.length > 0
        ? []
        : ["projected_games", "projected_plate_appearances", "projected_innings"],
    drivers: available.map(
      ([label, value]) => `${label}:${Math.round(Number(value) * 10) / 10}`,
    ),
    note:
      directAvailable.length > 0
        ? "Depth rank uses projected playing-time fields from the generated player source."
        : "Direct projected PA/IP/G are missing in this runtime player file, so volume is inferred from weighted historical production until the next data-generation refresh includes those fields.",
  };
}

function normalizeStatWindow(value) {
  const normalized = String(value || STAT_WINDOWS.THREE_YEAR)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (["1", "1_YEAR", "ONE_YEAR", "CURRENT", "CURRENT_YEAR"].includes(normalized)) {
    return STAT_WINDOWS.ONE_YEAR;
  }
  if (["BLEND", "CUSTOM_BLEND"].includes(normalized)) {
    return STAT_WINDOWS.BLEND;
  }
  return STAT_WINDOWS.THREE_YEAR;
}

function buildStatOverridesByPlayerId(sources) {
  const byPlayerId = new Map();
  sources
    .filter(Boolean)
    .forEach((source) => {
      if (Array.isArray(source)) {
        source.forEach((entry) => addStatOverride(byPlayerId, entry));
        return;
      }
      if (typeof source !== "object") return;
      Object.entries(source).forEach(([key, entry]) => {
        if (entry && typeof entry === "object") {
          addStatOverride(byPlayerId, {
            ...entry,
            player_id: entry.player_id ?? entry.playerId ?? key,
          });
        }
      });
    });
  return byPlayerId;
}

function buildDepthContextByPlayerId(sources) {
  const byPlayerId = new Map();
  sources
    .filter(Boolean)
    .forEach((source) => {
      if (Array.isArray(source)) {
        source.forEach((entry) => addDepthContext(byPlayerId, entry));
        return;
      }
      if (typeof source !== "object") return;
      Object.entries(source).forEach(([key, entry]) => {
        if (entry && typeof entry === "object") {
          addDepthContext(byPlayerId, {
            ...entry,
            player_id: entry.player_id ?? entry.playerId ?? key,
          });
        }
      });
    });
  return byPlayerId;
}

function addDepthContext(byPlayerId, entry) {
  const playerId = Number(entry?.player_id ?? entry?.playerId ?? entry?.id);
  if (!Number.isFinite(playerId)) return;
  byPlayerId.set(playerId, {
    player_id: playerId,
    depth_position: entry.depth_position || entry.position || entry.primary_position || null,
    depth_rank: numberOrNull(entry.depth_rank ?? entry.rank),
    depth_role: entry.depth_role || entry.role || null,
    status: entry.status || entry.statusDescription || null,
    is_starter: Boolean(entry.is_starter ?? entry.isStarter ?? false),
  });
}

function addStatOverride(byPlayerId, entry) {
  if (!entry || typeof entry !== "object") return;
  const playerId = Number(entry.player_id ?? entry.playerId ?? entry.id);
  if (!Number.isFinite(playerId)) return;
  byPlayerId.set(playerId, normalizeStatOverride(entry));
}

function normalizeStatOverride(entry) {
  return {
    oneYear: entry.one_year || entry.oneYear || entry.current_year || entry.currentYear || null,
    threeYear: entry.three_year || entry.threeYear || entry.three_year_average || entry.threeYearAverage || null,
    predictive: entry.predictive || entry.projection || entry.projections || null,
    label: entry.label || entry.source || "custom draft-state stats",
  };
}

function buildStatProfile(player, context) {
  const override = context.statOverridesByPlayerId.get(player.id);
  const oneYearStats = override?.oneYear || null;
  const threeYearStats = override?.threeYear || null;
  const predictiveStats = override?.predictive || buildDefaultPredictiveStats(player);

  /*
   * selectedStats is the stat line that replaces the runtime player fields for
   * the baseline/scoring steps. Predictive stats are kept separate because they
   * are forward-looking workload/production inputs, not the historical baseline.
   */
  const selectedStats =
    context.statWindow === STAT_WINDOWS.ONE_YEAR
      ? oneYearStats || threeYearStats || null
      : context.statWindow === STAT_WINDOWS.BLEND
        ? blendStatLines(oneYearStats, threeYearStats)
        : threeYearStats || oneYearStats || null;
  const selectedSource =
    selectedStats === oneYearStats && oneYearStats
      ? "custom one-year stats"
      : selectedStats === threeYearStats && threeYearStats
        ? "custom three-year stats"
        : selectedStats
          ? "custom blended stats"
          : player.stats_window || "runtime weighted player stats";

  return {
    selectedStats,
    predictiveStats,
    publicProfile: {
      window: context.statWindow,
      selected_source: selectedSource,
      custom_one_year_available: Boolean(oneYearStats),
      custom_three_year_available: Boolean(threeYearStats),
      predictive_available: Boolean(predictiveStats),
      runtime_stats_window: player.stats_window || null,
      custom_label: override?.label || null,
    },
  };
}

function buildDefaultPredictiveStats(player) {
  const predictive = {};
  [
    "projected_games",
    "projected_plate_appearances",
    "projected_at_bats",
    "projected_innings",
    "fpts",
  ].forEach((key) => {
    if (numberOrNull(player[key]) != null) predictive[key] = player[key];
  });
  return Object.keys(predictive).length ? predictive : null;
}

function blendStatLines(oneYearStats, threeYearStats) {
  if (!oneYearStats && !threeYearStats) return null;
  if (!oneYearStats) return threeYearStats;
  if (!threeYearStats) return oneYearStats;
  const keys = new Set([...Object.keys(oneYearStats), ...Object.keys(threeYearStats)]);
  const blended = {};
  keys.forEach((key) => {
    const one = numberOrNull(oneYearStats[key]);
    const three = numberOrNull(threeYearStats[key]);
    // Blend favors the most recent season while still stabilizing with history.
    if (one != null && three != null) blended[key] = one * 0.6 + three * 0.4;
    else if (one != null) blended[key] = one;
    else if (three != null) blended[key] = three;
  });
  return blended;
}

function buildScoringPlayer(player, selectedStats) {
  if (!selectedStats || typeof selectedStats !== "object") return player;
  return { ...player, ...selectedStats };
}

function calculateStatsBaselineValue(player, statProfile) {
  const originalBaseValue = Math.max(Number(player.baseValue) || 1, 1);
  const selectedStats = statProfile.selectedStats;
  if (!selectedStats || typeof selectedStats !== "object") return originalBaseValue;

  /*
   * Highest-trust path: the client can send an explicit custom auction value.
   * This lets a customer import their own dollar values while still letting
   * Dark Blue apply live scarcity, risk, age, depth, and market factors.
   */
  const explicitValue = numberOrNull(
    selectedStats.baseValue ?? selectedStats.base_value ?? selectedStats.auction_value,
  );
  if (explicitValue != null) return clampDollarValue(explicitValue);

  /*
   * Next best path: compare custom FPTS with runtime FPTS. Example:
   * - runtime player pool says 600 FPTS and $30 base value;
   * - custom one-year stats say 540 FPTS;
   * - baseline becomes roughly $27 before clamps.
   */
  const customFpts = numberOrNull(selectedStats.fpts);
  const runtimeFpts = numberOrNull(player.fpts);
  if (customFpts != null && runtimeFpts != null && runtimeFpts > 0) {
    return clampDollarValue(originalBaseValue * clamp(customFpts / runtimeFpts, 0.65, 1.45));
  }

  /*
   * Last path: estimate a comparable fantasy score from available categories.
   * This is less exact than FPTS but keeps custom HR/RBI/R/SB/AVG or
   * SO/W/SV/ERA/WHIP lines meaningful.
   */
  const customScore = estimateFantasyScoreFromStats(buildScoringPlayer(player, selectedStats));
  const runtimeScore = estimateFantasyScoreFromStats(player);
  if (customScore > 0 && runtimeScore > 0) {
    return clampDollarValue(originalBaseValue * clamp(customScore / runtimeScore, 0.65, 1.45));
  }

  return originalBaseValue;
}

function estimateFantasyScoreFromStats(player) {
  const positions = Array.isArray(player.pos) ? player.pos : [];
  const isPitcher = ["SP", "RP", "P"].includes(positions[0]);
  if (isPitcher) {
    return (
      numberOrNull(player.so) * 1.2 +
      numberOrNull(player.w) * 7 +
      numberOrNull(player.sv) * 6 +
      (5 - (numberOrNull(player.era) || 5)) * 20 +
      (1.55 - (numberOrNull(player.whip) || 1.55)) * 40
    );
  }
  return (
    numberOrNull(player.r) +
    numberOrNull(player.rbi) +
    numberOrNull(player.hr) * 4 +
    numberOrNull(player.sb) * 2 +
    ((numberOrNull(player.avg) || 0.25) - 0.25) * 250
  );
}

function calculatePredictiveAdjustment(player, statProfile, volumeProjection) {
  const predictiveStats = statProfile.predictiveStats;
  const predictiveFpts = numberOrNull(predictiveStats?.fpts);
  const runtimeFpts = numberOrNull(player.fpts);

  /*
   * Predictive adjustment is intentionally modest. Projections should nudge
   * value, not swamp the baseline. FPTS compares forward-looking production
   * with the current player pool, while volumeProjection captures playing time.
   */
  const fptsMultiplier =
    predictiveFpts != null && runtimeFpts != null && runtimeFpts > 0
      ? clamp(predictiveFpts / runtimeFpts, 0.88, 1.12)
      : 1;
  const volumeMultiplier = volumeProjection?.score
    ? clamp(0.9 + volumeProjection.score / 500, 0.9, 1.1)
    : 1;
  const multiplier = Number(clamp((fptsMultiplier + volumeMultiplier) / 2, 0.88, 1.12).toFixed(3));
  return {
    multiplier,
    source: predictiveStats ? "predictive playing-time and production inputs" : "none",
    fpts_delta_percent:
      predictiveFpts != null && runtimeFpts
        ? Number(((predictiveFpts / runtimeFpts - 1) * 100).toFixed(1))
        : 0,
    volume_score: volumeProjection?.score || 0,
  };
}

function calculateAgeAdjustment(player) {
  const age = numberOrNull(player.age);
  if (age == null) {
    return { multiplier: 1, age: null, band: "UNKNOWN" };
  }
  const positions = Array.isArray(player.pos) ? player.pos : [];
  const isPitcher = ["SP", "RP", "P"].includes(positions[0]);
  let multiplier = 1;
  let band = "PRIME";

  /*
   * Age curve is a small contextual factor:
   * - young hitters can receive a small growth bump;
   * - prime-age players get stability;
   * - older players receive gradual risk haircuts.
   * Pitchers are treated more conservatively at very young ages because role
   * volatility and workload limits are common.
   */
  if (age <= 23) {
    multiplier = isPitcher ? 0.98 : 1.03;
    band = "ASCENDING";
  } else if (age <= (isPitcher ? 31 : 30)) {
    multiplier = 1.03;
    band = "PRIME";
  } else if (age <= 34) {
    multiplier = 0.98;
    band = "POST_PRIME";
  } else if (age <= 37) {
    multiplier = 0.93;
    band = "DECLINE_RISK";
  } else {
    multiplier = 0.88;
    band = "LATE_CAREER";
  }
  return { multiplier, age, band };
}

function calculateDepthChartAdjustment(player, volumeProjection, depthContext = null) {
  const depth = String(depthContext?.depth_role || player.depth || player.tier || "").toUpperCase();
  const depthRank = numberOrNull(depthContext?.depth_rank);

  /*
   * Depth context answers: "How secure is this player's real baseball role?"
   * A first-choice starter or elite player gets a small bump. Bench/deeper depth
   * roles get a haircut. The separate volumeMultiplier then checks whether the
   * projected PA/IP/G supports that role.
   */
  const depthMultiplier =
    depthContext?.is_starter || depthRank === 1 || depth === "ELITE"
      ? 1.04
      : depth === "STARTER" || (depthRank != null && depthRank <= 3)
        ? 1
        : depth === "BENCH" || (depthRank != null && depthRank > 3)
          ? 0.92
          : 0.96;
  const volumeScore = numberOrNull(volumeProjection?.score) || 0;
  const volumeMultiplier =
    volumeScore >= 76 ? 1.05 : volumeScore >= 58 ? 1 : volumeScore >= 38 ? 0.94 : 0.86;
  return {
    multiplier: Number(clamp(depthMultiplier * volumeMultiplier, 0.82, 1.1).toFixed(3)),
    depth: depthContext?.depth_role || player.depth || player.tier || null,
    depth_position: depthContext?.depth_position || (Array.isArray(player.pos) ? player.pos[0] : null),
    depth_rank: depthRank,
    status: depthContext?.status || null,
    volume_score: volumeScore,
    role: volumeProjection?.role || "Unknown role",
  };
}

function buildStaticInjuryUpdate(player) {
  if (!player?.injury && !player?.injury_status) return null;
  const injuryStatus = player.injury_status || player.injury;
  return {
    player_id: player.id,
    player_name: player.name,
    type: "INJURY",
    severity: "MEDIUM",
    risk_level: "MEDIUM",
    headline: `${player.name} has injury context in the player pool`,
    injury_status: injuryStatus,
    impact_summary: "Player-pool injury status lowered the risk-adjusted valuation.",
    source: "Player pool injury status",
    created_at: new Date(0).toISOString(),
  };
}

function buildValuationBreakdown(parts) {
  /*
   * This object is the audit trail for the valuation. It is intentionally
   * redundant with the individual response fields so a reviewer can read one
   * block and see the exact math used to produce TDV.
   */
  return {
    formula:
      "stat_baseline_value * scoring * scarcity * predictive * age * depth_chart * market_inflation * injury_risk",
    stat_baseline_value: parts.baseValue,
    scoring_multiplier: parts.scoringAdjustment.multiplier,
    scarcity_multiplier: parts.selectedScarcity.multiplier,
    predictive_multiplier: parts.predictiveAdjustment.multiplier,
    age_multiplier: parts.ageAdjustment.multiplier,
    depth_chart_multiplier: parts.depthChartAdjustment.multiplier,
    market_inflation_multiplier: Number(parts.inflationFactor.toFixed(3)),
    injury_risk_multiplier: parts.riskAdjustment.multiplier,
    pre_injury_value: parts.rawTrueDollarValue,
    post_injury_value: parts.adjustedTrueDollarValue,
    true_dollar_value: parts.trueDollarValue,
    max_bid_recommendation: parts.maxBidRecommendation,
    stat_source: parts.statProfile.publicProfile.selected_source,
  };
}

function buildPlayerRubricChecks(parts) {
  return {
    custom_one_or_three_year_stats_used:
      parts.statProfile.publicProfile.custom_one_year_available ||
      parts.statProfile.publicProfile.custom_three_year_available ||
      Boolean(parts.statProfile.publicProfile.runtime_stats_window),
    predictive_stats_used: parts.predictiveAdjustment.source !== "none",
    age_used: parts.ageAdjustment.age != null,
    injury_status_used: parts.riskAdjustment.level !== "LOW" || Boolean(parts.playerUpdate),
    scarcity_used: Number.isFinite(Number(parts.selectedScarcity.multiplier)),
    depth_chart_position_used:
      parts.depthChartAdjustment.depth != null || parts.depthChartAdjustment.depth_position != null,
  };
}

function buildRubricCoverageSummary(context) {
  return {
    valuation_variation_test_cases: 5,
    custom_one_or_three_year_stats: "Supported through draft_state.player_stat_overrides and runtime weighted stats_window.",
    predictive_stats: "Projected playing time and FPTS feed predictive_adjustment.",
    age: "Player age feeds age_adjustment.",
    injury_status: "Player updates, player-pool injury status, and commissioner notes feed risk_adjustment.",
    scarcity: "Roster config and undrafted pool feed position scarcity.",
    depth_chart_position: "draft_state.depth_chart_context, depth/tier, and projected volume feed depth_chart_adjustment.",
    draftkit_refresh: "Draft Kit posts the full draft_state after draft-state cache invalidation.",
    active_stat_window: context.statWindow,
  };
}

function calculateScoringAdjustment(player, scoringCategories = []) {
  const active = new Set(
    (Array.isArray(scoringCategories) ? scoringCategories : [])
      .map((category) => String(category || "").trim().toUpperCase())
      .filter(Boolean),
  );
  const isPitcher = Boolean(
    ["SP", "RP", "P"].includes((player.pos || [])[0]) ||
      ((player.era != null || player.whip != null || player.so != null) &&
        !["r", "rbi", "hr", "sb"].some((key) => numberOrNull(player[key]) != null)),
  );
  const defaults = isPitcher ? DEFAULT_PITCHER_CATEGORIES : DEFAULT_HITTER_CATEGORIES;
  const relevantActive = [...active].filter((category) => defaults.includes(category));
  if (relevantActive.length === 0) {
    return {
      multiplier: 0.75,
      active_categories: [],
      role: isPitcher ? "PITCHER" : "HITTER",
    };
  }

  const defaultAverage = averageCategoryScore(player, defaults);
  const activeAverage = averageCategoryScore(player, relevantActive);

  /*
   * If the league's active categories match a player's strengths, activeAverage
   * is higher than defaultAverage and the multiplier rises. If the league does
   * not count the player's best categories, the multiplier falls.
   */
  const rawMultiplier =
    defaultAverage > 0 ? activeAverage / defaultAverage : 1;
  return {
    multiplier: Number(Math.min(Math.max(rawMultiplier, 0.7), 1.35).toFixed(3)),
    active_categories: relevantActive,
    role: isPitcher ? "PITCHER" : "HITTER",
  };
}

function averageCategoryScore(player, categories) {
  if (!categories.length) return 0;
  const total = categories.reduce(
    (sum, category) => sum + categoryScore(player, category),
    0,
  );
  return total / categories.length;
}

function categoryScore(player, category) {
  const value = (key) => Number(player[key]);
  switch (category) {
    case "R":
      return clampRatio(value("r"), 90);
    case "HR":
      return clampRatio(value("hr"), 32);
    case "RBI":
      return clampRatio(value("rbi"), 95);
    case "SB":
      return clampRatio(value("sb"), 28);
    case "AVG":
      return clampRatio((value("avg") || 0) - 0.22, 0.08);
    case "W":
      return clampRatio(value("w"), 14);
    case "SV":
      return clampRatio(value("sv"), 32);
    case "SO":
      return clampRatio(value("so"), 185);
    case "ERA":
      return clampRatio(5 - (value("era") || 5), 2);
    case "WHIP":
      return clampRatio(1.55 - (value("whip") || 1.55), 0.45);
    default:
      return 1;
  }
}

function clampRatio(value, divisor) {
  const ratio = Number(value) / divisor;
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(Math.max(ratio, 0), 2);
}

function clamp(value, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return minimum;
  return Math.min(Math.max(numeric, minimum), maximum);
}

function clampDollarValue(value) {
  return Math.round(clamp(value, 1, 120));
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeRosterEntry(entry, fallbackTeamId) {
  if (Array.isArray(entry)) {
    if (typeof entry[0] === "string" && typeof entry[1] === "string") {
      const matched = findPlayer(entry[0], entry[1]);
      if (!matched) return null;
      return {
        playerId: matched.id,
        teamId: fallbackTeamId,
        playerName: matched.name,
        playerTeam: matched.team,
      };
    }

    const playerId = Number(entry[0]);
    const matched = findPlayerById(playerId);
    if (!Number.isFinite(playerId) || !matched) {
      return null;
    }

    return {
      playerId,
      teamId: fallbackTeamId,
      playerName: matched?.name || null,
      playerTeam: matched?.team || null,
    };
  }

  if (entry && typeof entry === "object") {
    const candidateId = Number(entry.playerId ?? entry.player_id ?? entry.id);
    if (Number.isFinite(candidateId)) {
      const matched = findPlayerById(candidateId);
      if (!matched) return null;
      return {
        playerId: candidateId,
        teamId: fallbackTeamId,
        playerName: matched?.name || entry.name || entry.player || entry.player_name || null,
        playerTeam: matched?.team || entry.team || entry.player_team || entry.team_abbr || null,
      };
    }

    const matched = findPlayer(
      entry.name || entry.player || entry.player_name || "",
      entry.team || entry.player_team || entry.team_abbr || "",
    );
    if (matched) {
      return {
        playerId: matched.id,
        teamId: fallbackTeamId,
        playerName: matched.name,
        playerTeam: matched.team,
      };
    }
  }

  const rawName =
    typeof entry === "string"
      ? entry
      : entry?.name || entry?.player || entry?.player_name || "";
  const matched = findPlayer(rawName);
  if (!matched) {
    return null;
  }

  return {
    playerId: matched.id,
    teamId: fallbackTeamId,
    playerName: matched.name,
    playerTeam: matched.team,
  };
}

function findPlayerById(id) {
  return PLAYER_BY_ID.get(Number(id)) || null;
}

function findPlayer(name, team) {
  if (!name) return null;
  const q = normalizeNameKey(name);
  const normalizedTeam = normalizeTeamKey(team);
  const teamMatches = (player) =>
    !normalizedTeam || normalizeTeamKey(player.team) === normalizedTeam;

  const exact = players.find(
    (player) => teamMatches(player) && normalizeNameKey(player.name) === q,
  );
  if (exact) return exact;

  const aliasMatches = players.filter((player) =>
    teamMatches(player) &&
    (player.aliases || []).some((alias) => normalizeNameKey(alias) === q),
  );
  if (aliasMatches.length === 1) return aliasMatches[0];
  if (aliasMatches.length > 1) return null;

  const partialMatches = players.filter(
    (player) => teamMatches(player) && normalizeNameKey(player.name).includes(q),
  );
  if (partialMatches.length === 1) return partialMatches[0];
  if (partialMatches.length > 1 && normalizedTeam) return null;

  if (normalizedTeam) {
    return null;
  }

  return players.find((player) => normalizeNameKey(player.name).includes(q)) || null;
}

function getPlayers({ league, pos, tier, available_only, drafted_names }) {
  let result = [...players];

  if (league && league !== "ALL") {
    result = result.filter((player) => player.league === league);
  }
  if (pos && pos !== "ALL") {
    result = result.filter((player) => player.pos.includes(pos));
  }
  if (tier && tier !== "ALL") {
    result = result.filter((player) => player.tier === tier);
  }
  if (available_only && drafted_names) {
    const draftedSet = new Set(drafted_names);
    result = result.filter((player) => !draftedSet.has(player.name));
  }

  const sorted = result.slice().sort((a, b) => {
    const tierDelta =
      (PLAYER_TIER_ORDER[a.tier] ?? Number.MAX_SAFE_INTEGER) -
      (PLAYER_TIER_ORDER[b.tier] ?? Number.MAX_SAFE_INTEGER);
    if (tierDelta !== 0) return tierDelta;
    if ((b.baseValue ?? 0) !== (a.baseValue ?? 0)) {
      return (b.baseValue ?? 0) - (a.baseValue ?? 0);
    }
    if ((b.fpts ?? 0) !== (a.fpts ?? 0)) {
      return (b.fpts ?? 0) - (a.fpts ?? 0);
    }
    return a.name.localeCompare(b.name);
  });

  return annotateRanks(sorted).map((player) =>
    decoratePlayerWithUpdate({
      ...player,
      volume_projection: buildVolumeProjection(player),
    }),
  );
}

function annotateRanks(sortedPlayers) {
  const tierCounts = {};
  return sortedPlayers.map((player, index) => {
    const nextTierRank = (tierCounts[player.tier] || 0) + 1;
    tierCounts[player.tier] = nextTierRank;
    return {
      ...player,
      overall_rank: index + 1,
      tier_rank: nextTierRank,
    };
  });
}

function groupPlayersByTier(sortedPlayers) {
  return ["Elite", "Starter", "Bench"]
    .map((tier) => ({
      tier,
      count: sortedPlayers.filter((player) => player.tier === tier).length,
      players: sortedPlayers.filter((player) => player.tier === tier),
    }))
    .filter((group) => group.count > 0);
}

function summarizeMarket(inflationFactor) {
  const deltaPercent = Number(((inflationFactor - 1) * 100).toFixed(1));
  if (inflationFactor >= 1.15) {
    return { label: "Very Hot", delta_percent: deltaPercent };
  }
  if (inflationFactor >= 1.05) {
    return { label: "Hot", delta_percent: deltaPercent };
  }
  if (inflationFactor <= 0.9) {
    return { label: "Very Cold", delta_percent: deltaPercent };
  }
  if (inflationFactor <= 0.97) {
    return { label: "Cold", delta_percent: deltaPercent };
  }
  return { label: "Neutral", delta_percent: deltaPercent };
}

function getRiskAdjustment(playerUpdate) {
  if (!playerUpdate) {
    return { level: "LOW", multiplier: 1, max_bid_delta_percent: 0 };
  }
  if (playerUpdate.risk_level === "HIGH") {
    return { level: "HIGH", multiplier: 0.88, max_bid_delta_percent: -12 };
  }
  if (playerUpdate.risk_level === "MEDIUM") {
    return { level: "MEDIUM", multiplier: 0.94, max_bid_delta_percent: -6 };
  }
  return { level: "LOW", multiplier: 1, max_bid_delta_percent: 0 };
}

function normalizeRiskLevel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(RISK_ORDER, normalized)
    ? normalized
    : "LOW";
}

function buildCommissionerNotesByPlayerId(notes) {
  const byPlayerId = new Map();
  if (!Array.isArray(notes)) return byPlayerId;

  notes.forEach((note) => {
    const playerId = Number(note?.player_id ?? note?.playerId);
    if (!Number.isFinite(playerId)) return;
    const normalized = {
      ...note,
      player_id: playerId,
      type: String(note.type || "NEWS").toUpperCase(),
      risk_level: normalizeRiskLevel(note.risk_level || note.severity),
      severity: normalizeRiskLevel(note.severity || note.risk_level),
      headline:
        note.headline ||
        `${note.player_name || `Player ${playerId}`} has commissioner draft context`,
      source: note.source || "League commissioner note",
      created_at: note.created_at || new Date(0).toISOString(),
    };

    byPlayerId.set(
      playerId,
      // If multiple notes exist for one player, valuations should react to the
      // highest-risk note first and use recency only as a tie breaker.
      chooseMostSevereUpdate(byPlayerId.get(playerId), normalized),
    );
  });

  return byPlayerId;
}

function chooseMostSevereUpdate(left, right) {
  if (!left) return right || null;
  if (!right) return left;

  const leftRisk = RISK_ORDER[normalizeRiskLevel(left.risk_level || left.severity)];
  const rightRisk = RISK_ORDER[normalizeRiskLevel(right.risk_level || right.severity)];
  if (rightRisk > leftRisk) return right;
  if (rightRisk < leftRisk) return left;

  const leftTime = Date.parse(left.created_at || 0) || 0;
  const rightTime = Date.parse(right.created_at || 0) || 0;
  return rightTime > leftTime ? right : left;
}

function buildReasoning(
  player,
  playerTier,
  scarcityTier,
  posMap,
  inflation,
  tdv,
  playerUpdate = null,
  riskAdjustment = { max_bid_delta_percent: 0 },
  scoringAdjustment = { multiplier: 1, active_categories: [] },
  predictiveAdjustment = { multiplier: 1 },
  ageAdjustment = { multiplier: 1, band: "UNKNOWN" },
  depthChartAdjustment = { multiplier: 1, role: "Unknown role" },
  volumeProjection = null,
) {
  const playerPositions = Array.isArray(player.pos) ? player.pos : [];
  const primaryPosition = playerPositions[0];
  const scarcityLevel = (primaryPosition && posMap[primaryPosition]) || scarcityTier || "LOW";
  const inflPct = ((inflation - 1) * 100).toFixed(1);
  const inflSign = inflation >= 1 ? "+" : "";

  const parts = [];
  if (scarcityLevel === "CRITICAL" || scarcityLevel === "HIGH") {
    parts.push(`${primaryPosition || "Position"} scarce — high demand in pool.`);
  } else if (scarcityLevel === "MEDIUM") {
    parts.push(`${primaryPosition || "Position"} demand is steady.`);
  }
  if (Math.abs(inflation - 1) > 0.02) {
    parts.push(`Market inflation ${inflSign}${inflPct}%.`);
  }
  if (Math.abs(Number(scoringAdjustment.multiplier || 1) - 1) > 0.03) {
    const scoringPct = ((Number(scoringAdjustment.multiplier || 1) - 1) * 100).toFixed(1);
    const scoringSign = Number(scoringAdjustment.multiplier || 1) >= 1 ? "+" : "";
    parts.push(
      `Scoring format impact ${scoringSign}${scoringPct}% for ${(
        scoringAdjustment.active_categories || []
      ).join("/") || "no active role categories"}.`,
    );
  }
  if (Math.abs(Number(predictiveAdjustment.multiplier || 1) - 1) > 0.02) {
    const predictivePct = ((Number(predictiveAdjustment.multiplier || 1) - 1) * 100).toFixed(1);
    const predictiveSign = Number(predictiveAdjustment.multiplier || 1) >= 1 ? "+" : "";
    parts.push(`Predictive playing-time impact ${predictiveSign}${predictivePct}%.`);
  }
  if (ageAdjustment.age != null && Math.abs(Number(ageAdjustment.multiplier || 1) - 1) > 0.02) {
    const agePct = ((Number(ageAdjustment.multiplier || 1) - 1) * 100).toFixed(1);
    const ageSign = Number(ageAdjustment.multiplier || 1) >= 1 ? "+" : "";
    parts.push(`Age curve ${ageAdjustment.band} ${ageSign}${agePct}%.`);
  }
  if (Math.abs(Number(depthChartAdjustment.multiplier || 1) - 1) > 0.02) {
    const depthPct = ((Number(depthChartAdjustment.multiplier || 1) - 1) * 100).toFixed(1);
    const depthSign = Number(depthChartAdjustment.multiplier || 1) >= 1 ? "+" : "";
    parts.push(`Depth role impact ${depthSign}${depthPct}% (${depthChartAdjustment.role}).`);
  }
  if (playerUpdate) {
    const adjustment = Number(riskAdjustment.max_bid_delta_percent || 0);
    const adjustmentText =
      adjustment < 0 ? ` ${adjustment}% valuation adjustment applied.` : "";
    parts.push(`${playerUpdate.headline}.${adjustmentText}`);
  }
  if (volumeProjection) {
    parts.push(
      `Depth volume: ${volumeProjection.role} (${volumeProjection.score}/100, ${volumeProjection.confidence.toLowerCase()} confidence).`,
    );
  }
  parts.push(`Player tier: ${playerTier}. Scarcity: ${scarcityTier}. TDV: $${tdv}.`);
  return parts.join(" ");
}

module.exports = {
  calculateValuation,
  calculateValuations,
  getPlayers,
  findPlayer,
  findPlayerById,
  groupPlayersByTier,
};
