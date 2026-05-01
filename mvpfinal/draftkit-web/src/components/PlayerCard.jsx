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

import { useState, useEffect, useRef } from "react";
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
export default function PlayerCard({
  player,
  valuation,
  notes,
  favorites,
  saveNote,
  toggleFavorite,
  previewMode = false,
}) {
  // Local note text mirrors the stored note but allows typing without re-renders
  const [localNote, setLocalNote] = useState("");
  const [savedPulse, setSavedPulse] = useState(false);
  const previousPlayerIdRef = useRef(player.id);
  const previousStoredNoteRef = useRef(notes?.[player.id] ?? player.note ?? "");
  const valuationFailed = Boolean(
    valuation &&
    valuation !== "loading" &&
    valuation.error
  );

  // Sync local note when the selected player changes
  useEffect(() => {
    const nextStoredNote = notes?.[player.id] ?? player.note ?? "";
    if (!previewMode && previousPlayerIdRef.current !== player.id) {
      const previousNote = previousStoredNoteRef.current;
      if (localNote !== previousNote) {
        saveNote(previousPlayerIdRef.current, localNote);
      }
    }

    previousPlayerIdRef.current = player.id;
    previousStoredNoteRef.current = nextStoredNote;
    setLocalNote(nextStoredNote);
    setSavedPulse(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id, previewMode]);

  useEffect(() => {
    const nextStoredNote = notes?.[player.id] ?? player.note ?? "";
    if (
      previousPlayerIdRef.current === player.id &&
      localNote === previousStoredNoteRef.current
    ) {
      setLocalNote(nextStoredNote);
    }
    previousStoredNoteRef.current = nextStoredNote;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, player.id]);

  useEffect(() => {
    if (!savedPulse) return;
    const timeoutId = window.setTimeout(() => setSavedPulse(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [savedPulse]);

  // ── Max Bid Display ───────────────────────────────────────────────────────
  // Priority: API recommendation → player's pre-calculated base value
  // "loading" string triggers a "…" placeholder while the API is fetching.
  const maxBid =
    valuation === "loading"
      ? "…"
      : valuationFailed
      ? player.baseValue
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
  const updateContext =
    player.latest_update ||
    (valuation && valuation !== "loading" ? valuation.player_update : null);
  const riskLevel =
    player.risk_level ||
    (valuation && valuation !== "loading" ? valuation.risk_level : null) ||
    "LOW";
  const injuryStatus =
    player.injury_status ||
    (valuation && valuation !== "loading" ? valuation.injury_status : null) ||
    player.injury;
  const updateHeadline =
    player.news_headline ||
    updateContext?.headline ||
    (valuation && valuation !== "loading" ? valuation.news_headline : null);
  const riskAdjustmentDelta =
    valuation && valuation !== "loading"
      ? Number(valuation.risk_adjustment?.max_bid_delta_percent || 0)
      : 0;
  const updateImpact =
    player.update_impact_summary ||
    updateContext?.impact_summary ||
    (riskAdjustmentDelta
      ? `${Math.abs(riskAdjustmentDelta)}% risk adjustment applied.`
      : null);

  const storedNote = notes?.[player.id] ?? player.note ?? "";
  const isDirty = localNote !== storedNote;

  function handleSaveNote() {
    if (previewMode) return;
    saveNote(player.id, localNote);
    setSavedPulse(true);
  }

  return (
    <div className={`player-card ${previewMode ? "preview-mode" : ""}`}>

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
          <div className="pc-name-row">
            <div className="pc-name">{player.name}</div>
            <button
              type="button"
              className={`favorite-btn compact ${favorites?.[player.id] ? "active" : ""}`}
              onClick={() => !previewMode && toggleFavorite(player.id)}
              disabled={previewMode}
              title={favorites?.[player.id] ? "Remove favorite" : "Favorite this player"}
            >
              ★
            </button>
          </div>

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
            {player.depth && <span className="depth-badge">{player.depth}</span>}
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

      {player.minorLeague && (
        <div className="pc-news">
          <span className="news-tag">[MiLB]</span>{" "}
          Protected on a minor league roster. This player is unavailable for
          auction picks until released or transferred by the commissioner.
        </div>
      )}

      {/* ── Live Update Alert ───────────────────────────────────────────── */}
      {(injuryStatus || updateHeadline) && (
        <div className={`pc-risk-panel risk-${String(riskLevel).toLowerCase()}`}>
          <div className="pc-risk-top">
            <span className="pc-risk-label">LIVE UPDATE</span>
            <span className="pc-risk-level">{riskLevel} RISK</span>
          </div>
          {injuryStatus && (
            <div className="pc-risk-status">Status: {injuryStatus}</div>
          )}
          {updateHeadline && (
            <div className="pc-risk-headline">{updateHeadline}</div>
          )}
          {updateImpact && (
            <div className="pc-risk-impact">{updateImpact}</div>
          )}
        </div>
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

      {valuationFailed && (
        <div className="pc-news">
          <span className="news-tag">[API]</span>{" "}
          {valuation.message || "Live valuation was unavailable. Showing the base value instead."}
        </div>
      )}

      {/* ── Scout Note (fallback when no API) ───────────────────────────── */}
      {!valuation && player.note && (
        <div className="pc-news">
          <span className="news-tag">[NOTE]</span> {player.note}
        </div>
      )}

      {/* ── Personal Notes ───────────────────────────────────────────────── */}
      {/* Notes are stored by player ID in the App's `notes` state map.
          They persist across tab switches within the session (not persisted
          to localStorage yet — future enhancement). */}
      <div className="pc-section-label pc-notes-header">
        <span>{previewMode ? "NOTES PREVIEW" : "MY NOTES"}</span>
        {savedPulse && !previewMode && <span className="pc-saved-indicator">✓ Saved</span>}
      </div>
      {previewMode ? (
        <div className="pc-preview-note">
          {storedNote || "Hovering a player previews the card here. Click to pin and edit notes."}
        </div>
      ) : (
        <>
          <textarea
            className="pc-notes"
            value={localNote}
            onChange={(e) => setLocalNote(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && isDirty) {
                e.preventDefault();
                handleSaveNote();
              }
            }}
            onBlur={() => {
              if (isDirty) handleSaveNote();
            }}
            rows={5}
            placeholder="Add a scouting note…"
          />
          <div className="pc-note-actions">
            {isDirty ? (
              <button
                type="button"
                className="record-sale-btn pc-save-note-btn"
                onClick={handleSaveNote}
              >
                Save Note
              </button>
            ) : (
              <span className="pc-note-status">{localNote ? "Notes synced" : "No note yet"}</span>
            )}
            {localNote && (
              <button
                type="button"
                className="pc-clear-note-btn"
                onClick={() => {
                  setLocalNote("");
                  saveNote(player.id, "");
                  setSavedPulse(true);
                }}
              >
                Clear note
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
