// ─────────────────────────────────────────────────────────────────────────────
// components/SetupScreen.jsx
//
// The initial landing / league-creation screen shown before the draft starts.
// User fills in league name, season, owner count, budget, and player pool,
// then clicks "Initialize Draft" which calls onInit with the form values.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { DRAFTKIT_API_BASE, DEFAULT_ROSTER, DEFAULT_SCORING } from "../constants.js";
import {
  buildTeamNameList,
  countDraftEntries,
  countTaxiEntries,
  formatDraftTimestamp,
  formatPoolLabel,
  hasDraftStarted,
  validateLeagueConfig,
} from "../utils/draftSessions.js";

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
export default function SetupScreen({
  onInit,
  drafts = [],
  activeDraftId = null,
  onResumeDraft,
  onDuplicateDraft,
  onDeleteDraft,
  user = null,
  authReady = false,
  storageMode = "local",
  onOpenAuth,
}) {
  // ── Local form state ─────────────────────────────────────────────────────
  // This state is ONLY used on this screen. Once onInit() is called the
  // parent App component takes over and this component unmounts.
  const [form, setForm] = useState({
    name: "Valuation Test League",
    season: "2025",
    owners: 12,
    budget: 260,
    pool: "MLB",
    teamNames: buildTeamNameList({ owners: 12 }, 12),
    roster: { ...DEFAULT_ROSTER },
    scoring: { ...DEFAULT_SCORING },
    keeperLeague: true,
  });
  const [creating, setCreating] = useState(false);
  const [poolCounts, setPoolCounts] = useState({
    status: "loading",
    MLB: null,
    AL: null,
    NL: null,
  });

  const validation = useMemo(() => validateLeagueConfig(form), [form]);
  const totalRosterSlots = Object.entries(form.roster)
    .filter(([slot]) => slot !== "TAXI")
    .reduce((sum, [, count]) => sum + count, 0);
  const scoringCount = Object.values(form.scoring).filter(Boolean).length;
  const selectedPoolCount = poolCounts[form.pool];

  useEffect(() => {
    let cancelled = false;

    async function loadPoolCounts() {
      try {
        const pools = [
          ["MLB", "ALL"],
          ["AL", "AL"],
          ["NL", "NL"],
        ];

        const results = await Promise.all(
          pools.map(async ([key, league]) => {
            const response = await fetch(`${DRAFTKIT_API_BASE}/v1/players?league=${league}`);
            if (!response.ok) {
              throw new Error(`Failed to load ${key} pool`);
            }
            const data = await response.json();
            const players = Array.isArray(data) ? data : data.players || [];
            return [key, players.length];
          })
        );

        if (cancelled) return;

        setPoolCounts({
          status: "ready",
          MLB: results.find(([key]) => key === "MLB")?.[1] ?? null,
          AL: results.find(([key]) => key === "AL")?.[1] ?? null,
          NL: results.find(([key]) => key === "NL")?.[1] ?? null,
        });
      } catch {
        if (!cancelled) {
          setPoolCounts({
            status: "error",
            MLB: null,
            AL: null,
            NL: null,
          });
        }
      }
    }

    loadPoolCounts();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Shorthand setter — merges a single key-value pair into form state.
   * @param {string} key - Form field name
   * @param {*}      val - New value
   */
  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function setOwnerCount(nextOwners) {
    const owners = Number(nextOwners);
    setForm((prev) => ({
      ...prev,
      owners,
      teamNames: buildTeamNameList(prev, owners),
    }));
  }

  function setTeamName(index, value) {
    setForm((prev) => {
      const teamNames = buildTeamNameList(prev, prev.owners);
      teamNames[index] = value;
      return { ...prev, teamNames };
    });
  }

  async function handleInit() {
    if (!authReady || validation.errors.length > 0 || creating) return;
    if (!user) {
      onOpenAuth?.();
      return;
    }
    setCreating(true);
    try {
      await onInit(form);
    } finally {
      setCreating(false);
    }
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
      <div className="setup-content">
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
                onChange={(e) => setOwnerCount(e.target.value)}
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

          <div className="form-group">
            <div className="setup-team-name-header">
              <label>FANTASY TEAM NAMES</label>
              <span>{form.owners} teams</span>
            </div>
            <div className="setup-team-name-grid">
              {buildTeamNameList(form, form.owners).map((teamName, index) => (
                <label key={index} className="team-name-field">
                  <span>Team {index + 1}</span>
                  <input
                    value={teamName}
                    onChange={(event) => setTeamName(index, event.target.value)}
                    placeholder={`Owner ${index + 1}`}
                  />
                </label>
              ))}
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
                  onClick={() => set("pool", val)}
                >
                  <span>{label}</span>
                  <small>
                    {poolCounts.status === "ready" && poolCounts[val] != null
                      ? `${poolCounts[val]} players`
                      : "Loading..."}
                  </small>
                </button>
              ))}
            </div>
          </div>

          <div className="setup-summary">
            <div className="setup-summary-row">
              <span>Scoring Categories</span>
              <strong>{scoringCount} active</strong>
            </div>
            <div className="setup-summary-row">
              <span>Main Roster Slots</span>
              <strong>{totalRosterSlots}</strong>
            </div>
            <div className="setup-summary-row">
              <span>Pool Mode</span>
              <strong>{formatPoolLabel(form.pool)}</strong>
            </div>
            <div className="setup-summary-row">
              <span>Players Available</span>
              <strong>
                {selectedPoolCount != null ? selectedPoolCount : poolCounts.status === "error" ? "Unavailable" : "Loading…"}
              </strong>
            </div>
          </div>

          {(validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div className="setup-validation">
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

          <div className={`setup-pool-note ${poolCounts.status === "error" ? "warning" : "info"}`}>
            {poolCounts.status === "ready"
              ? `Live API player pool connected. MLB: ${poolCounts.MLB} · AL: ${poolCounts.AL} · NL: ${poolCounts.NL}.`
              : poolCounts.status === "error"
                ? "Live player-pool counts could not be loaded right now. Draft initialization will still try the API when you start."
                : "Checking live player-pool counts from the API..."}
          </div>

          <button
            className="init-btn"
            disabled={!authReady || validation.errors.length > 0 || creating}
            onClick={handleInit}
          >
            {creating
              ? "INITIALIZING…"
              : user
                ? "INITIALIZE DRAFT →"
                : "LOGIN TO INITIALIZE DRAFT"}
          </button>
          <p className="setup-hint">
            {user
              ? "Drafts created while signed in sync to your cloud library automatically."
              : "Draft creation now requires login so saved work stays in the cloud library."}
          </p>
        </div>

        <div className="setup-card setup-library-card">
          <div className="setup-library-header">
            <h2 className="setup-card-title">SAVED DRAFT LIBRARY</h2>
            <span className="setup-library-count">
              {drafts.length} total · cloud
            </span>
          </div>

          <div className={`setup-cloud-banner ${user ? "connected" : ""}`}>
            <div>
              <div className="setup-cloud-title">
                {user
                  ? `Cloud sync enabled for ${user.displayName || user.email}`
                  : authReady
                    ? "Sign in to save drafts to your account"
                    : "Checking cloud account status…"}
              </div>
              <div className="setup-cloud-copy">
                {user
                  ? "Saved drafts now stay with your Draft Kit account and reopen across devices."
                  : "Draft saving requires an account. Local browser draft libraries are disabled."}
              </div>
            </div>
            <button
              type="button"
              className="setup-cloud-btn"
              onClick={() => onOpenAuth?.()}
            >
              {user ? "Account" : "Login / Sign Up"}
            </button>
          </div>

          {drafts.length === 0 && (
            <p className="setup-library-empty">
              {user
                ? "No saved drafts yet. Create your first league setup to start a reusable cloud draft library."
                : "Sign in to create and save cloud drafts."}
            </p>
          )}

          {drafts.length > 0 && (
            <div className="saved-draft-list">
              {drafts.map((draft) => {
                const draftLeague = draft.league || {};
                const started = hasDraftStarted(draftLeague);
                const mainPicks = countDraftEntries(draftLeague);
                const taxiPicks = countTaxiEntries(draftLeague);

                return (
                  <div
                    key={draft.id}
                    className={`saved-draft-card ${draft.id === activeDraftId ? "active" : ""}`}
                  >
                    <div className="saved-draft-top">
                      <div>
                        <div className="saved-draft-name">{draftLeague.name || "Untitled League"}</div>
                        <div className="saved-draft-meta">
                          {draftLeague.season || "2025"} · {formatPoolLabel(draftLeague.pool)} · {draftLeague.owners || 0} owners
                        </div>
                      </div>
                      <span className={`saved-draft-badge ${started ? "live" : "setup"}`}>
                        {started ? "ACTIVE" : "SETUP"}
                      </span>
                    </div>

                    <div className="saved-draft-stats">
                      <span>{mainPicks} main picks</span>
                      <span>{taxiPicks} taxi picks</span>
                      <span className="saved-draft-source">
                        {(draft.source || storageMode || "local").toUpperCase()}
                      </span>
                    </div>
                    <div className="saved-draft-updated">
                      Last saved: {formatDraftTimestamp(draft.updatedAt || draft.lastOpenedAt)}
                    </div>

                    <div className="saved-draft-actions">
                      <button
                        className="saved-draft-btn primary"
                        onClick={() => onResumeDraft?.(draft.id)}
                      >
                        Resume
                      </button>
                      <button
                        className="saved-draft-btn"
                        onClick={() => onDuplicateDraft?.(draft.id)}
                      >
                        Duplicate
                      </button>
                      <button
                        className="saved-draft-btn danger"
                        onClick={() => onDeleteDraft?.(draft.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
