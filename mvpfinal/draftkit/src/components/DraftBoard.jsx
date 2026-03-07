// ─────────────────────────────────────────────────────────────────────────────
// components/DraftBoard.jsx
//
// The main draft screen. Left: interactive team roster grid + player search.
// Right: budget panel, player card, recommendations.
//
// ── Grid Cell Behavior ────────────────────────────────────────────────────────
//
//  FILLED CELL:
//    • Hover → tooltip: name / price / base value / FPTS / "click to remove"
//    • Left border color: green=steal, red=overpaid, transparent=fair
//    • Click → RemoveModal (confirms, refunds budget)
//
//  EMPTY CELL:
//    • Hover → tooltip: position slot label + best available player
//    • Click → InlineCellSearch (mini search box inside the cell)
//             Also opens sale modal when a player is selected from it.
//
//  COLUMN HEADER (position badge):
//    • Click → toggles position filter in the bottom search bar
//
// ── Roster Slot Storage ───────────────────────────────────────────────────────
// Each roster entry: { name, price, pos, slotIndex, draftedPos, isKeeper? }
// Grid displays via: team.roster.find(r => r.slotIndex === si)
// This means position matters — a C drafted into slot 0 stays in that cell.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import PlayerCard from "./PlayerCard.jsx";
import { posColor, calcMaxBid, getValueClass } from "../utils/helpers.js";

export default function DraftBoard({
  league,
  players,
  selectedPlayer,
  setSelectedPlayer,
  onSale,          // (player, price, teamId, slotIndex, draftedPos) => void
  onUndo,
  onUndoCell,
  currentOwnerIdx,
  setCurrentOwnerIdx,
  notes,
  saveNote,
  apiStatus,
  rosterPositions, // flat ordered array e.g. ["C","1B","2B","3B","SS","OF","OF","OF","SP"...]
  totalSlots,
  maxBid,
  valuationCache,      // shared valuation cache from App { [playerId]: "loading" | apiResponse }
  requestValuation,    // (player) => void  — requests a valuation and stores it in the cache
  draftStateKey,       // compact string that changes on every pick/undo (cache version key)
}) {
  // ── Search / filter state (bottom search bar) ─────────────────────────────
  const [searchQ,   setSearchQ]   = useState("");
  const [posFilter, setPosFilter] = useState("ALL");

  // ── Sale modal state ──────────────────────────────────────────────────────
  const [saleModal,     setSaleModal]     = useState(null);  // player obj or null
  const [saleTeam,      setSaleTeam]      = useState(1);     // winning team ID
  const [salePrice,     setSalePrice]     = useState("");    // bid amount
  const [saleSlot,      setSaleSlot]      = useState(null);  // slotIndex to fill
  const [customPosInput, setCustomPosInput] = useState(""); // custom eligibility override

  // ── Remove confirmation modal state ──────────────────────────────────────
  const [removeModal, setRemoveModal] = useState(null); // {playerName, teamId, price, pos}

  // ── Inline cell search state ──────────────────────────────────────────────
  // When set, the matching empty cell shows an inline search box.
  const [activeCellSearch, setActiveCellSearch] = useState(null); // {teamId, slotIdx, pos}

  // ── Grid tooltip hover state ──────────────────────────────────────────────
  const [hoveredCell, setHoveredCell] = useState(null);

  // ── Recommendations ───────────────────────────────────────────────────────
  const [recommendations, setRecommendations] = useState([]);

  const searchRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Derived: extend saleModal player with custom eligibility override.
  // If user typed extra positions in the override box, temporarily add them
  // to the player's pos list so they appear as valid slot options.
  // ─────────────────────────────────────────────────────────────────────────
  const extendedSalePlayer = saleModal
    ? {
        ...saleModal,
        pos: [
          ...new Set([
            ...saleModal.pos,
            ...customPosInput
              .toUpperCase()
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean),
          ]),
        ],
      }
    : null;

  // Valid slots for the current modal player + selected team
  const validSlotsForModal = extendedSalePlayer
    ? getValidSlotsForPlayer(extendedSalePlayer, saleTeam)
    : [];

  // ─────────────────────────────────────────────────────────────────────────
  // getValidSlotsForPlayer — returns all valid empty roster slots for a player
  // on a given team. Used in both the sale modal slot picker and inline search.
  //
  // Slot eligibility rules:
  //   BN   → any player
  //   UTIL → any player with at least one non-pitcher position (not pure SP/RP)
  //   other → player.pos.includes(slotPos)
  //
  // @param {Object} player - Player object (uses .pos array)
  // @param {number} teamId - Team to check slots for
  // @returns {{ slotIdx: number, pos: string }[]}
  // ─────────────────────────────────────────────────────────────────────────
  function getValidSlotsForPlayer(player, teamId) {
    const team = league.teams.find((t) => t.id === teamId);
    if (!team) return [];

    // Occupied slot indices for this team
    const takenSlots = new Set(team.roster.map((r) => r.slotIndex));

    return rosterPositions.reduce((acc, slotPos, si) => {
      // Skip occupied slots
      if (takenSlots.has(si)) return acc;

      if (slotPos === "BN") {
        // Bench: accepts any player
        acc.push({ slotIdx: si, pos: slotPos });
        return acc;
      }

      if (slotPos === "UTIL") {
        // UTIL: accepts any hitter (player has at least one non-pitcher position)
        const hasHitterEligibility = player.pos.some(
          (p) => !["SP", "RP"].includes(p)
        );
        if (hasHitterEligibility) {
          acc.push({ slotIdx: si, pos: slotPos });
        }
        return acc;
      }

      // Standard slot: player must have this position in their eligibility
      if (player.pos.includes(slotPos)) {
        acc.push({ slotIdx: si, pos: slotPos });
      }

      return acc;
    }, []);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Effects
  // ─────────────────────────────────────────────────────────────────────────

  // Update recommendations when player pool changes
  useEffect(() => {
    setRecommendations(players.filter((p) => !p.drafted).slice(0, 4));
  }, [players]);

  // Auto-fetch valuation when selected player OR draft state changes.
  // draftStateKey re-triggers this whenever a player is added/removed,
  // so the API inflation & scarcity math stays accurate without a manual re-click.
  useEffect(() => {
    if (selectedPlayer) requestValuation(selectedPlayer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayer?.id, draftStateKey]);

  // Pre-fetch valuations for the top recommended players so the rec panel
  // always shows live API values, not just base values.
  useEffect(() => {
    recommendations.forEach((p) => requestValuation(p));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendations, draftStateKey]);

  // Close modals on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") {
        setSaleModal(null);
        setRemoveModal(null);
        setActiveCellSearch(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Close inline cell search when clicking outside
  useEffect(() => {
    if (!activeCellSearch) return;
    function handleOutsideClick() {
      setActiveCellSearch(null);
    }
    // Small timeout so the click that opened us doesn't immediately close us
    const t = setTimeout(() => {
      document.addEventListener("click", handleOutsideClick);
    }, 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener("click", handleOutsideClick);
    };
  }, [activeCellSearch]);

  // When saleTeam changes while modal is open, recalculate valid slots
  // and reset saleSlot to the first valid option
  useEffect(() => {
    if (!saleModal || !extendedSalePlayer) return;
    const slots = getValidSlotsForPlayer(extendedSalePlayer, saleTeam);
    setSaleSlot(slots[0]?.slotIdx ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleTeam, customPosInput]);

  // ─────────────────────────────────────────────────────────────────────────
  // openSaleModal — open the sale modal for a player.
  // Pre-selects the first valid slot for the current active owner's team.
  // ─────────────────────────────────────────────────────────────────────────
  function openSaleModal(player) {
    const team = league.teams[currentOwnerIdx];
    const initialSlots = getValidSlotsForPlayer(player, team?.id || 1);
    setSaleModal(player);
    setSaleTeam(team?.id || 1);
    setSaleSlot(initialSlots[0]?.slotIdx ?? null);
    setSalePrice(valuationCache[player.id]?.max_bid_recommendation || player.baseValue || "");
    setCustomPosInput("");
    setSelectedPlayer(player);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // openSaleModalForCell — opens sale modal pre-filled for a specific cell.
  // Called when a player is selected from the InlineCellSearch dropdown.
  //
  // @param {Object} player  - Player selected
  // @param {number} teamId  - Team ID of the clicked cell
  // @param {number} slotIdx - Slot index of the clicked cell
  // ─────────────────────────────────────────────────────────────────────────
  function openSaleModalForCell(player, teamId, slotIdx) {
    setActiveCellSearch(null);
    // Switch the active owner to the team being filled
    const ti = league.teams.findIndex((t) => t.id === teamId);
    if (ti >= 0) setCurrentOwnerIdx(ti);

    setSaleModal(player);
    setSaleTeam(teamId);
    setSaleSlot(slotIdx);     // pre-select the exact slot that was clicked
    setSalePrice(valuationCache[player.id]?.max_bid_recommendation || player.baseValue || "");
    setCustomPosInput("");
    setSelectedPlayer(player);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // confirmSale — validates and fires onSale with slotIndex + draftedPos.
  // Clears all modal state on success.
  // ─────────────────────────────────────────────────────────────────────────
  function confirmSale() {
    if (!saleModal || !salePrice || saleSlot == null) return;
    // The draftedPos is the position label of the selected slot
    // (could differ from player.pos[0] if going into UTIL or BN)
    const draftedPos = rosterPositions[saleSlot] || "BN";
    onSale(saleModal, +salePrice, saleTeam, saleSlot, draftedPos);
    setSaleModal(null);
    setSalePrice("");
    setSaleSlot(null);
    setCustomPosInput("");
    setSelectedPlayer(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // handleFilledCellClick — opens the remove confirmation modal.
  // ─────────────────────────────────────────────────────────────────────────
  function handleFilledCellClick(entry, teamId, pos, e) {
    e.stopPropagation();
    setActiveCellSearch(null); // close any open inline search
    setRemoveModal({ playerName: entry.name, teamId, price: entry.price, pos });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // handleEmptyCellClick — opens the inline cell search for this specific slot.
  // This lets the user search + add a player directly from the grid cell.
  // ─────────────────────────────────────────────────────────────────────────
  function handleEmptyCellClick(pos, teamId, slotIdx, e) {
    e.stopPropagation();
    // Toggle: clicking the same cell again closes it
    if (
      activeCellSearch?.teamId === teamId &&
      activeCellSearch?.slotIdx === slotIdx
    ) {
      setActiveCellSearch(null);
      return;
    }
    setActiveCellSearch({ teamId, slotIdx, pos });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // confirmRemove — removes a player and refunds budget.
  // ─────────────────────────────────────────────────────────────────────────
  function confirmRemove() {
    if (!removeModal) return;
    onUndoCell(removeModal.playerName, removeModal.teamId);
    setRemoveModal(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getBestAvailable — top undrafted player eligible for a position slot.
  // Used in hover tooltips on empty cells.
  // ─────────────────────────────────────────────────────────────────────────
  function getBestAvailable(pos) {
    if (pos === "BN" || pos === "UTIL") {
      return players.find((p) => !p.drafted) || null;
    }
    return players.find((p) => !p.drafted && p.pos.includes(pos)) || null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Filtered player list for the bottom search bar autocomplete.
  // ─────────────────────────────────────────────────────────────────────────
  const filteredPlayers = players.filter((p) => {
    if (p.drafted) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.team || "").toLowerCase().includes(q)) {
        return false;
      }
    }
    if (posFilter !== "ALL" && !p.pos.includes(posFilter)) return false;
    return true;
  });

  const myTeam  = league.teams[currentOwnerIdx];
  const slotsLeft = totalSlots - (myTeam?.roster?.length || 0);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="board-layout">

      {/* ════════════════════════════════════════════════════════════════════
          GRID + SEARCH (main/left area)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="board-main">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="board-header">
          <div>
            <h2 className="board-title">DRAFT LEAGUE TEAMS TABLE</h2>
            <span className="board-hint">
              Click filled cell to remove · click empty cell to search + add inline
            </span>
          </div>
          <button className="undo-btn" onClick={onUndo} title="Undo last recorded sale">
            ↩ Undo Last
          </button>
        </div>

        {/* ── Teams Grid ──────────────────────────────────────────────────── */}
        <div className="teams-table-wrap">
          <table className="teams-table">
            <thead>
              <tr>
                <th className="col-owner">OWNER</th>
                <th className="col-budget">$ LEFT</th>
                {rosterPositions.map((pos, i) => (
                  <th
                    key={i}
                    style={{ cursor: "pointer" }}
                    title={`Click to filter search to ${pos}`}
                    onClick={() => {
                      setPosFilter(pos === posFilter ? "ALL" : pos);
                      searchRef.current?.focus();
                    }}
                  >
                    <span
                      className="pos-badge-header"
                      style={{
                        background: posColor(pos),
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
                const isMe = ti === currentOwnerIdx;
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
                    {/* Owner label */}
                    <td className="col-owner">
                      {isMe && <span className="star">★ </span>}
                      {team.name}
                      {isMe && (
                        <div className="max-bid-mini">max bid ${teamMaxBid}</div>
                      )}
                    </td>

                    {/* Budget */}
                    <td
                      className="col-budget"
                      style={{
                        color:
                          team.budget_remaining > 50 ? "#22c55e"
                          : team.budget_remaining > 20 ? "#f59e0b"
                          : "#ef4444",
                      }}
                    >
                      ${team.budget_remaining}
                    </td>

                    {/* Roster slot cells */}
                    {rosterPositions.map((pos, si) => {
                      // ── KEY FIX: look up entry by slotIndex, not array index ──
                      // This ensures a drafted player stays in the correct column
                      // regardless of the order they were added to the roster array.
                      const entry = team.roster.find((r) => r.slotIndex === si);
                      const isHovered =
                        hoveredCell?.teamId === team.id && hoveredCell?.slotIdx === si;
                      const isCellSearchActive =
                        activeCellSearch?.teamId === team.id &&
                        activeCellSearch?.slotIdx === si;

                      if (entry) {
                        // ── FILLED CELL ────────────────────────────────────
                        const matchedPlayer = players.find((p) => p.name === entry.name);
                        const valueClass = getValueClass(entry.price, matchedPlayer?.baseValue);

                        return (
                          <td
                            key={si}
                            className={`roster-cell roster-cell-filled ${valueClass}`}
                            onClick={(e) => handleFilledCellClick(entry, team.id, pos, e)}
                            onMouseEnter={() =>
                              setHoveredCell({ teamId: team.id, slotIdx: si, entry, pos, matchedPlayer })
                            }
                            onMouseLeave={() => setHoveredCell(null)}
                            title={`${entry.name} · $${entry.price} · Click to remove`}
                            style={{ position: "relative" }}
                          >
                            <div className="roster-entry">
                              {entry.isKeeper && <span className="keeper-badge">K</span>}
                              <span className="roster-name">{entry.name}</span>
                              <div className="roster-price-row">
                                <span className="roster-price">${entry.price}</span>
                                {/* Show the position slot they were drafted into (not just pos[0]) */}
                                <span
                                  className="roster-drafted-pos"
                                  style={{ color: posColor(entry.draftedPos || pos) }}
                                >
                                  {entry.draftedPos || pos}
                                </span>
                                {matchedPlayer && valueClass === "value-steal" && (
                                  <span className="value-label steal" title="Great value!">▲</span>
                                )}
                                {matchedPlayer && valueClass === "value-overpaid" && (
                                  <span className="value-label overpaid" title="Overpaid">▼</span>
                                )}
                              </div>
                            </div>

                            {/* Hover tooltip */}
                            {isHovered && (
                              <div className="cell-tooltip">
                                <div className="ct-name">{entry.name}</div>
                                <div className="ct-row">
                                  <span className="ct-label">SLOT</span>
                                  <span className="ct-val" style={{ color: posColor(entry.draftedPos || pos) }}>
                                    {entry.draftedPos || pos}
                                  </span>
                                </div>
                                <div className="ct-row">
                                  <span className="ct-label">PAID</span>
                                  <span className="ct-val">${entry.price}</span>
                                </div>
                                {matchedPlayer && (
                                  <>
                                    <div className="ct-row">
                                      <span className="ct-label">VALUE</span>
                                      <span className="ct-val">${matchedPlayer.baseValue}</span>
                                    </div>
                                    <div className="ct-row">
                                      <span className="ct-label">FPTS</span>
                                      <span className="ct-val">{matchedPlayer.fpts}</span>
                                    </div>
                                  </>
                                )}
                                <div className="ct-hint">↩ Click to remove</div>
                              </div>
                            )}
                          </td>
                        );

                      } else {
                        // ── EMPTY CELL ─────────────────────────────────────
                        const bestAvail = isHovered ? getBestAvailable(pos) : null;

                        return (
                          <td
                            key={si}
                            className={`roster-cell roster-cell-empty ${isCellSearchActive ? "cell-active" : ""}`}
                            onClick={(e) => handleEmptyCellClick(pos, team.id, si, e)}
                            onMouseEnter={() =>
                              setHoveredCell({ teamId: team.id, slotIdx: si, entry: null, pos })
                            }
                            onMouseLeave={() => setHoveredCell(null)}
                            title={
                              isCellSearchActive
                                ? "Type to search players for this slot"
                                : `Empty ${pos} — click to search and add player`
                            }
                            style={{ position: "relative", minWidth: 80 }}
                          >
                            {isCellSearchActive ? (
                              /* ── Inline search box ─────────────────────── */
                              <InlineCellSearch
                                pos={pos}
                                teamId={team.id}
                                slotIdx={si}
                                players={players}
                                rosterPositions={rosterPositions}
                                getValidSlotsForPlayer={getValidSlotsForPlayer}
                                onSelect={(player) =>
                                  openSaleModalForCell(player, team.id, si)
                                }
                                onClose={() => setActiveCellSearch(null)}
                              />
                            ) : (
                              <>
                                <span className="roster-empty">–</span>

                                {/* Hover tooltip for empty cell */}
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
                                      ↓ Click to search inline
                                    </div>
                                  </div>
                                )}
                              </>
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

        {/* ── Bottom Search Bar ─────────────────────────────────────────────── */}
        <div className="search-bar-area">
          <div className="search-label-row">
            <span className="search-label">PLAYER SEARCH</span>
            <span className="search-hint">
              Search here or click an empty grid cell to add directly
            </span>
            <div className="pos-filters">
              {["ALL", "C", "1B", "2B", "3B", "SS", "OF", "SP", "RP"].map((p) => (
                <button
                  key={p}
                  className={`pos-filter ${posFilter === p ? "active" : ""}`}
                  onClick={() => setPosFilter(p)}
                >
                  {p}
                </button>
              ))}
              <span className="avail-count">{filteredPlayers.length} available</span>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <input
              ref={searchRef}
              className="search-input"
              placeholder={
                posFilter !== "ALL"
                  ? `Search ${posFilter} players…`
                  : "Search by name or team…"
              }
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setPosFilter("ALL"); setSearchQ(""); }
              }}
            />
            {searchQ && filteredPlayers.length > 0 && (
              <div className="search-dropdown">
                {filteredPlayers.slice(0, 8).map((p) => (
                  <SearchResult
                    key={p.id}
                    player={p}
                    onSelect={() => { setSelectedPlayer(p); setSearchQ(""); }}
                    onRecord={() => openSaleModal(p)}
                  />
                ))}
                {filteredPlayers.length > 8 && (
                  <div style={{ padding: "6px 12px", fontSize: 10, color: "var(--muted)" }}>
                    + {filteredPlayers.length - 8} more — refine search
                  </div>
                )}
              </div>
            )}
            {searchQ && filteredPlayers.length === 0 && (
              <div className="search-dropdown">
                <div style={{ padding: "12px", fontSize: 11, color: "var(--muted)" }}>
                  No available players match "{searchQ}"
                  {posFilter !== "ALL" && ` for ${posFilter}`}
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
        {/* Budget summary */}
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
            {selectedPlayer && (
              <button
                className="record-sale-btn"
                onClick={() => openSaleModal(selectedPlayer)}
              >
                RECORD SALE
              </button>
            )}
          </div>

          {selectedPlayer ? (
            <PlayerCard
              player={selectedPlayer}
              valuation={valuationCache[selectedPlayer?.id] ?? null}
              notes={notes}
              saveNote={saveNote}
            />
          ) : (
            <div className="cp-empty">
              Search below or click a grid cell to select a player
            </div>
          )}
        </div>

        {/* Recommendations */}
        <div className="recommendations">
          <div className="rec-header">
            TOP AVAILABLE{" "}
            <span className="rec-sub">{posFilter !== "ALL" ? posFilter : "Overall"}</span>
          </div>
          {recommendations
            .filter((p) => posFilter === "ALL" || p.pos.includes(posFilter))
            .slice(0, 4)
            .map((p) => (
              <div
                key={p.id}
                className="rec-row"
                onClick={() => setSelectedPlayer(p)}
              >
                <PlayerAvatar name={p.name} size={32} photoUrl={p.photoUrl} />
                <div className="rec-info">
                  <div className="rec-name">{p.name}</div>
                  <div className="rec-team">{p.team}</div>
                  <div className="rec-pos">
                    {p.pos.map((pos) => (
                      <span key={pos} className="pos-badge" style={{ background: posColor(pos) }}>
                        {pos}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rec-right">
                  <div className="rec-value green">${valuationCache[p.id]?.max_bid_recommendation ?? p.baseValue}</div>
                  <div className={`tier-badge ${p.tier?.toLowerCase()}`}>
                    {p.tier?.toUpperCase()}
                  </div>
                </div>
              </div>
            ))}
          {posFilter !== "ALL" &&
            recommendations.filter((p) => p.pos.includes(posFilter)).length === 0 &&
            recommendations.slice(0, 2).map((p) => (
              <div key={p.id} className="rec-row" onClick={() => setSelectedPlayer(p)}>
                <PlayerAvatar name={p.name} size={32} photoUrl={p.photoUrl} />
                <div className="rec-info">
                  <div className="rec-name">{p.name}</div>
                  <div className="rec-team">{p.team}</div>
                </div>
                <div className="rec-right">
                  <div className="rec-value green">${valuationCache[p.id]?.max_bid_recommendation ?? p.baseValue}</div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SALE MODAL
          Opened by: "Record Sale" button, search result, or inline cell search
      ════════════════════════════════════════════════════════════════════ */}
      {saleModal && (
        <div className="modal-overlay" onClick={() => setSaleModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>RECORD AUCTION SALE</h3>
            <p className="modal-player">{saleModal.name}</p>

            <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
              {saleModal.pos.map((p) => (
                <span key={p} className="pos-badge" style={{ background: posColor(p) }}>{p}</span>
              ))}
              <span className={`tier-badge ${saleModal.tier?.toLowerCase()}`}>
                {saleModal.tier?.toUpperCase()}
              </span>
            </div>

            {/* Winning team selector */}
            <div className="form-group">
              <label>WINNING TEAM</label>
              <select value={saleTeam} onChange={(e) => setSaleTeam(+e.target.value)}>
                {league.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (${t.budget_remaining} left)
                  </option>
                ))}
              </select>
            </div>

            {/* ── Position Slot Picker ─────────────────────────────────────── */}
            {/* Shows all empty roster slots this player is eligible to fill.    */}
            {/* Clicking a slot badge selects it. The sale places the player     */}
            {/* into the grid at that exact column position.                     */}
            <div className="form-group">
              <label>DRAFT INTO SLOT</label>
              {validSlotsForModal.length > 0 ? (
                <div className="slot-picker">
                  {validSlotsForModal.map(({ slotIdx, pos }) => (
                    <button
                      key={slotIdx}
                      type="button"
                      className={`slot-btn ${saleSlot === slotIdx ? "active" : ""}`}
                      onClick={() => setSaleSlot(slotIdx)}
                      title={`Slot ${slotIdx + 1}: ${pos}`}
                    >
                      <span
                        className="pos-badge"
                        style={{ background: posColor(pos), pointerEvents: "none" }}
                      >
                        {pos}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ color: "var(--red)", fontSize: 11, padding: "6px 0" }}>
                  ⚠ No eligible slots available for{" "}
                  {league.teams.find((t) => t.id === saleTeam)?.name}
                  — try a different team or add a custom position below.
                </div>
              )}

              {/* Custom eligibility override */}
              {/* Lets you temporarily grant a player eligibility at a position  */}
              {/* not in their database profile (e.g., multi-pos player listed    */}
              {/* only as OF but has 1B eligibility in your league).              */}
              <div className="custom-pos-row">
                <span className="custom-pos-label">Override/add eligibility:</span>
                <input
                  className="custom-pos-input"
                  value={customPosInput}
                  onChange={(e) => setCustomPosInput(e.target.value)}
                  placeholder="e.g. 2B or SS,3B"
                  title="Add custom position eligibility for this player"
                />
              </div>
            </div>

            {/* Bid amount */}
            <div className="form-group">
              <label>WINNING BID ($)</label>
              <input
                type="number"
                value={salePrice}
                min={1}
                onChange={(e) => setSalePrice(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") confirmSale(); }}
              />
            </div>

            {/* API / base value hint */}
            {valuationCache[saleModal?.id] && valuationCache[saleModal?.id] !== "loading" ? (
              <div className="modal-hint">
                API suggests: <strong>${valuationCache[saleModal?.id].max_bid_recommendation}</strong> max bid
                {valuationCache[saleModal?.id].true_dollar_value && <> · TDV: <strong>${valuationCache[saleModal?.id].true_dollar_value}</strong></>}
                {valuationCache[saleModal?.id].scarcity_tier && <> · {valuationCache[saleModal?.id].scarcity_tier}</>}
              </div>
            ) : (
              <div className="modal-hint">
                Base value: <strong>${saleModal.baseValue}</strong>
                {apiStatus !== "online" && " (API offline — using pre-calc value)"}
              </div>
            )}

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setSaleModal(null)}>
                Cancel
              </button>
              <button
                className="modal-confirm"
                onClick={confirmSale}
                disabled={!salePrice || saleSlot == null}
                title={saleSlot == null ? "Select a roster slot above" : ""}
              >
                {saleSlot == null
                  ? "Select a slot ↑"
                  : `Confirm Sale — $${salePrice} → ${rosterPositions[saleSlot]}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          REMOVE MODAL
      ════════════════════════════════════════════════════════════════════ */}
      {removeModal && (
        <div className="modal-overlay" onClick={() => setRemoveModal(null)}>
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
                Slot: <strong style={{ color: posColor(removeModal.pos) }}>
                  {removeModal.pos}
                </strong>
              </div>
              <div>
                Paid: <strong style={{ color: "var(--red)" }}>${removeModal.price}</strong>
              </div>
              <div style={{ marginTop: 6, color: "var(--green)" }}>
                ✓ Budget refunded: +${removeModal.price}
              </div>
              <div style={{ marginTop: 4 }}>Player returns to available pool.</div>
            </div>

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setRemoveModal(null)}>
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
// SearchResult — single row in the bottom search bar autocomplete dropdown
// ─────────────────────────────────────────────────────────────────────────────
function SearchResult({ player, onSelect, onRecord }) {
  return (
    <div
      className="search-result"
      onClick={onSelect}
      title={`View ${player.name}'s card`}
    >
      <PlayerAvatar name={player.name} size={28} photoUrl={player.photoUrl} />
      <span className="sr-name">{player.name}</span>
      <span className="sr-team">{player.team} · {player.league}</span>
      <div style={{ display: "flex", gap: 2 }}>
        {player.pos.map((pos) => (
          <span key={pos} className="pos-badge" style={{ background: posColor(pos) }}>
            {pos}
          </span>
        ))}
      </div>
      {player.fpts && (
        <span style={{ fontSize: 9, color: "var(--muted)" }}>{player.fpts}pts</span>
      )}
      <span className="sr-value">${player.baseValue}</span>
      <button
        className="sr-record"
        onClick={(e) => { e.stopPropagation(); onRecord(); }}
      >
        Record Sale
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InlineCellSearch — mini search box rendered directly inside an empty grid cell
//
// Shown when user clicks an empty cell. Provides an auto-focused input and a
// small dropdown of eligible players. Selecting a player opens the full sale
// modal pre-filled for this specific team and slot.
//
// @param {Object}    props
// @param {string}    props.pos                  - Position label for this slot
// @param {number}    props.teamId               - Team this cell belongs to
// @param {number}    props.slotIdx              - Slot index of this cell
// @param {Object[]}  props.players              - Full player array
// @param {string[]}  props.rosterPositions      - Ordered roster position labels
// @param {Function}  props.getValidSlotsForPlayer - Slot eligibility helper
// @param {Function}  props.onSelect             - (player) => void
// @param {Function}  props.onClose              - () => void
// ─────────────────────────────────────────────────────────────────────────────
function InlineCellSearch({
  pos,
  teamId,
  slotIdx,
  players,
  rosterPositions,
  getValidSlotsForPlayer,
  onSelect,
  onClose,
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  // Auto-focus input when dropdown appears
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Filter players eligible for this specific slot position
  // BN/UTIL slots show all undrafted players; others filter by pos eligibility.
  const results = players
    .filter((p) => {
      if (p.drafted) return false;
      // Filter by position eligibility for this slot type
      if (pos !== "BN" && pos !== "UTIL" && !p.pos.includes(pos)) return false;
      if (pos === "UTIL") {
        // UTIL: hitters only
        if (!p.pos.some((pp) => !["SP", "RP"].includes(pp))) return false;
      }
      // Text search if user has typed something
      if (q) {
        const lq = q.toLowerCase();
        if (!p.name.toLowerCase().includes(lq) && !(p.team || "").toLowerCase().includes(lq)) {
          return false;
        }
      }
      return true;
    })
    .slice(0, 6);

  return (
    // stopPropagation prevents the document click listener from closing this immediately
    <div
      className="cell-search-container"
      onClick={(e) => e.stopPropagation()}
      style={{ position: "relative" }}
    >
      {/* Mini input — fills the cell */}
      <input
        ref={inputRef}
        className="cell-search-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.stopPropagation(); onClose(); }
          // Enter selects first result
          if (e.key === "Enter" && results.length > 0) onSelect(results[0]);
        }}
        placeholder={`${pos}…`}
      />

      {/* Results dropdown */}
      {results.length > 0 && (
        <div className="cell-search-dropdown">
          {results.map((p) => (
            <div
              key={p.id}
              className="cell-search-result"
              // Use onMouseDown to fire before input blur closes the dropdown
              onMouseDown={(e) => { e.preventDefault(); onSelect(p); }}
            >
              <PlayerAvatar name={p.name} size={20} photoUrl={p.photoUrl} />
              <div className="csr-info">
                <span className="csr-name">{p.name}</span>
                <span className="csr-team">{p.team}</span>
              </div>
              <div style={{ display: "flex", gap: 2 }}>
                {p.pos.map((pp) => (
                  <span key={pp} className="pos-badge" style={{ background: posColor(pp), fontSize: 7 }}>
                    {pp}
                  </span>
                ))}
              </div>
              <span className="csr-value">${p.baseValue}</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && (
        <div className="cell-search-dropdown">
          <div className="csr-empty">
            {q
              ? `No ${pos === "BN" || pos === "UTIL" ? "" : pos + " "}players match "${q}"`
              : `No ${pos} players available`}
          </div>
        </div>
      )}
    </div>
  );
}
