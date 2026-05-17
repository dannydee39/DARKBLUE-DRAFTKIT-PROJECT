const ALERT_TONES = new Set(["danger", "warning", "positive", "info", "neutral"]);

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

export function getPlayerAlertTone(update = {}) {
  const apiTone = String(update?.tone || "").trim().toLowerCase();
  if (ALERT_TONES.has(apiTone)) return apiTone;

  const status = normalizeKey(update?.alert_status || update?.status);
  if (["INJURY_HIGH", "ROLE_LOSS", "DEMOTION", "SUSPENSION"].includes(status)) {
    return "danger";
  }
  if (
    [
      "INJURY_MEDIUM",
      "DAY_TO_DAY",
      "LINEUP_CHANGE",
      "TRANSACTION",
      "CONTRACT",
      "ROLE_CHANGE",
    ].includes(status)
  ) {
    return "warning";
  }
  if (["ACTIVE", "CLEARED", "ROLE_GAIN", "PROMOTION"].includes(status)) {
    return "positive";
  }

  const severity = normalizeKey(update?.risk_level || update?.severity);
  if (severity === "HIGH") return "danger";
  if (severity === "MEDIUM") return "warning";
  if (severity === "LOW") return "info";
  return "neutral";
}

export function getPlayerAlertLabel(update = {}) {
  if (update?.status_label) return update.status_label;

  const status = normalizeKey(update?.alert_status || update?.status);
  const labels = {
    INJURY_HIGH: "Major injury concern",
    INJURY_MEDIUM: "Injury watch",
    DAY_TO_DAY: "Day-to-day",
    ACTIVE: "Cleared",
    ROLE_GAIN: "Role increase",
    ROLE_LOSS: "Role decrease",
    ROLE_CHANGE: "Role change",
    LINEUP_CHANGE: "Lineup change",
    TRANSACTION: "Transaction",
    CONTRACT: "Contract status",
    NEWS: "Player news",
  };
  if (labels[status]) return labels[status];

  const type = normalizeKey(update?.type);
  if (type === "INJURY") return "Injury update";
  if (type === "ROLE") return "Role update";
  if (type === "LINEUP") return "Lineup update";
  if (type === "TRANSACTION") return "Transaction";
  if (type === "CONTRACT") return "Contract status";
  return "Player alert";
}
