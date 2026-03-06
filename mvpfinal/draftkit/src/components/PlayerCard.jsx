// ─────────────────────────────────────────────────────────────────────────────
// components/PlayerCard.jsx
//
// Displays a detailed player card in the right panel. Shows:
//   - Team, league, and tier badge
//   - Avatar (photo or initials) + name + positions + max bid
//   - Key stats (batting or pitching depending on player type)
//   - Injury alert if present
//   - API reasoning text from the valuation engine
//   - Personal notes textarea (auto-saves on blur)
//
// This component is used in both DraftBoard and PlayerDictionary.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { posColor, formatStat } from "../utils/helpers.js";

/**
 * PlayerCard
 *
 * Renders the detailed card for a selected player in the right panel.
 * Displays stats, valuation data, and an editable notes field.
 *
 * @param {Object}        props
 * @param {Object}        props.player    - Player object from players.json / API
 * @param {Object|"loading"|null} props.valuation - API valuation result, "loading" string, or null
 * @param {Object}        props.notes     - Map of { [playerId]: noteText }
 * @param {Function}      props.saveNote  - Callback: (playerId, text) => void
 * @returns {JSX.Element}
 */
export default function PlayerCard({ player, valuation, notes, saveNote }) {
  // Local note text mirrors the stored note but allows typing without re-renders
  const [localNote, setLocalNote] = useState("");

  // Sync local note when the selected player changes
  useEffect(() => {
    setLocalNote(notes?.[player.id] ?? player.note ?? "");
  }, [player.id, notes]);

  // ── Max Bid Display ───────────────────────────────────────────────────────
  // Priority: API recommendation → player's pre-calculated base value
  // "loading" string triggers a "…" placeholder while the API is fetching.
  const maxBid =
    valuation === "loading"
      ? "…"
      : valuation?.max_bid_recommendation ?? player.baseValue;

  // ── Pitcher vs. Hitter detection ────────────────────────────────────────
  // Players with non-null era values are pitchers.
  // The NL-only CSV data doesn't include pitcher batting stats, so this also
  // handles two-way-player edge cases (e.g. Ohtani has both SP and batting stats).
  const isPitcher = player.era !== null && player.era !== undefined;

  // ── Stats to display ─────────────────────────────────────────────────────
  // Show 3 key stats relevant to the player's type. We display at most 3.
  const rawStats = isPitcher
    ? [
        { label: "ERA",  val: player.era  },
        { label: "SO",   val: player.so   },
        { label: "WHIP", val: player.whip },
      ]
    : [
        { label: "HR",  val: player.hr  },
        { label: "RBI", val: player.rbi },
        { label: "SB",  val: player.sb  },
      ];

  // Append AVG for hitters that have it (most will)
  if (!isPitcher && player.avg) {
    rawStats.push({ label: "AVG", val: player.avg });
  }

  // Format for display and limit to 3 visible stats
  const displayStats = rawStats
    .slice(0, 3)
    .map((s) => ({ ...s, val: formatStat(s.val, s.label) }));

  // ── API Scarcity Label ─────────────────────────────────────────────────
  // Build a human-readable scarcity badge from the API response.
  const scarcityLabel =
    valuation && valuation !== "loading" && valuation.position_scarcity
      ? Object.values(valuation.position_scarcity)[0]
      : null;

  return (
    <div className="player-card">

      {/* ── Header: team / league + tier badge ─────────────────────────── */}
      <div className="pc-header">
        <div className="pc-team-league">
          {player.team} · {player.league} LEAGUE
        </div>
        <span className={`tier-badge ${player.tier?.toLowerCase()}`}>
          {player.tier?.toUpperCase()}
        </span>
      </div>

      {/* ── Main: avatar + name + positions + max bid ──────────────────── */}
      {/*
        ▶ REAL PHOTO INTEGRATION:
        The PlayerAvatar component reads the `photoUrl` field from the player
        object. Set player.photoUrl in players.json to show a real headshot.
        See components/PlayerAvatar.jsx for detailed instructions.
      */}
      <div className="pc-main">
        <PlayerAvatar
          name={player.name}
          size={52}
          photoUrl={player.photoUrl || null}  // ← real photo if available
        />
        <div className="pc-info">
          <div className="pc-name">{player.name}</div>

          {/* Position eligibility badges */}
          <div className="pc-badges">
            {player.pos.map((p) => (
              <span
                key={p}
                className="pos-badge"
                style={{ background: posColor(p) }}
              >
                {p}
              </span>
            ))}
          </div>

          {/* Max bid (from API or base value) */}
          <div className="pc-maxbid">
            <span className="pc-bid-val">${maxBid}</span>
            <span className="pc-bid-label"> MAX BID</span>
          </div>
        </div>
      </div>

      {/* ── Key Stats ───────────────────────────────────────────────────── */}
      <div className="pc-section-label">
        {valuation === "loading" ? "FETCHING VALUATION…" : "STATISTICS"}
      </div>
      <div className="pc-stats">
        {displayStats.map((s) => (
          <div key={s.label} className="pc-stat">
            <div className="pcs-label">{s.label}</div>
            <div className="pcs-val">{s.val}</div>
          </div>
        ))}
      </div>

      {/* ── FPTS (fantasy points) ─────────────────────────────────────── */}
      {player.fpts != null && (
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: -4 }}>
          Projected FPTS: <strong style={{ color: "var(--white)" }}>{player.fpts}</strong>
          {" "}· Base Value: <strong style={{ color: "var(--green)" }}>${player.baseValue}</strong>
        </div>
      )}

      {/* ── Injury Alert ────────────────────────────────────────────────── */}
      {player.injury && (
        <div className="pc-injury">⚠ {player.injury}</div>
      )}

      {/* ── API Valuation Reasoning ─────────────────────────────────────── */}
      {/* Shown when the dark blue valuation API returns a reasoning string */}
      {valuation && valuation !== "loading" && valuation.reasoning && (
        <div className="pc-news">
          <span className="news-tag">[API]</span>
          {" "}{valuation.reasoning}
          {scarcityLabel && (
            <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: "var(--yellow)" }}>
              · {player.pos[0]} SCARCITY: {scarcityLabel}
            </span>
          )}
        </div>
      )}

      {/* ── Scout Note (fallback when no API) ───────────────────────────── */}
      {!valuation && player.note && (
        <div className="pc-news">
          <span className="news-tag">[NOTE]</span> {player.note}
        </div>
      )}

      {/* ── Position Eligibility ─────────────────────────────────────────── */}
      <div className="pc-section-label">ELIGIBILITY</div>
      <div className="pc-badges" style={{ marginBottom: 6 }}>
        {player.pos.map((p) => (
          <span
            key={p}
            className="pos-badge"
            style={{ background: posColor(p) }}
          >
            {p}
          </span>
        ))}
        {player.depth && (
          <span className="depth-badge">{player.depth}</span>
        )}
      </div>

      {/* ── Personal Notes ───────────────────────────────────────────────── */}
      {/* Notes are stored by player ID in the App's `notes` state map.
          They persist across tab switches within the session (not persisted
          to localStorage yet — future enhancement). */}
      <div className="pc-section-label">MY NOTES</div>
      <textarea
        className="pc-notes"
        value={localNote}
        onChange={(e) => setLocalNote(e.target.value)}
        onBlur={() => saveNote(player.id, localNote)} // save on blur (focus loss)
        placeholder="Add a scouting note…"
      />
    </div>
  );
}
