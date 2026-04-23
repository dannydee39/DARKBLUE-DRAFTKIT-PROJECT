const players = require("../data/players.json");

const PLAYER_TIER_ORDER = { Elite: 0, Starter: 1, Bench: 2 };
const PLAYER_BY_ID = new Map(players.map((player) => [player.id, player]));
const POSITION_DEFAULT = {
  multiplier: 1.0,
  level: "LOW",
  remainingSlots: 0,
  undraftedAtPos: 0,
};

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
    valuations,
  };
}

function buildDraftContext(draftState = {}) {
  const {
    total_teams = 12,
    budget_per_team = 260,
    scoring_categories = ["R", "HR", "RBI", "SB", "AVG", "W", "SV", "ERA", "WHIP", "SO"],
    teams = [],
    roster_config = {
      C: 2,
      "1B": 1,
      "2B": 2,
      CI: 1,
      "3B": 0,
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
  const baseValue = player.baseValue ?? 1;
  const playerPositions = Array.isArray(player.pos) ? player.pos : [];
  const positionDetails = {};

  let selectedScarcity = POSITION_DEFAULT;
  playerPositions.forEach((position) => {
    const detail = context.positionScarcity[position] || POSITION_DEFAULT;
    positionDetails[position] = detail.level;
    if (detail.multiplier > selectedScarcity.multiplier) {
      selectedScarcity = detail;
    }
  });

  const rawTrueDollarValue = Math.round(
    baseValue * selectedScarcity.multiplier * context.inflationFactor,
  );
  const trueDollarValue = Math.min(Math.max(rawTrueDollarValue, 1), 120);
  const maxBidRecommendation = Math.max(Math.round(trueDollarValue * 0.92), 1);
  const valueDelta = trueDollarValue - baseValue;
  const draftabilityScore = Number(
    (trueDollarValue / Math.max(baseValue, 1)).toFixed(2),
  );

  return {
    player: player.name,
    player_id: player.id,
    player_tier: player.tier,
    base_value: baseValue,
    true_dollar_value: trueDollarValue,
    max_bid_recommendation: maxBidRecommendation,
    market_inflation: parseFloat(context.inflationFactor.toFixed(3)),
    market_context: summarizeMarket(context.inflationFactor),
    scarcity_tier: selectedScarcity.level,
    position_scarcity: positionDetails,
    draftability_score: draftabilityScore,
    value_delta: valueDelta,
    is_drafted: context.draftedPlayerIds.has(player.id),
    reasoning: buildReasoning(
      player,
      player.tier,
      selectedScarcity.level,
      positionDetails,
      context.inflationFactor,
      trueDollarValue,
    ),
    stats: {
      tier: player.tier,
      positions: player.pos,
      team: player.team,
      league: player.league,
    },
  };
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

  return annotateRanks(sorted);
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

function buildReasoning(player, playerTier, scarcityTier, posMap, inflation, tdv) {
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
