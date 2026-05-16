import { useEffect, useMemo, useState } from "react";
import { posColor } from "../utils/helpers.js";
import { sortOwnerRankings } from "../utils/teamInsights.js";

const POSITION_GROUPS = [
  ["Hitters", ["C", "1B", "2B", "3B", "SS", "OF", "DH"]],
  ["Pitchers", ["SP", "RP", "P"]],
];

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

function roleSourceLabel(player) {
  if (player.officialRoster?.active) return "MLB roster";
  if (player.volumeProjection?.missing_direct_fields?.length === 0) return "Workload projection";
  return "Projection estimate";
}

function roleSourceDetail(player) {
  if (player.officialRoster?.active) {
    return player.officialRoster.statusDescription || "Listed on current MLB active roster";
  }
  if (player.volumeProjection?.missing_direct_fields?.length === 0) {
    return player.volumeProjection.basis || "Projected workload fields";
  }
  return "Estimated from production and fantasy-value signals";
}

function roleTone(player) {
  const score = Number(player.volumeScore || player.volumeProjection?.score || 0);
  if (score >= 76) return "strong";
  if (score >= 58) return "steady";
  if (score >= 38) return "thin";
  return "limited";
}

function getTeamByCode(depthCharts, selectedTeam) {
  return (depthCharts?.teams || []).find((team) => team.team === selectedTeam) || null;
}

function flattenTeamPlayers(team, positionFilter, searchQ) {
  const query = searchQ.trim().toLowerCase();
  if (!team) return [];
  return team.positions
    .filter((position) => positionFilter === "ALL" || position.position === positionFilter)
    .flatMap((position) =>
      position.players
        .filter((player) => {
          if (!query) return true;
          return (
            player.name.toLowerCase().includes(query) ||
            String(player.assignment?.teamName || "").toLowerCase().includes(query)
          );
        })
        .map((player) => ({ ...player, depthPosition: position.position })),
    );
}

function buildPositionSections(team, positionFilter, searchQ) {
  if (!team) return [];
  const query = searchQ.trim().toLowerCase();
  return team.positions
    .filter((position) => positionFilter === "ALL" || position.position === positionFilter)
    .map((position) => ({
      ...position,
      players: position.players.filter((player) => {
        if (!query) return true;
        return (
          player.name.toLowerCase().includes(query) ||
          String(player.assignment?.teamName || "").toLowerCase().includes(query)
        );
      }),
    }))
    .filter((position) => position.players.length > 0);
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
  const [selectedTeam, setSelectedTeam] = useState(teamOptions[0] || "");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [searchQ, setSearchQ] = useState("");
  const [sortState, setSortState] = useState({
    key: "strengthScore",
    direction: "desc",
  });

  useEffect(() => {
    if (teamOptions.length === 0) return;
    if (!selectedTeam || !teamOptions.includes(selectedTeam)) {
      setSelectedTeam(teamOptions[0]);
    }
  }, [selectedTeam, teamOptions]);

  const selectedTeamData = useMemo(
    () => getTeamByCode(depthCharts, selectedTeam),
    [depthCharts, selectedTeam],
  );
  const positionSections = useMemo(
    () => buildPositionSections(selectedTeamData, positionFilter, searchQ),
    [positionFilter, searchQ, selectedTeamData],
  );
  const visiblePlayers = useMemo(
    () => flattenTeamPlayers(selectedTeamData, positionFilter, searchQ),
    [positionFilter, searchQ, selectedTeamData],
  );
  const availableCount = visiblePlayers.filter((player) => !player.assignment).length;
  const draftedCount = visiblePlayers.length - availableCount;
  const highVolumeCount = visiblePlayers.filter((player) => roleTone(player) === "strong").length;
  const activeScoring = Object.entries(league.scoring || {})
    .filter(([, enabled]) => enabled)
    .map(([category]) => category)
    .join(", ");
  const sortedRankings = useMemo(
    () => sortOwnerRankings(ownerRankings, sortState.key, sortState.direction),
    [ownerRankings, sortState],
  );

  function toggleSort(key) {
    setSortState((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  }

  return (
    <div className="depth-redesign">
      <section className="depth-workspace">
        <header className="depth-hero">
          <div>
            <span className="depth-eyebrow">MLB team research</span>
            <h2>MLB Team Depth Charts</h2>
            <p>
              Pick a real MLB team, scan who has role volume by position, then click a player
              to open their Draft Kit card before bidding.
            </p>
          </div>
          <div className="depth-hero-stats">
            <span>{depthCharts?.summary?.teamCount || 0} teams</span>
            <span>{depthCharts?.summary?.liveRosterPlayerCount || 0} MLB roster matches</span>
            <span>{activeScoring || "Default"} scoring</span>
          </div>
        </header>

        <section className={`depth-source-card ${depthCharts?.summary?.warning || liveDepthError ? "warning" : ""}`}>
          <div>
            <span>Current source</span>
            <strong>
              {liveDepthLoading
                ? "Refreshing MLB roster feed"
                : depthCharts?.summary?.source || "Draft Kit projection model"}
            </strong>
            <small>
              {depthCharts?.summary?.generatedAt
                ? `Updated ${new Date(depthCharts.summary.generatedAt).toLocaleString()}`
                : "Local player pool context"}
            </small>
          </div>
          <p>
            {liveDepthError ||
              depthCharts?.summary?.warning ||
              "This view combines the MLB roster feed with Draft Kit role and volume estimates. It is a draft research chart, not an official club depth chart."}
          </p>
          <button type="button" onClick={onRefreshLiveDepth} disabled={liveDepthLoading}>
            {liveDepthLoading ? "Refreshing..." : "Refresh MLB Feed"}
          </button>
        </section>

        <section className="depth-controls-panel">
          <label>
            <span>MLB team</span>
            <select value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)}>
              {teamOptions.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Position</span>
            <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}>
              <option value="ALL">All positions</option>
              {positionOptions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </label>
          <label className="depth-search-control">
            <span>Search this team</span>
            <input
              value={searchQ}
              onChange={(event) => setSearchQ(event.target.value)}
              placeholder="Player or fantasy owner"
            />
          </label>
        </section>

        {selectedTeamData ? (
          <section className="depth-team-shell">
            <div className="depth-team-overview">
              <div>
                <span>Selected MLB Team</span>
                <strong>{selectedTeamData.team}</strong>
              </div>
              <div className="depth-team-counters">
                <span>{visiblePlayers.length} visible</span>
                <span>{availableCount} available</span>
                <span>{draftedCount} rostered</span>
                <span>{highVolumeCount} high-volume</span>
              </div>
            </div>

            <div className="depth-position-jump">
              {POSITION_GROUPS.map(([group, positions]) => (
                <div key={group}>
                  <span>{group}</span>
                  <div>
                    {positions
                      .filter((position) => positionOptions.includes(position))
                      .map((position) => (
                        <button
                          key={position}
                          type="button"
                          className={positionFilter === position ? "active" : ""}
                          onClick={() => setPositionFilter(position)}
                        >
                          {position}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
              {positionFilter !== "ALL" && (
                <button type="button" className="depth-clear-filter" onClick={() => setPositionFilter("ALL")}>
                  Show all
                </button>
              )}
            </div>

            {positionSections.length === 0 ? (
              <div className="depth-empty">No players match this team/position/search view.</div>
            ) : (
              <div className="depth-sections">
                {positionSections.map((position) => (
                  <section key={`${selectedTeamData.team}-${position.position}`} className="depth-position-card">
                    <div className="depth-position-title">
                      <span
                        className="depth-position-chip"
                        style={{ background: posColor(position.position) }}
                      >
                        {position.position}
                      </span>
                      <div>
                        <strong>{position.position} depth</strong>
                        <small>Sorted by role volume, then fantasy value</small>
                      </div>
                    </div>

                    <div className="depth-card-list">
                      {position.players.map((player) => (
                        <button
                          key={`${player.id}-${position.position}`}
                          type="button"
                          className={`depth-card-row ${roleTone(player)} ${
                            selectedPlayer?.id === player.id ? "active" : ""
                          }`}
                          onClick={() => setSelectedPlayer?.(player)}
                        >
                          <span className="depth-card-rank">#{player.depthRank}</span>
                          <span className="depth-card-player">
                            <strong>{player.name}</strong>
                            <small>{player.pos?.join("/")} · age {player.age || "N/A"}</small>
                          </span>
                          <span className={`depth-role-pill ${roleTone(player)}`}>
                            {player.volumeProjection?.role || "Role estimate"}
                          </span>
                          <span className="depth-card-source">
                            <strong>{roleSourceLabel(player)}</strong>
                            <small>{roleSourceDetail(player)}</small>
                          </span>
                          <span className="depth-card-value">
                            <strong>{formatMoney(player.value)}</strong>
                            <small>value</small>
                          </span>
                          <span className={`depth-card-draft ${player.assignment ? "drafted" : "available"}`}>
                            {formatAssignment(player)}
                          </span>
                          <span className={`depth-risk risk-${player.riskLevel.toLowerCase()}`}>
                            {player.riskLevel}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="depth-empty">No MLB team depth data is available yet.</div>
        )}
      </section>

      <aside className="depth-context-rail">
        <section className="depth-help-card">
          <span className="depth-eyebrow">How to use this</span>
          <h3>Draft flow</h3>
          <ol>
            <li>Choose the MLB team for a player you are considering.</li>
            <li>Check whether his position group has strong or thin role volume.</li>
            <li>Use rostered/available status to find alternatives or backups.</li>
            <li>Click a player to open the full card and valuation drivers.</li>
          </ol>
        </section>

        <section className="rankings-card">
          <div className="rankings-header">
            <div>
              <span className="depth-eyebrow">Draft context</span>
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
        </section>
      </aside>
    </div>
  );
}
