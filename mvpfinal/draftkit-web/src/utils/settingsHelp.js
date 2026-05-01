export const POSITION_HELP = {
  C: {
    label: "Catcher",
    description: "Active catcher slot. Only catcher-eligible players fit here.",
    draftImpact: "Adds one active roster column and one required $1 endgame slot.",
  },
  "1B": {
    label: "First Base",
    description: "Active first-base slot. First-base eligible players fit here.",
    draftImpact: "Adds one active roster column and one required $1 endgame slot.",
  },
  "2B": {
    label: "Second Base",
    description: "Active second-base slot. Second-base eligible players fit here.",
    draftImpact: "Adds one active roster column and one required $1 endgame slot.",
  },
  "3B": {
    label: "Third Base",
    description: "Active third-base slot. Third-base eligible players fit here.",
    draftImpact: "Adds one active roster column and one required $1 endgame slot.",
  },
  SS: {
    label: "Shortstop",
    description: "Active shortstop slot. Shortstop-eligible players fit here.",
    draftImpact: "Adds one active roster column and one required $1 endgame slot.",
  },
  CI: {
    label: "Corner Infield",
    description: "Flexible active slot for first-base or third-base eligible players.",
    draftImpact: "Adds flexibility but still counts as one active roster column.",
  },
  MI: {
    label: "Middle Infield",
    description: "Flexible active slot for second-base or shortstop eligible players.",
    draftImpact: "Adds flexibility but still counts as one active roster column.",
  },
  OF: {
    label: "Outfield",
    description: "Active outfield slot. Outfield-eligible players fit here.",
    draftImpact: "Adds one active roster column and one required $1 endgame slot.",
  },
  SP: {
    label: "Starting Pitcher",
    description: "Dedicated starting pitcher slot.",
    draftImpact: "Use this only if the league separates starting and relief pitchers.",
  },
  RP: {
    label: "Relief Pitcher",
    description: "Dedicated relief pitcher slot.",
    draftImpact: "Use this only if the league separates saves/holds roles from starters.",
  },
  P: {
    label: "Pitcher",
    description: "Flexible pitcher slot for SP, RP, or general pitcher eligibility.",
    draftImpact: "Adds one active pitcher column and one required $1 endgame slot.",
  },
  UTIL: {
    label: "Utility",
    description: "Active non-pitcher flex slot for eligible hitters.",
    draftImpact: "Adds hitter flexibility while preserving active roster max-bid math.",
  },
  BN: {
    label: "Bench",
    description: "Bench slot for reserve players who still count against auction budget.",
    draftImpact: "Adds active draft capacity and reduces early max bids by $1 per added slot.",
  },
  TAXI: {
    label: "Taxi Squad",
    description: "Reserve/minor-style slot outside the main auction board.",
    draftImpact: "Does not create a main draft-board column or reduce auction max bid.",
  },
};

export const SCORING_HELP = {
  R: "Runs scored.",
  H: "Hits.",
  HR: "Home runs.",
  RBI: "Runs batted in.",
  SB: "Stolen bases.",
  AVG: "Batting average.",
  OBP: "On-base percentage.",
  BB: "Walks.",
  TB: "Total bases.",
  XBH: "Extra-base hits.",
  W: "Pitcher wins.",
  SV: "Saves.",
  ERA: "Earned run average.",
  WHIP: "Walks plus hits per inning pitched.",
  SO: "Strikeouts.",
  HLD: "Holds.",
  "K/9": "Strikeouts per nine innings.",
  "BB/9": "Walks per nine innings.",
  QS: "Quality starts.",
};

export function getPositionHelp(slot) {
  const key = String(slot || "").toUpperCase();
  return (
    POSITION_HELP[key] || {
      label: key || "Unknown",
      description: "Custom roster slot.",
      draftImpact: "Counts according to the slot count configured here.",
    }
  );
}

export function getScoringHelp(category) {
  return SCORING_HELP[category] || `${category} scoring category.`;
}

export function buildRosterImpact(roster = {}, owners = 12, budget = 260) {
  const activeSlots = Object.entries(roster)
    .filter(([slot]) => slot !== "TAXI")
    .reduce((total, [, count]) => total + Math.max(0, Number(count) || 0), 0);
  const taxiSlots = Math.max(0, Number(roster.TAXI) || 0);
  const ownerCount = Math.max(0, Number(owners) || 0);
  const budgetPerOwner = Math.max(0, Number(budget) || 0);
  const leagueActiveSlots = activeSlots * ownerCount;
  const leagueTaxiSlots = taxiSlots * ownerCount;
  const openingMaxBid =
    activeSlots > 0
      ? Math.max(budgetPerOwner - Math.max(activeSlots - 1, 0), 1)
      : budgetPerOwner;

  return {
    activeSlots,
    taxiSlots,
    ownerCount,
    budgetPerOwner,
    leagueActiveSlots,
    leagueTaxiSlots,
    openingMaxBid,
    requiredEndgameDollars: activeSlots,
  };
}

export function summarizeScoring(scoring = {}) {
  const active = Object.entries(scoring)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([category]) => category);
  const hitting = active.filter((category) =>
    ["R", "H", "HR", "RBI", "SB", "AVG", "OBP", "BB", "TB", "XBH"].includes(category),
  );
  const pitching = active.filter((category) =>
    ["W", "SV", "ERA", "WHIP", "SO", "HLD", "K/9", "BB/9", "QS"].includes(category),
  );

  return {
    active,
    hittingCount: hitting.length,
    pitchingCount: pitching.length,
    totalCount: active.length,
  };
}
