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
}) {
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

  return (
    <section className="player-update-center" aria-label="Player updates">
      <div className="puc-header">
        <div>
          <div className="puc-eyebrow">Live player context</div>
          <h2>Push news and injury alerts</h2>
        </div>
        <div className={`puc-status ${statusTone}`}>
          {statusLabel}
        </div>
      </div>

      <div className="puc-body">
        <div className="puc-primary">
          <div className="puc-label">
            {latest ? latest.type : "No updates loaded"}
          </div>
          <strong>
            {latest?.headline || "Select a player, then publish an injury/news update."}
          </strong>
          <p>
            {latest?.impact_summary ||
              "Draft managers can stay on the board while pushed update context streams into the player pool and valuation cards."}
          </p>
          {latest && (
            <button
              type="button"
              className="puc-link-btn"
              onClick={() => onOpenPlayer?.(latest)}
            >
              Inspect Updated Player
            </button>
          )}
        </div>

        <div className="puc-actions">
          <div className="puc-target">
            <span>Publishing target</span>
            <strong>{targetPlayer?.name || "Select a player"}</strong>
          </div>
          <button
            type="button"
            className="puc-primary-btn"
            onClick={onPublishInjury}
            disabled={!canPublish}
          >
            {loading ? "Publishing..." : "Publish Injury Alert"}
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

      {updates.length > 0 && (
        <div className="puc-list">
          {updates.slice(0, 3).map((update) => (
            <button
              key={update.id}
              type="button"
              className={`puc-item risk-${String(update.risk_level || "LOW").toLowerCase()}`}
              onClick={() => onOpenPlayer?.(update)}
            >
              <span className="puc-item-risk">{update.risk_level}</span>
              <span className="puc-item-copy">
                <strong>{update.player_name}</strong>
                <span>{update.headline}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
