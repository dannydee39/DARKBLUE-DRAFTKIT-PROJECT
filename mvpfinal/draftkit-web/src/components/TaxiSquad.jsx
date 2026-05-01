// ─────────────────────────────────────────────────────────────────────────────
// components/TaxiSquad.jsx
//
// $1 reserve draft screen used after the main auction phase. The component
// renders active-team context, slot guards, search, and removal controls while
// App owns the actual state mutation.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { posColor } from "../utils/helpers.js";

export default function TaxiSquad({
  league,
  players,
  onTaxiPick,
  onRemoveTaxiPick,
  currentOwnerIdx,
  onSetCurrentOwnerIdx,
  rosterPositions,
}) {
  const [taxiSearch, setTaxiSearch] = useState("");
  const taxiSlots = Math.max(0, Number(league.roster?.TAXI) || 0);
  const activeTeam = league.teams[currentOwnerIdx] || league.teams[0] || null;
  const activeTaxiCount = activeTeam?.taxiSquad?.length || 0;
  const activeTeamFull = taxiSlots > 0 && activeTaxiCount >= taxiSlots;
  const searchQuery = taxiSearch.trim().toLowerCase();

  const available = useMemo(() => {
    if (!searchQuery) return [];
    return players
      .filter(
        (player) =>
          !player.drafted &&
          player.name.toLowerCase().includes(searchQuery),
      )
      .slice(0, 10);
  }, [players, searchQuery]);

  function addPick(player) {
    if (!activeTeam || activeTeamFull || taxiSlots <= 0) return;
    const saved = onTaxiPick?.(player, activeTeam.id);
    if (saved) setTaxiSearch("");
  }

  function removePick(team, pick) {
    onRemoveTaxiPick?.(team.id, pick.playerId);
  }

  return (
    <div className="taxi-layout">
      <div className="taxi-main">
        <div className="taxi-header-row">
          <h2 className="taxi-mode-title">TAXI SQUAD MODE</h2>
          <span className="taxi-badge">
            $1 fixed per pick - main auction budget stays unchanged
          </span>
          <span className="taxi-hint" style={{ marginLeft: "auto" }}>
            Active team controls reserve picks.
          </span>
        </div>

        <div className={`taxi-active-card ${activeTeamFull ? "full" : ""}`}>
          <div>
            <span className="taxi-active-label">ACTIVE TAXI TEAM</span>
            <strong>{activeTeam?.name || "No team selected"}</strong>
          </div>
          <div className="taxi-active-meter">
            <span>
              {activeTaxiCount}/{taxiSlots} slots
            </span>
            <div className="taxi-meter-track">
              <div
                className="taxi-meter-fill"
                style={{
                  width:
                    taxiSlots > 0
                      ? `${Math.min((activeTaxiCount / taxiSlots) * 100, 100)}%`
                      : "0%",
                }}
              />
            </div>
          </div>
          <span className="taxi-active-status">
            {taxiSlots <= 0
              ? "No taxi slots configured"
              : activeTeamFull
                ? "Taxi squad full"
                : `${taxiSlots - activeTaxiCount} picks open`}
          </span>
        </div>

        <div className="settings-section-label" style={{ marginBottom: 8 }}>
          ALL TAXI SQUADS
        </div>
        <div className="teams-table-wrap">
          <table className="teams-table">
            <thead>
              <tr>
                <th className="col-owner">OWNER</th>
                {Array.from({ length: Math.max(taxiSlots, 1) }, (_, index) => (
                  <th key={index} style={{ minWidth: 130 }}>
                    <span className="taxi-col-badge">
                      {taxiSlots > 0 ? `TAXI ${index + 1}` : "NO TAXI"}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {league.teams.map((team, teamIndex) => {
                const isActive = teamIndex === currentOwnerIdx;
                const teamPicks = team.taxiSquad || [];
                const teamFull = taxiSlots > 0 && teamPicks.length >= taxiSlots;

                return (
                  <tr
                    key={team.id}
                    className={isActive ? "taxi-my-row" : ""}
                    onClick={() => onSetCurrentOwnerIdx?.(teamIndex)}
                    title={`Set ${team.name} as active taxi team`}
                  >
                    <td className="col-owner">
                      {isActive && (
                        <span className="star" style={{ color: "#8b5cf6" }}>
                          *
                        </span>
                      )}
                      {team.name}
                      <div className="taxi-owner-sub">
                        {teamPicks.length}/{taxiSlots} taxi
                        {teamFull ? " - full" : ""}
                      </div>
                    </td>

                    {Array.from({ length: Math.max(taxiSlots, 1) }, (_, slotIndex) => {
                      const pick = teamPicks[slotIndex];
                      return (
                        <td key={slotIndex} className="taxi-cell">
                          {pick ? (
                            <div className="taxi-pick-chip">
                              <span className="taxi-pick">{pick.name}</span>
                              <button
                                type="button"
                                className="taxi-remove-btn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removePick(team, pick);
                                }}
                                title={`Remove ${pick.name}`}
                              >
                                Remove
                              </button>
                            </div>
                          ) : taxiSlots <= 0 ? (
                            <span className="taxi-empty">configure slots</span>
                          ) : isActive && !teamFull ? (
                            <button
                              type="button"
                              className="taxi-pick-slot"
                              onClick={(event) => {
                                event.stopPropagation();
                                const input = document.querySelector(".taxi-search-area .search-input");
                                input?.focus();
                              }}
                            >
                              + pick
                            </button>
                          ) : (
                            <span className="taxi-empty">
                              {teamFull ? "full" : "empty"}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={`taxi-search-area ${activeTeamFull ? "disabled" : ""}`}>
          <div className="search-label-row">
            <span className="search-label" style={{ color: "#8b5cf6" }}>
              TAXI PICK SEARCH
            </span>
            <span className="search-hint">
              {activeTeam?.name || "Select a team"}: add available players for $1
            </span>
          </div>
          <input
            className="search-input"
            placeholder={
              taxiSlots <= 0
                ? "Add TAXI slots in League Settings first"
                : activeTeamFull
                  ? `${activeTeam?.name || "This team"} is full`
                  : "Search available players for taxi pick"
            }
            value={taxiSearch}
            disabled={taxiSlots <= 0 || activeTeamFull}
            onChange={(event) => setTaxiSearch(event.target.value)}
          />
          {!activeTeamFull && taxiSlots > 0 && (
            <div className="scout-results-list taxi-results-list">
              {available.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className="search-result taxi-search-result"
                  onClick={() => addPick(player)}
                  title={`Add ${player.name} to ${activeTeam?.name} taxi squad for $1`}
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
                  <span className="sr-value" style={{ color: "#8b5cf6" }}>$1</span>
                </button>
              ))}
              {searchQuery && available.length === 0 && (
                <div className="taxi-empty-search">
                  No available players match "{taxiSearch}".
                </div>
              )}
              {!searchQuery && (
                <div className="taxi-empty-search">
                  Type a player name to find available taxi candidates.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="right-panel taxi-right-panel">
        <div className="panel-section-label">ACTIVE MAIN ROSTER</div>
        <div className="roster-summary">
          {rosterPositions.map((slot, index) => {
            const entry = activeTeam?.roster?.find(
              (candidate) => candidate.slotIndex === index,
            );
            return (
              <div key={index} className="roster-sum-row">
                <span className="roster-sum-pos" style={{ color: posColor(slot) }}>
                  {slot}
                </span>
                <span className="roster-sum-name">
                  {entry ? entry.name : "-"}
                </span>
                {entry && (
                  <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--green)" }}>
                    ${entry.price}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="panel-section-label" style={{ marginTop: 16 }}>
          ACTIVE TAXI SQUAD
        </div>
        {taxiSlots <= 0 && (
          <div className="taxi-side-empty">
            No taxi slots are configured for this league.
          </div>
        )}
        {Array.from({ length: taxiSlots }, (_, index) => {
          const pick = activeTeam?.taxiSquad?.[index];
          return (
            <div key={index} className="taxi-roster-row">
              <span className="taxi-badge-sm">TAXI</span>
              <span className="roster-sum-name">
                {pick ? pick.name : "empty"}
              </span>
              {pick ? (
                <button
                  type="button"
                  className="taxi-remove-link"
                  onClick={() => removePick(activeTeam, pick)}
                  title={`Remove ${pick.name}`}
                >
                  Remove
                </button>
              ) : (
                <span style={{ marginLeft: "auto", fontSize: 9, color: "#8b5cf6" }}>
                  $1
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
