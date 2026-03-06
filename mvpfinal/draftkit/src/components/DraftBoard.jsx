// ─────────────────────────────────────────────────────────────────────────────
// components/DraftBoard.jsx
//
// The main draft screen. Contains:
//
//   ┌─────────────────────────────────────────────────────────┬───────────┐
//   │  DRAFT LEAGUE TEAMS TABLE (interactive roster grid)     │  Right    │
//   │  ── Teams as rows, roster slots as columns              │  Panel:   │
//   │  ── Click filled cell → remove player (with confirm)    │  Budget   │
//   │  ── Click empty cell  → tooltip + position filter       │  Player   │
//   │  ── Hover filled cell → mini stats tooltip              │  Card     │
//   │  ── Color-coded value borders (steal/fair/overpaid)     │  Recs     │
//   ├─────────────────────────────────────────────────────────┤           │
//   │  PLAYER SEARCH (autocomplete)                           │           │
//   └─────────────────────────────────────────────────────────┴───────────┘
//
// ── Grid Cell Behavior ────────────────────────────────────────────────────────
//
//  FILLED CELL (player is drafted here):
//    • Hover: shows a mini tooltip with player name, price, base value, and
//             a "click to remove" hint
//    • Left border color:
//        green  = steal (price < 80% of base value)
//        yellow = fair  (price 80–120% of base value)
//        red    = overpaid (price > 120% of base value)
//    • Single click: opens RemoveModal asking to confirm removal
//      Removing restores the player to the available pool and refunds budget.
//
//  EMPTY CELL:
//    • Hover: shows the best available player for that position (name + value)
//    • Single click: triggers a brief "pulse" animation + sets the position
//      filter in the search bar below (e.g. clicking an empty OF slot → filters
//      player search to OF players)
//    • Does NOT let you add a player directly — use "Record Sale" from the search
//
//  COLUMN HEADER (position badge):
//    • Click: sets position filter in search to that position
//
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import PlayerCard from "./PlayerCard.jsx";
import { API_BASE, DEMO_KEY } from "../constants.js";
import { posColor, calcMaxBid, getValueClass } from "../utils/helpers.js";

/**
 * DraftBoard
 *
 * @param {Object}    props
 * @param {Object}    props.league             - Full league state
 * @param {Object[]}  props.players            - Full player array from API
 * @param {Object}    props.selectedPlayer     - Currently highlighted player (or null)
 * @param {Function}  props.setSelectedPlayer  - Sets selected player for the card panel
 * @param {Function}  props.onSale             - (player, price, teamId) => void
 * @param {Function}  props.onUndo             - () => void — undoes the last recorded sale
 * @param {Function}  props.onUndoCell         - (playerName, teamId) => void — targeted undo
 * @param {number}    props.currentOwnerIdx    - Index into league.teams of the active owner
 * @param {Function}  props.setCurrentOwnerIdx - Changes the active drafting owner
 * @param {Object}    props.notes              - { [playerId]: noteText }
 * @param {Function}  props.saveNote           - (playerId, text) => void
 * @param {string}    props.apiStatus          - "online" | "offline" | "checking"
 * @param {string[]}  props.rosterPositions    - Flat array of roster slot labels
 * @param {number}    props.totalSlots         - Total roster slots per team
 * @param {number}    props.maxBid             - Max bid for the active owner
 * @returns {JSX.Element}
 */
export default function DraftBoard({
  league,
  players,
  selectedPlayer,
  setSelectedPlayer,
  onSale,
  onUndo,
  onUndoCell,
  currentOwnerIdx,
  setCurrentOwnerIdx,
  notes,
  saveNote,
  apiStatus,
  rosterPositions,
  totalSlots,
  maxBid,
}) {
  // ── Search / filter state ─────────────────────────────────────────────────
  const [searchQ,   setSearchQ]   = useState("");     // text search query
  const [posFilter, setPosFilter] = useState("ALL");  // position filter for search

  // ── Sale modal state ──────────────────────────────────────────────────────
  // saleModal: the player being sold (or null if modal is closed)
  const [saleModal, setSaleModal] = useState(null);
  const [saleTeam,  setSaleTeam]  = useState(1);   // team ID in the sale modal
  const [salePrice, setSalePrice] = useState("");  // bid amount string

  // ── Remove confirmation modal state ──────────────────────────────────────
  // Shown when user clicks a filled grid cell to remove a player.
  const [removeModal, setRemoveModal] = useState(null); // { playerName, teamId, price, pos }

  // ── Empty cell feedback state ─────────────────────────────────────────────
  // When the user clicks an empty cell, we briefly flash it and set posFilter.
  const [flashCell, setFlashCell] = useState(null); // "teamId-slotIdx" key

  // ── Grid tooltip hover state ──────────────────────────────────────────────
  // Tracks which cell is hovered so we can show a mini tooltip.
  const [hoveredCell, setHoveredCell] = useState(null); // { teamId, slotIdx, entry, pos }

  // ── API valuation state ───────────────────────────────────────────────────
  const [valuation,  setValuation]  = useState(null);
  const [valuating,  setValuating]  = useState(false);

  // ── Recommendations ───────────────────────────────────────────────────────
  const [recommendations, setRecommendations] = useState([]);

  // Ref to the search input (used to focus it when an empty cell is clicked)
  const searchRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Effect: Update recommendations whenever the player pool changes.
  // Shows the top 4 undrafted players by base value.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const undrafted = players.filter((p) => !p.drafted);
    setRecommendations(undrafted.slice(0, 4));
  }, [players]);

  // ─────────────────────────────────────────────────────────────────────────
  // Effect: Auto-fetch valuation when selected player changes.
  // Only runs if the API is online — otherwise shows base value.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedPlayer && apiStatus === "online") {
      fetchValuation(selectedPlayer);
    } else {
      setValuation(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayer?.id, apiStatus]);

  // ─────────────────────────────────────────────────────────────────────────
  // Effect: Close modals on Escape key press.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") {
        setSaleModal(null);
        setRemoveModal(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // fetchValuation — POSTs the current draft state to the valuation API
  // and stores the result in `valuation` state.
  //
  // @param {Object} player - The player to get valuation for
  // ─────────────────────────────────────────────────────────────────────────
  async function fetchValuation(player) {
    setValuating(true);
    setValuation(null);
    try {
      // Build the full draft state payload the API expects
      const draftState = {
        total_teams: league.owners,
        budget_per_team: league.budget,
        scoring_categories: Object.entries(league.scoring)
          .filter(([, v]) => v)
          .map(([k]) => k),
        teams: league.teams.map((t) => ({
          id: t.id,
          budget_remaining: t.budget_remaining,
          roster: t.roster.map((r) => r.name), // API expects array of name strings
        })),
        nominated_player: player.name,
        roster_config: league.roster,
      };

      const r = await fetch(`${API_BASE}/v1/valuate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-License-Key": DEMO_KEY,
        },
        body: JSON.stringify({ license_key: DEMO_KEY, draft_state: draftState }),
      });

      const data = await r.json();
      setValuation(data);
    } catch {
      // API offline or unreachable — valuation stays null, card shows base value
      setValuation(null);
    }
    setValuating(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // openSaleModal — opens the sale confirmation modal for a given player.
  // Pre-fills team with the current active owner and price with the API
  // recommendation (or base value if API is offline).
  //
  // @param {Object} player - Player to record a sale for
  // ─────────────────────────────────────────────────────────────────────────
  function openSaleModal(player) {
    setSaleModal(player);
    setSaleTeam(league.teams[currentOwnerIdx]?.id || 1);
    // Pre-fill price from API recommendation if available, else use base value
    setSalePrice(valuation?.max_bid_recommendation || player.baseValue || "");
    setSelectedPlayer(player);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // confirmSale — commits the sale modal and fires onSale().
  // Closes the modal and clears the selected player on success.
  // ─────────────────────────────────────────────────────────────────────────
  function confirmSale() {
    if (!saleModal || !salePrice) return;
    onSale(saleModal, +salePrice, saleTeam);
    setSaleModal(null);
    setSalePrice("");
    setSelectedPlayer(null);
    setValuation(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // handleFilledCellClick — handles clicking a cell that already has a player.
  // Opens the RemoveModal confirmation dialog.
  //
  // @param {Object} entry  - Roster entry { name, price, pos }
  // @param {number} teamId - ID of the team this cell belongs to
  // @param {string} pos    - Position slot label (e.g. "OF")
  // @param {Event}  e      - Click event (stopped from bubbling to row click)
  // ─────────────────────────────────────────────────────────────────────────
  function handleFilledCellClick(entry, teamId, pos, e) {
    e.stopPropagation(); // prevent row click (which changes active owner)
    setRemoveModal({ playerName: entry.name, teamId, price: entry.price, pos });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // handleEmptyCellClick — handles clicking an empty roster slot.
  // Shows a brief flash animation and sets the position filter in the search bar.
  // Scrolls the search bar into view and focuses the input.
  //
  // @param {string} pos       - Position for this slot (e.g. "OF")
  // @param {number} teamId    - Team ID this cell belongs to
  // @param {number} slotIdx   - Column index of the slot within that team's row
  // @param {Event}  e         - Click event
  // ─────────────────────────────────────────────────────────────────────────
  function handleEmptyCellClick(pos, teamId, slotIdx, e) {
    e.stopPropagation();

    // Set position filter to help user find the right player
    if (pos !== "BN" && pos !== "UTIL") {
      setPosFilter(pos);
    }

    // Flash the cell to give feedback
    const key = `${teamId}-${slotIdx}`;
    setFlashCell(key);
    setTimeout(() => setFlashCell(null), 600); // clear flash after animation

    // Focus the search bar so user can type immediately
    searchRef.current?.focus();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // confirmRemove — fires onUndoCell to remove the player and refund budget.
  // ─────────────────────────────────────────────────────────────────────────
  function confirmRemove() {
    if (!removeModal) return;
    onUndoCell(removeModal.playerName, removeModal.teamId);
    setRemoveModal(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getBestAvailable — returns the top undrafted player eligible for a given
  // position slot. Shown as a hint in hover tooltips on empty cells.
  //
  // @param {string} pos - Position slot (e.g. "OF", "SP")
  // @returns {Object|null} Player object or null if none available
  // ─────────────────────────────────────────────────────────────────────────
  function getBestAvailable(pos) {
    if (pos === "BN" || pos === "UTIL") {
      // Bench/UTIL: return highest-value undrafted player of any position
      return players.find((p) => !p.drafted) || null;
    }
    return players.find((p) => !p.drafted && p.pos.includes(pos)) || null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Filtered player list for the search autocomplete dropdown.
  // Excludes already-drafted players. Applies text search and position filter.
  // ─────────────────────────────────────────────────────────────────────────
  const filteredPlayers = players.filter((p) => {
    if (p.drafted) return false;
    if (
      searchQ &&
      !p.name.toLowerCase().includes(searchQ.toLowerCase()) &&
      !(p.team || "").toLowerCase().includes(searchQ.toLowerCase())
    ) {
      return false;
    }
    if (posFilter !== "ALL" && !p.pos.includes(posFilter)) return false;
    return true;
  });

  const myTeam   = league.teams[currentOwnerIdx];
  const slotsLeft = totalSlots - (myTeam?.roster?.length || 0);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="board-layout">

      {/* ════════════════════════════════════════════════════════════════════
          TEAMS TABLE (Left/Main area)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="board-main">

        {/* ── Header row (title + undo button) ──────────────────────────── */}
        <div className="board-header">
          <div>
            <h2 className="board-title">DRAFT LEAGUE TEAMS TABLE</h2>
            <span className="board-hint">
              Click a filled cell to remove · click empty cell to filter search by position
            </span>
          </div>
          <button className="undo-btn" onClick={onUndo} title="Undo last recorded sale">
            ↩ Undo Last
          </button>
        </div>

        {/* ── Draft Grid Table ──────────────────────────────────────────── */}
        <div className="teams-table-wrap">
          <table className="teams-table">
            <thead>
              <tr>
                {/* Owner column header */}
                <th className="col-owner">OWNER</th>
                {/* Budget column header */}
                <th className="col-budget">$ LEFT</th>

                {/* Position slot headers — clicking sets the position filter */}
                {rosterPositions.map((pos, i) => (
                  <th
                    key={i}
                    style={{ cursor: "pointer" }}
                    title={`Click to filter player search to ${pos}`}
                    onClick={() => {
                      setPosFilter(pos === posFilter ? "ALL" : pos);
                      searchRef.current?.focus();
                    }}
                  >
                    <span
                      className="pos-badge-header"
                      style={{
                        background: posColor(pos),
                        // Highlight the column if its position is the active filter
                        outline: posFilter === pos ? "2px solid white" : "none",
                        outlineOffset: 1,
                      }}
                    >
                      {pos}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {league.teams.map((team, ti) => {
                const isMe    = ti === currentOwnerIdx;
                // Max bid for this specific team's row
                const teamMaxBid = calcMaxBid(
                  team.budget_remaining,
                  totalSlots - team.roster.length
                );

                return (
                  <tr
                    key={team.id}
                    className={isMe ? "my-row" : ""}
                    onClick={() => setCurrentOwnerIdx(ti)}
                    title={`Click row to set ${team.name} as drafting owner`}
                  >
                    {/* Owner name cell */}
                    <td className="col-owner">
                      {isMe && <span className="star">★ </span>}
                      {team.name}
                      {isMe && (
                        <div className="max-bid-mini">
                          max bid ${teamMaxBid}
                        </div>
                      )}
                    </td>

                    {/* Budget cell — color changes at thresholds */}
                    <td
                      className="col-budget"
                      style={{
                        color:
                          team.budget_remaining > 50
                            ? "#22c55e"     // green: lots of budget left
                            : team.budget_remaining > 20
                            ? "#f59e0b"     // amber: getting tight
                            : "#ef4444",   // red: almost out
                      }}
                    >
                      ${team.budget_remaining}
                    </td>

                    {/* Roster slot cells */}
                    {rosterPositions.map((pos, si) => {
                      const entry   = team.roster[si];
                      const cellKey = `${team.id}-${si}`;
                      const isFlashing = flashCell === cellKey;
                      const isHovered  = hoveredCell?.teamId === team.id &&
                                         hoveredCell?.slotIdx === si;

                      if (entry) {
                        // ── FILLED CELL ─────────────────────────────────
                        // Look up base value to determine if it was a steal/overpay
                        const matchedPlayer = players.find(
                          (p) => p.name === entry.name
                        );
                        const valueClass = getValueClass(
                          entry.price,
                          matchedPlayer?.baseValue
                        );

                        return (
                          <td
                            key={si}
                            className={`roster-cell roster-cell-filled ${valueClass}`}
                            onClick={(e) =>
                              handleFilledCellClick(entry, team.id, pos, e)
                            }
                            onMouseEnter={() =>
                              setHoveredCell({ teamId: team.id, slotIdx: si, entry, pos, matchedPlayer })
                            }
                            onMouseLeave={() => setHoveredCell(null)}
                            title={`${entry.name} · $${entry.price} · Click to remove`}
                            style={{ position: "relative" }}
                          >
                            {/* ── Roster entry content ──────────────────── */}
                            <div className="roster-entry">
                              {/* Keeper badge (if this entry was a pre-draft keeper) */}
                              {entry.isKeeper && (
                                <span className="keeper-badge">K</span>
                              )}
                              <span className="roster-name">{entry.name}</span>
                              <div className="roster-price-row">
                                <span className="roster-price">${entry.price}</span>
                                {/* Show if this was a steal or overpay */}
                                {matchedPlayer && valueClass === "value-steal" && (
                                  <span className="value-label steal" title="Great value!">▲</span>
                                )}
                                {matchedPlayer && valueClass === "value-overpaid" && (
                                  <span className="value-label overpaid" title="Overpaid">▼</span>
                                )}
                              </div>
                            </div>

                            {/* ── Hover tooltip ─────────────────────────── */}
                            {isHovered && (
                              <div className="cell-tooltip">
                                <div className="ct-name">{entry.name}</div>
                                <div className="ct-row">
                                  <span className="ct-label">PAID</span>
                                  <span className="ct-val">${entry.price}</span>
                                </div>
                                {matchedPlayer && (
                                  <div className="ct-row">
                                    <span className="ct-label">VALUE</span>
                                    <span className="ct-val">${matchedPlayer.baseValue}</span>
                                  </div>
                                )}
                                {matchedPlayer && (
                                  <div className="ct-row">
                                    <span className="ct-label">FPTS</span>
                                    <span className="ct-val">{matchedPlayer.fpts}</span>
                                  </div>
                                )}
                                <div className="ct-hint">↩ Click to remove</div>
                              </div>
                            )}
                          </td>
                        );

                      } else {
                        // ── EMPTY CELL ───────────────────────────────────
                        // Show best-available hint on hover
                        const bestAvail = isHovered ? getBestAvailable(pos) : null;

                        return (
                          <td
                            key={si}
                            className={`roster-cell roster-cell-empty ${isFlashing ? "cell-flash" : ""}`}
                            onClick={(e) =>
                              handleEmptyCellClick(pos, team.id, si, e)
                            }
                            onMouseEnter={() =>
                              setHoveredCell({ teamId: team.id, slotIdx: si, entry: null, pos })
                            }
                            onMouseLeave={() => setHoveredCell(null)}
                            title={`Empty ${pos} slot — click to filter search to ${pos}`}
                            style={{ position: "relative" }}
                          >
                            {/* Default dash marker */}
                            <span className="roster-empty">–</span>

                            {/* ── Hover tooltip for empty cell ─────────── */}
                            {isHovered && (
                              <div className="cell-tooltip cell-tooltip-empty">
                                <div className="ct-name" style={{ color: posColor(pos) }}>
                                  {pos} SLOT
                                </div>
                                {bestAvail ? (
                                  <>
                                    <div className="ct-hint" style={{ marginBottom: 3 }}>
                                      Best available:
                                    </div>
                                    <div className="ct-row">
                                      <span className="ct-val" style={{ color: "var(--white)" }}>
                                        {bestAvail.name}
                                      </span>
                                    </div>
                                    <div className="ct-row">
                                      <span className="ct-label">VALUE</span>
                                      <span className="ct-val" style={{ color: "var(--green)" }}>
                                        ${bestAvail.baseValue}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="ct-hint" style={{ color: "var(--red)" }}>
                                    No {pos} available
                                  </div>
                                )}
                                <div className="ct-hint" style={{ marginTop: 4 }}>
                                  ↓ Click to filter search
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      }
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Player Search ─────────────────────────────────────────────── */}
        <div className="search-bar-area">
          <div className="search-label-row">
            <span className="search-label">PLAYER SEARCH</span>
            <span className="search-hint">
              Quick search · click result to view card · click "Record Sale" to commit
            </span>
            {/* Position filter buttons — also used as the grid's position filter */}
            <div className="pos-filters">
              {["ALL", "C", "1B", "2B", "3B", "SS", "OF", "SP", "RP"].map((p) => (
                <button
                  key={p}
                  className={`pos-filter ${posFilter === p ? "active" : ""}`}
                  onClick={() => setPosFilter(p)}
                  title={p === "ALL" ? "Show all positions" : `Filter to ${p}`}
                >
                  {p}
                </button>
              ))}
              <span className="avail-count">{filteredPlayers.length} available</span>
            </div>
          </div>

          {/* ── Search input with autocomplete dropdown ──────────────── */}
          <div style={{ position: "relative" }}>
            <input
              ref={searchRef}
              className="search-input"
              placeholder={
                posFilter !== "ALL"
                  ? `Search ${posFilter} players… (filtering active)`
                  : "Search players or teams… click result to view, click Record Sale to commit"
              }
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => {
                // Pressing Escape clears the position filter
                if (e.key === "Escape") {
                  setPosFilter("ALL");
                  setSearchQ("");
                }
              }}
            />

            {/* ── Autocomplete dropdown results ───────────────────── */}
            {searchQ && filteredPlayers.length > 0 && (
              <div className="search-dropdown">
                {filteredPlayers.slice(0, 8).map((p) => (
                  <SearchResult
                    key={p.id}
                    player={p}
                    onSelect={() => {
                      setSelectedPlayer(p);
                      setSearchQ("");
                    }}
                    onRecord={() => openSaleModal(p)}
                  />
                ))}
                {filteredPlayers.length > 8 && (
                  <div style={{ padding: "6px 12px", fontSize: 10, color: "var(--muted)" }}>
                    + {filteredPlayers.length - 8} more results — refine your search
                  </div>
                )}
              </div>
            )}
            {/* No results message */}
            {searchQ && filteredPlayers.length === 0 && (
              <div className="search-dropdown">
                <div style={{ padding: "12px", fontSize: 11, color: "var(--muted)" }}>
                  No available players match "{searchQ}"
                  {posFilter !== "ALL" && ` for position ${posFilter}`}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════════════════
          RIGHT PANEL
      ════════════════════════════════════════════════════════════════════ */}
      <div className="right-panel">

        {/* Budget + Slots summary */}
        <div className="panel-budget">
          <div>
            <div className="panel-label">BUDGET</div>
            <div className="panel-value green">
              ${myTeam?.budget_remaining ?? league.budget}
            </div>
          </div>
          <div>
            <div className="panel-label">SLOTS LEFT</div>
            <div className="panel-value">{slotsLeft}</div>
          </div>
          <div>
            <div className="panel-label">MAX BID</div>
            <div className="panel-value">${maxBid}</div>
          </div>
        </div>

        {/* Current player section */}
        <div className="current-player-section">
          <div className="cp-header">CURRENT PLAYER</div>
          <div className="cp-drafting-row">
            <span className="cp-drafting-label">DRAFTING OWNER:</span>
            {/* Owner selector dropdown */}
            <select
              className="cp-owner-select"
              value={currentOwnerIdx}
              onChange={(e) => setCurrentOwnerIdx(+e.target.value)}
            >
              {league.teams.map((t, i) => (
                <option key={i} value={i}>
                  {t.name} (${t.budget_remaining})
                </option>
              ))}
            </select>
            {/* Record Sale button — only shown when a player is selected */}
            {selectedPlayer && (
              <button
                className="record-sale-btn"
                onClick={() => openSaleModal(selectedPlayer)}
              >
                RECORD SALE
              </button>
            )}
          </div>

          {/* Player card or empty state */}
          {selectedPlayer ? (
            <PlayerCard
              player={selectedPlayer}
              valuation={valuating ? "loading" : valuation}
              notes={notes}
              saveNote={saveNote}
            />
          ) : (
            <div className="cp-empty">
              Search for a player below or click a roster cell
            </div>
          )}
        </div>

        {/* Recommendations panel */}
        <div className="recommendations">
          <div className="rec-header">
            TOP AVAILABLE{" "}
            <span className="rec-sub">
              {posFilter !== "ALL" ? posFilter : "Overall"}
            </span>
          </div>
          {recommendations
            .filter((p) => posFilter === "ALL" || p.pos.includes(posFilter))
            .slice(0, 4)
            .map((p) => (
              <div
                key={p.id}
                className="rec-row"
                onClick={() => setSelectedPlayer(p)}
                title={`Select ${p.name} — $${p.baseValue} base value`}
              >
                <PlayerAvatar name={p.name} size={32} photoUrl={p.photoUrl} />
                <div className="rec-info">
                  <div className="rec-name">{p.name}</div>
                  <div className="rec-team">{p.team}</div>
                  <div className="rec-pos">
                    {p.pos.map((pos) => (
                      <span
                        key={pos}
                        className="pos-badge"
                        style={{ background: posColor(pos) }}
                      >
                        {pos}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rec-right">
                  <div className="rec-value green">${p.baseValue}</div>
                  <div className={`tier-badge ${p.tier?.toLowerCase()}`}>
                    {p.tier?.toUpperCase()}
                  </div>
                </div>
              </div>
            ))}
          {/* Fall back to overall top if no filtered matches */}
          {posFilter !== "ALL" &&
            recommendations.filter((p) => p.pos.includes(posFilter)).length === 0 &&
            recommendations.slice(0, 2).map((p) => (
              <div
                key={p.id}
                className="rec-row"
                onClick={() => setSelectedPlayer(p)}
              >
                <PlayerAvatar name={p.name} size={32} photoUrl={p.photoUrl} />
                <div className="rec-info">
                  <div className="rec-name">{p.name}</div>
                  <div className="rec-team">{p.team}</div>
                </div>
                <div className="rec-right">
                  <div className="rec-value green">${p.baseValue}</div>
                </div>
              </div>
            ))}
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SALE MODAL — record an auction sale
          Opened by: "Record Sale" button or clicking a player in search results
      ════════════════════════════════════════════════════════════════════ */}
      {saleModal && (
        <div
          className="modal-overlay"
          onClick={() => setSaleModal(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>RECORD AUCTION SALE</h3>
            <p className="modal-player">{saleModal.name}</p>

            {/* Positions + tier on the header */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
              {saleModal.pos.map((p) => (
                <span key={p} className="pos-badge" style={{ background: posColor(p) }}>
                  {p}
                </span>
              ))}
              <span className={`tier-badge ${saleModal.tier?.toLowerCase()}`}>
                {saleModal.tier?.toUpperCase()}
              </span>
            </div>

            {/* Winning team selector */}
            <div className="form-group">
              <label>WINNING TEAM</label>
              <select
                value={saleTeam}
                onChange={(e) => setSaleTeam(+e.target.value)}
              >
                {league.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (${t.budget_remaining} left)
                  </option>
                ))}
              </select>
            </div>

            {/* Bid amount input */}
            <div className="form-group">
              <label>WINNING BID ($)</label>
              <input
                type="number"
                value={salePrice}
                min={1}
                onChange={(e) => setSalePrice(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmSale();
                }}
              />
            </div>

            {/* API valuation hint */}
            {valuation && valuation !== "loading" && (
              <div className="modal-hint">
                API suggests:{" "}
                <strong>${valuation.max_bid_recommendation}</strong> max bid
                {valuation.true_dollar_value && (
                  <> · TDV: <strong>${valuation.true_dollar_value}</strong></>
                )}
                {valuation.scarcity_tier && (
                  <> · Tier: {valuation.scarcity_tier}</>
                )}
              </div>
            )}

            {/* Show base value if no API valuation */}
            {!valuation && (
              <div className="modal-hint">
                Base value: <strong>${saleModal.baseValue}</strong>
                {" "}(no live API valuation)
              </div>
            )}

            <div className="modal-actions">
              <button
                className="modal-cancel"
                onClick={() => setSaleModal(null)}
              >
                Cancel
              </button>
              <button
                className="modal-confirm"
                onClick={confirmSale}
                disabled={!salePrice}
              >
                Confirm Sale — {salePrice ? `$${salePrice}` : "enter bid"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          REMOVE MODAL — confirm player removal from roster
          Opened by: clicking a filled cell in the grid
      ════════════════════════════════════════════════════════════════════ */}
      {removeModal && (
        <div
          className="modal-overlay"
          onClick={() => setRemoveModal(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>REMOVE PLAYER FROM ROSTER?</h3>
            <p className="modal-player">{removeModal.playerName}</p>

            <div className="modal-hint" style={{ marginBottom: 16 }}>
              <div>
                Team:{" "}
                <strong>
                  {league.teams.find((t) => t.id === removeModal.teamId)?.name}
                </strong>
              </div>
              <div>
                Paid: <strong style={{ color: "var(--red)" }}>
                  ${removeModal.price}
                </strong>
              </div>
              <div style={{ marginTop: 6, color: "var(--green)" }}>
                ✓ Budget will be refunded: +${removeModal.price}
              </div>
              <div style={{ marginTop: 4 }}>
                Player returns to available pool.
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="modal-cancel"
                onClick={() => setRemoveModal(null)}
              >
                Cancel
              </button>
              <button
                className="modal-confirm"
                style={{ background: "var(--red)" }}
                onClick={confirmRemove}
              >
                Remove Player
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchResult — internal sub-component for a single search dropdown row
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SearchResult
 *
 * A single row in the autocomplete dropdown. Shows avatar, name, team,
 * positions, base value, and a "Record Sale" action button.
 *
 * @param {Object}   props
 * @param {Object}   props.player    - Player object
 * @param {Function} props.onSelect  - Called when the row itself is clicked (view card)
 * @param {Function} props.onRecord  - Called when "Record Sale" button is clicked
 */
function SearchResult({ player, onSelect, onRecord }) {
  return (
    <div
      className="search-result"
      onClick={onSelect}
      title={`Click to view ${player.name}'s card`}
    >
      {/* Mini avatar */}
      <PlayerAvatar name={player.name} size={28} photoUrl={player.photoUrl} />

      {/* Name */}
      <span className="sr-name">{player.name}</span>

      {/* Team + league */}
      <span className="sr-team">
        {player.team} · {player.league}
      </span>

      {/* Position badges */}
      <div style={{ display: "flex", gap: 2 }}>
        {player.pos.map((pos) => (
          <span
            key={pos}
            className="pos-badge"
            style={{ background: posColor(pos) }}
          >
            {pos}
          </span>
        ))}
      </div>

      {/* FPTS */}
      {player.fpts && (
        <span style={{ fontSize: 9, color: "var(--muted)", marginLeft: 2 }}>
          {player.fpts}pts
        </span>
      )}

      {/* Base value */}
      <span className="sr-value">${player.baseValue}</span>

      {/* Record Sale action button */}
      <button
        className="sr-record"
        onClick={(e) => {
          e.stopPropagation(); // don't trigger onSelect
          onRecord();
        }}
        title={`Record sale of ${player.name}`}
      >
        Record Sale
      </button>
    </div>
  );
}
