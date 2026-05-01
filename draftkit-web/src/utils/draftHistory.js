function asNumber(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatMoneyValue(value) {
  const numeric = asNumber(value, null);
  if (numeric == null) return "";
  return String(Math.round(numeric));
}

function normalizePositions(pos) {
  if (Array.isArray(pos)) return pos.filter(Boolean).join("/");
  if (typeof pos === "string") return pos;
  return "";
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

export function makeDraftHistoryEvent({
  type,
  player,
  team,
  rosterSlot = "",
  price = 0,
  timestamp = Date.now(),
  prePickValue = null,
  remainingBudgetAfter = null,
  note = "",
  source = "manual",
}) {
  const numericPrice = asNumber(price, 0);
  const numericValue = asNumber(prePickValue, 0);

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
        note: entry.note || "Minor league/prospect roster",
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
    "Player",
    "MLB Team",
    "Positions",
    "Fantasy Owner",
    "Roster Slot",
    "Winning Bid",
    "Pre-Pick Value",
    "Value Delta",
    "Remaining Budget After",
    "Note",
  ];

  const body = rows.map((row) => [
    row.eventNumber,
    row.typeLabel,
    row.timestampLabel,
    row.playerName,
    row.mlbTeam,
    row.positions,
    row.fantasyOwner,
    row.rosterSlot,
    row.priceLabel ? `$${row.priceLabel}` : "",
    row.prePickValueLabel ? `$${row.prePickValueLabel}` : "",
    row.valueDeltaLabel,
    row.remainingBudgetAfterLabel ? `$${row.remainingBudgetAfterLabel}` : "",
    row.note,
  ]);

  const title = [
    [`League`, league.name || "Draft"],
    [`Season`, league.season || ""],
    [`Exported At`, new Date().toLocaleString()],
    [],
  ];

  return [...title, headers, ...body].map(csvLine).join("\r\n");
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
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
