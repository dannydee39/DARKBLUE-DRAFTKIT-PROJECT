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

import { useState, useEffect, useRef } from "react";
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
// SAMPLE_PICKS — hardcoded debug picks for fillSampleDraft().
// slotIndex based on default roster order:
//   [C=0, 1B=1, 2B=2, 3B=3, SS=4, OF=5, OF=6, OF=7, SP=8, SP=9, RP=10, RP=11, UTIL=12, BN=13, BN=14]
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE_PICKS = [
  { name: "Shohei Ohtani",     teamIdx: 0, price: 65, slotIndex: 12, draftedPos: "UTIL" },
  { name: "William Contreras", teamIdx: 0, price: 22, slotIndex: 0,  draftedPos: "C"    },
  { name: "Juan Soto",         teamIdx: 1, price: 72, slotIndex: 5,  draftedPos: "OF"   },
  { name: "Freddie Freeman",   teamIdx: 1, price: 28, slotIndex: 1,  draftedPos: "1B"   },
  { name: "Kyle Tucker",       teamIdx: 2, price: 55, slotIndex: 6,  draftedPos: "OF"   },
  { name: "Francisco Lindor",  teamIdx: 2, price: 38, slotIndex: 4,  draftedPos: "SS"   },
  { name: "Corbin Carroll",    teamIdx: 3, price: 40, slotIndex: 7,  draftedPos: "OF"   },
  { name: "Nolan Arenado",     teamIdx: 3, price: 20, slotIndex: 3,  draftedPos: "3B"   },
  { name: "Elly De La Cruz",   teamIdx: 4, price: 35, slotIndex: 4,  draftedPos: "SS"   },
  { name: "Logan Webb",        teamIdx: 5, price: 25, slotIndex: 8,  draftedPos: "SP"   },
];

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

  // ── Shared valuation cache ────────────────────────────────────────────────
  // Single source of truth for API valuation results, shared across
  // DraftBoard and PlayerDictionary so both panels always show live values.
  // Values: undefined (not fetched) | "loading" | API response object.
  const [valuationCache, setValuationCache] = useState({});
  const inFlightRef     = useRef(new Set());   // player IDs with active requests
  const cacheVersionRef = useRef(0);           // incremented on cache invalidation

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
  // draftStateKey + cache invalidation
  // Clears the entire valuation cache whenever any team's roster changes.
  // This forces fresh API calls after every pick or undo so inflation/scarcity
  // math in the API stays accurate.
  // ─────────────────────────────────────────────────────────────────────────
  const draftStateKey = league.teams.map((t) => t.roster.length).join(",");
  useEffect(() => {
    cacheVersionRef.current += 1;
    inFlightRef.current.clear();
    setValuationCache({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStateKey]);

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
  // requestValuation — shared valuation fetcher for all components.
  //
  // Features:
  //  • De-duplication: skips if an identical request is already in-flight
  //  • Cache hit: skips if a fresh (non-loading) result already exists
  //  • Stale-response guard: discards responses from before the last cache reset
  //
  // @param {Object} player - Player object to valuate
  // ─────────────────────────────────────────────────────────────────────────
  async function requestValuation(player) {
    if (!player || apiStatus !== "online") return;
    // Already has a fresh (non-loading) cache entry — nothing to do
    if (valuationCache[player.id] && valuationCache[player.id] !== "loading") return;
    // Request already in-flight for this player
    if (inFlightRef.current.has(player.id)) return;

    const version = cacheVersionRef.current;
    inFlightRef.current.add(player.id);
    setValuationCache((prev) => ({ ...prev, [player.id]: "loading" }));
    try {
      const draftState = {
        total_teams: league.owners,
        budget_per_team: league.budget,
        scoring_categories: Object.entries(league.scoring)
          .filter(([, v]) => v)
          .map(([k]) => k),
        teams: league.teams.map((t) => ({
          id: t.id,
          budget_remaining: t.budget_remaining,
          roster: t.roster.map((r) => r.name),
        })),
        nominated_player: player.name,
        roster_config: league.roster,
      };
      const r = await fetch(`${API_BASE}/v1/valuate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-License-Key": DEMO_KEY },
        body: JSON.stringify({ license_key: DEMO_KEY, draft_state: draftState }),
      });
      const data = await r.json();
      // Discard stale response if the draft state changed while we were waiting
      if (cacheVersionRef.current === version) {
        setValuationCache((prev) => ({ ...prev, [player.id]: data }));
      }
    } catch {
      if (cacheVersionRef.current === version) {
        setValuationCache((prev) => {
          const next = { ...prev };
          delete next[player.id];
          return next;
        });
      }
    } finally {
      inFlightRef.current.delete(player.id);
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
  //  - Adds a roster entry to the winning team (with slotIndex + draftedPos)
  //  - Marks the player as drafted in the players array
  //
  // @param {Object} player     - Player object from the players array
  // @param {number} price      - Winning bid in dollars
  // @param {number} teamId     - ID of the winning team
  // @param {number} slotIndex  - Roster slot index the player is placed into
  // @param {string} draftedPos - Position label of the slot (e.g. "OF", "UTIL")
  // ─────────────────────────────────────────────────────────────────────────
  function recordSale(player, price, teamId, slotIndex, draftedPos) {
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
            {
              name: player.name,
              price,
              pos: player.pos,
              slotIndex,
              draftedPos,
            },
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
  // fillSampleDraft — hardcodes 10 sample picks for debugging the grid.
  //
  // Finds each player in the players array by name (case-insensitive), then
  // applies all picks at once by calling setLeague and setPlayers once each
  // with fully accumulated changes.
  //
  // Picks use the default roster slot order:
  //   [C=0, 1B=1, 2B=2, 3B=3, SS=4, OF=5, OF=6, OF=7,
  //    SP=8, SP=9, RP=10, RP=11, UTIL=12, BN=13, BN=14]
  // ─────────────────────────────────────────────────────────────────────────
  function fillSampleDraft() {
    // Build accumulated per-team changes: teamId → { budgetDelta, newRoster[] }
    const teamChanges = {};
    // Track which player IDs were drafted so we can update players state at once
    const draftedPlayerIds = new Set();

    SAMPLE_PICKS.forEach((pick) => {
      // Find the player in current players state by name (case-insensitive)
      const player = players.find(
        (p) => p.name.toLowerCase() === pick.name.toLowerCase()
      );
      if (!player) return; // player not found in pool, skip

      // Get the team for this pick
      const team = league.teams[pick.teamIdx];
      if (!team) return; // team index out of range, skip

      // Skip if player already drafted (e.g., sample called twice)
      if (player.drafted) return;

      // Accumulate changes for this team
      if (!teamChanges[team.id]) {
        teamChanges[team.id] = { budgetDelta: 0, newRoster: [] };
      }
      teamChanges[team.id].budgetDelta -= pick.price;
      teamChanges[team.id].newRoster.push({
        name: player.name,
        price: pick.price,
        pos: player.pos,
        slotIndex: pick.slotIndex,
        draftedPos: pick.draftedPos,
      });

      draftedPlayerIds.add(player.id);
    });

    // Apply all team changes in a single setLeague call
    setLeague((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        const changes = teamChanges[t.id];
        if (!changes) return t;
        return {
          ...t,
          budget_remaining: t.budget_remaining + changes.budgetDelta,
          roster: [...t.roster, ...changes.newRoster],
        };
      }),
    }));

    // Mark all drafted players in a single setPlayers call
    setPlayers((prev) =>
      prev.map((p) =>
        draftedPlayerIds.has(p.id)
          ? { ...p, drafted: true }
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
          {/* Sample Draft debug button — only shown on the board tab */}
          {activeTab === "board" && (
            <button
              onClick={fillSampleDraft}
              title="Fill 10 sample picks for debugging the draft grid"
              style={{
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.35)",
                color: "#f59e0b",
                fontSize: 10,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: "var(--radius)",
                cursor: "pointer",
                letterSpacing: "0.04em",
                flexShrink: 0,
              }}
            >
              Sample Draft
            </button>
          )}

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
            onFillSample={fillSampleDraft}
            currentOwnerIdx={currentOwnerIdx}
            setCurrentOwnerIdx={setCurrentOwnerIdx}
            notes={notes}
            saveNote={saveNote}
            apiStatus={apiStatus}
            rosterPositions={rosterPositions}
            totalSlots={totalSlots}
            maxBid={maxBid}
            valuationCache={valuationCache}
            requestValuation={requestValuation}
            draftStateKey={draftStateKey}
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
            valuationCache={valuationCache}
            requestValuation={requestValuation}
            draftStateKey={draftStateKey}
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
