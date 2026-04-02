// ─────────────────────────────────────────────────────────────────────────────
// components/LeagueSettings.jsx
//
// Saved-settings editor for the current draft workspace.
// Core setup fields stay editable before the first pick. Once the draft has
// started, only non-destructive metadata and scoring changes remain editable.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { HITTING_CATS, PITCHING_CATS } from "../constants.js";
import { posColor } from "../utils/helpers.js";
import {
  cloneLeagueConfig,
  countDraftEntries,
  hasDraftStarted,
  validateLeagueConfig,
} from "../utils/draftSessions.js";

/**
 * LeagueSettings
 *
 * Renders two panels side-by-side:
 *  Left: scoring category toggles + league meta (name, season, owners, budget, pool)
 *  Right: roster slot count adjusters
 *
 * @param {Object}   props
 * @param {Object}   props.league          - Full league state object from App
 * @param {Function} props.onSaveSettings  - Async callback that persists settings safely
 * @returns {JSX.Element}
 */
export default function LeagueSettings({ league, onSaveSettings }) {
  const [form, setForm] = useState(() => cloneLeagueConfig(league));
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(cloneLeagueConfig(league));
    setStatus("");
  }, [league]);

  const draftStarted = useMemo(() => hasDraftStarted(league), [league]);
  const picksRecorded = useMemo(() => countDraftEntries(league), [league]);
  const validation = useMemo(() => validateLeagueConfig(form), [form]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleScoring(cat) {
    setForm((prev) => ({
      ...prev,
      scoring: { ...prev.scoring, [cat]: !prev.scoring[cat] },
    }));
  }

  function adjRoster(slot, delta) {
    setForm((prev) => ({
      ...prev,
      roster: {
        ...prev.roster,
        [slot]: Math.max(0, (prev.roster[slot] || 0) + delta),
      },
    }));
  }

  async function handleSave() {
    if (validation.errors.length > 0 || saving) return;
    setSaving(true);
    try {
      const result = await onSaveSettings(form);
      setStatus(result?.message || "Settings saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-layout">

      {/* ── Left Panel: Scoring + Meta ─────────────────────────────────── */}
      <div className="settings-left">
        <h2 className="settings-title">LEAGUE SETTINGS</h2>

        <div className="settings-card" style={{ marginBottom: 12 }}>
          <div className="settings-section-label">SETUP STATUS</div>
          <p style={{ fontSize: 11, color: "var(--muted2)", marginBottom: 8 }}>
            {draftStarted
              ? `Core setup is locked because ${picksRecorded} picks have already been recorded in this draft.`
              : "Core setup is still editable because the draft has not started yet."}
          </p>
          <p style={{ fontSize: 10, color: "var(--muted)" }}>
            You can still rename the league, change the season label, and adjust scoring categories without wiping the draft state.
          </p>
        </div>

        {/* Scoring categories */}
        <div className="settings-card">
          <div className="settings-section-label">SCORING CATEGORIES</div>
          <p style={{ fontSize: 10, color: "var(--muted)", marginBottom: 10 }}>
            Click to toggle. Active categories are used for player valuations.
          </p>

          <div className="scoring-group-label">HITTING</div>
          <div className="scoring-cats">
            {HITTING_CATS.map((cat) => (
              <button
                key={cat}
                className={`cat-btn ${form.scoring[cat] ? "active" : ""}`}
                onClick={() => toggleScoring(cat)}
                title={form.scoring[cat] ? `Remove ${cat}` : `Add ${cat}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="scoring-group-label">PITCHING</div>
          <div className="scoring-cats">
            {PITCHING_CATS.map((cat) => (
              <button
                key={cat}
                className={`cat-btn ${form.scoring[cat] ? "active" : ""}`}
                onClick={() => toggleScoring(cat)}
                title={form.scoring[cat] ? `Remove ${cat}` : `Add ${cat}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* League meta settings */}
        <div className="settings-card" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label>LEAGUE NAME</label>
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>SEASON YEAR</label>
            <input
              value={form.season}
              onChange={(e) => setField("season", e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>OWNERS</label>
              <input
                type="number"
                value={form.owners}
                disabled={draftStarted}
                onChange={(e) => setField("owners", +e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>BUDGET / OWNER ($)</label>
              <input
                type="number"
                value={form.budget}
                disabled={draftStarted}
                onChange={(e) => setField("budget", +e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>PLAYER POOL</label>
            <div className="toggle-group">
              {[
                ["MLB", "MLB (All)"],
                ["AL", "AL Only"],
                ["NL", "NL Only"],
              ].map(([val, label]) => (
                <button
                  key={val}
                  className={`toggle-btn ${form.pool === val ? "active" : ""}`}
                  disabled={draftStarted}
                  onClick={() => setField("pool", val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>KEEPER LEAGUE?</label>
            <div className="toggle-group">
              <button
                className={`toggle-btn ${form.keeperLeague ? "active" : ""}`}
                onClick={() => setField("keeperLeague", true)}
              >
                YES
              </button>
              <button
                className={`toggle-btn ${!form.keeperLeague ? "active" : ""}`}
                onClick={() => setField("keeperLeague", false)}
              >
                NO
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Roster Configuration ─────────────────────────── */}
      <div className="settings-right">
        <div className="settings-card">
          <div className="settings-section-label">ROSTER CONFIGURATION</div>
          <p style={{ fontSize: 10, color: "var(--muted)", marginBottom: 10 }}>
            Adjust how many slots each position gets. This affects the draft grid and max-bid calculations.
          </p>

          <div className="roster-grid">
            {Object.entries(form.roster).map(([slot, count]) => (
              <div key={slot} className="roster-row">
                <span
                  className="roster-slot-label"
                  style={{ color: posColor(slot) }}
                >
                  {slot}
                </span>
                <div className="roster-adj">
                  <button
                    className="adj-btn"
                    onClick={() => adjRoster(slot, -1)}
                    disabled={draftStarted || count <= 0}
                    title={`Remove one ${slot} slot`}
                  >
                    −
                  </button>
                  <span className="adj-val green">{count}</span>
                  <button
                    className="adj-btn"
                    onClick={() => adjRoster(slot, 1)}
                    disabled={draftStarted}
                    title={`Add one ${slot} slot`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          {(validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div className="setup-validation settings-validation">
              {validation.errors.map((error) => (
                <div key={error} className="setup-validation-row error">
                  {error}
                </div>
              ))}
              {validation.warnings.map((warning) => (
                <div key={warning} className="setup-validation-row warning">
                  {warning}
                </div>
              ))}
            </div>
          )}

          <button
            className="init-btn"
            style={{ marginTop: 16 }}
            disabled={validation.errors.length > 0 || saving}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
          <p style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", marginTop: 8 }}>
            {draftStarted
              ? "Live draft safety is enabled. Core setup fields stay locked after picks begin."
              : "Pre-draft changes update the current saved draft workspace and refresh setup safely."}
          </p>

          {status && <div className="settings-status">{status}</div>}
        </div>
      </div>

    </div>
  );
}
