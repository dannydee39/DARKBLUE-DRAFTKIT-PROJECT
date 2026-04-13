// ─────────────────────────────────────────────────────────────────────────────
// components/KeeperSetup.jsx
//
// Pre-draft keeper initialization screen. Users can enter keeper contracts
// for any team before the draft starts. Each keeper deducts the contract cost
// from the team's starting budget and pre-fills their roster slot.
//
// Usage flow:
//   1. Select an owner
//   2. Type the player name (exact match against the API player database)
//   3. Enter the keeper cost
//   4. Click "Add Keeper" — budget is deducted immediately
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

/**
 * KeeperSetup
 *
 * @param {Object}   props
 * @param {Object}   props.league    - Full league state object
 * @param {Function} props.setLeague - Setter to update league teams / budgets
 * @param {Object[]} props.players   - Player array (used to match keeper names → positions)
 * @returns {JSX.Element}
 */
export default function KeeperSetup({ league, setLeague, players }) {
  // ── Form state ────────────────────────────────────────────────────────────
  // Local form for the add-keeper input fields.
  const [form, setForm] = useState({
    ownerId: "1",
    playerName: "",
    cost: "",
  });

  // ── keepersByTeam ─────────────────────────────────────────────────────────
  // Separate local tracker so we can display keeper history per team
  // without re-deriving it from league.teams.roster on every render.
  const [keepersByTeam, setKeepersByTeam] = useState({});

  /**
   * addKeeper — validates and commits a keeper to the team's roster.
   *
   * Side effects:
   *  - Deducts keeper cost from the team's budget_remaining
   *  - Adds a roster entry to the team in league state
   *  - Updates keepersByTeam for the summary display
   *  - Resets the form fields
   */
  function addKeeper() {
    if (!form.playerName.trim() || !form.cost) return;

    const teamId = +form.ownerId;
    const cost   = +form.cost;
    const name   = form.playerName.trim();

    // Try to find the player in the API pool to get their positions.
    // If not found we fall back to ["?"] — the keeper still gets added
    // but will show a placeholder position indicator in the roster grid.
    const matchedPlayer = players.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );

    // Update the visual keeper-history panel (separate from league state)
    setKeepersByTeam((prev) => ({
      ...prev,
      [teamId]: [
        ...(prev[teamId] || []),
        { name, cost },
      ],
    }));

    // Update the league: deduct budget + add roster entry
    setLeague((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        return {
          ...t,
          budget_remaining: t.budget_remaining - cost,
          roster: [
            ...t.roster,
            {
              name,
              price: cost,
              pos: matchedPlayer?.pos || ["?"],
              isKeeper: true, // flag so the draft grid can show a keeper badge
            },
          ],
        };
      }),
    }));

    // Reset input fields (keep the same owner selected for fast multi-entry)
    setForm((prev) => ({ ...prev, playerName: "", cost: "" }));
  }

  return (
    <div className="keeper-layout">

      {/* ── Left: Add Keeper Form ─────────────────────────────────────────── */}
      <div className="keeper-left">
        <h2 className="keeper-title">PRE-DRAFT KEEPER INITIALIZATION</h2>
        <p className="dict-sub">
          Enter keeper contracts before the draft. Each keeper deducts its cost
          from the owner's starting budget.
        </p>

        <div className="settings-card" style={{ marginTop: 16 }}>
          <div className="settings-section-label">ADD KEEPER CONTRACT</div>

          {/* Owner selector */}
          <div className="form-group">
            <label>OWNER</label>
            <select
              value={form.ownerId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, ownerId: e.target.value }))
              }
            >
              {league.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (${t.budget_remaining} remaining)
                </option>
              ))}
            </select>
          </div>

          {/* Player name — must match exactly (case-insensitive) */}
          <div className="form-group">
            <label>PLAYER NAME</label>
            <input
              value={form.playerName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, playerName: e.target.value }))
              }
              placeholder="e.g. Shohei Ohtani"
              onKeyDown={(e) => {
                // Submit on Enter for fast data entry
                if (e.key === "Enter") addKeeper();
              }}
            />
            {/* Show match confirmation if found in player database */}
            {form.playerName && (() => {
              const match = players.find(
                (p) => p.name.toLowerCase() === form.playerName.toLowerCase()
              );
              if (match) {
                return (
                  <div style={{ fontSize: 10, color: "var(--green)", marginTop: 3 }}>
                    ✓ Found: {match.name} ({match.pos.join(", ")}) — ${match.baseValue} base value
                  </div>
                );
              }
              if (form.playerName.length > 3) {
                return (
                  <div style={{ fontSize: 10, color: "var(--yellow)", marginTop: 3 }}>
                    ⚠ Not found in database — will add with unknown position
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Cost field */}
          <div className="form-group">
            <label>CONTRACT COST ($)</label>
            <input
              type="number"
              value={form.cost}
              min={1}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, cost: e.target.value }))
              }
              placeholder="e.g. 25"
              onKeyDown={(e) => {
                if (e.key === "Enter") addKeeper();
              }}
            />
          </div>

          <button
            className="init-btn"
            onClick={addKeeper}
            disabled={!form.playerName.trim() || !form.cost}
          >
            Add Keeper
          </button>
        </div>
      </div>

      {/* ── Right: Team Budget Summary Cards ──────────────────────────────── */}
      <div className="keeper-right">
        <div className="settings-section-label">ADJUSTED STARTING BUDGETS</div>
        <div className="keeper-grid">
          {league.teams.map((team) => {
            const keepers  = keepersByTeam[team.id] || [];
            const deducted = keepers.reduce((s, k) => s + k.cost, 0);

            return (
              <div key={team.id} className="keeper-card">
                {/* Team name */}
                <div className="kc-name">{team.name}</div>
                <div className="kc-count">
                  {keepers.length} keeper{keepers.length !== 1 ? "s" : ""}
                </div>

                {/* Deducted amount (red) */}
                <div className="kc-row">
                  <span className="kc-label">DEDUCTED</span>
                  <span className="kc-deducted">-${deducted}</span>
                </div>

                {/* Adjusted starting budget */}
                <div className="kc-row">
                  <span className="kc-label">STARTS WITH</span>
                  <span className="kc-budget green">${team.budget_remaining}</span>
                </div>

                {/* List of keepers for this team */}
                {keepers.map((k, i) => (
                  <div key={i} className="kc-keeper">
                    {k.name} · ${k.cost}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
