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
import { getPlayerVolumeProjection } from "../utils/teamInsights.js";
import {
  formatAdjustmentPercent,
  formatValuationSource,
  getValuationSource,
  makeValuationSnapshot,
} from "../utils/draftHistory.js";

const HITTER_STAT_META = {
  R: { key: "r", label: "Runs", benchmark: 90 },
  HR: { key: "hr", label: "Power", benchmark: 32 },
  RBI: { key: "rbi", label: "RBI", benchmark: 95 },
  SB: { key: "sb", label: "Speed", benchmark: 28 },
  AVG: { key: "avg", label: "Average", benchmark: 0.28, baseline: 0.22 },
};

const PITCHER_STAT_META = {
  W: { key: "w", label: "Wins", benchmark: 14 },
  SV: { key: "sv", label: "Saves", benchmark: 32 },
  SO: { key: "so", label: "Strikeouts", benchmark: 185 },
  ERA: { key: "era", label: "ERA", benchmark: 3.6, lowerIsBetter: true },
  WHIP: { key: "whip", label: "WHIP", benchmark: 1.18, lowerIsBetter: true },
};

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeCategoryList(categories, isPitcher) {
  const meta = isPitcher ? PITCHER_STAT_META : HITTER_STAT_META;
  const defaults = isPitcher ? ["W", "SV", "SO", "ERA", "WHIP"] : ["R", "HR", "RBI", "SB", "AVG"];
  const normalized = (Array.isArray(categories) ? categories : [])
    .map((category) => String(category || "").trim().toUpperCase())
    .filter((category) => meta[category]);
  return normalized.length ? normalized : defaults;
}

function scoreStat(value, meta) {
  const numeric = numberOrNull(value);
  if (numeric == null) return 0;
  if (meta.lowerIsBetter) {
    return Math.min(Math.max(meta.benchmark / Math.max(numeric, 0.01), 0), 1.4);
  }
  if (meta.baseline != null) {
    return Math.min(Math.max((numeric - meta.baseline) / (meta.benchmark - meta.baseline), 0), 1.4);
  }
  return Math.min(Math.max(numeric / meta.benchmark, 0), 1.4);
}

function statTone(score) {
  if (score >= 1.05) return "strength";
  if (score >= 0.78) return "useful";
  return "weakness";
}

function statSummary(score) {
  if (score >= 1.05) return "Strong driver";
  if (score >= 0.78) return "Counts well";
  return "Needs help";
}

function buildStatRows(player, isPitcher, activeCategories) {
  const meta = isPitcher ? PITCHER_STAT_META : HITTER_STAT_META;
  return normalizeCategoryList(activeCategories, isPitcher).map((category) => {
    const stat = meta[category];
    const rawValue = player[stat.key];
    const score = scoreStat(rawValue, stat);
    return {
      category,
      label: stat.label,
      value: formatStat(rawValue, category),
      tone: statTone(score),
      summary: statSummary(score),
    };
  });
}

function impactTone(multiplier) {
  const numeric = numberOrNull(multiplier);
  if (numeric == null) return "neutral";
  if (numeric >= 1.025) return "positive";
  if (numeric <= 0.975) return "negative";
  return "neutral";
}

function impactLabel(multiplier) {
  const tone = impactTone(multiplier);
  const percent = formatAdjustmentPercent(multiplier);
  if (!percent) return "No adjustment";
  if (tone === "positive") return `Boost ${percent}`;
  if (tone === "negative") return `Penalty ${percent}`;
  return "Neutral";
}

function readableBand(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function listText(values, fallback = "not specified") {
  const cleaned = (Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return cleaned.length ? cleaned.join(", ") : fallback;
}

function buildValuationDrivers({
  player,
  valuation,
  valuationSnapshot,
  statRows,
  volumeProjection,
  riskLevel,
  injuryStatus,
}) {
  if (!valuationSnapshot || !valuation || valuation === "loading" || valuation.error) {
    return [];
  }

  const scoringAdjustment = valuation.scoring_adjustment || {};
  const scarcityDetail =
    valuation.position_scarcity && typeof valuation.position_scarcity === "object"
      ? Object.entries(valuation.position_scarcity)[0]
      : null;
  const predictiveAdjustment = valuation.predictive_adjustment || {};
  const ageAdjustment = valuation.age_adjustment || {};
  const depthAdjustment = valuation.depth_chart_adjustment || {};
  const riskAdjustment = valuation.risk_adjustment || {};
  const strongestStats = statRows
    .filter((row) => row.tone === "strength")
    .map((row) => row.category)
    .slice(0, 3);
  const weakerStats = statRows
    .filter((row) => row.tone === "weakness")
    .map((row) => row.category)
    .slice(0, 3);
  const scoringDetail = [
    `League categories: ${listText(scoringAdjustment.active_categories)}`,
    strongestStats.length ? `Strengths: ${strongestStats.join(", ")}` : "",
    weakerStats.length ? `Watch: ${weakerStats.join(", ")}` : "",
  ].filter(Boolean).join(" · ");
  const predictiveDetail = [
    predictiveAdjustment.source && predictiveAdjustment.source !== "none"
      ? predictiveAdjustment.source
      : "projection/volume signal",
    predictiveAdjustment.fpts_delta_percent
      ? `FPTS vs pool ${predictiveAdjustment.fpts_delta_percent > 0 ? "+" : ""}${predictiveAdjustment.fpts_delta_percent}%`
      : "",
    `Volume ${predictiveAdjustment.volume_score || volumeProjection?.score || 0}/100`,
  ].filter(Boolean).join(" · ");
  const depthDetail = [
    depthAdjustment.depth_position || player.pos?.[0] || "Role",
    depthAdjustment.depth_rank ? `rank ${depthAdjustment.depth_rank}` : "",
    depthAdjustment.role || volumeProjection?.role || "role inferred from volume",
    `${depthAdjustment.volume_score || volumeProjection?.score || 0}/100 volume`,
  ].filter(Boolean).join(" · ");

  return [
    {
      label: "Baseline Stats",
      value: valuationSnapshot.statBaselineValue != null ? `$${valuationSnapshot.statBaselineValue}` : `$${player.baseValue}`,
      tone: "neutral",
      detail: `${readableBand(valuation.stat_profile?.window || "runtime")} window · ${valuation.stat_profile?.selected_source || "player-pool stats"}`,
    },
    {
      label: "Scoring Fit",
      value: impactLabel(scoringAdjustment.multiplier),
      tone: impactTone(scoringAdjustment.multiplier),
      detail: scoringDetail,
    },
    {
      label: "Position Scarcity",
      value: impactLabel(valuationSnapshot.factors?.scarcity),
      tone: impactTone(valuationSnapshot.factors?.scarcity),
      detail: `${scarcityDetail?.[0] || player.pos?.[0] || "Position"} · ${scarcityDetail?.[1] || valuation.scarcity_tier || "scarcity measured from remaining pool"}`,
    },
    {
      label: "Predictive Signal",
      value: impactLabel(predictiveAdjustment.multiplier),
      tone: impactTone(predictiveAdjustment.multiplier),
      detail: predictiveDetail,
    },
    {
      label: "Age Curve",
      value: impactLabel(ageAdjustment.multiplier),
      tone: impactTone(ageAdjustment.multiplier),
      detail: ageAdjustment.age != null
        ? `Age ${ageAdjustment.age} · ${readableBand(ageAdjustment.band)}`
        : "Age unavailable",
    },
    {
      label: "Role & Volume",
      value: impactLabel(depthAdjustment.multiplier),
      tone: impactTone(depthAdjustment.multiplier),
      detail: depthDetail,
    },
    {
      label: "Risk",
      value: impactLabel(riskAdjustment.multiplier),
      tone: impactTone(riskAdjustment.multiplier),
      detail: `${riskLevel || "LOW"} risk${injuryStatus ? ` · ${injuryStatus}` : ""}`,
    },
  ];
}

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
  const valuationSource = getValuationSource(player, valuation);
  const valuationSourceLabel = formatValuationSource(valuationSource);

  // ── Pitcher vs. Hitter detection ────────────────────────────────────────
  // Players with non-null era values are pitchers.
  // The NL-only CSV data doesn't include pitcher batting stats, so this also
  // handles two-way-player edge cases (e.g. Ohtani has both SP and batting stats).
  const isPitcher = player.era !== null && player.era !== undefined;

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
  const updateType =
    player.latest_update?.type ||
    updateContext?.type ||
    (valuation && valuation !== "loading" ? valuation.player_update?.type : null);
  const transactionContext =
    updateType === "TRANSACTION" || updateType === "LINEUP" || updateType === "ROLE"
      ? updateContext
      : null;
  const volumeProjection =
    player.volume_projection ||
    (valuation && valuation !== "loading"
      ? valuation.volume_projection || valuation.stats?.volume_projection
      : null) ||
    getPlayerVolumeProjection(player);
  const valuationSnapshot =
    valuation && valuation !== "loading" && !valuationFailed
      ? makeValuationSnapshot(player, valuation)
      : null;
  const statProfile =
    valuation && valuation !== "loading" ? valuation.stat_profile : null;
  const activeScoringCategories =
    valuation && valuation !== "loading"
      ? valuation.scoring_adjustment?.active_categories
      : null;
  const statRows = buildStatRows(player, isPitcher, activeScoringCategories);
  const valuationDrivers = buildValuationDrivers({
    player,
    valuation,
    valuationSnapshot,
    statRows,
    volumeProjection,
    riskLevel,
    injuryStatus,
  });

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
              aria-label={favorites?.[player.id] ? `Unfavorite ${player.name}` : `Favorite ${player.name}`}
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
            {player.age != null && <span className="depth-badge">Age {player.age}</span>}
            {volumeProjection && (
              <span className="depth-badge">Vol {volumeProjection.score}</span>
            )}
          </div>

          {/* Max bid (from API or base value) */}
          <div className="pc-maxbid">
            <span className="pc-bid-val">${maxBid}</span>
            <span className="pc-bid-label"> MAX BID</span>
          </div>
          <div className={`valuation-source-chip ${valuationSource}`}>
            {valuationSourceLabel}
          </div>
        </div>
      </div>

      {/* ── Key Stats ───────────────────────────────────────────────────── */}
      <div className="pc-section-label">
        {valuation === "loading" ? "FETCHING VALUATION…" : "SCORING STAT PROFILE"}
      </div>
      <div className="pc-stat-panel">
        <div className="pc-stat-panel-head">
          <span>{statProfile?.window ? readableBand(statProfile.window) : "Player Pool"} Stats</span>
          <strong>
            {activeScoringCategories?.length
              ? `${activeScoringCategories.length} league cats`
              : "Default cats"}
          </strong>
        </div>
        <div className="pc-stat-grid">
          {statRows.map((stat) => (
            <div key={stat.category} className={`pc-stat-card ${stat.tone}`}>
              <div>
                <span>{stat.category}</span>
                <strong>{stat.value}</strong>
              </div>
              <small>{stat.summary}</small>
            </div>
          ))}
        </div>
        {player.fpts != null && (
          <div className="pc-stat-footer">
            <span>Projected FPTS</span>
            <strong>{player.fpts}</strong>
            <span>Base value</span>
            <strong>${player.baseValue}</strong>
          </div>
        )}
      </div>

      {volumeProjection && (
        <div className="pc-role-panel">
          <div className="pc-role-head">
            <span>Role & Playing Time</span>
            <strong>{volumeProjection.score}/100</strong>
          </div>
          <div className="pc-role-copy">
            <strong>{volumeProjection.role}</strong>
            <span>{volumeProjection.confidence} confidence · {volumeProjection.basis}</span>
          </div>
          <div className="pc-role-drivers">
            {(volumeProjection.drivers || []).slice(0, 5).map((driver) => (
              <span key={driver}>{driver}</span>
            ))}
            {(volumeProjection.drivers || []).length === 0 && <span>No workload drivers</span>}
          </div>
          {volumeProjection.note && (
            <p>{volumeProjection.note}</p>
          )}
        </div>
      )}

      {valuationSnapshot && (
        <div className="pc-valuation-panel">
          <div className="pc-valuation-top">
            <span>Live valuation</span>
            <strong>TDV ${valuationSnapshot.trueDollarValue} · Max ${valuationSnapshot.maxBidRecommendation}</strong>
          </div>
          <div className="pc-valuation-summary">
            <span>{valuationSnapshot.marketContext?.label || "Neutral market"}</span>
            <span>{valuationSnapshot.scarcityTier || "Scarcity measured"}</span>
            <span>{valuationSnapshot.riskLevel || riskLevel} risk</span>
          </div>
          <div className="pc-driver-list">
            {valuationDrivers.map((driver) => (
              <div key={driver.label} className={`pc-driver-row ${driver.tone}`}>
                <div className="pc-driver-main">
                  <span>{driver.label}</span>
                  <p>{driver.detail}</p>
                </div>
                <strong>{driver.value}</strong>
              </div>
            ))}
          </div>
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
            <span className="pc-risk-label">
              {updateType === "TRANSACTION" ? "TRANSACTION" : "LIVE UPDATE"}
            </span>
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

      {transactionContext && (
        <div className="pc-news">
          <span className="news-tag">[{updateType}]</span>{" "}
          {transactionContext.body ||
            transactionContext.impact_summary ||
            "Transaction context is active for draft review."}
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
                Save
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
