// ─────────────────────────────────────────────────────────────────────────────
// components/TaxiSquad.jsx
//
// $1 reserve / minor-league draft screen used after the main auction completes.
// Each team can draft players into their "taxi squad" at a fixed $1 price.
// Taxi squad picks do NOT reduce the team's main auction budget.
//
// The right panel shows the current owner's main roster + taxi slots.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { posColor } from "../utils/helpers.js";

/**
 * TaxiSquad
 *
 * @param {Object}   props
 * @param {Object}   props.league           - Full league state
 * @param {Object[]} props.players          - Full player array
 * @param {Function} props.onTaxiPick       - (player, teamId) => void — assigns $1 taxi pick
 * @param {number}   props.currentOwnerIdx  - Index of the active owner in league.teams
 * @param {string[]} props.rosterPositions  - Flat roster slot array (e.g. ["C","OF","OF",...])
 * @returns {JSX.Element}
 */
export default function TaxiSquad({
  league,
  players,
  onTaxiPick,
  currentOwnerIdx,
  rosterPositions,
}) {
  // ── Local search state ────────────────────────────────────────────────────
  // Controls the autocomplete dropdown for picking taxi squad players.
  const [taxiSearch, setTaxiSearch] = useState("");

  // Number of taxi slots each team has (configured in league settings)
  const taxiSlots = league.roster.TAXI || 3;

  // Currently active (drafting) team
  const myTeam = league.teams[currentOwnerIdx];

  // Undrafted players matching the search query
  const available = players.filter(
    (p) =>
      !p.drafted &&
      (taxiSearch === "" ||
        p.name.toLowerCase().includes(taxiSearch.toLowerCase()))
  );

  return (
    <div className="taxi-layout">

      {/* ── Main: All Teams Taxi Grid ──────────────────────────────────────── */}
      <div className="taxi-main">
        {/* Header row */}
        <div className="taxi-header-row">
          <h2 className="taxi-mode-title">TAXI SQUAD MODE</h2>
          <span className="taxi-badge">
            $1 fixed per pick — does NOT reduce main ${league.budget} auction budget
          </span>
          <span className="taxi-hint" style={{ marginLeft: "auto" }}>
            Reserve minor-league prospects below.
          </span>
        </div>

        {/* All-teams taxi grid table */}
        <div className="settings-section-label" style={{ marginBottom: 8 }}>
          ALL TAXI SQUADS
        </div>
        <div className="teams-table-wrap">
          <table className="teams-table">
            <thead>
              <tr>
                <th className="col-owner">OWNER</th>
                {/* One column per taxi slot */}
                {Array.from({ length: taxiSlots }, (_, i) => (
                  <th key={i} style={{ minWidth: 120 }}>
                    <span className="taxi-col-badge">TAXI $1</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {league.teams.map((team, ti) => {
                const isMe = ti === currentOwnerIdx;
                return (
                  <tr key={team.id} className={isMe ? "taxi-my-row" : ""}>
                    {/* Owner column */}
                    <td className="col-owner">
                      {isMe && (
                        <span className="star" style={{ color: "#8b5cf6" }}>★ </span>
                      )}
                      {team.name}
                    </td>

                    {/* Taxi slot cells */}
                    {Array.from({ length: taxiSlots }, (_, si) => {
                      const pick = (team.taxiSquad || [])[si];
                      return (
                        <td key={si} className="taxi-cell">
                          {pick ? (
                            // Filled slot — shows player name
                            <span className="taxi-pick">{pick.name}</span>
                          ) : isMe ? (
                            // Empty slot for current owner — shows clickable prompt
                            <span className="taxi-pick-slot">+ pick</span>
                          ) : (
                            // Empty slot for other teams
                            <span className="taxi-empty">empty</span>
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

        {/* ── Taxi Pick Search ─────────────────────────────────────────────── */}
        {/* Search bar for the current owner to find and assign a taxi pick */}
        <div className="taxi-search-area">
          <div className="search-label-row">
            <span className="search-label" style={{ color: "#8b5cf6" }}>
              TAXI PICK SEARCH
            </span>
            <span className="search-hint">
              {myTeam?.name}: click a result to assign a $1 taxi pick
            </span>
          </div>
          <div style={{ position: "relative" }}>
            <input
              className="search-input"
              placeholder="Search available players for $1 taxi pick…"
              value={taxiSearch}
              onChange={(e) => setTaxiSearch(e.target.value)}
            />
            {/* Dropdown results */}
            {taxiSearch && (
              <div className="search-dropdown">
                {available.slice(0, 8).map((p) => (
                  <div
                    key={p.id}
                    className="search-result"
                    onClick={() => {
                      // Assign $1 taxi pick to the current owner's team
                      onTaxiPick(p, myTeam?.id);
                      setTaxiSearch(""); // clear search after pick
                    }}
                    title={`Add ${p.name} to ${myTeam?.name} taxi squad for $1`}
                  >
                    <PlayerAvatar name={p.name} size={26} photoUrl={p.photoUrl} />
                    <span className="sr-name">{p.name}</span>
                    <span className="sr-team">{p.team}</span>
                    {p.pos.map((pos) => (
                      <span
                        key={pos}
                        className="pos-badge"
                        style={{ background: posColor(pos) }}
                      >
                        {pos}
                      </span>
                    ))}
                    <span className="sr-value" style={{ color: "#8b5cf6" }}>$1</span>
                  </div>
                ))}
                {available.length === 0 && (
                  <div style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted)" }}>
                    No available players match "{taxiSearch}"
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right Panel: My Roster + Taxi ─────────────────────────────────── */}
      <div className="right-panel taxi-right-panel">

        {/* Main roster summary */}
        <div className="panel-section-label">MY MAIN ROSTER</div>
        <div className="roster-summary">
          {rosterPositions.map((slot, i) => {
            const entry = myTeam?.roster[i];
            return (
              <div key={i} className="roster-sum-row">
                <span className="roster-sum-pos" style={{ color: posColor(slot) }}>
                  {slot}
                </span>
                <span className="roster-sum-name">
                  {entry ? entry.name : "–"}
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

        {/* Taxi squad slots */}
        <div className="panel-section-label" style={{ marginTop: 16 }}>
          MY TAXI SQUAD
        </div>
        {Array.from({ length: taxiSlots }, (_, i) => {
          const pick = (myTeam?.taxiSquad || [])[i];
          return (
            <div key={i} className="taxi-roster-row">
              <span className="taxi-badge-sm">TAXI</span>
              <span className="roster-sum-name">
                {pick ? pick.name : "empty"}
              </span>
              {pick && (
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
