import { useState } from "react";
import { getPlayerAlertLabel, getPlayerAlertTone } from "../utils/playerAlerts.js";

function formatUpdateSource(update) {
  if (update?.source_type === "MANUAL_DEMO") {
    return "Demo alert";
  }
  return update?.source_type === "LIVE_FEED" ? "Live alert" : "Player alert";
}

export default function PlayerUpdateCenter({
  updates = [],
  loading = false,
  error = "",
  apiStatus = "checking",
  pushStatus = "offline",
  onRefresh,
  onOpenPlayer,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const latest = updates[0] || null;
  const isOnline = apiStatus === "online";
  const statusLabel =
    !isOnline
      ? "Alerts unavailable"
      : pushStatus === "online"
        ? "Alerts live"
        : pushStatus === "reconnecting"
          ? "Reconnecting"
          : "Connecting";
  const statusTone =
    !isOnline ? "offline" : pushStatus === "online" ? "online" : "reconnecting";
  const compactHeadline = latest
    ? latest.headline
    : "No player alerts";
  const latestTone = latest ? getPlayerAlertTone(latest) : "neutral";
  const latestStatusLabel = latest ? getPlayerAlertLabel(latest) : "";
  const updateCountLabel =
    updates.length === 1 ? "1 update" : `${updates.length} updates`;

  return (
    <section
      className={`player-update-center alert-${latestTone} ${isOpen ? "is-open" : "is-collapsed"}`}
      aria-label="Player alerts"
    >
      <div className="puc-compact">
        <button
          type="button"
          className="puc-compact-main"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
        >
          <span className="puc-eyebrow">Player Alerts</span>
          <strong>{compactHeadline}</strong>
          <span>
            {latest
              ? `${latestStatusLabel} - ${formatUpdateSource(latest)} - ${updateCountLabel}`
              : updateCountLabel}
          </span>
        </button>
        <div className={`puc-status ${statusTone}`}>{statusLabel}</div>
        {latest && (
          <button
            type="button"
            className="puc-compact-btn"
            onClick={() => onOpenPlayer?.(latest)}
          >
            Inspect
          </button>
        )}
        <button
          type="button"
          className="puc-compact-btn puc-primary-btn"
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? "Hide" : "View Feed"}
        </button>
      </div>

      {isOpen && (
        <>
          <div className="puc-header">
            <div>
              <div className="puc-eyebrow">Player alert center</div>
              <h2>Draft-day player updates</h2>
            </div>
            <div className={`puc-status ${statusTone}`}>
              {statusLabel}
            </div>
          </div>

          <div className="puc-body">
            <div className="puc-primary">
              <div className={`puc-label alert-${latestTone}`}>
                {latest ? `${latestStatusLabel} - ${formatUpdateSource(latest)}` : "No updates loaded"}
              </div>
              <strong>
                {latest?.headline || "No player alerts right now."}
              </strong>
              <p>
                {latest?.impact_summary ||
                  "Important player updates will appear here automatically during the draft."}
              </p>
              {latest && (
                <div className="puc-primary-actions">
                  <button
                    type="button"
                    className="puc-link-btn"
                    onClick={() => onOpenPlayer?.(latest)}
                  >
                    Inspect Updated Player
                  </button>
                </div>
              )}
            </div>

            <div className="puc-actions">
              <div className="puc-ingest-note">
                Alerts refresh automatically while the draft is open.
              </div>
              <button
                type="button"
                onClick={onRefresh}
                disabled={!isOnline || loading}
              >
                Refresh Alerts
              </button>
            </div>
          </div>

          {error ? <div className="puc-error">{error}</div> : null}

          {updates.length > 0 ? (
            <div className="puc-list">
              {updates.slice(0, 3).map((update) => {
                const tone = getPlayerAlertTone(update);
                const statusLabel = getPlayerAlertLabel(update);
                return (
                <div
                  key={update.id}
                  className={`puc-item alert-${tone} risk-${String(update.risk_level || "LOW").toLowerCase()}`}
                >
                  <button
                    type="button"
                    className="puc-item-main"
                    onClick={() => onOpenPlayer?.(update)}
                  >
                    <span className="puc-item-risk">{statusLabel}</span>
                    <span className="puc-item-copy">
                      <strong>
                        {update.player_name}
                        <em>{formatUpdateSource(update)}</em>
                      </strong>
                      <span>{update.headline}</span>
                    </span>
                  </button>
                </div>
              );
              })}
            </div>
          ) : (
            <div className="puc-empty">
              No player alerts are active. New updates will appear here during the draft.
            </div>
          )}
        </>
      )}

      {!isOpen && error ? <div className="puc-error compact">{error}</div> : null}
    </section>
  );
}
