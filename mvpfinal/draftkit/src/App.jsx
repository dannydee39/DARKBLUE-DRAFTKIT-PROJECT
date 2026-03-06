// ─────────────────────────────────────────────────────────────────────────────
// App.jsx — Root application component
//
// This file is the top-level entry point. It owns:
//   • Application screen routing (setup vs. main)
//   • Tab navigation within the main screen
//   • All shared league state (teams, players, notes, budgets)
//   • API health polling
//   • Draft action handlers (recordSale, undoLast, undoSale, addTaxiPick)
//
// ── Architecture Note ──────────────────────────────────────────────────────
// All UI components are in src/components/. This file only handles routing
// and state — it does not render any HTML directly (except the nav shells).
//
// State data flow:
//   App (league, players, notes)
//   └─ DraftBoard (receives all draft actions as callbacks)
//   └─ PlayerDictionary (receives players + notes)
//   └─ LeagueSettings (receives league + setLeague)
//   └─ KeeperSetup (receives league + setLeague + players)
//   └─ TaxiSquad (receives league + players + onTaxiPick)
//   └─ ApiSandbox (receives league + apiStatus)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import "./styles.css";

// ── Named imports from modular components ─────────────────────────────────────
import SetupScreen       from "./components/SetupScreen.jsx";
import DraftBoard        from "./components/DraftBoard.jsx";
import PlayerDictionary  from "./components/PlayerDictionary.jsx";
import LeagueSettings    from "./components/LeagueSettings.jsx";
import KeeperSetup       from "./components/KeeperSetup.jsx";
import TaxiSquad         from "./components/TaxiSquad.jsx";
import ApiSandbox        from "./components/ApiSandbox.jsx";

// ── Shared constants and helpers ──────────────────────────────────────────────
import { API_BASE, DEMO_KEY, DEFAULT_ROSTER, DEFAULT_SCORING } from "./constants.js";
import { buildRosterPositions, calcMaxBid } from "./utils/helpers.js";

// ─────────────────────────────────────────────────────────────────────────────
// App — root component
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Screen / tab routing ──────────────────────────────────────────────────
  // "setup" shows the league creation screen; "main" shows the full draft app.
  const [screen,    setScreen]    = useState("setup");
  const [activeTab, setActiveTab] = useState("board");

  // ── API health state ──────────────────────────────────────────────────────
  // "checking" → "online" | "offline" based on GET /health response.
  const [apiStatus, setApiStatus] = useState("checking");

  // ── Player pool state ─────────────────────────────────────────────────────
  // Loaded from GET /v1/players on draft initialization.
  // Each player object has a `drafted` flag added by the app as sales are recorded.
  const [players, setPlayers] = useState([]);

  // ── Selected player (shared across board + dictionary) ────────────────────
  // The player whose card is currently showing in any right panel.
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // ── Per-player notes (persisted in session only) ──────────────────────────
  // Map of { [playerId]: noteText }. Saved when user blurs a notes textarea.
  // Future enhancement: persist to localStorage or a DB.
  const [notes, setNotes] = useState({});

  // ── Current active owner (index into league.teams) ────────────────────────
  // Controls which team row is highlighted and whose budget/max-bid is shown.
  const [currentOwnerIdx, setCurrentOwnerIdx] = useState(0);

  // ── League configuration object ───────────────────────────────────────────
  // This is the single source of truth for all league settings and team data.
  // Teams array is populated when the user clicks "Initialize Draft".
  const [league, setLeague] = useState({
    name: "",
    season: "2025",
    owners: 12,
    budget: 260,
    pool: "NL",
    roster: { ...DEFAULT_ROSTER },
    scoring: { ...DEFAULT_SCORING },
    keeperLeague: true,
    teams: [],
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Effect: Poll API health on mount.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    checkApiStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // checkApiStatus — hits GET /health and updates the apiStatus indicator.
  // ─────────────────────────────────────────────────────────────────────────
  async function checkApiStatus() {
    try {
      const r = await fetch(`${API_BASE}/health`);
      setApiStatus(r.ok ? "online" : "offline");
    } catch {
      setApiStatus("offline");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // fetchPlayers — GET /v1/players with the configured league pool filter.
  // Returns the loaded array (also sets it in state as a side effect).
  //
  // @param {Object} leagueData - League config (needs .pool)
  // @returns {Object[]} Loaded player array
  // ─────────────────────────────────────────────────────────────────────────
  async function fetchPlayers(leagueData) {
    try {
      // Map pool setting to API query parameter
      const poolParam =
        leagueData?.pool === "AL" ? "AL"
        : leagueData?.pool === "NL" ? "NL"
        : "ALL";

      const r = await fetch(`${API_BASE}/v1/players?league=${poolParam}`, {
        headers: { "X-License-Key": DEMO_KEY },
      });
      const data = await r.json();
      const loaded = data.players || [];
      setPlayers(loaded);
      return loaded;
    } catch {
      // API might be offline — return empty, game still functional without it
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // initDraft — called when the user submits the setup form.
  // Creates the teams array, fetches the player pool, and transitions
  // to the main draft screen.
  //
  // @param {Object} formLeague - League config collected from SetupScreen
  // ─────────────────────────────────────────────────────────────────────────
  function initDraft(formLeague) {
    // Create one team entry per owner, each starting with full budget
    const teams = Array.from({ length: formLeague.owners }, (_, i) => ({
      id: i + 1,
      name: `Owner ${i + 1}`,
      budget_remaining: formLeague.budget,
      roster: [],
      taxiSquad: [],
    }));

    const lg = { ...formLeague, teams };
    setLeague(lg);
    fetchPlayers(lg);      // load player pool from API
    setScreen("main");     // switch to draft view
    setActiveTab("board");
    setCurrentOwnerIdx(0);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // recordSale — commits an auction sale for a player.
  //
  // Side effects:
  //  - Deducts the sale price from the winning team's budget_remaining
  //  - Adds a roster entry to the winning team
  //  - Marks the player as drafted in the players array
  //
  // @param {Object} player  - Player object from the players array
  // @param {number} price   - Winning bid in dollars
  // @param {number} teamId  - ID of the winning team
  // ─────────────────────────────────────────────────────────────────────────
  function recordSale(player, price, teamId) {
    // Update the winning team's budget and roster
    setLeague((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        return {
          ...t,
          budget_remaining: t.budget_remaining - price,
          roster: [
            ...t.roster,
            { name: player.name, price, pos: player.pos },
          ],
        };
      }),
    }));

    // Mark the player as drafted in the pool
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === player.id
          ? { ...p, drafted: true, draftedBy: teamId, draftPrice: price }
          : p
      )
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // undoLast — undoes the most recent recorded sale across all teams.
  //
  // Finds the team with the last roster entry (by scanning teams in reverse),
  // removes that entry, and restores the player to the available pool.
  // ─────────────────────────────────────────────────────────────────────────
  function undoLast() {
    // Find the last drafted player by scanning teams from the end
    let lastTeamId = null;
    let lastEntry  = null;
    for (let i = league.teams.length - 1; i >= 0; i--) {
      const t = league.teams[i];
      if (t.roster.length > 0) {
        lastTeamId = t.id;
        lastEntry  = t.roster[t.roster.length - 1];
        break;
      }
    }
    if (!lastTeamId || !lastEntry) return; // nothing to undo

    // Remove the last entry and refund the budget
    setLeague((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        if (t.id !== lastTeamId) return t;
        return {
          ...t,
          budget_remaining: t.budget_remaining + lastEntry.price,
          roster: t.roster.slice(0, -1),
        };
      }),
    }));

    // Return the player to the available pool
    const p = players.find((pl) => pl.name === lastEntry.name);
    if (p) {
      setPlayers((prev) =>
        prev.map((pl) =>
          pl.id === p.id
            ? { ...pl, drafted: false, draftedBy: null, draftPrice: null }
            : pl
        )
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // undoSale — removes a specific player from a specific team's roster.
  // Used when clicking a filled cell in the draft grid.
  //
  // @param {string} playerName - Name of the player to remove
  // @param {number} teamId     - ID of the team to remove them from
  // ─────────────────────────────────────────────────────────────────────────
  function undoSale(playerName, teamId) {
    const p = players.find((pl) => pl.name === playerName);

    setLeague((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        const entry = t.roster.find((r) => r.name === playerName);
        return {
          ...t,
          budget_remaining: t.budget_remaining + (entry?.price || 0),
          roster: t.roster.filter((r) => r.name !== playerName),
        };
      }),
    }));

    // Return player to available pool
    if (p) {
      setPlayers((prev) =>
        prev.map((pl) =>
          pl.id === p.id
            ? { ...pl, drafted: false, draftedBy: null, draftPrice: null }
            : pl
        )
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // addTaxiPick — assigns a $1 taxi squad pick to a team.
  // Does NOT deduct budget (taxi picks are outside the main auction).
  //
  // @param {Object} player - Player object
  // @param {number} teamId - Team ID to add the taxi pick to
  // ─────────────────────────────────────────────────────────────────────────
  function addTaxiPick(player, teamId) {
    setLeague((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        return {
          ...t,
          taxiSquad: [
            ...(t.taxiSquad || []),
            { name: player.name, price: 1, pos: player.pos },
          ],
        };
      }),
    }));

    // Mark as drafted (taxi) so player doesn't show in the main pool
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === player.id
          ? { ...p, drafted: true, draftedBy: teamId, draftPrice: 1, taxi: true }
          : p
      )
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // saveNote — persists a scouting note for a player ID.
  //
  // @param {number} playerId - Player ID (from players array)
  // @param {string} text     - Note text to save
  // ─────────────────────────────────────────────────────────────────────────
  function saveNote(playerId, text) {
    setNotes((prev) => ({ ...prev, [playerId]: text }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Setup screen (before draft starts)
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === "setup") {
    return <SetupScreen onInit={initDraft} />;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Derived values (re-computed each render)
  // ─────────────────────────────────────────────────────────────────────────
  const myTeam          = league.teams[currentOwnerIdx];
  const rosterPositions = buildRosterPositions(league.roster);
  const totalSlots      = rosterPositions.length;
  const slotsLeft       = totalSlots - (myTeam?.roster?.length || 0);
  const maxBid          = calcMaxBid(myTeam?.budget_remaining || 0, slotsLeft);

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Main draft app
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="app">

      {/* ── Navigation bar ────────────────────────────────────────────────── */}
      <nav className="nav">
        <div className="nav-left">
          {/* League name + season */}
          <div className="nav-brand">
            <div className="nav-league">{league.name}</div>
            <div className="nav-season">SEASON {league.season}</div>
          </div>

          {/* Tab navigation buttons */}
          {[
            ["board",      "Draft Board"],
            ["dictionary", "Player Dictionary"],
            ["settings",   "League Settings"],
            ["keeper",     "Keeper Setup"],
            ["sandbox",    "API Sandbox"],
            ["taxi",       "Taxi Squad"],
          ].map(([tab, label]) => (
            <button
              key={tab}
              className={`nav-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="nav-right">
          {/* API health indicator dot */}
          <div className={`api-dot ${apiStatus}`} />
          <span className="api-status-label">API {apiStatus.toUpperCase()}</span>
          {/* Re-check API status on click */}
          <button
            onClick={checkApiStatus}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 10,
              color: "var(--muted)",
              padding: "2px 6px",
            }}
            title="Re-check API connection"
          >
            ↺
          </button>
          <div className="nav-badge">IN PROGRESS</div>
          <div className="nav-avatar" title="User profile">👤</div>
        </div>
      </nav>

      {/* ── Active Owner bar ──────────────────────────────────────────────── */}
      <div className="owner-bar">
        <div className="owner-info">
          <div>
            <div className="owner-label">YOUR OWNER</div>
            <div className="owner-name">{myTeam?.name}</div>
          </div>
          <div className="owner-verified-badge">
            <span className="verified-check">✓</span>{" "}
            VERIFIED ${league.budget} budget
          </div>
        </div>
        <div className="owner-right">
          {/* Max bid indicator */}
          <div className="max-bid-block">
            <div className="max-bid-label">MAX BID</div>
            <div className="max-bid-value">${maxBid}</div>
          </div>
          {/* Turn indicator */}
          <div className="turn-block">
            <span className="turn-label">Turn</span>
            <span className="turn-name">{myTeam?.name}</span>
            <span className="your-turn-badge">YOUR TURN</span>
          </div>
        </div>
      </div>

      {/* ── Main Content Area (tab-driven) ────────────────────────────────── */}
      <div className="main-content">

        {/* Draft Board — the primary screen */}
        {activeTab === "board" && (
          <DraftBoard
            league={league}
            players={players}
            selectedPlayer={selectedPlayer}
            setSelectedPlayer={setSelectedPlayer}
            onSale={recordSale}
            onUndo={undoLast}
            onUndoCell={undoSale}
            currentOwnerIdx={currentOwnerIdx}
            setCurrentOwnerIdx={setCurrentOwnerIdx}
            notes={notes}
            saveNote={saveNote}
            apiStatus={apiStatus}
            rosterPositions={rosterPositions}
            totalSlots={totalSlots}
            maxBid={maxBid}
          />
        )}

        {/* Player Dictionary — browse and search all players */}
        {activeTab === "dictionary" && (
          <PlayerDictionary
            players={players}
            selectedPlayer={selectedPlayer}
            setSelectedPlayer={setSelectedPlayer}
            notes={notes}
            saveNote={saveNote}
          />
        )}

        {/* League Settings — scoring categories + roster config */}
        {activeTab === "settings" && (
          <LeagueSettings league={league} setLeague={setLeague} />
        )}

        {/* Keeper Setup — pre-draft keeper contracts */}
        {activeTab === "keeper" && (
          <KeeperSetup
            league={league}
            setLeague={setLeague}
            players={players}
          />
        )}

        {/* API Sandbox — raw JSON request/response tester */}
        {activeTab === "sandbox" && (
          <ApiSandbox league={league} apiStatus={apiStatus} />
        )}

        {/* Taxi Squad — $1 reserve picks */}
        {activeTab === "taxi" && (
          <TaxiSquad
            league={league}
            players={players}
            onTaxiPick={addTaxiPick}
            currentOwnerIdx={currentOwnerIdx}
            rosterPositions={rosterPositions}
          />
        )}

      </div>
    </div>
  );
}
