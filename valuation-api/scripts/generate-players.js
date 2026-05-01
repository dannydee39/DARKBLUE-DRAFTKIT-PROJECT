/**
 * generate-players.js
 * ---------------------------------------------------------------------------
 * Builds valuation-api/data/players.json from real MLB data.
 *
 * Source of truth:
 *   - Official MLB Stats API season hitting stats
 *   - Official MLB Stats API season pitching stats
 *   - Official MLB Stats API people metadata
 *
 * Seasons blended:
 *   - 2025: 50%
 *   - 2024: 30%
 *   - 2023: 20%
 *
 * The runtime API contract does not change. This script only replaces the
 * sample CSV ETL with a real-data ETL that still emits the same normalized
 * schema the Draft Kit expects.
 * ---------------------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");

const OUT_FILE = path.join(__dirname, "../data/players.json");

const SEASONS = [2025, 2024, 2023];
const SEASON_WEIGHTS = {
  2025: 0.5,
  2024: 0.3,
  2023: 0.2,
};

const TEAM_ENDPOINT = "https://statsapi.mlb.com/api/v1/teams?sportId=1";
const STATS_ENDPOINT = "https://statsapi.mlb.com/api/v1/stats";
const PEOPLE_ENDPOINT = "https://statsapi.mlb.com/api/v1/people";

const TOTAL_AUCTION_BUDGET = 12 * 260;
const HITTER_BUDGET = TOTAL_AUCTION_BUDGET * 0.68;
const PITCHER_BUDGET = TOTAL_AUCTION_BUDGET * 0.32;
const HITTER_REPLACEMENT_RANK = 156;
const PITCHER_REPLACEMENT_RANK = 84;

const MIN_HITTER_PA = 40;
const MIN_PITCHER_OUTS = 15;

const ELITE_COUNT = 25;
const STARTER_CUTOFF = 125;

const POSITION_MAP = {
  C: "C",
  "1B": "1B",
  "2B": "2B",
  "3B": "3B",
  SS: "SS",
  LF: "OF",
  CF: "OF",
  RF: "OF",
  OF: "OF",
  DH: "DH",
  PH: "DH",
  PR: "OF",
  P: "P",
};

function buildPhotoUrl(mlbId) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${mlbId}/headshot/67/current`;
}

async function fetchJson(url, label, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "darkblue-draftkit/1.0",
        Accept: "application/json",
      },
    });

    if (response.ok) {
      return response.json();
    }

    if (attempt === attempts) {
      throw new Error(`${label} failed with ${response.status}: ${url}`);
    }

    await new Promise((resolve) => setTimeout(resolve, attempt * 600));
  }

  throw new Error(`${label} exhausted retries: ${url}`);
}

function chunk(values, size) {
  const output = [];
  for (let i = 0; i < values.length; i += size) {
    output.push(values.slice(i, i + size));
  }
  return output;
}

function safeNumber(value) {
  if (value === null || value === undefined || value === "" || value === ".---" || value === "-.--") {
    return 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRate(value) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return value.toFixed(3);
}

function formatPitchRate(value) {
  if (!Number.isFinite(value) || value < 0) return null;
  return value.toFixed(2);
}

function inningsToOuts(value) {
  if (value === null || value === undefined || value === "") return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const [wholePart, partialPart = "0"] = raw.split(".");
  return Number(wholePart) * 3 + Number(partialPart);
}

function normalizeLeague(leagueInfo) {
  if (!leagueInfo) return "ALL";
  if (leagueInfo.id === 104 || String(leagueInfo.name).toUpperCase().includes("NL")) return "NL";
  if (leagueInfo.id === 103 || String(leagueInfo.name).toUpperCase().includes("AL")) return "AL";
  return "ALL";
}

function normalizePosition(abbrev) {
  return POSITION_MAP[String(abbrev || "").toUpperCase()] || "OF";
}

function inferPitcherRole(pitching) {
  const gamesStarted = safeNumber(pitching.gamesStarted);
  const gamesPitched = safeNumber(pitching.gamesPitched);
  const saves = safeNumber(pitching.saves);
  const gamesFinished = safeNumber(pitching.gamesFinished);

  if (gamesStarted >= Math.max(5, gamesPitched * 0.35)) return "SP";
  if (saves >= 5 || gamesFinished >= Math.max(10, gamesPitched * 0.4)) return "RP";
  return gamesStarted > 0 ? "SP" : "RP";
}

function weightedBlend(seasonMap, extractor) {
  let totalWeight = 0;
  const accumulator = {};

  for (const season of SEASONS) {
    const entry = seasonMap[season];
    if (!entry) continue;

    const weight = SEASON_WEIGHTS[season] || 0;
    const values = extractor(entry);
    totalWeight += weight;

    Object.entries(values).forEach(([key, value]) => {
      accumulator[key] = (accumulator[key] || 0) + safeNumber(value) * weight;
    });
  }

  if (!totalWeight) return null;

  Object.keys(accumulator).forEach((key) => {
    accumulator[key] /= totalWeight;
  });

  return accumulator;
}

async function fetchTeamsMap() {
  const data = await fetchJson(TEAM_ENDPOINT, "teams");
  const map = new Map();

  for (const team of data.teams || []) {
    map.set(team.id, {
      id: team.id,
      abbreviation: team.abbreviation || team.teamCode || team.fileCode || team.teamName,
      name: team.name,
      league: normalizeLeague(team.league),
    });
  }

  return map;
}

async function fetchSeasonSplits(group, season) {
  const url = `${STATS_ENDPOINT}?stats=season&group=${group}&playerPool=ALL&sportIds=1&season=${season}&limit=5000`;
  const data = await fetchJson(url, `${group} season ${season}`);
  return data.stats?.[0]?.splits || [];
}

async function fetchPeopleMap(playerIds) {
  const peopleMap = new Map();

  for (const ids of chunk(playerIds, 50)) {
    const url = `${PEOPLE_ENDPOINT}?personIds=${ids.join(",")}&hydrate=currentTeam`;
    const data = await fetchJson(url, `people batch ${ids[0]}`);
    for (const person of data.people || []) {
      peopleMap.set(person.id, person);
    }
  }

  return peopleMap;
}

function hitterExtractor(split) {
  const stat = split.stat || {};
  return {
    runs: stat.runs,
    homeRuns: stat.homeRuns,
    rbi: stat.rbi,
    stolenBases: stat.stolenBases,
    hits: stat.hits,
    atBats: stat.atBats,
    baseOnBalls: stat.baseOnBalls,
    strikeOuts: stat.strikeOuts,
    totalBases: stat.totalBases,
    plateAppearances: stat.plateAppearances,
    hitByPitch: stat.hitByPitch,
    sacFlies: stat.sacFlies,
    gamesPlayed: stat.gamesPlayed,
  };
}

function pitcherExtractor(split) {
  const stat = split.stat || {};
  return {
    wins: stat.wins,
    saves: stat.saves,
    strikeOuts: stat.strikeOuts,
    earnedRuns: stat.earnedRuns,
    hitsAllowed: stat.hits,
    baseOnBalls: stat.baseOnBalls,
    outsPitched: stat.outs || inningsToOuts(stat.inningsPitched),
    gamesStarted: stat.gamesStarted,
    gamesPitched: stat.gamesPitched,
    gamesFinished: stat.gamesFinished,
    holds: stat.holds,
    gamesPlayed: stat.gamesPlayed,
  };
}

function computeHitterRates(blended) {
  if (!blended) return null;
  const atBats = safeNumber(blended.atBats);
  const hits = safeNumber(blended.hits);
  const walks = safeNumber(blended.baseOnBalls);
  const hitByPitch = safeNumber(blended.hitByPitch);
  const sacFlies = safeNumber(blended.sacFlies);
  const totalBases = safeNumber(blended.totalBases);

  const avg = atBats > 0 ? hits / atBats : 0;
  const obpDenominator = atBats + walks + hitByPitch + sacFlies;
  const obp = obpDenominator > 0 ? (hits + walks + hitByPitch) / obpDenominator : 0;
  const slg = atBats > 0 ? totalBases / atBats : 0;

  return {
    ...blended,
    avg,
    obp,
    slg,
  };
}

function computePitcherRates(blended) {
  if (!blended) return null;
  const outsPitched = safeNumber(blended.outsPitched);
  const earnedRuns = safeNumber(blended.earnedRuns);
  const hitsAllowed = safeNumber(blended.hitsAllowed);
  const walks = safeNumber(blended.baseOnBalls);

  const era = outsPitched > 0 ? (earnedRuns * 27) / outsPitched : 0;
  const whip = outsPitched > 0 ? ((hitsAllowed + walks) * 3) / outsPitched : 0;

  return {
    ...blended,
    era,
    whip,
  };
}

function computeHitterFpts(hitting) {
  if (!hitting) return 0;
  return Math.round(
    safeNumber(hitting.runs) +
      safeNumber(hitting.rbi) +
      safeNumber(hitting.homeRuns) * 4 +
      safeNumber(hitting.stolenBases) * 2 +
      safeNumber(hitting.totalBases) * 0.5 +
      safeNumber(hitting.baseOnBalls) * 0.25
  );
}

function computePitcherFpts(pitching) {
  if (!pitching) return 0;
  return Math.round(
    safeNumber(pitching.outsPitched) +
      safeNumber(pitching.wins) * 6 +
      safeNumber(pitching.saves) * 5 +
      safeNumber(pitching.strikeOuts) -
      safeNumber(pitching.earnedRuns) * 3 -
      safeNumber(pitching.hitsAllowed) -
      safeNumber(pitching.baseOnBalls)
  );
}

function assignBaseValues(players, budget, replacementRank) {
  if (players.length === 0) return;

  players.sort((a, b) => b.fpts - a.fpts);
  const replacementIndex = Math.max(Math.min(replacementRank - 1, players.length - 1), 0);
  const replacementFpts = players[replacementIndex]?.fpts ?? 0;
  const pointsAboveReplacement = players.map((player) => Math.max(0, player.fpts - replacementFpts));
  const totalPar = pointsAboveReplacement.reduce((sum, value) => sum + value, 0);

  players.forEach((player, index) => {
    const par = pointsAboveReplacement[index];
    if (par <= 0 || totalPar <= 0) {
      player.baseValue = 1;
    } else {
      player.baseValue = Math.max(1, Math.round((par / totalPar) * budget));
    }
  });
}

function makePlayerRecord(raw, overallIndex, tierRanks) {
  const positions = [...raw.pos];
  const tier = raw.tier;
  tierRanks[tier] = (tierRanks[tier] || 0) + 1;

  if (raw.roleBucket === "pitcher") {
    return {
      id: overallIndex + 1,
      name: raw.name,
      team: raw.team,
      league: raw.league,
      pos: positions,
      tier,
      baseValue: raw.baseValue,
      hr: null,
      rbi: null,
      r: null,
      sb: null,
      avg: null,
      obp: null,
      slg: null,
      era: formatPitchRate(raw.pitching.era),
      so: Math.round(safeNumber(raw.pitching.strikeOuts)),
      whip: formatPitchRate(raw.pitching.whip),
      w: Math.round(safeNumber(raw.pitching.wins)),
      sv: Math.round(safeNumber(raw.pitching.saves)),
      photoUrl: raw.mlbId ? buildPhotoUrl(raw.mlbId) : null,
      injury: null,
      note: null,
      depth: tier,
      fpts: raw.fpts,
      mlbId: raw.mlbId,
      overall_rank: overallIndex + 1,
      tier_rank: tierRanks[tier],
      age: raw.age,
      aliases: raw.aliases,
      source: "mlb-stats-api",
      stats_window: "2023-2025 weighted",
    };
  }

  return {
    id: overallIndex + 1,
    name: raw.name,
    team: raw.team,
    league: raw.league,
    pos: positions,
    tier,
    baseValue: raw.baseValue,
    hr: Math.round(safeNumber(raw.hitting.homeRuns)),
    rbi: Math.round(safeNumber(raw.hitting.rbi)),
    r: Math.round(safeNumber(raw.hitting.runs)),
    sb: Math.round(safeNumber(raw.hitting.stolenBases)),
    avg: formatRate(raw.hitting.avg),
    obp: formatRate(raw.hitting.obp),
    slg: formatRate(raw.hitting.slg),
    era: null,
    so: null,
    whip: null,
    w: null,
    sv: null,
    photoUrl: raw.mlbId ? buildPhotoUrl(raw.mlbId) : null,
    injury: null,
    note: null,
    depth: tier,
    fpts: raw.fpts,
    mlbId: raw.mlbId,
    overall_rank: overallIndex + 1,
    tier_rank: tierRanks[tier],
    age: raw.age,
    aliases: raw.aliases,
    source: "mlb-stats-api",
    stats_window: "2023-2025 weighted",
  };
}

async function main() {
  console.log("Fetching current MLB teams...");
  const teamsMap = await fetchTeamsMap();

  const playerMap = new Map();

  for (const season of SEASONS) {
    console.log(`Fetching hitting stats for ${season}...`);
    const hitters = await fetchSeasonSplits("hitting", season);
    console.log(`Fetching pitching stats for ${season}...`);
    const pitchers = await fetchSeasonSplits("pitching", season);

    hitters.forEach((split) => {
      const playerId = split.player?.id;
      if (!playerId) return;
      const current = playerMap.get(playerId) || {
        mlbId: playerId,
        name: split.player.fullName,
        seasons: { hitting: {}, pitching: {} },
        latestTeamId: split.team?.id || null,
        latestLeague: normalizeLeague(split.league),
      };
      current.name = split.player.fullName || current.name;
      current.seasons.hitting[season] = split;
      current.latestTeamId = split.team?.id || current.latestTeamId;
      current.latestLeague = normalizeLeague(split.league) || current.latestLeague;
      playerMap.set(playerId, current);
    });

    pitchers.forEach((split) => {
      const playerId = split.player?.id;
      if (!playerId) return;
      const current = playerMap.get(playerId) || {
        mlbId: playerId,
        name: split.player.fullName,
        seasons: { hitting: {}, pitching: {} },
        latestTeamId: split.team?.id || null,
        latestLeague: normalizeLeague(split.league),
      };
      current.name = split.player.fullName || current.name;
      current.seasons.pitching[season] = split;
      current.latestTeamId = split.team?.id || current.latestTeamId;
      current.latestLeague = normalizeLeague(split.league) || current.latestLeague;
      playerMap.set(playerId, current);
    });
  }

  console.log(`Fetched raw records for ${playerMap.size} unique players.`);
  console.log("Fetching player metadata batches...");
  const peopleMap = await fetchPeopleMap([...playerMap.keys()]);

  const normalized = [];

  for (const raw of playerMap.values()) {
    const person = peopleMap.get(raw.mlbId);
    const hitting = computeHitterRates(weightedBlend(raw.seasons.hitting, hitterExtractor));
    const pitching = computePitcherRates(weightedBlend(raw.seasons.pitching, pitcherExtractor));

    const hasHitting = safeNumber(hitting?.plateAppearances) >= MIN_HITTER_PA;
    const hasPitching = safeNumber(pitching?.outsPitched) >= MIN_PITCHER_OUTS;
    if (!hasHitting && !hasPitching) continue;

    const teamInfo =
      teamsMap.get(person?.currentTeam?.id) ||
      teamsMap.get(raw.latestTeamId) || {
        abbreviation: "FA",
        league: raw.latestLeague || "ALL",
      };

    const primaryPosition = normalizePosition(person?.primaryPosition?.abbreviation);
    const pitcherRole = hasPitching ? inferPitcherRole(pitching) : null;

    let roleBucket = "hitter";
    let pos = [];

    if (hasPitching && !hasHitting) {
      roleBucket = "pitcher";
      pos = [pitcherRole];
    } else {
      const hitterPos = primaryPosition === "P" ? "DH" : primaryPosition;
      pos = [hitterPos];
      if (hasPitching && pitcherRole && !pos.includes(pitcherRole)) {
        pos.push(pitcherRole);
      }
    }

    const fpts = roleBucket === "pitcher" ? computePitcherFpts(pitching) : computeHitterFpts(hitting);

    normalized.push({
      mlbId: raw.mlbId,
      name: raw.name,
      team: teamInfo.abbreviation,
      league: teamInfo.league,
      pos,
      roleBucket,
      age: person?.currentAge ?? null,
      hitting,
      pitching,
      fpts,
    });
  }

  const hitters = normalized.filter((player) => player.roleBucket === "hitter");
  const pitchers = normalized.filter((player) => player.roleBucket === "pitcher");

  assignBaseValues(hitters, HITTER_BUDGET, HITTER_REPLACEMENT_RANK);
  assignBaseValues(pitchers, PITCHER_BUDGET, PITCHER_REPLACEMENT_RANK);

  const duplicateNameCounts = normalized.reduce((acc, player) => {
    acc[player.name] = (acc[player.name] || 0) + 1;
    return acc;
  }, {});

  normalized.forEach((player) => {
    if ((duplicateNameCounts[player.name] || 0) > 1) {
      player.aliases = [player.name];
      player.name = `${player.name} (${player.team})`;
    } else {
      player.aliases = [];
    }
  });

  const combined = [...normalized]
    .sort((a, b) => {
      if ((b.baseValue || 0) !== (a.baseValue || 0)) return (b.baseValue || 0) - (a.baseValue || 0);
      if ((b.fpts || 0) !== (a.fpts || 0)) return (b.fpts || 0) - (a.fpts || 0);
      return a.name.localeCompare(b.name);
    })
    .map((player, index) => {
      let tier = "Bench";
      if (index < ELITE_COUNT) tier = "Elite";
      else if (index < STARTER_CUTOFF) tier = "Starter";
      return { ...player, tier };
    });

  const tierRanks = { Elite: 0, Starter: 0, Bench: 0 };
  const playersJson = combined.map((player, index) => makePlayerRecord(player, index, tierRanks));

  fs.writeFileSync(OUT_FILE, JSON.stringify(playersJson, null, 2), "utf8");

  console.log(`Wrote ${playersJson.length} players to ${OUT_FILE}`);
  console.log(`  Hitters: ${playersJson.filter((player) => !["SP", "RP"].includes(player.pos[0])).length}`);
  console.log(`  Pitchers: ${playersJson.filter((player) => ["SP", "RP"].includes(player.pos[0])).length}`);
  console.log(`  Elite: ${playersJson.filter((player) => player.tier === "Elite").length}`);
  console.log(`  Starter: ${playersJson.filter((player) => player.tier === "Starter").length}`);
  console.log(`  Bench: ${playersJson.filter((player) => player.tier === "Bench").length}`);
}

main().catch((error) => {
  console.error("Failed to build real MLB player pool.");
  console.error(error);
  process.exit(1);
});
