import { useMemo, useState } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { posColor } from "../utils/helpers.js";

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export default function ProspectRosters({
  league,
  players,
  currentOwnerIdx,
  onSetCurrentOwnerIdx,
  onAddProspect,
  onRemoveProspect,
  onTransferProspect,
}) {
  const [search, setSearch] = useState("");
  const [transferTo, setTransferTo] = useState({});
  const activeTeam = league.teams[currentOwnerIdx] || league.teams[0] || null;
  const query = normalizeName(search);

  const available = useMemo(() => {
    if (query.length < 2) return [];
    return players
      .filter(
        (player) =>
          !player.drafted &&
          normalizeName(player.name).includes(query),
      )
      .slice(0, 12);
  }, [players, query]);

  const totalProspects = (league.teams || []).reduce(
    (total, team) => total + (team.minorLeague || []).length,
    0,
  );

  function addProspect(player) {
    if (!activeTeam) return;
    const saved = onAddProspect?.(player, activeTeam.id);
    if (saved) setSearch("");
  }

  function setTransferTarget(playerId, teamId) {
    setTransferTo((prev) => ({ ...prev, [playerId]: teamId }));
  }

  function transferProspect(fromTeam, prospect) {
    const fallbackTeamId =
      league.teams.find((candidate) => candidate.id !== fromTeam.id)?.id || "";
    const toTeamId = Number(transferTo[prospect.playerId] || fallbackTeamId);
    if (!toTeamId || toTeamId === fromTeam.id) return;
    onTransferProspect?.(fromTeam.id, toTeamId, prospect.playerId);
  }

  return (
    <div className="prospect-layout">
      <div className="prospect-main">
        <div className="taxi-header-row">
          <h2 className="taxi-mode-title">MINOR LEAGUE ROSTERS</h2>
          <span className="prospect-badge">
            Prospects are protected and removed from the auction pool
          </span>
          <span className="taxi-hint" style={{ marginLeft: "auto" }}>
            Use this before draft day or for commissioner corrections.
          </span>
        </div>

        <div className="prospect-summary-grid">
          <div className="prospect-summary-card">
            <span>Active Owner</span>
            <strong>{activeTeam?.name || "No team selected"}</strong>
          </div>
          <div className="prospect-summary-card">
            <span>Protected Prospects</span>
            <strong>{totalProspects}</strong>
          </div>
          <div className="prospect-summary-card">
            <span>Draft Pool Rule</span>
            <strong>Unavailable while rostered</strong>
          </div>
        </div>

        <div className="prospect-search-card">
          <div className="search-label-row">
            <span className="search-label">PROSPECT SEARCH</span>
            <span className="search-hint">
              {activeTeam?.name || "Select a team"}: assign a player to the minor league roster
            </span>
          </div>
          <div style={{ position: "relative" }}>
            <input
              className="search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search available players to protect as prospects"
            />
            {query.length >= 2 && (
              <div className="search-dropdown">
                {available.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    className="search-result prospect-search-result"
                    onClick={() => addProspect(player)}
                    title={`Add ${player.name} to ${activeTeam?.name}'s minor league roster`}
                  >
                    <PlayerAvatar name={player.name} size={26} photoUrl={player.photoUrl} />
                    <span className="sr-name">{player.name}</span>
                    <span className="sr-team">{player.team}</span>
                    {(player.pos || []).map((pos) => (
                      <span
                        key={pos}
                        className="pos-badge"
                        style={{ background: posColor(pos) }}
                      >
                        {pos}
                      </span>
                    ))}
                    <span className="sr-value prospect-value">MiLB</span>
                  </button>
                ))}
                {available.length === 0 && (
                  <div className="taxi-empty-search">
                    No available players match "{search}".
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="settings-section-label" style={{ marginBottom: 8 }}>
          TEAM PROSPECT LISTS
        </div>
        <div className="prospect-team-grid">
          {league.teams.map((team, teamIndex) => {
            const isActive = teamIndex === currentOwnerIdx;
            const prospects = team.minorLeague || [];

            return (
              <section
                key={team.id}
                className={`prospect-team-card ${isActive ? "active" : ""}`}
              >
                <button
                  type="button"
                  className="prospect-team-header"
                  onClick={() => onSetCurrentOwnerIdx?.(teamIndex)}
                  title={`Set ${team.name} as active prospect team`}
                >
                  <span>{team.name}</span>
                  <strong>
                    {prospects.length} prospect{prospects.length !== 1 ? "s" : ""}
                  </strong>
                </button>

                {prospects.length === 0 && (
                  <div className="prospect-empty">No minor league players assigned.</div>
                )}

                {prospects.map((prospect) => {
                  const transferValue =
                    transferTo[prospect.playerId] ||
                    league.teams.find((candidate) => candidate.id !== team.id)?.id ||
                    "";

                  return (
                    <div key={prospect.playerId} className="prospect-row">
                      <div className="prospect-player">
                        <strong>{prospect.name}</strong>
                        <span>
                          {(prospect.pos || []).join(", ") || "No position"} · protected
                        </span>
                      </div>
                      <div className="prospect-actions">
                        <select
                          value={transferValue}
                          onChange={(event) =>
                            setTransferTarget(prospect.playerId, event.target.value)
                          }
                          title={`Transfer ${prospect.name}`}
                        >
                          {league.teams
                            .filter((candidate) => candidate.id !== team.id)
                            .map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.name}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => transferProspect(team, prospect)}
                          title={`Move ${prospect.name} to another minor league roster`}
                        >
                          Transfer
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => onRemoveProspect?.(team.id, prospect.playerId)}
                          title={`Release ${prospect.name} back to the draft pool`}
                        >
                          Release
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>

      <div className="right-panel prospect-right-panel">
        <div className="panel-section-label">RUBRIC COVERAGE</div>
        <div className="prospect-rule-list">
          <div>
            <strong>Minor league entry</strong>
            <span>Owners can assign prospects directly to protected rosters.</span>
          </div>
          <div>
            <strong>Draft eligibility block</strong>
            <span>Rostered prospects are marked unavailable in the main auction pool.</span>
          </div>
          <div>
            <strong>Team movement</strong>
            <span>Commissioner can transfer prospects between fantasy teams.</span>
          </div>
        </div>

        <div className="panel-section-label" style={{ marginTop: 16 }}>
          ACTIVE TEAM PROSPECTS
        </div>
        {(activeTeam?.minorLeague || []).length === 0 && (
          <div className="taxi-side-empty">No prospects assigned to this team.</div>
        )}
        {(activeTeam?.minorLeague || []).map((prospect, index) => (
          <div key={prospect.playerId} className="taxi-roster-row">
            <span className="taxi-badge-sm">MiLB {index + 1}</span>
            <span className="roster-sum-name">{prospect.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
