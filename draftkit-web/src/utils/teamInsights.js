const POSITION_ORDER = [
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "OF",
  "DH",
  "SP",
  "RP",
  "P",
  "UTIL",
];

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function asNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function positionRank(position) {
  const index = POSITION_ORDER.indexOf(String(position || "").toUpperCase());
  return index === -1 ? POSITION_ORDER.length : index;
}

function buildPlayerLookup(players = []) {
  const byId = new Map();
  const byName = new Map();

  players.forEach((player) => {
    if (!player) return;
    byId.set(Number(player.id), player);
    byName.set(normalizeKey(player.name), player);
    (player.aliases || []).forEach((alias) => {
      byName.set(normalizeKey(alias), player);
    });
  });

  return { byId, byName };
}

function findPlayerForEntry(entry, lookup) {
  if (!entry) return null;
  const playerId = entry.playerId ?? entry.id;
  const byIdMatch =
    playerId != null ? lookup.byId.get(Number(playerId)) : null;
  if (byIdMatch) return byIdMatch;

  const fallbackName =
    typeof entry === "string" ? entry : entry.name || entry.player || "";
  return lookup.byName.get(normalizeKey(fallbackName)) || null;
}

function buildAssignmentMap(league = {}) {
  const assignments = new Map();

  (league.teams || []).forEach((team) => {
    (team.roster || []).forEach((entry) => {
      if (entry?.playerId == null) return;
      assignments.set(Number(entry.playerId), {
        status: entry.isKeeper ? "Keeper" : "Rostered",
        teamId: team.id,
        teamName: team.name,
        price: asNumber(entry.price, null),
        slot: entry.draftedPos || null,
      });
    });

    (team.taxiSquad || []).forEach((entry) => {
      if (entry?.playerId == null) return;
      assignments.set(Number(entry.playerId), {
        status: "Taxi",
        teamId: team.id,
        teamName: team.name,
        price: asNumber(entry.price, 1),
        slot: "TAXI",
      });
    });

    (team.minorLeague || []).forEach((entry) => {
      if (entry?.playerId == null) return;
      assignments.set(Number(entry.playerId), {
        status: "Minor League",
        teamId: team.id,
        teamName: team.name,
        price: 0,
        slot: "MiLB",
      });
    });
  });

  return assignments;
}

function buildLiveRosterLookup(liveDepthData = null) {
  const byMlbId = new Map();
  const byTeamAndName = new Map();

  (liveDepthData?.teams || []).forEach((team) => {
    (team.roster || []).forEach((entry) => {
      const normalized = {
        ...entry,
        team: entry.team || team.team,
        teamName: entry.teamName || team.teamName || team.team,
      };
      if (entry.mlbId != null) byMlbId.set(Number(entry.mlbId), normalized);
      byTeamAndName.set(
        `${normalized.team}:${normalizeKey(entry.name)}`,
        normalized,
      );
    });
  });

  return { byMlbId, byTeamAndName };
}

function findLiveRosterEntry(player, lookup) {
  if (!player || !lookup) return null;
  if (player.mlbId != null) {
    const byId = lookup.byMlbId.get(Number(player.mlbId));
    if (byId) return byId;
  }
  return (
    lookup.byTeamAndName.get(`${player.team}:${normalizeKey(player.name)}`) ||
    null
  );
}

export function getPlayerValue(player = {}) {
  return Math.max(0, asNumber(player.baseValue ?? player.base_value ?? player.value, 0));
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function getPlayerVolumeProjection(player = {}) {
  if (player.volume_projection) return player.volume_projection;

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
  const directWorkload = isPitcher
    ? [
        ["IP", numberOrNull(player.projected_innings), 180],
        ["G", numberOrNull(player.projected_games), 65],
      ]
    : [
        ["PA", numberOrNull(player.projected_plate_appearances), 650],
        ["G", numberOrNull(player.projected_games), 150],
      ];
  const directAvailable = directWorkload.filter(([, value]) => value != null);
  const proxyFields = isPitcher
    ? [
        ["SO", numberOrNull(player.so), 185],
        ["W", numberOrNull(player.w), 14],
        ["SV", numberOrNull(player.sv), 32],
        ["FPTS", numberOrNull(player.fpts), 520],
      ]
    : [
        ["R", numberOrNull(player.r), 90],
        ["RBI", numberOrNull(player.rbi), 95],
        ["HR", numberOrNull(player.hr), 32],
        ["SB", numberOrNull(player.sb), 28],
        ["FPTS", numberOrNull(player.fpts), 600],
      ];
  const sourceFields = directAvailable.length > 0 ? directWorkload : proxyFields;
  const available = sourceFields.filter(([, value]) => value != null);
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
        ? "Rotation or closer role"
        : "Everyday role"
      : normalizedScore >= 58
        ? isPitcher
          ? "Regular pitching role"
          : "Regular role"
        : normalizedScore >= 38
          ? isPitcher
            ? "Swing or setup role"
            : "Part-time role"
          : isPitcher
            ? "Depth arm"
            : "Depth role";

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
    source: player.stats_window || "weighted historical stats",
    missing_direct_fields:
      directAvailable.length > 0
        ? []
        : ["projected_games", "projected_plate_appearances", "projected_innings"],
    drivers: available.map(
      ([label, value]) => `${label}:${Math.round(Number(value) * 10) / 10}`,
    ),
    note:
      directAvailable.length > 0
        ? "Depth rank uses generated playing-time fields from the player pool."
        : "Role estimate uses available production because playing-time fields are unavailable for this player.",
  };
}

export function getPlayerRiskLevel(player = {}) {
  // Risk shown in team/depth insights must come from the Valuation API news
  // feed or a live valuation response. Static player-pool injury fields are
  // intentionally ignored so the UI does not invent notification context.
  return String(
    player.risk_level ||
      player.latest_update?.risk_level ||
      (player.injury_status ? "MEDIUM" : "LOW"),
  ).toUpperCase();
}

export function getPlayerUpdateSummary(player = {}) {
  return (
    player.news_headline ||
    player.latest_update?.headline ||
    player.update_impact_summary ||
    player.latest_update?.impact_summary ||
    player.injury_status ||
    ""
  );
}

export function buildMlbDepthCharts(players = [], league = {}, liveDepthData = null) {
  const assignments = buildAssignmentMap(league);
  const liveRosterLookup = buildLiveRosterLookup(liveDepthData);
  const byTeam = new Map();

  (players || []).forEach((player) => {
    if (!player?.team) return;
    const positions = Array.isArray(player.pos) ? player.pos : [];
    if (positions.length === 0) return;

    if (!byTeam.has(player.team)) {
      byTeam.set(player.team, {
        team: player.team,
        totalPlayers: 0,
        draftedCount: 0,
        highRiskCount: 0,
        positions: new Map(),
      });
    }

    const teamBucket = byTeam.get(player.team);
    teamBucket.totalPlayers += 1;
    const assignment = assignments.get(Number(player.id)) || null;
    const riskLevel = getPlayerRiskLevel(player);
    const liveRosterEntry = findLiveRosterEntry(player, liveRosterLookup);
    const volumeProjection = getPlayerVolumeProjection(player);
    if (assignment || player.drafted) teamBucket.draftedCount += 1;
    if (riskLevel === "HIGH") teamBucket.highRiskCount += 1;

    positions.forEach((position) => {
      const normalizedPosition = String(position || "").toUpperCase();
      if (!normalizedPosition) return;
      if (!teamBucket.positions.has(normalizedPosition)) {
        teamBucket.positions.set(normalizedPosition, {
          position: normalizedPosition,
          players: [],
        });
      }

      teamBucket.positions.get(normalizedPosition).players.push({
        ...player,
        depthPosition: normalizedPosition,
        value: getPlayerValue(player),
        volumeProjection,
        volumeScore: volumeProjection.score,
        riskLevel,
        updateSummary: getPlayerUpdateSummary(player),
        officialRoster:
          liveRosterEntry != null
            ? {
                source: liveDepthData?.source || "mlb-stats-api",
                active: Boolean(liveRosterEntry.active),
                statusCode: liveRosterEntry.statusCode || null,
                statusDescription: liveRosterEntry.statusDescription || null,
                positionCode: liveRosterEntry.positionCode || null,
                positionName: liveRosterEntry.positionName || null,
                jerseyNumber: liveRosterEntry.jerseyNumber || null,
                teamName: liveRosterEntry.teamName || null,
              }
            : null,
        assignment:
          assignment ||
          (player.drafted
            ? {
                status: player.minorLeague
                  ? "Minor League"
                  : player.taxi
                    ? "Taxi"
                    : "Rostered",
                teamId: player.draftedBy,
                teamName: player.draftedBy
                  ? `Owner ${player.draftedBy}`
                  : "Drafted",
                price: asNumber(player.draftPrice, null),
                slot: player.minorLeague ? "MiLB" : player.taxi ? "TAXI" : null,
              }
            : null),
      });
    });
  });

  const teams = [...byTeam.values()]
    .sort((a, b) => a.team.localeCompare(b.team))
    .map((teamBucket) => {
      const positions = [...teamBucket.positions.values()]
        .sort((a, b) => positionRank(a.position) - positionRank(b.position))
        .map((positionBucket) => ({
          ...positionBucket,
          players: positionBucket.players
            .sort((a, b) => {
              const volumeDelta = (b.volumeScore || 0) - (a.volumeScore || 0);
              if (volumeDelta !== 0) return volumeDelta;
              const valueDelta = b.value - a.value;
              if (valueDelta !== 0) return valueDelta;
              return (
                asNumber(a.overall_rank, 9999) -
                  asNumber(b.overall_rank, 9999) ||
                a.name.localeCompare(b.name)
              );
            })
            .map((player, index) => ({
              ...player,
              depthRank: index + 1,
            })),
        }));

      return {
        ...teamBucket,
        positions,
        liveRosterCount:
          liveDepthData?.teams?.find((entry) => entry.team === teamBucket.team)
            ?.roster?.length || 0,
      };
    });

  return {
    teams,
    teamOptions: teams.map((team) => team.team),
    positionOptions: [
      ...new Set(
        teams.flatMap((team) =>
          team.positions.map((position) => position.position),
        ),
      ),
    ].sort((a, b) => positionRank(a) - positionRank(b)),
    summary: {
      teamCount: teams.length,
      playerCount: players.length,
      draftedCount: teams.reduce((sum, team) => sum + team.draftedCount, 0),
      highRiskCount: teams.reduce((sum, team) => sum + team.highRiskCount, 0),
      liveRosterPlayerCount: teams.reduce(
        (sum, team) => sum + (team.liveRosterCount || 0),
        0,
      ),
      source: liveDepthData?.source || "local-derived",
      generatedAt: liveDepthData?.generated_at || null,
      warning: liveDepthData?.warning || "",
    },
  };
}

export function buildOwnerRankings(league = {}, players = [], rosterPositions = []) {
  const lookup = buildPlayerLookup(players);
  const totalSlots = Math.max(1, rosterPositions.length || 1);

  const rows = (league.teams || []).map((team) => {
    const rosterEntries = team.roster || [];
    const taxiEntries = team.taxiSquad || [];

    const rosterPlayers = rosterEntries.map((entry) => {
      const player = findPlayerForEntry(entry, lookup);
      const value = player ? getPlayerValue(player) : asNumber(entry?.baseValue, 0);
      const price = asNumber(entry?.price, 0);
      const riskLevel = player ? getPlayerRiskLevel(player) : "LOW";
      return { entry, player, value, price, riskLevel };
    });

    const taxiPlayers = taxiEntries.map((entry) => {
      const player = findPlayerForEntry(entry, lookup);
      const value = player ? getPlayerValue(player) : asNumber(entry?.baseValue, 0);
      const riskLevel = player ? getPlayerRiskLevel(player) : "LOW";
      return { entry, player, value, riskLevel };
    });

    const rosterValue = rosterPlayers.reduce((sum, item) => sum + item.value, 0);
    const taxiValue = taxiPlayers.reduce((sum, item) => sum + item.value, 0);
    const spent = rosterPlayers.reduce((sum, item) => sum + item.price, 0);
    const valueDelta = rosterValue - spent;
    const rosterCount = rosterEntries.length;
    const emptySlots = Math.max(totalSlots - rosterCount, 0);
    const rosterFillPercent = Math.round((rosterCount / totalSlots) * 100);
    const budgetRemaining = asNumber(team.budget_remaining, 0);
    const maxBid = Math.max(budgetRemaining - Math.max(emptySlots - 1, 0), 1);
    const highRiskCount =
      rosterPlayers.filter((item) => item.riskLevel === "HIGH").length +
      taxiPlayers.filter((item) => item.riskLevel === "HIGH").length;
    const mediumRiskCount =
      rosterPlayers.filter((item) => item.riskLevel === "MEDIUM").length +
      taxiPlayers.filter((item) => item.riskLevel === "MEDIUM").length;

    const strengthScore = Math.max(
      0,
      Math.round(
        rosterValue +
          taxiValue * 0.15 +
          budgetRemaining * 0.18 +
          maxBid * 0.12 +
          rosterFillPercent * 0.18 +
          valueDelta * 0.35 -
          highRiskCount * 7 -
          mediumRiskCount * 3 -
          emptySlots * 0.6,
      ),
    );

    return {
      id: team.id,
      name: team.name,
      strengthScore,
      rosterValue: Math.round(rosterValue),
      taxiValue: Math.round(taxiValue),
      spent,
      valueDelta: Math.round(valueDelta),
      budgetRemaining,
      maxBid,
      rosterCount,
      totalSlots,
      emptySlots,
      rosterFillPercent,
      highRiskCount,
      mediumRiskCount,
    };
  });

  return rows
    .sort((a, b) => {
      const scoreDelta = b.strengthScore - a.strengthScore;
      if (scoreDelta !== 0) return scoreDelta;
      return b.rosterValue - a.rosterValue || b.budgetRemaining - a.budgetRemaining;
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function sortOwnerRankings(rows = [], sortKey = "strengthScore", direction = "desc") {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...rows]
    .sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      if (typeof aValue === "string" || typeof bValue === "string") {
        return String(aValue || "").localeCompare(String(bValue || "")) * multiplier;
      }
      return (asNumber(aValue, 0) - asNumber(bValue, 0)) * multiplier;
    })
    .map((row, index) => ({
      ...row,
      displayRank: index + 1,
    }));
}
