import { useState } from "react";

function formatUpdateSource(update) {
  if (update?.source_type === "MANUAL_DEMO") {
    return "Valuation API Demo";
  }
  return update?.source || "Valuation API";
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
      ? "Feed offline"
      : pushStatus === "online"
        ? "Push connected"
        : pushStatus === "reconnecting"
          ? "Push reconnecting"
          : "Push connecting";
  const statusTone =
    !isOnline ? "offline" : pushStatus === "online" ? "online" : "reconnecting";
  const compactHeadline = latest
    ? latest.headline
    : "No Valuation API news";
  const updateCountLabel =
    updates.length === 1 ? "1 update" : `${updates.length} updates`;

  return (
    <section
      className={`player-update-center ${isOpen ? "is-open" : "is-collapsed"}`}
      aria-label="Valuation API player news"
    >
      <div className="puc-compact">
        <button
          type="button"
          className="puc-compact-main"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
        >
          <span className="puc-eyebrow">API News</span>
          <strong>{compactHeadline}</strong>
          <span>{latest ? `${formatUpdateSource(latest)} - ${updateCountLabel}` : updateCountLabel}</span>
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
              <div className="puc-eyebrow">Valuation API notification center</div>
              <h2>API-sourced player news</h2>
            </div>
            <div className={`puc-status ${statusTone}`}>
              {statusLabel}
            </div>
          </div>

          <div className="puc-body">
            <div className="puc-primary">
              <div className="puc-label">
                {latest ? `${formatUpdateSource(latest)} ${latest.type}` : "No updates loaded"}
              </div>
              <strong>
                {latest?.headline || "Draft Kit is listening for Valuation API player updates."}
              </strong>
              <p>
                {latest?.impact_summary ||
                  "News alerts are created by the Valuation API. Draft Kit only subscribes, alerts, and opens the affected player card."}
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
                Create demo/news pushes from the Valuation API site. This draft board
                never manufactures news locally.
              </div>
              <button
                type="button"
                onClick={onRefresh}
                disabled={!isOnline || loading}
              >
                Refresh Feed
              </button>
            </div>
          </div>

          {error ? <div className="puc-error">{error}</div> : null}

          {updates.length > 0 ? (
            <div className="puc-list">
              {updates.slice(0, 3).map((update) => (
                <div
                  key={update.id}
                  className={`puc-item risk-${String(update.risk_level || "LOW").toLowerCase()}`}
                >
                  <button
                    type="button"
                    className="puc-item-main"
                    onClick={() => onOpenPlayer?.(update)}
                  >
                    <span className="puc-item-risk">{update.risk_level}</span>
                    <span className="puc-item-copy">
                      <strong>
                        {update.player_name}
                        <em>{formatUpdateSource(update)}</em>
                      </strong>
                      <span>{update.headline}</span>
                    </span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="puc-empty">
              No API news is active. The board will alert when the Valuation API
              publishes notification-worthy player information.
            </div>
          )}
        </>
      )}

      {!isOpen && error ? <div className="puc-error compact">{error}</div> : null}
    </section>
  );
}
