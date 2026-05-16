function asNumber(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatMoneyValue(value) {
  const numeric = asNumber(value, null);
  if (numeric == null) return "";
  return String(Math.round(numeric));
}

function formatIsoTimestamp(timestamp) {
  if (!timestamp) return "";
  const numeric = asNumber(timestamp, null);
  const date = numeric != null ? new Date(numeric) : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? String(timestamp) : date.toISOString();
}

function normalizePositions(pos) {
  if (Array.isArray(pos)) return pos.filter(Boolean).join("/");
  if (typeof pos === "string") return pos;
  return "";
}

function roundMoney(value, fallback = null) {
  const numeric = asNumber(value, fallback);
  return numeric == null ? fallback : Math.round(numeric);
}

// Values can appear before the valuation API responds. Every visible dollar
// amount gets a source label so "Base Value" is not mistaken for a live API bid.
export function getValuationSource(player, valuation, loading = false) {
  if (valuation && valuation !== "loading" && !valuation.error) {
    return "live_api";
  }
  if (valuation === "loading" || loading) {
    return "refreshing";
  }
  if (valuation?.error) {
    return "api_error";
  }
  if (player?.baseValue != null) {
    return "base_value";
  }
  return "unknown";
}

export function formatValuationSource(source) {
  switch (source) {
    case "live_api":
      return "Live API";
    case "refreshing":
      return "Refreshing";
    case "api_error":
      return "API Error";
    case "base_value":
      return "Base Value";
    default:
      return "Unknown";
  }
}

export function getAdjustmentPercent(multiplier) {
  const numeric = asNumber(multiplier, null);
  if (numeric == null) return null;
  // API multipliers are centered on 1.00, so 1.08 means +8% and 0.94 means -6%.
  return Math.round((numeric - 1) * 100);
}

export function formatAdjustmentPercent(multiplier) {
  const pct = getAdjustmentPercent(multiplier);
  if (pct == null) return "";
  if (pct === 0) return "0%";
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

export function summarizeValuationSnapshot(snapshot = null) {
  if (!snapshot) return [];
  // Keep the factor order aligned with the valuation rubric: baseline stats
  // first, then scoring/scarcity/context adjustments that explain the final bid.
  return [
    ["Baseline", snapshot.statBaselineValue != null ? `$${snapshot.statBaselineValue}` : ""],
    ["Scoring", formatAdjustmentPercent(snapshot.factors?.scoring)],
    ["Scarcity", formatAdjustmentPercent(snapshot.factors?.scarcity)],
    ["Predictive", formatAdjustmentPercent(snapshot.factors?.predictive)],
    ["Age", formatAdjustmentPercent(snapshot.factors?.age)],
    ["Depth", formatAdjustmentPercent(snapshot.factors?.depthChart)],
    ["Inflation", formatAdjustmentPercent(snapshot.factors?.marketInflation)],
    ["Risk", formatAdjustmentPercent(snapshot.factors?.injuryRisk)],
  ].filter(([, value]) => value !== "");
}

function resolvePlayer(entry = {}, players = []) {
  if (entry.playerId != null) {
    const byId = players.find((player) => player.id === entry.playerId);
    if (byId) return byId;
  }

  const name = String(entry.playerName || entry.name || "").toLowerCase();
  if (!name) return null;
  return players.find((player) => String(player.name).toLowerCase() === name) || null;
}

function eventSortValue(event = {}) {
  const timestamp = asNumber(event.timestamp, null);
  if (timestamp != null) return timestamp;
  const parsed = Date.parse(event.timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getPlayerPrePickValue(player, valuation) {
  const liveValue = asNumber(valuation?.max_bid_recommendation, null);
  if (liveValue != null) return liveValue;
  return asNumber(player?.baseValue, 0);
}

/**
 * Build the one object the UI stores and displays for valuation context.
 *
 * Vocabulary:
 * - TDV / trueDollarValue: the API's calculated auction value before the app's
 *   max-bid guardrails.
 * - maxBidRecommendation: the number the drafter should be willing to bid.
 * - statBaselineValue: the value derived from the selected stat window before
 *   league scoring, scarcity, age, injury, depth, and market multipliers.
 * - factors: API multiplier fields copied into readable names for the UI.
 *
 * If the API value is unavailable, the snapshot intentionally falls back to the
 * player's baseValue and marks the source as "base_value".
 */
export function makeValuationSnapshot(player, valuation, options = {}) {
  const source = getValuationSource(player, valuation, options.loading);
  const hasLiveValuation = source === "live_api";
  const breakdown = hasLiveValuation ? valuation.valuation_breakdown || {} : {};
  const trueDollarValue = hasLiveValuation
    ? roundMoney(valuation.true_dollar_value ?? breakdown.true_dollar_value, null)
    : roundMoney(player?.baseValue, 0);
  const maxBidRecommendation = hasLiveValuation
    ? roundMoney(valuation.max_bid_recommendation ?? breakdown.max_bid_recommendation, null)
    : roundMoney(player?.baseValue, 0);

  return {
    source,
    sourceLabel: formatValuationSource(source),
    capturedAt: new Date().toISOString(),
    trueDollarValue,
    maxBidRecommendation,
    statBaselineValue: roundMoney(valuation?.stat_baseline_value ?? breakdown.stat_baseline_value, null),
    baseValue: roundMoney(player?.baseValue, null),
    marketContext: valuation?.market_context || null,
    scarcityTier: valuation?.scarcity_tier || null,
    positionScarcity: valuation?.position_scarcity || null,
    riskLevel: valuation?.risk_level || player?.risk_level || "LOW",
    injuryStatus: valuation?.injury_status || player?.injury_status || player?.injury || null,
    statProfile: valuation?.stat_profile || null,
    predictiveAdjustment: valuation?.predictive_adjustment || null,
    ageAdjustment: valuation?.age_adjustment || null,
    depthChartAdjustment: valuation?.depth_chart_adjustment || null,
    riskAdjustment: valuation?.risk_adjustment || null,
    valuationBreakdown: valuation?.valuation_breakdown || null,
    reasoning: valuation?.reasoning || null,
    factors: {
      scoring: asNumber(breakdown.scoring_multiplier, null),
      scarcity: asNumber(breakdown.scarcity_multiplier, null),
      predictive: asNumber(breakdown.predictive_multiplier, null),
      age: asNumber(breakdown.age_multiplier, null),
      depthChart: asNumber(breakdown.depth_chart_multiplier, null),
      marketInflation: asNumber(breakdown.market_inflation_multiplier, null),
      injuryRisk: asNumber(breakdown.injury_risk_multiplier, null),
    },
  };
}

export function makeDraftHistoryEvent({
  type,
  player,
  team,
  rosterSlot = "",
  price = 0,
  timestamp = Date.now(),
  prePickValue = null,
  valuationSnapshot = null,
  remainingBudgetAfter = null,
  note = "",
  source = "manual",
}) {
  const numericPrice = asNumber(price, 0);
  const snapshot = valuationSnapshot || null;
  const numericValue = asNumber(
    prePickValue ?? snapshot?.maxBidRecommendation,
    0,
  );

  return {
    id: `hist-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    timestamp,
    source,
    playerId: player?.id ?? null,
    playerName: player?.name || "",
    mlbTeam: player?.team || "",
    positions: normalizePositions(player?.pos),
    fantasyOwnerId: team?.id ?? null,
    fantasyOwner: team?.name || "",
    rosterSlot,
    price: numericPrice,
    prePickValue: numericValue,
    valuationSnapshot: snapshot,
    valueDelta: numericPrice - numericValue,
    remainingBudgetAfter: asNumber(remainingBudgetAfter, null),
    note,
  };
}

export function appendDraftHistoryEvent(league = {}, event) {
  const nextEventNumber = (league.draftHistory || []).length + 1;
  return [
    ...(league.draftHistory || []),
    {
      ...event,
      eventNumber: nextEventNumber,
    },
  ];
}

export function buildDraftHistoryRows(league = {}, players = [], rosterPositions = []) {
  const explicitEvents = Array.isArray(league.draftHistory)
    ? league.draftHistory
    : [];

  if (explicitEvents.length > 0) {
    return explicitEvents
      .slice()
      .sort((a, b) => {
        const byTime = eventSortValue(a) - eventSortValue(b);
        if (byTime !== 0) return byTime;
        return (a.eventNumber || 0) - (b.eventNumber || 0);
      })
      .map((event, index) => normalizeHistoryRow(event, index + 1));
  }

  const derived = [];
  (league.teams || []).forEach((team) => {
    (team.roster || []).forEach((entry) => {
      const player = resolvePlayer(entry, players);
      const price = asNumber(entry.price, 0);
      const value = getPlayerPrePickValue(player, null);
      derived.push({
        type: entry?.isKeeper ? "keeper" : "auction",
        timestamp: entry.draftedAt || 0,
        playerId: entry.playerId ?? player?.id ?? null,
        playerName: entry.name || player?.name || "",
        mlbTeam: player?.team || entry.team || "",
        positions: normalizePositions(entry.pos || player?.pos),
        fantasyOwnerId: team.id,
        fantasyOwner: team.name,
        rosterSlot:
          entry.draftedPos ||
          rosterPositions[entry.slotIndex] ||
          String(entry.slotIndex ?? ""),
        price,
        prePickValue: value,
        valueDelta: price - value,
        remainingBudgetAfter: team.budget_remaining,
        note: entry?.isKeeper ? "Keeper contract" : "",
      });
    });

    (team.taxiSquad || []).forEach((entry, taxiIndex) => {
      const player = resolvePlayer(entry, players);
      const price = asNumber(entry.price, 1);
      const value = getPlayerPrePickValue(player, null);
      derived.push({
        type: "taxi",
        timestamp: entry.draftedAt || 0,
        playerId: entry.playerId ?? player?.id ?? null,
        playerName: entry.name || player?.name || "",
        mlbTeam: player?.team || entry.team || "",
        positions: normalizePositions(entry.pos || player?.pos),
        fantasyOwnerId: team.id,
        fantasyOwner: team.name,
        rosterSlot: `TAXI ${taxiIndex + 1}`,
        price,
        prePickValue: value,
        valueDelta: price - value,
        remainingBudgetAfter: team.budget_remaining,
        note: "Taxi squad",
      });
    });

    (team.minorLeague || []).forEach((entry, prospectIndex) => {
      const player = resolvePlayer(entry, players);
      const value = getPlayerPrePickValue(player, null);
      derived.push({
        type: "minor_league",
        timestamp: entry.draftedAt || 0,
        playerId: entry.playerId ?? player?.id ?? null,
        playerName: entry.name || player?.name || "",
        mlbTeam: player?.team || entry.team || "",
        positions: normalizePositions(entry.pos || player?.pos),
        fantasyOwnerId: team.id,
        fantasyOwner: team.name,
        rosterSlot: `MiLB ${prospectIndex + 1}`,
        price: 0,
        prePickValue: value,
        valueDelta: -value,
        remainingBudgetAfter: team.budget_remaining,
        note: entry.note || "Minor league roster",
      });
    });
  });

  return derived
    .sort((a, b) => eventSortValue(a) - eventSortValue(b))
    .map((event, index) => normalizeHistoryRow(event, index + 1));
}

export function normalizeHistoryRow(event = {}, fallbackNumber = 1) {
  return {
    eventNumber: event.eventNumber || fallbackNumber,
    type: event.type || "auction",
    typeLabel: formatEventType(event.type),
    timestamp: event.timestamp || "",
    timestampLabel: formatEventTime(event.timestamp),
    playerId: event.playerId ?? null,
    playerName: event.playerName || "",
    mlbTeam: event.mlbTeam || "",
    positions: event.positions || "",
    fantasyOwnerId: event.fantasyOwnerId ?? null,
    fantasyOwner: event.fantasyOwner || "",
    rosterSlot: event.rosterSlot || "",
    price: asNumber(event.price, 0),
    priceLabel: formatMoneyValue(event.price),
    prePickValue: asNumber(event.prePickValue, 0),
    prePickValueLabel: formatMoneyValue(event.prePickValue),
    valuationSnapshot: event.valuationSnapshot || null,
    valuationSource:
      event.valuationSnapshot?.source || (event.prePickValue ? "legacy_value" : "unknown"),
    valuationSourceLabel:
      event.valuationSnapshot?.sourceLabel ||
      (event.prePickValue ? "Legacy Value" : "Unknown"),
    trueDollarValue: asNumber(event.valuationSnapshot?.trueDollarValue, null),
    trueDollarValueLabel: formatMoneyValue(event.valuationSnapshot?.trueDollarValue),
    scarcityTier: event.valuationSnapshot?.scarcityTier || "",
    riskLevel: event.valuationSnapshot?.riskLevel || "",
    marketLabel: event.valuationSnapshot?.marketContext?.label || "",
    valueDelta: asNumber(event.valueDelta, 0),
    valueDeltaLabel: formatSignedMoney(event.valueDelta),
    remainingBudgetAfter: asNumber(event.remainingBudgetAfter, null),
    remainingBudgetAfterLabel:
      event.remainingBudgetAfter == null
        ? ""
        : formatMoneyValue(event.remainingBudgetAfter),
    note: event.note || "",
    source: event.source || "manual",
  };
}

export function formatEventType(type) {
  switch (type) {
    case "keeper":
      return "Keeper";
    case "keeper_update":
      return "Keeper Update";
    case "keeper_remove":
      return "Keeper Removed";
    case "taxi":
      return "Taxi Squad";
    case "taxi_remove":
      return "Taxi Removed";
    case "minor_league":
      return "Minor League";
    case "minor_league_transfer":
      return "Minor League Transfer";
    case "minor_league_remove":
      return "Minor League Removed";
    case "roster_move":
      return "Roster Move";
    case "roster_transfer":
      return "Roster Transfer";
    case "auction_remove":
      return "Auction Removed";
    case "auction":
    default:
      return "Auction Pick";
  }
}

export function formatEventTime(timestamp) {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(timestamp);
  }
}

export function formatSignedMoney(value) {
  const numeric = asNumber(value, null);
  if (numeric == null) return "";
  if (numeric === 0) return "$0";
  return `${numeric > 0 ? "+" : "-"}$${Math.abs(Math.round(numeric))}`;
}

export function createDraftHistoryCsv(rows = [], league = {}) {
  const headers = [
    "Event #",
    "Type",
    "Timestamp",
    "Timestamp ISO",
    "Player",
    "MLB Team",
    "Positions",
    "Fantasy Owner",
    "Roster Slot",
    "Winning Bid",
    "Pre-Pick Value",
    "Valuation Source",
    "True Dollar Value",
    "Scarcity",
    "Risk",
    "Market",
    "Value Delta",
    "Remaining Budget After",
    "Note",
  ];

  const body = rows.map((row) => [
    row.eventNumber,
    row.typeLabel,
    row.timestampLabel,
    formatIsoTimestamp(row.timestamp),
    row.playerName,
    row.mlbTeam,
    row.positions,
    row.fantasyOwner,
    row.rosterSlot,
    row.priceLabel ? `$${row.priceLabel}` : "",
    row.prePickValueLabel ? `$${row.prePickValueLabel}` : "",
    row.valuationSourceLabel || "",
    row.trueDollarValueLabel ? `$${row.trueDollarValueLabel}` : "",
    row.scarcityTier || "",
    row.riskLevel || "",
    row.marketLabel || "",
    row.valueDeltaLabel,
    row.remainingBudgetAfterLabel ? `$${row.remainingBudgetAfterLabel}` : "",
    row.note,
  ]);

  const title = [
    ["League", league.name || "Draft"],
    ["Season", league.season || ""],
    [
      "Scoring Format",
      Object.entries(league.scoring || {})
        .filter(([, enabled]) => enabled)
        .map(([category]) => category)
        .join(", "),
    ],
    [
      "Roster Slots",
      Object.entries(league.roster || {})
        .map(([slot, count]) => `${slot}:${Number(count) || 0}`)
        .join(", "),
    ],
    ["Exported At", new Date().toLocaleString()],
    [],
  ];

  return [...title, headers, ...body].map(csvLine).join("\r\n");
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob([`\ufeff${csvText}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvLine(values) {
  return values
    .map((value) => {
      const text = value == null ? "" : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    })
    .join(",");
}
