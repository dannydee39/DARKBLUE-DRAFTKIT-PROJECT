// ─────────────────────────────────────────────────────────────────────────────
// components/PlayerDictionary.jsx
//
// Browsable list of all players in the pool. Supports:
//  - Name / team text search
//  - Position filter buttons
//  - Tier filter buttons (Elite / Starter / Bench)
//  - Toggle to show/hide drafted players
//  - Clicking a player loads their card in the right panel
//  - Inline note preview on each card
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import PlayerCard from "./PlayerCard.jsx";
import { TIERS } from "../constants.js";
import { posColor } from "../utils/helpers.js";

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
  saveNote,
  valuationCache,    // shared valuation cache from App
  requestValuation,  // (player) => void
  draftStateKey,     // changes on every pick/undo to trigger re-fetches
}) {
  // ── Filter state ──────────────────────────────────────────────────────────
  const [searchQ, setSearchQ]       = useState("");     // text search
  const [posFilter, setPosFilter]   = useState("ALL");  // position filter
  const [tierFilter, setTierFilter] = useState("ALL");  // tier filter
  const [showDrafted, setShowDrafted] = useState(false); // show drafted players

  // ── Valuation requests ────────────────────────────────────────────────────
  // Request valuation for the selected player whenever it changes or draft
  // state shifts (new pick/undo invalidates all cached values).
  useEffect(() => {
    if (selectedPlayer) requestValuation(selectedPlayer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayer?.id, draftStateKey]);

  // Pre-fetch valuations for the top 4 available players so the recommendation
  // panel and DictCards show live values instead of base values.
  useEffect(() => {
    players.filter((p) => !p.drafted).slice(0, 4).forEach((p) => requestValuation(p));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStateKey]);

  // ── Filtering Logic ───────────────────────────────────────────────────────
  // Apply all active filters to produce the visible player list
  const filtered = players.filter((p) => {
    // Hide drafted players unless explicitly shown
    if (!showDrafted && p.drafted) return false;

    // Text search on name and team abbreviation
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (
        !p.name.toLowerCase().includes(q) &&
        !(p.team || "").toLowerCase().includes(q)
      ) return false;
    }

    // Position filter — player must have this position in their eligibility list
    if (posFilter !== "ALL" && !p.pos.includes(posFilter)) return false;

    // Tier filter — must match exactly (Elite / Starter / Bench)
    if (tierFilter !== "ALL" && p.tier !== tierFilter) return false;

    return true;
  });

  // ── Group By Tier ─────────────────────────────────────────────────────────
  // Organise filtered players into groups by tier for titled sections.
  // Uses TIERS constant to maintain consistent order (Elite → Starter → Bench).
  const byTier = {};
  filtered.forEach((p) => {
    if (!byTier[p.tier]) byTier[p.tier] = [];
    byTier[p.tier].push(p);
  });

  return (
    <div className="dict-layout">

      {/* ── Main List ─────────────────────────────────────────────────────── */}
      <div className="dict-main">
        <h2 className="dict-title">PLAYER DICTIONARY</h2>
        <p className="dict-sub">
          Browse full pool · click for card · add scouting notes anytime
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
              )
            )}

            <span className="divider">|</span>

            {/* Tier filters */}
            {["ALL", "Elite", "Starter", "Bench"].map((t) => (
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
              />
              {" "}Show Drafted
            </label>

            {/* Result count */}
            <span className="avail-count">{filtered.length} players</span>
          </div>
        </div>

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
                    liveValue={valuationCache[p.id]?.max_bid_recommendation}
                    onClick={() => setSelectedPlayer(p)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Right Panel: Selected Player Card ─────────────────────────────── */}
      <div className="right-panel">
        <div className="panel-section-label">PLAYER CARD</div>
        {selectedPlayer ? (
          <PlayerCard
            player={selectedPlayer}
            valuation={valuationCache[selectedPlayer?.id] ?? null}
            notes={notes}
            saveNote={saveNote}
          />
        ) : (
          <div className="cp-empty">Select a player to view card</div>
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
                onClick={() => setSelectedPlayer(p)}
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
                  <div className="rec-value green">${valuationCache[p.id]?.max_bid_recommendation ?? p.baseValue}</div>
                  <div className={`tier-badge ${p.tier?.toLowerCase()}`}>
                    {p.tier?.toUpperCase()}
                  </div>
                </div>
              </div>
            ))}
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
 * Shows name, team, positions, value, injury, and a note preview.
 *
 * @param {Object}   props
 * @param {Object}   props.player     - Player object
 * @param {boolean}  props.isSelected - Whether this card is currently selected
 * @param {string}   props.note       - Note text (from notes map or player.note)
 * @param {Function} props.onClick    - Click handler
 */
function DictCard({ player, isSelected, note, liveValue, onClick }) {
  return (
    <div
      className={`dict-card ${isSelected ? "selected" : ""} ${player.drafted ? "drafted" : ""}`}
      onClick={onClick}
      title={player.drafted ? `Drafted by Team ${player.draftedBy}` : "Click to view card"}
    >
      {/* Top row: name/team/pos + value */}
      <div className="dc-top">
        <div>
          <div className="dc-name">{player.name}</div>
          <div className="dc-team">{player.team} · {player.league}</div>
          <div className="dc-badges">
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
        </div>
        <div className="dc-value green">${liveValue ?? player.baseValue}</div>
      </div>

      {/* FPTS micro-display */}
      {player.fpts && (
        <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 3 }}>
          {player.fpts} FPTS
        </div>
      )}

      {/* Injury flag */}
      {player.injury && (
        <div className="dc-injury">⚠ {player.injury}</div>
      )}

      {/* Note preview (truncated) */}
      {note && (
        <div className="dc-note">
          Note: {note.length > 40 ? note.slice(0, 40) + "…" : note}
        </div>
      )}

      {/* Drafted overlay badge */}
      {player.drafted && <div className="dc-drafted">DRAFTED</div>}
    </div>
  );
}
