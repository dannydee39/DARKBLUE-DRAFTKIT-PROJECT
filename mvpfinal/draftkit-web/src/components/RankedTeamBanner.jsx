export default function RankedTeamBanner({
  rankings = [],
  currentOwnerId = null,
  onOpenRankings,
}) {
  const leaders = rankings.slice(0, 3);
  const currentOwner = rankings.find((team) => team.id === currentOwnerId);

  if (rankings.length === 0) return null;

  return (
    <section className="ranked-team-banner" aria-label="Ranked fantasy teams">
      <div className="rtb-copy">
        <span className="rtb-eyebrow">Team strength rankings</span>
        <strong>
          {leaders[0]?.name || "Teams"} leads with a {leaders[0]?.strengthScore || 0} score
        </strong>
        <span>
          Rankings update from roster value, remaining budget, max bid, roster fill, and injury risk.
        </span>
      </div>

      <div className="rtb-leaders">
        {leaders.map((team) => (
          <div
            key={team.id}
            className={`rtb-leader ${team.id === currentOwnerId ? "active" : ""}`}
          >
            <span>#{team.rank}</span>
            <strong>{team.name}</strong>
            <small>{team.strengthScore} pts</small>
          </div>
        ))}
        {currentOwner && !leaders.some((team) => team.id === currentOwner.id) ? (
          <div className="rtb-leader current">
            <span>#{currentOwner.rank}</span>
            <strong>{currentOwner.name}</strong>
            <small>{currentOwner.strengthScore} pts</small>
          </div>
        ) : null}
      </div>

      <button type="button" className="rtb-open-btn" onClick={onOpenRankings}>
        Open Rankings
      </button>
    </section>
  );
}
