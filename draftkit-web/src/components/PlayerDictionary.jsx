// ─────────────────────────────────────────────────────────────────────────────
// components/PlayerDictionary.jsx
//
// Browsable list of all players in the pool. Supports:
//  - Name / team text search
//  - Position filter buttons
//  - Tier filter buttons (Elite / Core / Depth)
//  - Toggle to show/hide drafted players
//  - Clicking a player loads their card in the right panel
//  - Inline note preview on each card
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import PlayerCard from "./PlayerCard.jsx";
import { TIERS } from "../constants.js";
import { posColor } from "../utils/helpers.js";
import { formatValuationSource } from "../utils/draftHistory.js";

/**
 * PlayerDictionary
 *
 * @param {Object}   props
 * @param {Object[]} props.players          - Full player array from API
 * @param {Object}   props.selectedPlayer   - Currently selected player (or null)
 * @param {Function} props.setSelectedPlayer - Sets the selected player
 * @param {Object}   props.notes            - { [playerId]: noteText }
 * @param {Function} props.saveNote         - (playerId, text) => void
 * @returns {JSX.Element}
 */
export default function PlayerDictionary({
  players,
  selectedPlayer,
  setSelectedPlayer,
  notes,
  favorites,
  saveNote,
  toggleFavorite,
  valuationCache, // shared valuation cache from App
  valuationLoading,
  requestValuation, // (player) => void
  draftStateKey, // changes on every pick/undo to trigger re-fetches
}) {
  // ── Filter state ──────────────────────────────────────────────────────────
  const [searchQ, setSearchQ] = useState(""); // text search
  const [posFilter, setPosFilter] = useState("ALL"); // position filter
  const [tierFilter, setTierFilter] = useState("ALL"); // tier filter
  const [showDrafted, setShowDrafted] = useState(false); // show drafted players
  const [hasNotesOnly, setHasNotesOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const rightPanelRef = useRef(null);

  function handleSelectPlayer(player) {
    if (!player) return;
    setSelectedPlayer(player);
  }

  // ── Valuation requests ────────────────────────────────────────────────────
  // Request valuation for the selected player whenever it changes or draft
  // state shifts (new pick/undo invalidates all cached values).
  useEffect(() => {
    if (selectedPlayer) requestValuation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayer?.id, draftStateKey]);

  useEffect(() => {
    if (!selectedPlayer) return;
    rightPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedPlayer?.id]);

  // ── Filtering Logic ───────────────────────────────────────────────────────
  // Apply all active filters to produce the visible player list
  const filtered = players
    .filter((p) => {
      const noteText = notes[p.id] || p.note;
      // Hide drafted players unless explicitly shown
      if (!showDrafted && p.drafted) return false;

      // Text search on name and team abbreviation
      if (searchQ) {
        const q = searchQ.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.team || "").toLowerCase().includes(q)
        )
          return false;
      }

      // Position filter — player must have this position in their eligibility list
      if (posFilter !== "ALL" && !p.pos.includes(posFilter)) return false;

      // Tier filter - must match exactly (Elite / Core / Depth)
      if (tierFilter !== "ALL" && p.tier !== tierFilter) return false;
      if (hasNotesOnly && !noteText) return false;
      if (favoritesOnly && !favorites?.[p.id]) return false;

      return true;
    })
    .sort((a, b) => {
      const aFavorite = favorites?.[a.id] ? 1 : 0;
      const bFavorite = favorites?.[b.id] ? 1 : 0;
      if (aFavorite !== bFavorite) return bFavorite - aFavorite;

      const aHasNote = notes?.[a.id] || a.note ? 1 : 0;
      const bHasNote = notes?.[b.id] || b.note ? 1 : 0;
      if (aHasNote !== bHasNote) return bHasNote - aHasNote;

      const aValue = a.baseValue ?? 0;
      const bValue = b.baseValue ?? 0;
      if (aValue !== bValue) return bValue - aValue;

      return a.name.localeCompare(b.name);
    });

  // ── Group By Tier ─────────────────────────────────────────────────────────
  // Organise filtered players into groups by tier for titled sections.
  // Uses TIERS constant to maintain consistent order (Elite -> Core -> Depth).
  const byTier = {};
  filtered.forEach((p) => {
    if (!byTier[p.tier]) byTier[p.tier] = [];
    byTier[p.tier].push(p);
  });

  function getDisplayedValuation(player) {
    if (!player) return null;
    const cached = valuationCache[player.id];
    if (cached) return cached;
    return valuationLoading ? "loading" : null;
  }

  return (
    <div className="dict-layout">
      {/* ── Main List ─────────────────────────────────────────────────────── */}
      <div className="dict-main">
        <h2 className="dict-title">PLAYER DICTIONARY</h2>
        <p className="dict-sub">
          Browse the full pool of available players · Click a player to show
          their card · Add notes to player cards at any time
        </p>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="dict-filters">
          {/* Text search */}
          <input
            className="dict-search"
            placeholder="Search name or team…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />

          {/* Position + Tier + Drafted toggle row */}
          <div className="filter-row">
            {/* Position filters */}
            {["ALL", "C", "1B", "2B", "3B", "SS", "OF", "SP", "RP", "DH"].map(
              (p) => (
                <button
                  key={p}
                  className={`pos-filter ${posFilter === p ? "active" : ""}`}
                  onClick={() => setPosFilter(p)}
                >
                  {p}
                </button>
              ),
            )}

            <span className="divider">|</span>

            {/* Tier filters */}
            {["ALL", ...TIERS].map((t) => (
              <button
                key={t}
                className={`tier-filter ${tierFilter === t ? "active" : ""}`}
                onClick={() => setTierFilter(t)}
              >
                {t}
              </button>
            ))}

            {/* Show drafted toggle */}
            <label className="drafted-toggle">
              <input
                type="checkbox"
                checked={showDrafted}
                onChange={(e) => setShowDrafted(e.target.checked)}
              />{" "}
              Show Drafted
            </label>

            <button
              className={`notes-filter-btn ${hasNotesOnly ? "active" : ""}`}
              onClick={() => setHasNotesOnly((prev) => !prev)}
            >
              Has Notes
            </button>

            <button
              className={`notes-filter-btn ${favoritesOnly ? "active" : ""}`}
              onClick={() => setFavoritesOnly((prev) => !prev)}
            >
              Favorites
            </button>

            {/* Result count */}
            <span className="avail-count">{filtered.length} players</span>
          </div>
        </div>

        {filtered.length === 0 && (
          <div
            className="cp-empty dict-empty-state"
            style={{ marginBottom: 16 }}
          >
            <div className="dict-empty-title">
              {favoritesOnly
                ? "No favorite players match this view"
                : "No players match the current filters"}
            </div>
            <div className="dict-empty-copy">
              {favoritesOnly
                ? "Star a player from the dictionary, board, or player card to keep them in your favorites list."
                : "Try clearing one of the filters or broadening the search."}
            </div>
          </div>
        )}

        {/* ── Player Grid — grouped by tier ────────────────────────────── */}
        {TIERS.map((tier) => {
          const group = byTier[tier] || [];
          if (group.length === 0) return null;

          return (
            <div key={tier} className="tier-group">
              {/* Tier header row */}
              <div className={`tier-label-row ${tier.toLowerCase()}`}>
                {tier.toUpperCase()}
                <span className="tier-count">{group.length}</span>
              </div>

              {/* Grid of player cards */}
              <div className="player-grid">
                {group.map((p) => (
                  <DictCard
                    key={p.id}
                    player={p}
                    isSelected={selectedPlayer?.id === p.id}
                    note={notes[p.id] || p.note}
                    isFavorite={Boolean(favorites?.[p.id])}
                    liveValue={valuationCache[p.id]?.max_bid_recommendation}
                    valueLoading={valuationLoading && !valuationCache[p.id]}
                    onToggleFavorite={() => toggleFavorite(p.id)}
                    onClick={() => handleSelectPlayer(p)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Right Panel: Selected Player Card ─────────────────────────────── */}
      <div className="right-panel dict-right-panel">
        <div className="panel-section-label">PLAYER CARD</div>
        <div className="right-panel-body dict-card-scroll" ref={rightPanelRef}>
          {selectedPlayer ? (
            <PlayerCard
              player={selectedPlayer}
              valuation={getDisplayedValuation(selectedPlayer)}
              notes={notes}
              favorites={favorites}
              saveNote={saveNote}
              toggleFavorite={toggleFavorite}
            />
          ) : (
            <div className="cp-empty dict-empty-state">
              <div className="dict-empty-title">Select a player to view card</div>
              <div className="dict-empty-copy">
                Use search, filters, or the notes-only toggle to jump to players
                you already marked up.
              </div>
              <div className="dict-empty-meta">
                {filtered.length} players currently visible
              </div>
            </div>
          )}

          {/* Recommended players — top 4 undrafted in current filter */}
          <div className="recommendations">
            <div className="rec-header">
              TOP AVAILABLE{" "}
              <span className="rec-sub">
                {posFilter !== "ALL" ? posFilter : "All Positions"}
              </span>
            </div>
            {players
              .filter((p) => !p.drafted)
              .filter((p) => posFilter === "ALL" || p.pos.includes(posFilter))
              .slice(0, 4)
              .map((p) => (
                <div
                  key={p.id}
                  className="rec-row"
                  onClick={() => handleSelectPlayer(p)}
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
                    <div className="rec-value green">
                      $
                      {valuationCache[p.id]?.max_bid_recommendation ??
                        p.baseValue}
                    </div>
                    <div className={`tier-badge ${p.tier?.toLowerCase()}`}>
                      {p.tier?.toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DictCard — internal sub-component for a single player card in the grid
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DictCard
 *
 * A single clickable card in the player dictionary grid.
 * Shows name, team, positions, value, API news status, and a note preview.
 *
 * @param {Object}   props
 * @param {Object}   props.player     - Player object
 * @param {boolean}  props.isSelected - Whether this card is currently selected
 * @param {string}   props.note       - Note text (from notes map or player.note)
 * @param {Function} props.onClick    - Click handler
 */
function DictCard({
  player,
  isSelected,
  note,
  isFavorite,
  liveValue,
  valueLoading,
  onClick,
  onToggleFavorite,
}) {
  // Dictionary cards are often scanned quickly, so the chip clarifies whether
  // the displayed dollar amount is a live API max bid or only the base pool value.
  const valueSource =
    liveValue != null ? "live_api" : valueLoading ? "refreshing" : "base_value";
  const valueSourceLabel = formatValuationSource(valueSource);
  const displayValue =
    liveValue != null ? `$${liveValue}` : valueLoading ? "$..." : `$${player.baseValue}`;

  return (
    <div
      className={`dict-card ${isSelected ? "selected" : ""} ${player.drafted ? "drafted" : ""}`}
      onClick={onClick}
      title={
        player.drafted
          ? player.minorLeague
            ? `Protected on Team ${player.draftedBy}'s minor league roster`
            : `Drafted by Team ${player.draftedBy}`
          : "Click to view card"
      }
    >
      {/* Top row: name/team/pos + value */}
      <div className="dc-top">
        <div className="dc-main">
          <PlayerAvatar
            name={player.name}
            size={34}
            photoUrl={player.photoUrl}
          />
          <div className="dc-copy">
            <div className="dc-name">{player.name}</div>
            <div className="dc-team">
              {player.team} · {player.league}
            </div>
            <div className="dc-badges-row">
              {player.pos.map((pos) => (
                <span
                  key={pos}
                  className="pos-badge"
                  style={{ background: posColor(pos) }}
                >
                  {pos}
                </span>
              ))}
              {player.fpts ? (
                <span className="dc-fpts-inline">{player.fpts} FPTS</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="dc-top-right">
          <button
            type="button"
            className={`favorite-btn compact ${isFavorite ? "active" : ""}`}
            aria-label={isFavorite ? `Unfavorite ${player.name}` : `Favorite ${player.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            title={isFavorite ? "Remove favorite" : "Favorite this player"}
          >
            ★
          </button>
          <div className="dc-value green">
            {displayValue}
            <span className={`dc-value-source ${valueSource}`}>
              {valueSourceLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Valuation API alert preview. Draft Kit cards do not manufacture local news. */}
      {player.news_headline && <div className="dc-injury">API alert: {player.news_headline}</div>}

      {/* Note preview (truncated) */}
      {note && (
        <div className="dc-note">
          <span className="dc-note-icon">✎</span>
          {note.length > 55 ? note.slice(0, 55) + "…" : note}
        </div>
      )}

      {/* Drafted overlay badge */}
      {player.drafted && (
        <div className="dc-drafted">
          {player.minorLeague ? "PROSPECT" : "DRAFTED"}
        </div>
      )}
      {note && <div className="dc-note-dot" />}
    </div>
  );
}
