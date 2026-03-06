// ─────────────────────────────────────────────────────────────────────────────
// components/SetupScreen.jsx
//
// The initial landing / league-creation screen shown before the draft starts.
// User fills in league name, season, owner count, budget, and player pool,
// then clicks "Initialize Draft" which calls onInit with the form values.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { DEFAULT_ROSTER, DEFAULT_SCORING } from "../constants.js";

/**
 * SetupScreen
 *
 * The pre-draft setup form. Collects league settings and fires onInit()
 * when the user submits.
 *
 * @param {Object}   props
 * @param {Function} props.onInit - Called with the completed form object when ready.
 *                                  Signature: (formValues: LeagueConfig) => void
 * @returns {JSX.Element}
 */
export default function SetupScreen({ onInit }) {
  // ── Local form state ─────────────────────────────────────────────────────
  // This state is ONLY used on this screen. Once onInit() is called the
  // parent App component takes over and this component unmounts.
  const [form, setForm] = useState({
    name: "Valuation Test League",
    season: "2025",
    owners: 12,
    budget: 260,
    pool: "NL",            // default to NL-only since our sample data is NL
    roster: { ...DEFAULT_ROSTER },
    scoring: { ...DEFAULT_SCORING },
    keeperLeague: true,
  });

  /**
   * Shorthand setter — merges a single key-value pair into form state.
   * @param {string} key - Form field name
   * @param {*}      val - New value
   */
  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <div className="setup-page">

      {/* ── Brand Header ──────────────────────────────────────────────────── */}
      <div className="setup-header">
        <div className="setup-brand">DARK BLUE SOFTWARE SOLUTIONS</div>
        <h1 className="setup-title">
          <span className="white">AUCTION</span>
          <br />
          <span className="green">DRAFT KIT</span>
        </h1>
        <p className="setup-sub">
          Fantasy Baseball · Dynamic Valuation Engine · v2.0
        </p>
      </div>

      {/* ── League Config Form ────────────────────────────────────────────── */}
      <div className="setup-card">
        <h2 className="setup-card-title">CREATE NEW DRAFT INSTANCE</h2>

        {/* League name */}
        <div className="form-group">
          <label>LEAGUE NAME</label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Valuation Test League"
          />
        </div>

        {/* Season year */}
        <div className="form-group">
          <label>SEASON YEAR</label>
          <input
            value={form.season}
            onChange={(e) => set("season", e.target.value)}
          />
        </div>

        {/* Owner count + budget side by side */}
        <div className="form-row">
          <div className="form-group">
            <label>OWNERS</label>
            <input
              type="number"
              value={form.owners}
              min={2}
              max={20}
              onChange={(e) => set("owners", +e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>BUDGET / OWNER ($)</label>
            <input
              type="number"
              value={form.budget}
              min={100}
              max={500}
              onChange={(e) => set("budget", +e.target.value)}
            />
          </div>
        </div>

        {/* Player pool selection
            NOTE: The sample data is NL-only, so "NL Only" is the default.
            Selecting "MLB (All)" will work but may show fewer players
            until AL data files are added to sample/data/. */}
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
                onClick={() => set("pool", val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          className="init-btn"
          disabled={!form.name.trim()}
          onClick={() => onInit(form)}
        >
          INITIALIZE DRAFT →
        </button>
        <p className="setup-hint">
          Player pool auto-populated from NL sample data on initialization
        </p>
      </div>

    </div>
  );
}
