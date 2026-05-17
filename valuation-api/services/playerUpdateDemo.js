const players = require("../data/players.json");

const DEMO_STATUS_TEMPLATES = {
  INJURY_HIGH: {
    type: "INJURY",
    severity: "HIGH",
    injury_status: "Questionable",
    headline: (name) => `${name} has a major injury concern`,
    body: (name) => `${name} was flagged by the Valuation API with a high-priority injury concern for draft review.`,
    impact_summary: "Consider a lower bid until injury clarity improves.",
  },
  INJURY_MEDIUM: {
    type: "INJURY",
    severity: "MEDIUM",
    injury_status: "Day-to-day",
    headline: (name) => `${name} is on injury watch`,
    body: (name) => `${name} has a moderate injury note that should be reviewed before bidding.`,
    impact_summary: "Draft normally only if the price leaves room for short-term availability risk.",
  },
  DAY_TO_DAY: {
    type: "INJURY",
    severity: "LOW",
    injury_status: "Day-to-day",
    headline: (name) => `${name} is day-to-day`,
    body: (name) => `${name} has a minor availability note in the Valuation API alert feed.`,
    impact_summary: "Small risk flag; review before using a full-value bid.",
  },
  ACTIVE: {
    type: "NEWS",
    severity: "LOW",
    headline: (name) => `${name} cleared for active draft consideration`,
    body: (name) => `${name} is no longer carrying a major availability concern in the Valuation API feed.`,
    impact_summary: "Availability looks stable enough for normal draft consideration.",
  },
  ROLE_GAIN: {
    type: "ROLE",
    severity: "LOW",
    transaction_status: "Role moving up",
    depth_chart_note: "Projected role improved",
    headline: (name) => `${name} gained role clarity`,
    body: (name) => `${name} has a stronger projected role in the Valuation API alert feed.`,
    impact_summary: "Role context is positive; review as a potential value target.",
  },
  ROLE_LOSS: {
    type: "ROLE",
    severity: "HIGH",
    transaction_status: "Role moving down",
    depth_chart_note: "Projected role weakened",
    headline: (name) => `${name} lost role security`,
    body: (name) => `${name} has weaker projected playing-time or role security in the Valuation API alert feed.`,
    impact_summary: "Reduce confidence until playing-time or bullpen role is clearer.",
  },
  ROLE_CHANGE: {
    type: "ROLE",
    severity: "MEDIUM",
    transaction_status: "Role under review",
    depth_chart_note: "Projected role changed",
    headline: (name) => `${name} has a role update`,
    body: (name) => `${name} has a changed role projection in the Valuation API alert feed.`,
    impact_summary: "Check role context before bidding at the previous valuation.",
  },
  LINEUP_CHANGE: {
    type: "LINEUP",
    severity: "MEDIUM",
    transaction_status: "Lineup role changed",
    headline: (name) => `${name} has a lineup role change`,
    body: (name) => `${name} has a lineup-context change in the Valuation API alert feed.`,
    impact_summary: "Review lineup slot and playing-time context before bidding.",
  },
  TRANSACTION: {
    type: "TRANSACTION",
    severity: "MEDIUM",
    transaction_status: "Roster move reported",
    headline: (name) => `${name} has a roster transaction`,
    body: (name) => `${name} has a transaction update in the Valuation API alert feed.`,
    impact_summary: "Confirm the new team or roster status before drafting.",
  },
  CONTRACT: {
    type: "CONTRACT",
    severity: "MEDIUM",
    contract_status: "Contract status changed",
    headline: (name) => `${name} has a contract status update`,
    body: (name) => `${name} has a contract-status update in the Valuation API alert feed.`,
    impact_summary: "Review contract context before treating the projection as stable.",
  },
  NEWS: {
    type: "NEWS",
    severity: "LOW",
    headline: (name) => `${name} has a player update`,
    body: (name) => `${name} has a general player update in the Valuation API alert feed.`,
    impact_summary: "Review the update before making the next bid.",
  },
};

function buildDemoUpdatePayload(input = {}) {
  const player = findDemoPlayer(input.player_id, input.player_name);
  const alertStatus = normalizeDemoStatus(input.alert_status || input.status);
  const template = DEMO_STATUS_TEMPLATES[alertStatus];
  const playerName = player.name;

  return {
    player_id: player.id,
    player_name: playerName,
    type: input.type || template.type,
    severity: input.severity || template.severity,
    alert_status: alertStatus,
    headline: cleanText(input.headline) || template.headline(playerName),
    body: cleanText(input.body) || template.body(playerName),
    injury_status: cleanText(input.injury_status) || template.injury_status || null,
    transaction_status: cleanText(input.transaction_status) || template.transaction_status || null,
    contract_status: cleanText(input.contract_status) || template.contract_status || null,
    depth_chart_note: cleanText(input.depth_chart_note) || template.depth_chart_note || null,
    impact_summary: cleanText(input.impact_summary) || template.impact_summary,
    source: "Dark Blue Valuation API demo",
    source_type: "MANUAL_DEMO",
    created_by: cleanText(input.created_by) || "Dark Blue API admin console",
  };
}

function findDemoPlayer(playerId, playerName) {
  const id = Number(playerId);
  if (Number.isFinite(id)) {
    const byId = players.find((player) => player.id === id);
    if (byId) return byId;
  }

  const normalizedName = normalizeName(playerName);
  if (normalizedName) {
    const byName = players.find((player) => normalizeName(player.name) === normalizedName);
    if (byName) return byName;
  }

  return players.find((player) => player.name === "Aaron Judge") || players[0];
}

function normalizeDemoStatus(value) {
  const raw = String(value || "").trim();
  if (!raw) return "INJURY_HIGH";
  const key = raw.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  if (DEMO_STATUS_TEMPLATES[key]) return key;

  const error = new Error(
    `Demo alert status must be one of: ${Object.keys(DEMO_STATUS_TEMPLATES).join(", ")}.`,
  );
  error.status = 400;
  error.code = "INVALID_DEMO_ALERT_STATUS";
  throw error;
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function cleanText(value) {
  return String(value || "").trim();
}

module.exports = {
  DEMO_STATUS_TEMPLATES,
  buildDemoUpdatePayload,
  normalizeDemoStatus,
};
