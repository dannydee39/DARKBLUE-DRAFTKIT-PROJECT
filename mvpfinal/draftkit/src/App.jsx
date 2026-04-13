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
//   └─ LeagueSettings (receives league + safe-save handler)
//   └─ KeeperSetup (receives league + setLeague + players)
//   └─ TaxiSquad (receives league + players + onTaxiPick)
//   └─ ApiSandbox (receives league + apiStatus)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import "./styles.css";

// ── Named imports from modular components ─────────────────────────────────────
import SetupScreen from "./components/SetupScreen.jsx";
import AuthModal from "./components/AuthModal.jsx";
import DraftBoard from "./components/DraftBoard.jsx";
import PlayerDictionary from "./components/PlayerDictionary.jsx";
import LeagueSettings from "./components/LeagueSettings.jsx";
import KeeperSetup from "./components/KeeperSetup.jsx";
import TaxiSquad from "./components/TaxiSquad.jsx";
import ApiSandbox from "./components/ApiSandbox.jsx";

// ── Shared constants and helpers ──────────────────────────────────────────────
import {
  API_BASE,
  DEMO_KEY,
  DEFAULT_ROSTER,
  DEFAULT_SCORING,
} from "./constants.js";
import { buildRosterPositions, calcMaxBid } from "./utils/helpers.js";
import {
  createCloudDraft,
  deleteCloudDraft,
  getCurrentUser,
  listCloudDrafts,
  login as loginToCloud,
  logout as logoutFromCloud,
  markCloudDraftOpened,
  signup as signupForCloud,
  updateCloudDraft,
} from "./utils/cloudApi.js";
import {
  buildDraftRecord,
  buildCloudDraftPayload,
  buildTeamsFromConfig,
  cloneLeagueConfig,
  clonePlayers,
  countDraftEntries,
  createDraftId,
  DRAFT_LIBRARY_STORAGE_KEY,
  formatPoolLabel,
  hasDraftStarted,
  hydratePlayersFromLeague,
  validateLeagueConfig,
} from "./utils/draftSessions.js";

const MAX_HISTORY_SNAPSHOTS = 30;
const VALUATION_REQUEST_TIMEOUT_MS = 7000;
const VALUATION_ERROR_RETRY_MS = 10000;
const CLOUD_SAVE_DEBOUNCE_MS = 900;

const DEFAULT_LEAGUE = {
  name: "",
  season: "2025",
  owners: 12,
  budget: 260,
  pool: "MLB",
  roster: { ...DEFAULT_ROSTER },
  scoring: { ...DEFAULT_SCORING },
  keeperLeague: true,
  commissionerUnlocked: false,
  teams: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE_PICKS — hardcoded debug picks for fillSampleDraft().
// slotIndex based on default roster order:
//   [C=0, 1B=1, 2B=2, 3B=3, SS=4, OF=5, OF=6, OF=7, SP=8, SP=9, RP=10, RP=11, UTIL=12, BN=13, BN=14]
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE_PICKS = [
  {
    name: "Shohei Ohtani",
    teamIdx: 0,
    price: 65,
    slotIndex: 12,
    draftedPos: "UTIL",
  },
  {
    name: "William Contreras",
    teamIdx: 0,
    price: 22,
    slotIndex: 0,
    draftedPos: "C",
  },
  { name: "Juan Soto", teamIdx: 1, price: 72, slotIndex: 5, draftedPos: "OF" },
  {
    name: "Freddie Freeman",
    teamIdx: 1,
    price: 28,
    slotIndex: 1,
    draftedPos: "1B",
  },
  {
    name: "Kyle Tucker",
    teamIdx: 2,
    price: 55,
    slotIndex: 6,
    draftedPos: "OF",
  },
  {
    name: "Francisco Lindor",
    teamIdx: 2,
    price: 38,
    slotIndex: 4,
    draftedPos: "SS",
  },
  {
    name: "Corbin Carroll",
    teamIdx: 3,
    price: 40,
    slotIndex: 7,
    draftedPos: "OF",
  },
  {
    name: "Nolan Arenado",
    teamIdx: 3,
    price: 20,
    slotIndex: 3,
    draftedPos: "3B",
  },
  {
    name: "Elly De La Cruz",
    teamIdx: 4,
    price: 35,
    slotIndex: 4,
    draftedPos: "SS",
  },
  { name: "Logan Webb", teamIdx: 5, price: 25, slotIndex: 8, draftedPos: "SP" },
];

// ─────────────────────────────────────────────────────────────────────────────
// App — root component
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Screen / tab routing ──────────────────────────────────────────────────
  // "setup" shows the league creation screen; "main" shows the full draft app.
  const [screen, setScreen] = useState("setup");
  const [activeTab, setActiveTab] = useState("board");
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [libraryReady, setLibraryReady] = useState(false);
  const [storageMode, setStorageMode] = useState("local");
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [cloudSyncMessage, setCloudSyncMessage] = useState("");
  const cloudSaveTimeoutRef = useRef(null);

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

  // ── Per-player notes (persisted inside the saved draft workspace) ─────────
  // Map of { [playerId]: noteText }. Saved when user blurs a notes textarea.
  const [notes, setNotes] = useState({});
  const [favorites, setFavorites] = useState({});

  // ── Shared valuation cache ────────────────────────────────────────────────
  // Single source of truth for API valuation results, shared across
  // DraftBoard and PlayerDictionary so both panels always show live values.
  // Values: undefined (not fetched) | "loading" | API response object.
  const [valuationCache, setValuationCache] = useState({});
  const valuationCacheRef = useRef({}); // mirrors valuationCache; used in requestValuation
  // to avoid stale-closure reads of the state variable
  const inFlightRef = useRef(new Set()); // player IDs with active requests
  const loadingStartedRef = useRef({}); // playerId -> request start timestamp
  const cacheVersionRef = useRef(0); // incremented on cache invalidation

  // Keep the ref in sync with state so requestValuation always reads fresh values
  // even when called from inside a stale closure after a cache-clear.
  useEffect(() => {
    valuationCacheRef.current = valuationCache;
  }, [valuationCache]);

  // ── Current active owner (index into league.teams) ────────────────────────
  // Controls which team row is highlighted and whose budget/max-bid is shown.
  const [currentOwnerIdx, setCurrentOwnerIdx] = useState(0);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [boardNotice, setBoardNotice] = useState(null);

  // ── League configuration object ───────────────────────────────────────────
  // This is the single source of truth for the currently open draft workspace.
  // Teams array is populated when the user creates or resumes a draft.
  const [league, setLeague] = useState({ ...DEFAULT_LEAGUE });

  // ─────────────────────────────────────────────────────────────────────────
  // Effect: Poll API health on mount.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    checkApiStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!boardNotice) return;
    const timeoutId = window.setTimeout(() => setBoardNotice(null), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [boardNotice]);

  useEffect(() => {
    if (!cloudSyncMessage) return;
    const timeoutId = window.setTimeout(() => setCloudSyncMessage(""), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [cloudSyncMessage]);

  function clearDraftHistory() {
    setUndoStack([]);
    setRedoStack([]);
  }

  function captureDraftSnapshot() {
    return {
      league: cloneLeagueConfig(league),
      players: clonePlayers(players),
      currentOwnerIdx,
      selectedPlayerId: selectedPlayer?.id ?? null,
    };
  }

  function restoreDraftSnapshot(snapshot) {
    if (!snapshot) return;

    const restoredLeague = cloneLeagueConfig(snapshot.league);
    const restoredPlayers = clonePlayers(snapshot.players || []);
    const nextOwnerIdx = Math.min(
      snapshot.currentOwnerIdx || 0,
      Math.max((restoredLeague.teams?.length || 1) - 1, 0),
    );

    setLeague(restoredLeague);
    setPlayers(restoredPlayers);
    setCurrentOwnerIdx(nextOwnerIdx);
    setSelectedPlayer(
      snapshot.selectedPlayerId != null
        ? restoredPlayers.find(
            (player) => player.id === snapshot.selectedPlayerId,
          ) || null
        : null,
    );
  }

  function pushUndoSnapshot() {
    const snapshot = captureDraftSnapshot();
    setUndoStack((prev) => [
      ...prev.slice(-(MAX_HISTORY_SNAPSHOTS - 1)),
      snapshot,
    ]);
    setRedoStack([]);
  }

  function readLocalDraftLibrary() {
    try {
      const raw = window.localStorage.getItem(DRAFT_LIBRARY_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map((draft) => ({
        ...draft,
        source: draft.source || "local",
      }));
    } catch {
      return [];
    }
  }

  async function fetchCloudDraftLibrary() {
    const response = await listCloudDrafts();
    return (response.drafts || []).map((draft) => ({
      ...draft,
      source: "cloud",
    }));
  }

  async function hydrateDraftPlayers(draft) {
    if (draft?.players?.length) {
      return clonePlayers(draft.players);
    }

    const livePlayers = await fetchPlayers(draft.league || DEFAULT_LEAGUE);
    return hydratePlayersFromLeague(livePlayers, draft.league || {});
  }

  async function refreshCloudDraftLibrary() {
    const cloudDrafts = await fetchCloudDraftLibrary();
    const localDrafts = readLocalDraftLibrary().filter(
      (localDraft) => !cloudDrafts.some((cloudDraft) => cloudDraft.id === localDraft.id),
    );
    setStorageMode("cloud");
    setSavedDrafts([...cloudDrafts, ...localDrafts]);
    return cloudDrafts;
  }

  function upsertDraftInLibrary(record) {
    setSavedDrafts((prev) => {
      const next = prev.filter((draft) => draft.id !== record.id);
      return [{ ...record }, ...next];
    });
  }

  async function persistCloudDraftRecord(record, options = {}) {
    const payload = buildCloudDraftPayload(record);
    const response = options.forceCreate
      ? await createCloudDraft(payload)
      : record.source === "cloud"
      ? await updateCloudDraft(payload)
      : await createCloudDraft(payload);
    return {
      ...record,
      source: "cloud",
      updatedAt: response?.draft?.updatedAt || record.updatedAt,
      lastOpenedAt: response?.draft?.lastOpenedAt || record.lastOpenedAt,
    };
  }

  async function promoteActiveDraftToCloud() {
    if (screen !== "main" || !activeDraftId) return;

    const record = buildDraftRecord({
      id: activeDraftId,
      league,
      players,
      notes,
      favorites,
      currentOwnerIdx,
      createdAt: savedDrafts.find((draft) => draft.id === activeDraftId)?.createdAt,
    });

    const persisted = await persistCloudDraftRecord({
      ...record,
      source: "cloud",
    }, { forceCreate: true });
    upsertDraftInLibrary(persisted);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Draft library hydration + persistence
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setSavedDrafts(readLocalDraftLibrary());
    setLibraryReady(true);
  }, []);

  useEffect(() => {
    if (!libraryReady) return;
    window.localStorage.setItem(
      DRAFT_LIBRARY_STORAGE_KEY,
      JSON.stringify(savedDrafts.filter((draft) => (draft.source || "local") !== "cloud")),
    );
  }, [savedDrafts, libraryReady]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateAuth() {
      try {
        const response = await getCurrentUser();
        if (cancelled) return;
        if (response?.authenticated && response?.user) {
          setUser(response.user);
          await refreshCloudDraftLibrary();
        } else {
          setUser(null);
          setStorageMode("local");
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setStorageMode("local");
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    }

    hydrateAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!libraryReady || !activeDraftId || screen !== "main") return;
    const current = savedDrafts.find((draft) => draft.id === activeDraftId);
    if (!current) return;

    const nextRecord = {
      ...current,
      ...buildDraftRecord({
        id: activeDraftId,
        league,
        players,
        notes,
        favorites,
        currentOwnerIdx,
        createdAt: current.createdAt,
      }),
    };

    upsertDraftInLibrary(nextRecord);

    if (cloudSaveTimeoutRef.current) {
      window.clearTimeout(cloudSaveTimeoutRef.current);
    }

    if (user && nextRecord.source === "cloud") {
      cloudSaveTimeoutRef.current = window.setTimeout(async () => {
        try {
          const persisted = await persistCloudDraftRecord({
            ...nextRecord,
            source: "cloud",
          });
          setCloudSyncMessage("Cloud draft saved.");
          upsertDraftInLibrary(persisted);
        } catch (error) {
          setCloudSyncMessage(
            error?.message || "Cloud save failed. Keeping the local in-memory draft open.",
          );
        }
      }, CLOUD_SAVE_DEBOUNCE_MS);
    }

    return () => {
      if (cloudSaveTimeoutRef.current) {
        window.clearTimeout(cloudSaveTimeoutRef.current);
      }
    };
  }, [
    activeDraftId,
    currentOwnerIdx,
    favorites,
    league,
    libraryReady,
    notes,
    players,
    screen,
    storageMode,
    user,
  ]);

  useEffect(() => {
    setCurrentOwnerIdx((prev) =>
      Math.min(prev, Math.max((league.teams?.length || 1) - 1, 0)),
    );
  }, [league.teams?.length]);

  // ─────────────────────────────────────────────────────────────────────────
  // draftStateKey + cache invalidation
  // Clears the entire valuation cache whenever any team's roster changes.
  // This forces fresh API calls after every pick or undo so inflation/scarcity
  // math in the API stays accurate.
  // ─────────────────────────────────────────────────────────────────────────
  // Include budget_remaining so that partial picks (same count, diff spend)
  // still invalidate the cache and trigger fresh valuations.
  const draftStateKey = league.teams
    .map((t) => `${t.roster.length}:${t.budget_remaining}`)
    .join(",");
  useEffect(() => {
    cacheVersionRef.current += 1;
    inFlightRef.current.clear();
    loadingStartedRef.current = {};
    // BUG FIX: clear the ref SYNCHRONOUSLY here, not just via the
    // valuationCache state→useEffect chain. The pre-fetch in DraftBoard
    // reads from valuationCacheRef directly to avoid stale closures.
    // Without this sync clear, the ref still holds old entries when the
    // pre-fetch fires (React effects run top-down after each render, so
    // the ref-sync effect below hasn't run yet), and requestValuation
    // sees cache hits that don't exist — silently skipping re-fetches
    // after every pick. Values then appear frozen until a manual click.
    valuationCacheRef.current = {};
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
    if (!player) return;
    // Read from ref (not state) to avoid stale closure — state variable would
    // still reference the old cache object after a cache-clear triggered by a pick.
    const cached = valuationCacheRef.current[player.id];
    if (cached && cached !== "loading" && !cached?.error) return;
    if (
      cached?.error &&
      Date.now() - (cached.timestamp || 0) < VALUATION_ERROR_RETRY_MS
    ) {
      return;
    }
    if (
      cached === "loading" &&
      Date.now() - (loadingStartedRef.current[player.id] || 0) <
        VALUATION_REQUEST_TIMEOUT_MS
    ) {
      return;
    }
    if (apiStatus !== "online") {
      setValuationCache((prev) => ({
        ...prev,
        [player.id]: {
          error: true,
          message: "Live valuation is offline. Showing the base value instead.",
          timestamp: Date.now(),
        },
      }));
      return;
    }
    // Request already in-flight for this player
    if (inFlightRef.current.has(player.id)) return;

    const version = cacheVersionRef.current;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      VALUATION_REQUEST_TIMEOUT_MS,
    );
    inFlightRef.current.add(player.id);
    loadingStartedRef.current[player.id] = Date.now();
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
        headers: {
          "Content-Type": "application/json",
          "X-License-Key": DEMO_KEY,
        },
        signal: controller.signal,
        body: JSON.stringify({
          license_key: DEMO_KEY,
          draft_state: draftState,
        }),
      });
      const data = await r.json();
      // Discard stale response if the draft state changed while we were waiting
      if (cacheVersionRef.current === version) {
        if (!r.ok || data?.error || data?.max_bid_recommendation == null) {
          setValuationCache((prev) => ({
            ...prev,
            [player.id]: {
              error: true,
              message:
                data?.message ||
                data?.error ||
                "Live valuation was unavailable. Showing the base value instead.",
              timestamp: Date.now(),
            },
          }));
        } else {
          setValuationCache((prev) => ({ ...prev, [player.id]: data }));
        }
      }
    } catch (error) {
      if (cacheVersionRef.current === version) {
        setValuationCache((prev) => ({
          ...prev,
          [player.id]: {
            error: true,
            message:
              error?.name === "AbortError"
                ? "Live valuation timed out. Showing the base value instead."
                : error?.message ||
                  "Live valuation was unavailable. Showing the base value instead.",
            timestamp: Date.now(),
          },
        }));
      }
    } finally {
      window.clearTimeout(timeoutId);
      inFlightRef.current.delete(player.id);
      delete loadingStartedRef.current[player.id];
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
        leagueData?.pool === "AL"
          ? "AL"
          : leagueData?.pool === "NL"
            ? "NL"
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

  async function handleSignup(credentials) {
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await signupForCloud(credentials);
      setUser(response.user);
      setShowAuthModal(false);
      setCloudSyncMessage("Account created. Cloud draft sync is active.");
      await refreshCloudDraftLibrary();
      try {
        await promoteActiveDraftToCloud();
      } catch (error) {
        setCloudSyncMessage(
          error?.message ||
            "Signed in, but the current draft could not be promoted to cloud yet.",
        );
      }
    } catch (error) {
      setAuthError(error?.message || "Account creation failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogin(credentials) {
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await loginToCloud(credentials);
      setUser(response.user);
      setShowAuthModal(false);
      setCloudSyncMessage("Signed in. Cloud draft sync is active.");
      await refreshCloudDraftLibrary();
      try {
        await promoteActiveDraftToCloud();
      } catch (error) {
        setCloudSyncMessage(
          error?.message ||
            "Signed in, but the current draft could not be promoted to cloud yet.",
        );
      }
    } catch (error) {
      setAuthError(error?.message || "Sign in failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    setAuthBusy(true);
    setAuthError("");
    try {
      await logoutFromCloud();
      setUser(null);
      setStorageMode("local");
      setSavedDrafts((prev) => {
        const localDrafts = readLocalDraftLibrary();
        if (!activeDraftId || screen !== "main") return localDrafts;

        const snapshot = buildDraftRecord({
          id: activeDraftId,
          league,
          players,
          notes,
          favorites,
          currentOwnerIdx,
        });

        return [
          { ...snapshot, source: "local" },
          ...localDrafts.filter((draft) => draft.id !== activeDraftId),
        ];
      });
      setShowAuthModal(false);
      setCloudSyncMessage("Signed out. Current draft remains available locally in this browser.");
    } catch (error) {
      setAuthError(error?.message || "Sign out failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // initDraft — called when the user submits the setup form.
  // Creates the teams array, fetches the player pool, and transitions
  // to the main draft screen.
  //
  // @param {Object} formLeague - League config collected from SetupScreen
  // ─────────────────────────────────────────────────────────────────────────
  async function initDraft(formLeague) {
    const normalized = cloneLeagueConfig(formLeague);
    const validation = validateLeagueConfig(normalized);
    if (validation.errors.length > 0) return;

    const lg = {
      ...normalized,
      teams: buildTeamsFromConfig(normalized),
    };
    const loadedPlayers = await fetchPlayers(lg);
    const draftId = createDraftId();

    setActiveDraftId(draftId);
    setLeague(lg);
    setPlayers(loadedPlayers);
    setNotes({});
    setFavorites({});
    setSelectedPlayer(null);
    setScreen("main");
    setActiveTab("board");
    setCurrentOwnerIdx(0);
    clearDraftHistory();
    setBoardNotice({
      tone: "info",
      message: "New draft workspace initialized.",
    });

    const record = buildDraftRecord({
      id: draftId,
      league: lg,
      players: loadedPlayers,
      notes: {},
      favorites: {},
      currentOwnerIdx: 0,
    });

    upsertDraftInLibrary({
      ...record,
      source: "local",
    });

    if (user) {
      try {
        const persisted = await persistCloudDraftRecord({
          ...record,
          source: "cloud",
        }, { forceCreate: true });
        upsertDraftInLibrary(persisted);
        setStorageMode("cloud");
        setCloudSyncMessage("Draft created in your cloud library.");
      } catch (error) {
        setStorageMode("local");
        upsertDraftInLibrary({ ...record, source: "local" });
        setCloudSyncMessage(
          error?.message || "Cloud save failed. This draft is local only for now.",
        );
      }
    }
  }

  async function resumeDraft(draftId) {
    const draft = savedDrafts.find((entry) => entry.id === draftId);
    if (!draft) return;

    const restoredLeague = cloneLeagueConfig(draft.league);
    const restoredPlayers = await hydrateDraftPlayers(draft);
    const restoredNotes = { ...(draft.notes || {}) };
    const restoredFavorites = { ...(draft.favorites || {}) };
    const ownerIdx = Math.min(
      draft.currentOwnerIdx || 0,
      Math.max((restoredLeague.teams?.length || 1) - 1, 0),
    );

    setActiveDraftId(draftId);
    setLeague(restoredLeague);
    setPlayers(restoredPlayers);
    setNotes(restoredNotes);
    setFavorites(restoredFavorites);
    setSelectedPlayer(null);
    setScreen("main");
    setActiveTab("board");
    setCurrentOwnerIdx(ownerIdx);
    clearDraftHistory();
    setBoardNotice({
      tone: "info",
      message: `Resumed ${restoredLeague.name || "saved draft"}.`,
    });

    upsertDraftInLibrary({
      ...draft,
      players: restoredPlayers,
      lastOpenedAt: new Date().toISOString(),
    });

    if (draft.source === "cloud") {
      try {
        const response = await markCloudDraftOpened(draftId);
        upsertDraftInLibrary({
          ...draft,
          players: restoredPlayers,
          source: "cloud",
          lastOpenedAt: response?.draft?.lastOpenedAt || new Date().toISOString(),
        });
      } catch {
        // keep the local in-memory resume path functional even if the open ping fails
      }
    }
  }

  async function duplicateDraft(draftId) {
    const draft = savedDrafts.find((entry) => entry.id === draftId);
    if (!draft) return;

    const copyId = createDraftId();
    const copiedLeague = cloneLeagueConfig(draft.league);
    copiedLeague.name = `${copiedLeague.name || "Draft"} Copy`;
    const duplicatedPlayers = draft.players?.length
      ? clonePlayers(draft.players || [])
      : await hydrateDraftPlayers(draft);

    const copy = buildDraftRecord({
      id: copyId,
      league: copiedLeague,
      players: duplicatedPlayers,
      notes: { ...(draft.notes || {}) },
      favorites: { ...(draft.favorites || {}) },
      currentOwnerIdx: draft.currentOwnerIdx || 0,
    });

    upsertDraftInLibrary({
      ...copy,
      source: user ? "local" : draft.source || storageMode,
    });
    setActiveDraftId(copyId);
    setLeague(cloneLeagueConfig(copy.league));
    setPlayers(clonePlayers(copy.players || duplicatedPlayers));
    setNotes({ ...(copy.notes || {}) });
    setFavorites({ ...(copy.favorites || {}) });
    setSelectedPlayer(null);
    setScreen("main");
    setActiveTab("board");
    setCurrentOwnerIdx(copy.currentOwnerIdx || 0);
    clearDraftHistory();
    setBoardNotice({
      tone: "info",
      message: `Opened duplicate workspace for ${copiedLeague.name}.`,
    });

    if (user) {
      try {
        const persisted = await persistCloudDraftRecord({
          ...copy,
          source: "cloud",
        }, { forceCreate: true });
        upsertDraftInLibrary(persisted);
        setStorageMode("cloud");
      } catch (error) {
        setCloudSyncMessage(
          error?.message || "Cloud duplicate failed. The copy is available locally.",
        );
      }
    }
  }

  async function deleteDraft(draftId) {
    if (!window.confirm("Delete this saved draft workspace?")) return;

    const draft = savedDrafts.find((entry) => entry.id === draftId);
    if (draft?.source === "cloud") {
      try {
        await deleteCloudDraft(draftId);
      } catch (error) {
        setBoardNotice({
          tone: "warning",
          message:
            error?.message || "Could not delete that cloud draft right now.",
        });
        return;
      }
    }

    setSavedDrafts((prev) => prev.filter((entry) => entry.id !== draftId));
    if (draftId === activeDraftId) {
      setActiveDraftId(null);
      setLeague({ ...DEFAULT_LEAGUE });
      setPlayers([]);
      setNotes({});
      setFavorites({});
      setSelectedPlayer(null);
      setCurrentOwnerIdx(0);
      clearDraftHistory();
      setBoardNotice(null);
      setScreen("setup");
      setActiveTab("board");
    }
  }

  async function applyLeagueSettings(nextLeagueConfig) {
    const normalized = cloneLeagueConfig(nextLeagueConfig);
    const validation = validateLeagueConfig(normalized);
    if (validation.errors.length > 0) {
      return { ok: false, message: validation.errors[0] };
    }

    const draftStarted = hasDraftStarted(league);

    if (!draftStarted) {
      const nextLeague = {
        ...normalized,
        commissionerUnlocked: false,
        teams: buildTeamsFromConfig(normalized, league.teams),
      };

      setLeague(nextLeague);
      if (nextLeague.pool !== league.pool) {
        const loadedPlayers = await fetchPlayers(nextLeague);
        setPlayers(loadedPlayers);
      }

      return {
        ok: true,
        message:
          "Pre-draft setup saved. Owners, pool, budget, and roster structure are updated for this draft workspace.",
      };
    }

    const rosterShrinks = Object.entries(normalized.roster || {}).some(
      ([slot, count]) =>
        Number(count || 0) < Number(league.roster?.[slot] || 0),
    );

    if (normalized.commissionerUnlocked && rosterShrinks) {
      return {
        ok: false,
        message:
          "Commissioner override can expand roster counts mid-draft, but it will not shrink existing slot totals.",
      };
    }

    pushUndoSnapshot();

    setLeague((prev) => ({
      ...prev,
      name: normalized.name,
      season: normalized.season,
      scoring: normalized.scoring,
      keeperLeague: normalized.keeperLeague,
      commissionerUnlocked: normalized.commissionerUnlocked,
      budget: normalized.commissionerUnlocked ? normalized.budget : prev.budget,
      roster: normalized.commissionerUnlocked ? normalized.roster : prev.roster,
      teams: normalized.commissionerUnlocked
        ? prev.teams.map((team) => {
            const spent = prev.budget - team.budget_remaining;
            return {
              ...team,
              budget_remaining: Math.max(0, normalized.budget - spent),
            };
          })
        : prev.teams,
    }));

    const ignoredChanges = [];
    if (normalized.owners !== league.owners) ignoredChanges.push("owner count");
    if (normalized.pool !== league.pool) ignoredChanges.push("player pool");

    return {
      ok: true,
      message: normalized.commissionerUnlocked
        ? `Commissioner override saved metadata, budget, and expanded roster settings.${ignoredChanges.length ? ` Ignored mid-draft changes to ${ignoredChanges.join(" and ")}.` : ""}`
        : "Saved editable league metadata. Core setup fields stay locked after the draft starts.",
    };
  }

  function canPlayerFillSlot(player, slotPos) {
    if (!player || !slotPos) return false;

    const normalizedSlot = String(slotPos).trim().toUpperCase();
    const positions = (player.pos || []).map((pos) =>
      String(pos).trim().toUpperCase(),
    );

    if (normalizedSlot === "BN") return true;
    if (normalizedSlot === "UTIL") {
      return positions.some((pos) => !["SP", "RP"].includes(pos));
    }
    return positions.includes(normalizedSlot);
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
  function recordSale(
    player,
    price,
    teamId,
    slotIndex,
    draftedPos,
    options = {},
  ) {
    const slotLabels = buildRosterPositions(league.roster);
    const slotPos = slotLabels[slotIndex];
    const currentTeam = league.teams.find((team) => team.id === teamId);
    const currentPlayer = players.find(
      (candidate) => candidate.id === player?.id,
    );
    const effectivePlayer = currentPlayer
      ? {
          ...currentPlayer,
          pos: Array.from(
            new Set([
              ...(currentPlayer.pos || []),
              ...(player?.pos || []).map((pos) =>
                String(pos).trim().toUpperCase(),
              ),
            ]),
          ),
        }
      : null;
    const numericPrice = Number(price);

    if (!currentTeam) {
      setBoardNotice({
        tone: "warning",
        message: "Could not record sale because that team no longer exists.",
      });
      return false;
    }

    if (!currentPlayer) {
      setBoardNotice({
        tone: "warning",
        message:
          "Could not record sale because that player is missing from the pool.",
      });
      return false;
    }

    if (currentPlayer.drafted) {
      setBoardNotice({
        tone: "warning",
        message: `${currentPlayer.name} is already drafted in this workspace.`,
      });
      return false;
    }

    if (!Number.isFinite(numericPrice) || numericPrice < 1) {
      setBoardNotice({
        tone: "warning",
        message: "Sale amount must be a valid dollar value.",
      });
      return false;
    }

    if (slotPos == null || draftedPos !== slotPos) {
      setBoardNotice({
        tone: "warning",
        message:
          "The selected roster slot is no longer valid. Re-open the sale modal and try again.",
      });
      return false;
    }

    if (!canPlayerFillSlot(effectivePlayer, slotPos)) {
      setBoardNotice({
        tone: "warning",
        message: `${currentPlayer.name} cannot be placed into the ${slotPos} slot.`,
      });
      return false;
    }

    if (currentTeam.roster.some((entry) => entry.slotIndex === slotIndex)) {
      setBoardNotice({
        tone: "warning",
        message: `${currentTeam.name} already has a player in that slot.`,
      });
      return false;
    }

    if (currentTeam.budget_remaining < numericPrice) {
      setBoardNotice({
        tone: "warning",
        message: `${currentTeam.name} only has $${currentTeam.budget_remaining} left, so this sale would overrun the budget.`,
      });
      return false;
    }

    const actionTime = Date.now();
    pushUndoSnapshot();

    // Update the winning team's budget and roster
    setLeague((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        return {
          ...t,
          budget_remaining: t.budget_remaining - numericPrice,
          roster: [
            ...t.roster,
            {
              playerId: currentPlayer.id,
              name: player.name,
              price: numericPrice,
              pos: effectivePlayer.pos,
              slotIndex,
              draftedPos,
              draftedAt: actionTime,
            },
          ],
        };
      }),
    }));

    // Mark the player as drafted in the pool
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === player.id
          ? {
              ...p,
              drafted: true,
              draftedBy: teamId,
              draftPrice: numericPrice,
              draftedAt: actionTime,
            }
          : p,
      ),
    );

    setBoardNotice({
      tone: "success",
      message:
        options.notice ||
        `${player.name} recorded to ${currentTeam.name} for $${numericPrice}.`,
    });
    return true;
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
    const baseTime = Date.now();
    pushUndoSnapshot();

    // Build accumulated per-team changes: teamId → { budgetDelta, newRoster[] }
    const teamChanges = {};
    // Track which player IDs were drafted so we can update players state at once
    const draftedPlayerIds = new Set();

    SAMPLE_PICKS.forEach((pick) => {
      // Find the player in current players state by name (case-insensitive)
      const player = players.find(
        (p) => p.name.toLowerCase() === pick.name.toLowerCase(),
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
        playerId: player.id,
        name: player.name,
        price: pick.price,
        pos: player.pos,
        slotIndex: pick.slotIndex,
        draftedPos: pick.draftedPos,
        draftedAt: baseTime + draftedPlayerIds.size,
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
          ? { ...p, drafted: true, draftedAt: baseTime + p.id }
          : p,
      ),
    );

    setBoardNotice({
      tone: "info",
      message: "Sample draft loaded for board QA.",
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // undoLast — undoes the most recent recorded sale across all teams.
  //
  // Finds the team with the last roster entry (by scanning teams in reverse),
  // removes that entry, and restores the player to the available pool.
  // ─────────────────────────────────────────────────────────────────────────
  function undoLast() {
    undoLastAction();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // undoSale — removes a specific player from a specific team's roster.
  // Used when clicking a filled cell in the draft grid.
  //
  // @param {string} playerName - Name of the player to remove
  // @param {number} teamId     - ID of the team to remove them from
  // ─────────────────────────────────────────────────────────────────────────
  function undoSale(playerId, teamId, slotIndex) {
    const p = players.find((pl) => pl.id === playerId);
    const team = league.teams.find((entry) => entry.id === teamId);
    const rosterEntry = team?.roster.find(
      (entry) =>
        entry.slotIndex === slotIndex &&
        (entry.playerId === playerId || entry.name === p?.name),
    );

    if (!team || !rosterEntry) {
      setBoardNotice({
        tone: "warning",
        message:
          "Could not remove that player because the roster entry changed.",
      });
      return;
    }

    pushUndoSnapshot();

    setLeague((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        return {
          ...t,
          budget_remaining: t.budget_remaining + (rosterEntry?.price || 0),
          roster: t.roster.filter(
            (r) =>
              !(
                r.slotIndex === slotIndex &&
                (r.playerId === playerId || r.name === rosterEntry.name)
              ),
          ),
        };
      }),
    }));

    // Return player to available pool
    if (p) {
      setPlayers((prev) =>
        prev.map((pl) =>
          pl.id === p.id
            ? {
                ...pl,
                drafted: false,
                draftedBy: null,
                draftPrice: null,
                draftedAt: null,
              }
            : pl,
        ),
      );
    }

    setBoardNotice({
      tone: "warning",
      message: `${rosterEntry.name} removed from the board.`,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // addTaxiPick — assigns a $1 taxi squad pick to a team.
  // Does NOT deduct budget (taxi picks are outside the main auction).
  //
  // @param {Object} player - Player object
  // @param {number} teamId - Team ID to add the taxi pick to
  // ─────────────────────────────────────────────────────────────────────────
  function addTaxiPick(player, teamId) {
    pushUndoSnapshot();

    setLeague((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        return {
          ...t,
          taxiSquad: [
            ...(t.taxiSquad || []),
            {
              playerId: player.id,
              name: player.name,
              price: 1,
              pos: player.pos,
            },
          ],
        };
      }),
    }));

    // Mark as drafted (taxi) so player doesn't show in the main pool
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === player.id
          ? {
              ...p,
              drafted: true,
              draftedBy: teamId,
              draftPrice: 1,
              taxi: true,
            }
          : p,
      ),
    );

    setBoardNotice({
      tone: "info",
      message: `${player.name} added to taxi squad for $1.`,
    });
  }

  function redoLastAction() {
    if (redoStack.length === 0) return;
    const snapshot = redoStack[redoStack.length - 1];
    const currentSnapshot = captureDraftSnapshot();
    setUndoStack((prevUndo) => [
      ...prevUndo.slice(-(MAX_HISTORY_SNAPSHOTS - 1)),
      currentSnapshot,
    ]);
    setRedoStack((prevRedo) => prevRedo.slice(0, -1));
    restoreDraftSnapshot(snapshot);
    setBoardNotice({
      tone: "info",
      message: "Redid the last reverted board change.",
    });
  }

  function redoLast() {
    redoLastAction();
  }

  function undoLastAction() {
    if (undoStack.length === 0) return;
    const snapshot = undoStack[undoStack.length - 1];
    const currentSnapshot = captureDraftSnapshot();
    setRedoStack((prevRedo) => [
      ...prevRedo.slice(-(MAX_HISTORY_SNAPSHOTS - 1)),
      currentSnapshot,
    ]);
    setUndoStack((prevUndo) => prevUndo.slice(0, -1));
    restoreDraftSnapshot(snapshot);
    setBoardNotice({
      tone: "warning",
      message: "Undid the last board change.",
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // saveNote — persists a scouting note for a player ID.
  //
  // @param {number} playerId - Player ID (from players array)
  // @param {string} text     - Note text to save
  // ─────────────────────────────────────────────────────────────────────────
  function saveNote(playerId, text) {
    setNotes((prev) => {
      const next = { ...prev };
      if (text?.trim()) next[playerId] = text;
      else delete next[playerId];
      return next;
    });
  }

  function toggleFavorite(playerId) {
    setFavorites((prev) => {
      const next = { ...prev };
      if (next[playerId]) delete next[playerId];
      else next[playerId] = true;
      return next;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Setup screen (before draft starts)
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === "setup") {
    return (
      <>
        <SetupScreen
          onInit={initDraft}
          drafts={savedDrafts}
          activeDraftId={activeDraftId}
          onResumeDraft={resumeDraft}
          onDuplicateDraft={duplicateDraft}
          onDeleteDraft={deleteDraft}
          user={user}
          authReady={authReady}
          storageMode={storageMode}
          onOpenAuth={() => {
            setAuthError("");
            setShowAuthModal(true);
          }}
        />
        <AuthModal
          open={showAuthModal}
          user={user}
          busy={authBusy}
          error={authError}
          onClose={() => setShowAuthModal(false)}
          onLogin={handleLogin}
          onSignup={handleSignup}
          onLogout={handleLogout}
        />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Derived values (re-computed each render)
  // ─────────────────────────────────────────────────────────────────────────
  const myTeam = league.teams[currentOwnerIdx];
  const rosterPositions = buildRosterPositions(league.roster);
  const totalSlots = rosterPositions.length;
  const slotsLeft = totalSlots - (myTeam?.roster?.length || 0);
  const maxBid = calcMaxBid(myTeam?.budget_remaining || 0, slotsLeft);
  const totalRecordedPicks = countDraftEntries(league);

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
            <div className="nav-season">
              SEASON {league.season} · {formatPoolLabel(league.pool)} ·{" "}
              {savedDrafts.length} SAVED
            </div>
          </div>

          {/* Tab navigation buttons */}
          {[
            ["board", "Draft Board"],
            ["dictionary", "Player Dictionary"],
            ["settings", "League Settings"],
            ["keeper", "Keeper Setup"],
            // "sandbox" tab intentionally omitted from nav — use setActiveTab("sandbox")
            // programmatically or navigate directly for API diagnostics.
            ["taxi", "Taxi Squad"],
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
          <button
            className="nav-utility-btn"
            onClick={() => setScreen("setup")}
            title="Open the saved draft library"
          >
            Draft Library
          </button>

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

          {/* API status indicator removed from header UI per UX decision.
              The ApiSandbox tab (setActiveTab("sandbox")) and its underlying
              checkApiStatus / apiStatus state are preserved for diagnostics.
              To restore the header indicator, un-comment the block below:

          <div className={`api-dot ${apiStatus}`} />
          <span className="api-status-label">API {apiStatus.toUpperCase()}</span>
          <button onClick={checkApiStatus} title="Re-check API connection"
            style={{ background:"none", border:"none", cursor:"pointer",
                     fontSize:10, color:"var(--muted)", padding:"2px 6px" }}>
            ↺
          </button>
          */}
          <div className="nav-badge">
            {totalRecordedPicks > 0
              ? `${totalRecordedPicks} PICKS SAVED`
              : "SETUP READY"}
          </div>
          {cloudSyncMessage ? (
            <div className="nav-cloud-message">{cloudSyncMessage}</div>
          ) : null}
          <button
            type="button"
            className="nav-avatar-btn"
            title={user ? "Open account" : "Login or sign up"}
            onClick={() => {
              setAuthError("");
              setShowAuthModal(true);
            }}
          >
            <span className="nav-avatar" aria-hidden="true">
              {user?.displayName?.[0]?.toUpperCase() ||
                user?.email?.[0]?.toUpperCase() ||
                "👤"}
            </span>
            <span className="nav-avatar-label">
              {user ? user.displayName || user.email : "Account"}
            </span>
          </button>
        </div>
      </nav>

      <div className="owner-strip">
        {league.teams.map((team, idx) => {
          const teamSlotsLeft = totalSlots - (team.roster?.length || 0);
          const teamMaxBid = calcMaxBid(team.budget_remaining, teamSlotsLeft);
          const isActive = idx === currentOwnerIdx;

          return (
            <button
              key={team.id}
              type="button"
              className={`owner-strip-card ${isActive ? "active" : ""}`}
              onClick={() => setCurrentOwnerIdx(idx)}
              title={`Set ${team.name} as the active owner`}
            >
              <div className="owner-strip-top">
                <span className="owner-strip-name">{team.name}</span>
              </div>
              <div className="owner-strip-stats">
                <span
                  className="owner-strip-stat owner-strip-stat-budget budget"
                  title={`${team.budget_remaining} budget left`}
                >
                  ${team.budget_remaining}
                </span>
                <span
                  className="owner-strip-stat owner-strip-stat-roster"
                  title={`${team.roster.length} of ${totalSlots} roster slots filled`}
                >
                  {team.roster.length}/{totalSlots}
                </span>
                <span
                  className="owner-strip-stat owner-strip-stat-max"
                  title={`Maximum bid ${teamMaxBid}`}
                >
                  max {teamMaxBid}
                </span>
              </div>
            </button>
          );
        })}
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
            onRedo={redoLast}
            onUndoCell={undoSale}
            onFillSample={fillSampleDraft}
            currentOwnerIdx={currentOwnerIdx}
            setCurrentOwnerIdx={setCurrentOwnerIdx}
            notes={notes}
            favorites={favorites}
            saveNote={saveNote}
            toggleFavorite={toggleFavorite}
            apiStatus={apiStatus}
            rosterPositions={rosterPositions}
            totalSlots={totalSlots}
            maxBid={maxBid}
            valuationCache={valuationCache}
            requestValuation={requestValuation}
            draftStateKey={draftStateKey}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            boardNotice={boardNotice}
          />
        )}

        {/* Player Dictionary — browse and search all players */}
        {activeTab === "dictionary" && (
          <PlayerDictionary
            players={players}
            selectedPlayer={selectedPlayer}
            setSelectedPlayer={setSelectedPlayer}
            notes={notes}
            favorites={favorites}
            saveNote={saveNote}
            toggleFavorite={toggleFavorite}
            valuationCache={valuationCache}
            requestValuation={requestValuation}
            draftStateKey={draftStateKey}
          />
        )}

        {/* League Settings — scoring categories + roster config */}
        {activeTab === "settings" && (
          <LeagueSettings
            league={league}
            onSaveSettings={applyLeagueSettings}
          />
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

      <AuthModal
        open={showAuthModal}
        user={user}
        busy={authBusy}
        error={authError}
        onClose={() => setShowAuthModal(false)}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onLogout={handleLogout}
      />
    </div>
  );
}
