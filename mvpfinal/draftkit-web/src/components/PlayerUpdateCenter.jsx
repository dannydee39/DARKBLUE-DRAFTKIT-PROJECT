import { useState } from "react";

const UPDATE_TYPES = [
  { value: "INJURY", label: "Injury" },
  { value: "NEWS", label: "News" },
  { value: "LINEUP", label: "Lineup" },
  { value: "ROLE", label: "Role" },
];

const UPDATE_SEVERITIES = [
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

function formatUpdateSource(update) {
  const source = String(update?.source || "").toLowerCase();
  if (source.includes("commissioner") || source.includes("league")) {
    return "League";
  }
  return "MLB";
}

export default function PlayerUpdateCenter({
  updates = [],
  loading = false,
  error = "",
  apiStatus = "checking",
  pushStatus = "offline",
  targetPlayer = null,
  onRefresh,
  onPublishInjury,
  onOpenPlayer,
  onDeleteUpdate,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [updateType, setUpdateType] = useState("INJURY");
  const [severity, setSeverity] = useState("HIGH");
  const latest = updates[0] || null;
  const isOnline = apiStatus === "online";
  const canPublish = isOnline && !loading && targetPlayer;
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
    : targetPlayer
      ? `Ready to add a league note for ${targetPlayer.name}`
      : "No active player alerts";
  const updateCountLabel =
    updates.length === 1 ? "1 update" : `${updates.length} updates`;

  function handlePublish() {
    onPublishInjury?.({ type: updateType, severity });
  }

  function canDeleteUpdate(update) {
    return Boolean(update?.draft_id && formatUpdateSource(update) === "League");
  }

  return (
    <section
      className={`player-update-center ${isOpen ? "is-open" : "is-collapsed"}`}
      aria-label="Player updates"
    >
      <div className="puc-compact">
        <button
          type="button"
          className="puc-compact-main"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
        >
          <span className="puc-eyebrow">Player updates</span>
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
          {isOpen ? "Hide" : "Manage"}
        </button>
      </div>

      {isOpen && (
        <>
          <div className="puc-header">
            <div>
              <div className="puc-eyebrow">League note center</div>
              <h2>Player news and risk notes</h2>
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
                {latest?.headline || "Select a player, then publish a league note if needed."}
              </strong>
              <p>
                {latest?.impact_summary ||
                  "Use this only for notification-worthy context. The board stays clean when there is nothing to review."}
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
                  {canDeleteUpdate(latest) && (
                    <button
                      type="button"
                      className="puc-link-btn danger"
                      onClick={() => onDeleteUpdate?.(latest)}
                    >
                      Remove Note
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="puc-actions">
              <label className="puc-field">
                <span>Type</span>
                <select
                  value={updateType}
                  onChange={(event) => setUpdateType(event.target.value)}
                  disabled={loading}
                >
                  {UPDATE_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="puc-field">
                <span>Risk</span>
                <select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value)}
                  disabled={loading}
                >
                  {UPDATE_SEVERITIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="puc-primary-btn"
                onClick={handlePublish}
                disabled={!canPublish}
                title={
                  !canPublish && !targetPlayer
                    ? "Select a player first to publish a league note"
                    : !canPublish && !isOnline
                      ? "Player updates need the Draft Kit API to be online"
                      : `Publish ${updateType.toLowerCase()} note for ${targetPlayer?.name || "selected player"}`
                }
              >
                {loading
                  ? "Publishing..."
                  : targetPlayer
                    ? `Publish for ${targetPlayer.name}`
                    : "Publish League Note"}
              </button>
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
                  {canDeleteUpdate(update) && (
                    <button
                      type="button"
                      className="puc-delete-btn"
                      onClick={() => onDeleteUpdate?.(update)}
                      title={`Remove league note for ${update.player_name}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="puc-empty">
              No active player notes. Select a player only when there is real
              draft context to publish.
            </div>
          )}
        </>
      )}

      {!isOpen && error ? <div className="puc-error compact">{error}</div> : null}
    </section>
  );
}
