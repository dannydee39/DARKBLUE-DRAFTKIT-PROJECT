// ─────────────────────────────────────────────────────────────────────────────
// components/LeagueSettings.jsx
//
// Shows the current league's scoring categories and roster slot configuration.
// Users can toggle individual scoring categories and adjust how many of each
// roster slot the league uses.
// ─────────────────────────────────────────────────────────────────────────────

import { HITTING_CATS, PITCHING_CATS } from "../constants.js";
import { posColor } from "../utils/helpers.js";

/**
 * LeagueSettings
 *
 * Renders two panels side-by-side:
 *  Left: scoring category toggles + league meta (season, owners, budget, pool)
 *  Right: roster slot count adjusters
 *
 * @param {Object}   props
 * @param {Object}   props.league    - Full league state object from App
 * @param {Function} props.setLeague - State setter for the league object
 * @returns {JSX.Element}
 */
export default function LeagueSettings({ league, setLeague }) {

  /**
   * Toggles a single scoring category on or off.
   * @param {string} cat - Category key (e.g. "HR", "ERA")
   */
  function toggleScoring(cat) {
    setLeague((prev) => ({
      ...prev,
      scoring: { ...prev.scoring, [cat]: !prev.scoring[cat] },
    }));
  }

  /**
   * Increments or decrements the slot count for a specific roster position.
   * Minimum value is 0 — can't go below zero slots.
   *
   * @param {string} slot  - Roster slot key (e.g. "OF", "SP", "BN")
   * @param {number} delta - +1 to add a slot, -1 to remove
   */
  function adjRoster(slot, delta) {
    setLeague((prev) => ({
      ...prev,
      roster: {
        ...prev.roster,
        [slot]: Math.max(0, (prev.roster[slot] || 0) + delta),
      },
    }));
  }

  return (
    <div className="settings-layout">

      {/* ── Left Panel: Scoring + Meta ─────────────────────────────────── */}
      <div className="settings-left">
        <h2 className="settings-title">LEAGUE SETTINGS</h2>

        {/* Scoring categories */}
        <div className="settings-card">
          <div className="settings-section-label">SCORING CATEGORIES</div>
          <p style={{ fontSize: 10, color: "var(--muted)", marginBottom: 10 }}>
            Click to toggle. Active categories are used for player valuations.
          </p>

          {/* Hitting categories group */}
          <div className="scoring-group-label">HITTING</div>
          <div className="scoring-cats">
            {HITTING_CATS.map((cat) => (
              <button
                key={cat}
                className={`cat-btn ${league.scoring[cat] ? "active" : ""}`}
                onClick={() => toggleScoring(cat)}
                title={league.scoring[cat] ? `Remove ${cat}` : `Add ${cat}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Pitching categories group */}
          <div className="scoring-group-label">PITCHING</div>
          <div className="scoring-cats">
            {PITCHING_CATS.map((cat) => (
              <button
                key={cat}
                className={`cat-btn ${league.scoring[cat] ? "active" : ""}`}
                onClick={() => toggleScoring(cat)}
                title={league.scoring[cat] ? `Remove ${cat}` : `Add ${cat}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* League meta settings */}
        <div className="settings-card" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label>SEASON YEAR</label>
            <input
              value={league.season}
              onChange={(e) =>
                setLeague((prev) => ({ ...prev, season: e.target.value }))
              }
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>OWNERS</label>
              <input
                type="number"
                value={league.owners}
                onChange={(e) =>
                  setLeague((prev) => ({ ...prev, owners: +e.target.value }))
                }
              />
            </div>
            <div className="form-group">
              <label>BUDGET / OWNER ($)</label>
              <input
                type="number"
                value={league.budget}
                onChange={(e) =>
                  setLeague((prev) => ({ ...prev, budget: +e.target.value }))
                }
              />
            </div>
          </div>

          {/* Player pool toggle */}
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
                  className={`toggle-btn ${league.pool === val ? "active" : ""}`}
                  onClick={() => setLeague((prev) => ({ ...prev, pool: val }))}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Keeper league flag */}
          <div className="form-group">
            <label>KEEPER LEAGUE?</label>
            <div className="toggle-group">
              <button
                className={`toggle-btn ${league.keeperLeague ? "active" : ""}`}
                onClick={() => setLeague((prev) => ({ ...prev, keeperLeague: true }))}
              >
                YES
              </button>
              <button
                className={`toggle-btn ${!league.keeperLeague ? "active" : ""}`}
                onClick={() => setLeague((prev) => ({ ...prev, keeperLeague: false }))}
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
            {Object.entries(league.roster).map(([slot, count]) => (
              <div key={slot} className="roster-row">
                {/* Slot label with position color */}
                <span
                  className="roster-slot-label"
                  style={{ color: posColor(slot) }}
                >
                  {slot}
                </span>
                {/* +/- adjuster controls */}
                <div className="roster-adj">
                  <button
                    className="adj-btn"
                    onClick={() => adjRoster(slot, -1)}
                    disabled={count <= 0}
                    title={`Remove one ${slot} slot`}
                  >
                    −
                  </button>
                  <span className="adj-val green">{count}</span>
                  <button
                    className="adj-btn"
                    onClick={() => adjRoster(slot, 1)}
                    title={`Add one ${slot} slot`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            className="init-btn"
            style={{ marginTop: 16 }}
            onClick={() => alert("Settings saved for this session!")}
          >
            Save Settings
          </button>
          <p style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", marginTop: 8 }}>
            Note: settings apply immediately to valuation calculations
          </p>
        </div>
      </div>

    </div>
  );
}
