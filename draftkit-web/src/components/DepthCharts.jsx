import { useEffect, useMemo, useState } from "react";
import { posColor } from "../utils/helpers.js";
import { sortOwnerRankings } from "../utils/teamInsights.js";

const SORT_LABELS = {
  displayRank: "Rank",
  name: "Owner",
  strengthScore: "Score",
  rosterValue: "Roster Value",
  budgetRemaining: "Budget",
  maxBid: "Max Bid",
  rosterFillPercent: "Fill",
  highRiskCount: "Risk",
};

function formatMoney(value) {
  return `$${Math.round(Number(value) || 0)}`;
}

function formatAssignment(player) {
  if (player.assignment) {
    const price = player.assignment.price != null ? ` ${formatMoney(player.assignment.price)}` : "";
    const slot = player.assignment.slot ? ` ${player.assignment.slot}` : "";
    return `${player.assignment.status}${slot}${price}`;
  }
  return "Available";
}

function expectedVolumeLabel(player) {
  if (player.officialRoster && !player.officialRoster.active) {
    return "Low volume";
  }
  return player.volumeProjection?.role || "Volume unknown";
}

export default function DepthCharts({
  depthCharts,
  ownerRankings = [],
  league = {},
  selectedPlayer,
  setSelectedPlayer,
  liveDepthLoading = false,
  liveDepthError = "",
  onRefreshLiveDepth,
}) {
  const teamOptions = depthCharts?.teamOptions || [];
  const positionOptions = depthCharts?.positionOptions || [];
  const [selectedTeam, setSelectedTeam] = useState(teamOptions[0] || "ALL");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [searchQ, setSearchQ] = useState("");
  const [sortState, setSortState] = useState({
    key: "strengthScore",
    direction: "desc",
  });

  useEffect(() => {
    if (teamOptions.length === 0) return;
    if (selectedTeam !== "ALL" && !teamOptions.includes(selectedTeam)) {
      setSelectedTeam(teamOptions[0]);
    }
  }, [selectedTeam, teamOptions]);

  const visibleTeams = useMemo(() => {
    const query = searchQ.trim().toLowerCase();
    return (depthCharts?.teams || [])
      .filter((team) => selectedTeam === "ALL" || team.team === selectedTeam)
      .map((team) => ({
        ...team,
        positions: team.positions
          .filter(
            (position) =>
              positionFilter === "ALL" || position.position === positionFilter,
          )
          .map((position) => ({
            ...position,
            players: position.players.filter((player) => {
              if (!query) return true;
              return (
                player.name.toLowerCase().includes(query) ||
                String(player.team || "").toLowerCase().includes(query) ||
                String(player.assignment?.teamName || "")
                  .toLowerCase()
                  .includes(query)
              );
            }),
          }))
          .filter((position) => position.players.length > 0),
      }))
      .filter((team) => team.positions.length > 0);
  }, [depthCharts, positionFilter, searchQ, selectedTeam]);

  const sortedRankings = useMemo(
    () => sortOwnerRankings(ownerRankings, sortState.key, sortState.direction),
    [ownerRankings, sortState],
  );
  const activeScoring = Object.entries(league.scoring || {})
    .filter(([, enabled]) => enabled)
    .map(([category]) => category)
    .join(", ");

  function toggleSort(key) {
    setSortState((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  }

  return (
    <div className="insights-layout">
      <section className="insights-main">
        <div className="insights-header">
          <div>
            <span className="insights-eyebrow">Sprint 6 depth charts</span>
            <h2>MLB Depth Charts</h2>
            <p>
              Derived from the live draft pool, current auction state, keeper
              contracts, taxi picks, scoring format, and transaction context.
            </p>
          </div>
          <div className="insights-summary">
            <span>{activeScoring || "No scoring"} scoring</span>
            <span>{depthCharts?.summary?.teamCount || 0} MLB teams</span>
            <span>{depthCharts?.summary?.liveRosterPlayerCount || 0} MLB roster</span>
            <span>{depthCharts?.summary?.draftedCount || 0} drafted</span>
            <span>{depthCharts?.summary?.highRiskCount || 0} high risk</span>
          </div>
        </div>

        <div className={`depth-source-banner ${depthCharts?.summary?.warning ? "warning" : ""}`}>
          <div>
            <span>Depth source</span>
            <strong>
              {liveDepthLoading
                ? "Loading MLB roster feed"
                : depthCharts?.summary?.source || "local-derived"}
            </strong>
            <small>
              {depthCharts?.summary?.generatedAt
                ? `Updated ${new Date(depthCharts.summary.generatedAt).toLocaleString()}`
                : "Using local fantasy pool ranking"}
            </small>
          </div>
          <p>
            {liveDepthError ||
              depthCharts?.summary?.warning ||
              "MLB active roster status is supplied by the MLB Stats API. Depth rank now prioritizes projected volume/workload first, then fantasy value as a tie-breaker."}
          </p>
          <button type="button" onClick={onRefreshLiveDepth} disabled={liveDepthLoading}>
            {liveDepthLoading ? "Refreshing..." : "Refresh MLB Feed"}
          </button>
        </div>

        <div className="insights-toolbar">
          <label>
            <span>MLB team</span>
            <select
              value={selectedTeam}
              onChange={(event) => setSelectedTeam(event.target.value)}
            >
              <option value="ALL">All teams</option>
              {teamOptions.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Position</span>
            <select
              value={positionFilter}
              onChange={(event) => setPositionFilter(event.target.value)}
            >
              <option value="ALL">All positions</option>
              {positionOptions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </label>
          <label className="insights-search-label">
            <span>Search</span>
            <input
              value={searchQ}
              onChange={(event) => setSearchQ(event.target.value)}
              placeholder="Player or owner"
            />
          </label>
        </div>

        <div className="depth-team-list">
          {visibleTeams.length === 0 ? (
            <div className="insights-empty">No players match the current filters.</div>
          ) : (
            visibleTeams.map((team) => (
              <section key={team.team} className="depth-team">
                <div className="depth-team-header">
                  <div>
                    <span>MLB Team</span>
                    <strong>{team.team}</strong>
                  </div>
                  <div className="depth-team-metrics">
                    <span>{team.totalPlayers} players</span>
                    <span>{team.draftedCount} rostered</span>
                    <span>{team.highRiskCount} high risk</span>
                  </div>
                </div>

                {team.positions.map((position) => (
                  <div key={`${team.team}-${position.position}`} className="depth-position">
                    <div className="depth-position-header">
                      <span
                        className="depth-position-chip"
                        style={{ background: posColor(position.position) }}
                      >
                        {position.position}
                      </span>
                      <strong>{position.players.length} player depth</strong>
                      <span className="depth-position-method">
                        Ranked by volume score, then value
                      </span>
                    </div>
                    <div className="depth-player-grid">
                      {position.players.map((player) => (
                        <button
                          key={`${player.id}-${position.position}`}
                          type="button"
                          className={`depth-player-row risk-${player.riskLevel.toLowerCase()} ${
                            selectedPlayer?.id === player.id ? "active" : ""
                          }`}
                          onClick={() => setSelectedPlayer?.(player)}
                        >
                          <span className="depth-rank">#{player.depthRank}</span>
                          <span className="depth-player-main">
                            <strong>{player.name}</strong>
                            <small>
                              {player.pos?.join("/")} · age {player.age || "N/A"} · {player.volumeProjection?.confidence || "LOW"} confidence
                            </small>
                          </span>
                          <span className="depth-value">
                            Vol {player.volumeScore ?? 0}
                          </span>
                          <span className="depth-status">
                            {expectedVolumeLabel(player)}
                          </span>
                          <span className="depth-official fallback">
                            {(player.volumeProjection?.drivers || []).slice(0, 3).join(" · ") || "No drivers"}
                          </span>
                          <span className="depth-value">{formatMoney(player.value)}</span>
                          <span className={`depth-status ${player.assignment ? "drafted" : "available"}`}>
                            {formatAssignment(player)}
                          </span>
                          <span
                            className={`depth-official ${
                              player.officialRoster?.active ? "active" : "fallback"
                            }`}
                          >
                            {player.officialRoster
                              ? `${player.officialRoster.statusDescription || "MLB roster"}${
                                  player.officialRoster.positionCode
                                    ? ` ${player.officialRoster.positionCode}`
                                    : ""
                                }`
                              : "Local pool"}
                          </span>
                          <span className={`depth-risk risk-${player.riskLevel.toLowerCase()}`}>
                            {player.riskLevel}
                          </span>
                          <span className="depth-update">
                            {player.updateSummary || "No active update"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ))
          )}
        </div>
      </section>

      <aside className="insights-side">
        <div className="rankings-card">
          <div className="rankings-header">
            <div>
              <span className="insights-eyebrow">Fantasy team comparison</span>
              <h3>Owner Strength</h3>
            </div>
            <span className="rankings-count">{ownerRankings.length} teams</span>
          </div>

          <div className="rankings-table-wrap">
            <table className="rankings-table">
              <thead>
                <tr>
                  {[
                    ["displayRank", "#"],
                    ["name", "Owner"],
                    ["strengthScore", "Score"],
                    ["rosterValue", "Value"],
                    ["budgetRemaining", "Money"],
                    ["maxBid", "Max"],
                    ["rosterFillPercent", "Fill"],
                    ["highRiskCount", "Risk"],
                  ].map(([key, label]) => (
                    <th key={key}>
                      <button type="button" onClick={() => toggleSort(key)}>
                        {label}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRankings.map((team) => (
                  <tr key={team.id} className={team.displayRank === 1 ? "is-leader" : ""}>
                    <td>{team.displayRank}</td>
                    <td>
                      <strong>{team.name}</strong>
                      {team.displayRank === 1 ? (
                        <span className="rankings-current-pill">LEADER</span>
                      ) : null}
                    </td>
                    <td>{team.strengthScore}</td>
                    <td>{formatMoney(team.rosterValue)}</td>
                    <td>{formatMoney(team.budgetRemaining)}</td>
                    <td>{formatMoney(team.maxBid)}</td>
                    <td>{team.rosterFillPercent}%</td>
                    <td>{team.highRiskCount + team.mediumRiskCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="rankings-explainer">
            Current sort: {SORT_LABELS[sortState.key] || sortState.key},{" "}
            {sortState.direction === "desc" ? "high to low" : "low to high"}.
          </p>
        </div>
      </aside>
    </div>
  );
}
