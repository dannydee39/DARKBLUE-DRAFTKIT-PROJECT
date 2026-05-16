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
//   └─ ProspectRosters (receives league + players + protected roster actions)
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
import ProspectRosters from "./components/ProspectRosters.jsx";
import ApiSandbox from "./components/ApiSandbox.jsx";
import PlayerUpdateCenter from "./components/PlayerUpdateCenter.jsx";
import DraftHistory from "./components/DraftHistory.jsx";
import DepthCharts from "./components/DepthCharts.jsx";

// ── Shared constants and helpers ──────────────────────────────────────────────
import {
  DRAFTKIT_API_BASE,
  DEFAULT_ROSTER,
  DEFAULT_SCORING,
  MLB_TEAM_CODES,
} from "./constants.js";
import {
  buildDraftState,
  buildRosterPositions,
  calcMaxBid,
  slotAcceptsPlayer,
} from "./utils/helpers.js";
import {
  cloudRequest,
  createCloudDraft,
  deleteCloudDraft,
  deleteDraftNote,
  confirmPasswordReset,
  getCurrentUser,
  listCloudDrafts,
  login as loginToCloud,
  logout as logoutFromCloud,
  markCloudDraftOpened,
  requestPasswordReset,
  signup as signupForCloud,
  updateCloudDraft,
} from "./utils/cloudApi.js";
import {
  buildDraftRecord,
  buildCloudDraftPayload,
  buildTeamsFromConfig,
  cloneLeagueConfig,
  clonePlayers,
  countMinorLeagueEntries,
  countDraftEntries,
  createDraftId,
  DRAFT_LIBRARY_STORAGE_KEY,
  formatPoolLabel,
  hasDraftStarted,
  hydratePlayersFromLeague,
  validateLeagueConfig,
} from "./utils/draftSessions.js";
import {
  appendDraftHistoryEvent,
  buildDraftHistoryRows,
  makeDraftHistoryEvent,
  makeValuationSnapshot,
} from "./utils/draftHistory.js";
import {
  buildMlbDepthCharts,
  buildOwnerRankings,
} from "./utils/teamInsights.js";

const MAX_HISTORY_SNAPSHOTS = 30;
const VALUATION_REQUEST_TIMEOUT_MS = 7000;
const CLOUD_SAVE_DEBOUNCE_MS = 900;
const CUSTOM_PLAYER_BLANK_PHOTO = "__blank__";
const MLB_TEAM_CODE_SET = new Set(MLB_TEAM_CODES);

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
  draftHistory: [],
  teams: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE_PICKS — hardcoded debug picks for fillSampleDraft().
// slotIndex based on default roster order:
//   [C=0, C=1, 1B=2, 3B=3, CI=4, 2B=5, SS=6, MI=7, OF=8, OF=9, OF=10, OF=11, OF=12, UTIL=13, P=14..22]
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE_PICKS = [
  {
    name: "Shohei Ohtani",
    teamIdx: 0,
    price: 65,
    slotIndex: 13,
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
    slotIndex: 2,
    draftedPos: "1B",
  },
  {
    name: "Kyle Tucker",
    teamIdx: 2,
    price: 55,
    slotIndex: 9,
    draftedPos: "OF",
  },
  {
    name: "Francisco Lindor",
    teamIdx: 2,
    price: 38,
    slotIndex: 6,
    draftedPos: "SS",
  },
  {
    name: "Corbin Carroll",
    teamIdx: 3,
    price: 40,
    slotIndex: 10,
    draftedPos: "OF",
  },
  {
    name: "Nolan Arenado",
    teamIdx: 3,
    price: 20,
    slotIndex: 4,
    draftedPos: "CI",
  },
  {
    name: "Elly De La Cruz",
    teamIdx: 4,
    price: 35,
    slotIndex: 6,
    draftedPos: "SS",
  },
  { name: "Logan Webb", teamIdx: 5, price: 25, slotIndex: 14, draftedPos: "P" },
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
  const [storageMode, setStorageMode] = useState("cloud");
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [passwordResetToken, setPasswordResetToken] = useState("");
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
  // Single source of truth for the latest full valuation dictionary returned by
  // POST /v1/valuate. Keys are player IDs so the UI can read fast without
  // searching by name on every render.
  const [valuationCache, setValuationCache] = useState({});
  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuationError, setValuationError] = useState("");
  const [playerUpdates, setPlayerUpdates] = useState([]);
  const [playerUpdatesLoading, setPlayerUpdatesLoading] = useState(false);
  const [playerUpdatesError, setPlayerUpdatesError] = useState("");
  const [playerPushStatus, setPlayerPushStatus] = useState("offline");
  const [playerUpdateVersion, setPlayerUpdateVersion] = useState(0);
  const [liveDepthData, setLiveDepthData] = useState(null);
  const [liveDepthLoading, setLiveDepthLoading] = useState(false);
  const [liveDepthError, setLiveDepthError] = useState("");
  const valuationCacheRef = useRef({});
  const valuationRequestRef = useRef({ key: null, inFlight: false });
  const cacheVersionRef = useRef(0); // incremented on cache invalidation
  const playerUpdateSignatureRef = useRef("");
  const playerUpdateStreamRef = useRef(null);
  const draftNoteStreamRef = useRef(null);
  const playerUpdatesRef = useRef([]);
  const selectedPlayerRef = useRef(null);

  // Keep the ref in sync with state so requestValuation always reads fresh values
  // even when called from inside a stale closure after a cache-clear.
  useEffect(() => {
    valuationCacheRef.current = valuationCache;
  }, [valuationCache]);

  useEffect(() => {
    playerUpdatesRef.current = playerUpdates;
  }, [playerUpdates]);

  useEffect(() => {
    selectedPlayerRef.current = selectedPlayer;
  }, [selectedPlayer]);

  // ── Current active owner (index into league.teams) ────────────────────────
  // Controls which team row is highlighted and whose budget/max-bid is shown.
  const [currentOwnerIdx, setCurrentOwnerIdx] = useState(0);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [boardNotice, setBoardNotice] = useState(null);
  const [keeperPromptDismissed, setKeeperPromptDismissed] = useState(false);

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
    setKeeperPromptDismissed(false);
  }, [activeDraftId]);

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

  function getCachedValuationSnapshot(player) {
    return makeValuationSnapshot(
      player,
      valuationCacheRef.current?.[player?.id],
    );
  }

  // All draft actions use this wrapper so history stores the valuation context
  // that was visible at the moment of the edit, not a later recalculated value.
  function makeDraftHistoryEventWithValuation(args) {
    const snapshot = getCachedValuationSnapshot(args.player);
    return makeDraftHistoryEvent({
      ...args,
      prePickValue: snapshot.maxBidRecommendation,
      valuationSnapshot: snapshot,
    });
  }

  function withDraftHistory(prevLeague, event) {
    return {
      ...prevLeague,
      draftHistory: appendDraftHistoryEvent(prevLeague, event),
    };
  }

  function clearLocalDraftLibrary() {
    try {
      window.localStorage.removeItem(DRAFT_LIBRARY_STORAGE_KEY);
    } catch {
      // Browsers can block localStorage in private or restricted contexts.
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
    setStorageMode("cloud");
    setSavedDrafts(cloudDrafts);
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
    clearLocalDraftLibrary();
    setSavedDrafts([]);
    setLibraryReady(true);
  }, []);

  useEffect(() => {
    if (!libraryReady) return;
    clearLocalDraftLibrary();
  }, [libraryReady, savedDrafts]);

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
          setStorageMode("cloud");
          setSavedDrafts([]);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setStorageMode("cloud");
          setSavedDrafts([]);
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
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get("resetToken");
    if (!resetToken) return;

    setPasswordResetToken(resetToken);
    setAuthError("");
    setShowAuthModal(true);
    params.delete("resetToken");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  useEffect(() => {
    if (!libraryReady || !activeDraftId || screen !== "main") return;
    const current = savedDrafts.find((draft) => draft.id === activeDraftId);
    if (!current) return;
    if (!user || current.source !== "cloud") return;

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
          error?.message || "Cloud save failed. This draft is not saved locally.",
        );
      }
    }, CLOUD_SAVE_DEBOUNCE_MS);

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
  // Include exact roster identifiers and budgets so any meaningful draft-state change
  // forces a fresh all-player valuation pass.
  const scoringStateKey = Object.entries(league.scoring || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, enabled]) => `${category}:${enabled ? 1 : 0}`)
    .join("|");
  const rosterStateKey = Object.entries(league.roster || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([slot, count]) => `${slot}:${Number(count) || 0}`)
    .join("|");
  const leagueSettingsStateKey = [
    `owners:${league.owners}`,
    `budget:${league.budget}`,
    `pool:${league.pool}`,
    `scoring:${scoringStateKey}`,
    `roster:${rosterStateKey}`,
  ].join(";");
  const teamDraftStateKey = league.teams
    .map((team) => {
      const rosterNames = (team.roster || [])
        .map((entry) => entry?.playerId ?? entry?.name ?? entry)
        .sort()
        .join("|");
      const taxiNames = (team.taxiSquad || [])
        .map((entry) => entry?.playerId ?? entry?.name ?? entry)
        .sort()
        .join("|");
      const minorLeagueNames = (team.minorLeague || [])
        .map((entry) => entry?.playerId ?? entry?.name ?? entry)
        .sort()
        .join("|");
      return `${team.id}:${team.budget_remaining}:${rosterNames}:${taxiNames}:${minorLeagueNames}`;
    })
    .join(";");
  const draftStateKey = `${leagueSettingsStateKey}::${teamDraftStateKey}`;
  useEffect(() => {
    cacheVersionRef.current += 1;
    valuationRequestRef.current = { key: null, inFlight: false };
    valuationCacheRef.current = {};
    setValuationCache({});
    setValuationError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStateKey]);

  // ─────────────────────────────────────────────────────────────────────────
  // checkApiStatus — hits GET /health and updates the apiStatus indicator.
  // ─────────────────────────────────────────────────────────────────────────
  async function checkApiStatus() {
    try {
      const r = await fetch(`${DRAFTKIT_API_BASE}/health`);
      if (!r.ok) {
        setApiStatus("offline");
        return;
      }

      const data = await r.json();
      const valuationStatus = data?.dependencies?.valuation?.status;
      setApiStatus(valuationStatus === "offline" ? "offline" : "online");
    } catch {
      setApiStatus("offline");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // requestValuation — refreshes the full valuation dictionary for the current
  // draft state. The Draft Kit then reads per-player values locally from
  // valuationCache instead of making on-demand hover/click requests.
  // ─────────────────────────────────────────────────────────────────────────
  async function requestValuation() {
    if (apiStatus !== "online" || players.length === 0) return;

    const requestKey = `${cacheVersionRef.current}|${draftStateKey}|${players.length}|${playerUpdateVersion}`;
    if (valuationRequestRef.current.inFlight) return;
    if (valuationRequestRef.current.key === requestKey) return;

    const version = cacheVersionRef.current;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      VALUATION_REQUEST_TIMEOUT_MS,
    );

    valuationRequestRef.current = {
      key: requestKey,
      inFlight: true,
    };
    setValuationLoading(true);
    setValuationError("");

    try {
      const draftState = buildDraftState(league, players);
      draftState.commissioner_notes = getCommissionerNotesForValuation();

      const r = await fetch(`${DRAFTKIT_API_BASE}/v1/valuate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          draft_state: draftState,
        }),
      });
      const data = await r.json();

      if (cacheVersionRef.current !== version) return;

      if (!r.ok || data?.error || typeof data?.valuations !== "object") {
        valuationRequestRef.current = { key: null, inFlight: false };
        setValuationError(
          data?.message ||
            data?.error ||
            "Live valuation was unavailable. Showing the last known values instead.",
        );
        return;
      }

      const valuationsById = {};
      players.forEach((player) => {
        const match = data.valuations?.[player.name];
        if (match) {
          valuationsById[player.id] = match;
        }
      });

      valuationCacheRef.current = valuationsById;
      setValuationCache(valuationsById);
    } catch (error) {
      if (cacheVersionRef.current !== version) return;
      valuationRequestRef.current = { key: null, inFlight: false };
      setValuationError(
        error?.name === "AbortError"
          ? "Live valuation timed out. Showing the last known values instead."
          : error?.message ||
              "Live valuation was unavailable. Showing the last known values instead.",
      );
    } finally {
      window.clearTimeout(timeoutId);
      if (cacheVersionRef.current === version) {
        valuationRequestRef.current = {
          key: requestKey,
          inFlight: false,
        };
        setValuationLoading(false);
      }
    }
  }

  useEffect(() => {
    if (screen !== "main" || players.length === 0) return;
    requestValuation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeDraftId,
    apiStatus,
    draftStateKey,
    league.pool,
    playerUpdateVersion,
    players.length,
    screen,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // fetchPlayers — GET /v1/players with the configured league pool filter.
  // Returns the loaded array (also sets it in state as a side effect).
  //
  // @param {Object} leagueData - League config (needs .pool)
  // @returns {Object[]} Loaded player array
  // ─────────────────────────────────────────────────────────────────────────
  async function fetchPlayers(leagueData) {
    try {
      valuationRequestRef.current = { key: null, inFlight: false };
      valuationCacheRef.current = {};
      setValuationCache({});
      setValuationError("");
      setValuationLoading(false);
      // Map pool setting to API query parameter
      const poolParam =
        leagueData?.pool === "AL"
          ? "AL"
          : leagueData?.pool === "NL"
            ? "NL"
            : "ALL";

      const r = await fetch(`${DRAFTKIT_API_BASE}/v1/players?league=${poolParam}`);
      const data = await r.json();
      const loaded = Array.isArray(data) ? data : data.players || [];
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

  async function handlePasswordResetRequest(payload) {
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await requestPasswordReset(payload);
      setCloudSyncMessage(response?.message || "If that account exists, a reset link will be sent shortly.");
      return response;
    } catch (error) {
      if (error?.code === "MAIL_NOT_CONFIGURED") {
        const message =
          "Password reset email is not configured for this deployment. Contact the commissioner/admin to set SMTP before production reset links can be sent.";
        setCloudSyncMessage(message);
        return { ok: true, message };
      }
      setAuthError(error?.message || "Could not request a password reset.");
      return null;
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePasswordResetConfirm(payload) {
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await confirmPasswordReset(payload);
      setPasswordResetToken("");
      setCloudSyncMessage(response?.message || "Password reset complete. Sign in with your new password.");
      return response;
    } catch (error) {
      setAuthError(error?.message || "Could not reset password.");
      return null;
    } finally {
      setAuthBusy(false);
    }
  }

  function closeAuthModal() {
    setShowAuthModal(false);
    setPasswordResetToken("");
  }

  async function handleLogout() {
    setAuthBusy(true);
    setAuthError("");
    try {
      await logoutFromCloud();
      setUser(null);
      setStorageMode("cloud");
      setSavedDrafts([]);
      clearLocalDraftLibrary();
      setActiveDraftId(null);
      setLeague({ ...DEFAULT_LEAGUE });
      setPlayers([]);
      setNotes({});
      setFavorites({});
      setSelectedPlayer(null);
      setCurrentOwnerIdx(0);
      setScreen("setup");
      clearDraftHistory();
      setShowAuthModal(false);
      setCloudSyncMessage("Signed out. Draft saving requires an account.");
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
    if (!user) {
      setAuthError("");
      setShowAuthModal(true);
      setCloudSyncMessage("Sign in before creating a saved draft.");
      return;
    }

    const normalized = cloneLeagueConfig(formLeague);
    const validation = validateLeagueConfig(normalized);
    if (validation.errors.length > 0) return;

    const lg = {
      ...normalized,
      teams: buildTeamsFromConfig(normalized),
    };
    const loadedPlayers = await fetchPlayers(lg);
    const draftId = createDraftId();

    const record = buildDraftRecord({
      id: draftId,
      league: lg,
      players: loadedPlayers,
      notes: {},
      favorites: {},
      currentOwnerIdx: 0,
    });

    try {
      const persisted = await persistCloudDraftRecord({
        ...record,
        source: "cloud",
      }, { forceCreate: true });
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
      upsertDraftInLibrary(persisted);
      setStorageMode("cloud");
      setCloudSyncMessage("Draft created in your cloud library.");
      setBoardNotice({
        tone: "info",
        message: "New cloud draft workspace initialized.",
      });
    } catch (error) {
      setCloudSyncMessage(
        error?.message || "Cloud save failed. Sign in and try again before drafting.",
      );
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
    if (!user) {
      setAuthError("");
      setShowAuthModal(true);
      setCloudSyncMessage("Sign in before duplicating saved drafts.");
      return;
    }

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

    try {
      const persisted = await persistCloudDraftRecord({
        ...copy,
        source: "cloud",
      }, { forceCreate: true });
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
      upsertDraftInLibrary(persisted);
      setStorageMode("cloud");
      setBoardNotice({
        tone: "info",
        message: `Opened duplicate workspace for ${copiedLeague.name}.`,
      });
    } catch (error) {
      setCloudSyncMessage(
        error?.message || "Cloud duplicate failed. Sign in and try again.",
      );
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
      teams: prev.teams.map((team, index) => {
        const normalizedTeam = normalized.teams?.[index];
        const renamedTeam = {
          ...team,
          name: normalizedTeam?.name || normalized.teamNames?.[index] || team.name,
        };

        if (!normalized.commissionerUnlocked) {
          return renamedTeam;
        }

            const spent = prev.budget - team.budget_remaining;
            return {
          ...renamedTeam,
              budget_remaining: Math.max(0, normalized.budget - spent),
            };
      }),
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

    return slotAcceptsPlayer({ pos: positions }, normalizedSlot);
  }

  function mergePlayerUpdatesIntoPool(updates, options = {}) {
    const validUpdates = Array.isArray(updates) ? updates : [];
    const signature = validUpdates.map((update) => update.id).join("|");
    const force = Boolean(options.force);
    const affectedPlayerIds = new Set(
      (options.affectedPlayerIds || [])
        .map((playerId) => Number(playerId))
        .filter((playerId) => Number.isFinite(playerId)),
    );

    if (!force && signature === playerUpdateSignatureRef.current) return;
    playerUpdateSignatureRef.current = signature;

    const latestByPlayerId = new Map();
    validUpdates.forEach((update) => {
      const playerId = Number(update.player_id);
      if (!Number.isFinite(playerId)) return;
      const current = latestByPlayerId.get(playerId);
      if (!current || comparePlayerUpdates(update, current) > 0) {
        latestByPlayerId.set(playerId, update);
      }
    });

    function applyUpdateFields(player) {
      const playerId = Number(player.id);
      const update = latestByPlayerId.get(playerId);
      if (!update && !affectedPlayerIds.has(playerId)) return player;
      if (!update) {
        return {
          ...player,
          risk_level: "LOW",
          injury_status: player.injury || null,
          news_headline: null,
          update_impact_summary: null,
          last_update_at: null,
          latest_update: null,
          updates_count: 0,
        };
      }
      return {
        ...player,
        risk_level: update.risk_level || update.severity || "LOW",
        injury_status: update.injury_status || player.injury || null,
        news_headline: update.headline || null,
        update_impact_summary: update.impact_summary || null,
        last_update_at: update.created_at || null,
        latest_update: update,
        updates_count: Math.max(Number(player.updates_count || 0), 1),
      };
    }

    setPlayers((prev) => prev.map(applyUpdateFields));
    setSelectedPlayer((prev) => (prev ? applyUpdateFields(prev) : prev));
    valuationRequestRef.current = { key: null, inFlight: false };
    valuationCacheRef.current = {};
    setValuationCache({});
    setPlayerUpdateVersion((version) => version + 1);
  }

  function comparePlayerUpdates(left, right) {
    const riskWeight = { LOW: 0, MEDIUM: 1, HIGH: 2 };
    const leftRisk = riskWeight[String(left?.risk_level || left?.severity || "LOW").toUpperCase()] ?? 0;
    const rightRisk = riskWeight[String(right?.risk_level || right?.severity || "LOW").toUpperCase()] ?? 0;
    if (leftRisk !== rightRisk) return leftRisk - rightRisk;
    return (Date.parse(left?.created_at || 0) || 0) - (Date.parse(right?.created_at || 0) || 0);
  }

  async function fetchPlayerUpdates(options = {}) {
    const silent = Boolean(options.silent);
    if (apiStatus !== "online") return [];

    if (!silent) {
      setPlayerUpdatesLoading(true);
      setPlayerUpdatesError("");
    }

    try {
      const combinedUpdates = [];
      const response = await fetch(`${DRAFTKIT_API_BASE}/v1/player-updates?limit=10`);
      const data = await response.json();

      if (!response.ok || !Array.isArray(data?.updates)) {
        throw new Error(data?.message || "Could not load player updates.");
      }

      combinedUpdates.push(...data.updates);

      if (activeDraftUsesCloud()) {
        const draftNotes = await cloudRequest(
          `/v1/drafts/${activeDraftId}/notes?limit=10`,
          { method: "GET" },
        );
        if (Array.isArray(draftNotes?.updates)) {
          combinedUpdates.push(...draftNotes.updates);
        }
      }

      applyPlayerUpdates(combinedUpdates, { replace: true });
      return combinedUpdates;
    } catch (error) {
      if (!silent) {
        setPlayerUpdatesError(
          error?.message || "Player updates are unavailable right now.",
        );
      }
      return [];
    } finally {
      if (!silent) {
        setPlayerUpdatesLoading(false);
      }
    }
  }

  function activeDraftUsesCloud() {
    // Only cloud drafts have server-side note IDs and live note streams. Local
    // demo drafts can still publish global Player API updates, but they cannot
    // remove draft-scoped notes because no draft note row exists.
    const draft = savedDrafts.find((entry) => entry.id === activeDraftId);
    return Boolean(user && activeDraftId && draft?.source === "cloud");
  }

  function getCommissionerNotesForValuation() {
    // Valuation API accepts draft-local commissioner notes as an overlay so the
    // dollar values can react to injury/news context without changing base data.
    return playerUpdates
      .filter((update) =>
        String(update?.source || "").toLowerCase().includes("league"),
      )
      .map((update) => ({
        player_id: update.player_id,
        player_name: update.player_name,
        type: update.type,
        severity: update.severity || update.risk_level,
        risk_level: update.risk_level || update.severity,
        headline: update.headline,
        injury_status: update.injury_status,
        impact_summary: update.impact_summary,
        source: update.source,
        created_at: update.created_at,
      }));
  }

  async function fetchLiveDepthCharts(options = {}) {
    const silent = Boolean(options.silent);
    const refresh = Boolean(options.refresh);
    if (apiStatus !== "online") return null;

    if (!silent) {
      setLiveDepthLoading(true);
      setLiveDepthError("");
    }

    try {
      const suffix = refresh ? "?refresh=1" : "";
      const response = await fetch(
        `${DRAFTKIT_API_BASE}/v1/mlb/depth-charts${suffix}`,
      );
      const data = await response.json();

      if (!response.ok || !Array.isArray(data?.teams)) {
        throw new Error(data?.message || "Could not load MLB roster depth data.");
      }

      setLiveDepthData(data);
      setLiveDepthError(data.warning || "");
      return data;
    } catch (error) {
      if (!silent) {
        setLiveDepthError(
          error?.message || "MLB roster depth data is unavailable right now.",
        );
      }
      return null;
    } finally {
      if (!silent) {
        setLiveDepthLoading(false);
      }
    }
  }

  function applyPlayerUpdates(updates, options = {}) {
    const announce = Boolean(options.announce);
    const replace = Boolean(options.replace);
    const validUpdates = Array.isArray(updates)
      ? updates.filter((update) => update && update.id)
      : [];
    if (validUpdates.length === 0) {
      if (replace) {
        playerUpdatesRef.current = [];
        setPlayerUpdates([]);
        mergePlayerUpdatesIntoPool([], {
          force: true,
          affectedPlayerIds: players.map((player) => player.id),
        });
      }
      return;
    }

    const nextUpdates = replace
      ? sortUpdateList(validUpdates)
      : mergeUpdateLists(playerUpdatesRef.current, validUpdates);
    playerUpdatesRef.current = nextUpdates;
    setPlayerUpdates(nextUpdates);
    mergePlayerUpdatesIntoPool(nextUpdates, { force: true });

    if (announce) {
      const pushedUpdate = validUpdates[0];
      setBoardNotice({
        tone: "warning",
        message: `${pushedUpdate.player_name} pushed live to connected draft boards.`,
      });
    }
  }

  function mergeUpdateLists(existingUpdates, incomingUpdates) {
    const byId = new Map((existingUpdates || []).map((update) => [update.id, update]));
    incomingUpdates.forEach((update) => {
      byId.set(update.id, update);
    });

    return sortUpdateList([...byId.values()]);
  }

  function sortUpdateList(updates) {
    return [...updates]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 10);
  }

  async function publishInjuryUpdate(options = {}) {
    if (apiStatus !== "online") {
      setPlayerUpdatesError("Player updates need the Draft Kit API to be online.");
      return null;
    }
    if (!selectedPlayer) {
      setPlayerUpdatesError("Select a player before publishing a league note.");
      return null;
    }

    const allowedTypes = new Set(["INJURY", "NEWS", "LINEUP", "ROLE"]);
    const allowedSeverities = new Set(["LOW", "MEDIUM", "HIGH"]);
    const updateType = allowedTypes.has(options.type) ? options.type : "INJURY";
    const severity = allowedSeverities.has(options.severity)
      ? options.severity
      : "HIGH";
    const typeLabel = {
      INJURY: "injury",
      NEWS: "news",
      LINEUP: "lineup",
      ROLE: "role",
    }[updateType];
    const severityCopy = {
      HIGH: "high-priority",
      MEDIUM: "watch-list",
      LOW: "low-risk",
    }[severity];

    setPlayerUpdatesLoading(true);
    setPlayerUpdatesError("");

    try {
      const payload = {
        player_id: selectedPlayer.id,
        player_name: selectedPlayer.name,
        team: selectedPlayer.team,
        positions: selectedPlayer.pos || selectedPlayer.positions || [],
        type: updateType,
        severity,
        headline: `${selectedPlayer.name} marked as ${severityCopy} ${typeLabel} context`,
        body: `${selectedPlayer.name} has a ${severityCopy} ${typeLabel} note for draft review.`,
        source: "League commissioner note",
        created_by: user?.displayName || user?.display_name || "Draft Kit commissioner",
      };
      let data;

      if (activeDraftUsesCloud()) {
        data = await cloudRequest(`/v1/drafts/${activeDraftId}/notes?limit=10`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else {
        const response = await fetch(
          `${DRAFTKIT_API_BASE}/v1/player-updates`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "Could not publish the player update.");
        }
      }

      if (!data?.update) {
        throw new Error("Could not publish the player update.");
      }

      const updates = Array.isArray(data.updates) ? data.updates : [data.update];
      applyPlayerUpdates(updates);
      openPlayerFromUpdate(data.update);
      setBoardNotice({
        tone: "warning",
        message: `${data.update.player_name} league note published to the draft board.`,
      });
      return data.update;
    } catch (error) {
      setPlayerUpdatesError(error?.message || "Could not publish the league note.");
      return null;
    } finally {
      setPlayerUpdatesLoading(false);
    }
  }

  async function deletePlayerUpdate(update) {
    // Remove is intentionally limited to league notes saved inside this cloud
    // draft. Licensed/global Player API pushes remain append-only feed events.
    if (!update?.id || !update?.draft_id) {
      setPlayerUpdatesError("Only league notes saved to this draft can be removed.");
      return;
    }

    if (!activeDraftUsesCloud() || update.draft_id !== activeDraftId) {
      setPlayerUpdatesError("Open the cloud draft that owns this note before removing it.");
      return;
    }

    const confirmed = window.confirm(
      `Remove the league note for ${update.player_name || "this player"}?`,
    );
    if (!confirmed) return;

    setPlayerUpdatesLoading(true);
    setPlayerUpdatesError("");

    try {
      await deleteDraftNote(activeDraftId, update.id);
      removePlayerUpdateFromState(update);
      setBoardNotice({
        tone: "success",
        message: `${update.player_name || "Player"} league note removed.`,
      });
    } catch (error) {
      setPlayerUpdatesError(error?.message || "Could not remove the league note.");
    } finally {
      setPlayerUpdatesLoading(false);
    }
  }

  function removePlayerUpdateFromState(update) {
    const removedPlayerId = Number(update?.player_id);
    const remaining = playerUpdatesRef.current.filter((entry) => entry.id !== update?.id);
    playerUpdatesRef.current = remaining;
    setPlayerUpdates(remaining);
    mergePlayerUpdatesIntoPool(remaining, {
      force: true,
      affectedPlayerIds: Number.isFinite(removedPlayerId) ? [removedPlayerId] : [],
    });

    const currentSelectedPlayer = selectedPlayerRef.current;
    if (
      currentSelectedPlayer &&
      Number(currentSelectedPlayer.id) === removedPlayerId &&
      currentSelectedPlayer.latest_update?.id === update?.id
    ) {
      const fallbackUpdate = remaining
        .filter((entry) => Number(entry.player_id) === removedPlayerId)
        .sort(comparePlayerUpdates)
        .at(-1);
      if (fallbackUpdate) {
        openPlayerFromUpdate(fallbackUpdate);
      } else {
        setSelectedPlayer((prev) =>
          prev
            ? {
                ...prev,
                risk_level: "LOW",
                injury_status: prev.injury || null,
                news_headline: null,
                update_impact_summary: null,
                last_update_at: null,
                latest_update: null,
                updates_count: 0,
              }
            : prev,
        );
      }
    }
  }

  function openPlayerFromUpdate(update) {
    const matched = players.find(
      (player) => Number(player.id) === Number(update?.player_id),
    );
    if (!matched) return;

    setActiveTab("board");
    setSelectedPlayer({
      ...matched,
      risk_level: update.risk_level || update.severity || matched.risk_level,
      injury_status: update.injury_status || matched.injury_status || matched.injury,
      news_headline: update.headline || matched.news_headline,
      update_impact_summary:
        update.impact_summary || matched.update_impact_summary,
      last_update_at: update.created_at || matched.last_update_at,
      latest_update: update,
    });
  }

  useEffect(() => {
    if (apiStatus !== "online") {
      playerUpdateStreamRef.current?.close?.();
      playerUpdateStreamRef.current = null;
      draftNoteStreamRef.current?.close?.();
      draftNoteStreamRef.current = null;
      setPlayerPushStatus("offline");
      return undefined;
    }

    if (screen !== "main") return undefined;

    fetchPlayerUpdates({ silent: true });
    fetchLiveDepthCharts({ silent: true });
    setPlayerPushStatus("connecting");
    setPlayerUpdatesError("");

    const stream = new EventSource(
      `${DRAFTKIT_API_BASE}/v1/player-updates/stream?limit=10`,
    );
    playerUpdateStreamRef.current = stream;

    stream.onopen = () => {
      setPlayerPushStatus("online");
      setPlayerUpdatesError("");
    };

    stream.addEventListener("snapshot", (event) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        if (Array.isArray(payload?.updates)) {
          applyPlayerUpdates(payload.updates);
        }
        setPlayerPushStatus("online");
      } catch {
        setPlayerUpdatesError("Could not read the live player update snapshot.");
      }
    });

    stream.addEventListener("player-update", (event) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        if (payload?.update) {
          applyPlayerUpdates([payload.update], { announce: true });
        }
        setPlayerPushStatus("online");
      } catch {
        setPlayerUpdatesError("Could not read a pushed player update.");
      }
    });

    stream.onerror = () => {
      setPlayerPushStatus("reconnecting");
    };

    let draftNoteStream = null;
    if (activeDraftUsesCloud()) {
      // Draft-note SSE runs beside the global Player API stream. This lets rare
      // injury/news notes stay hidden until needed, while still updating every
      // open draft board immediately once a commissioner publishes one.
      draftNoteStream = new EventSource(
        `${DRAFTKIT_API_BASE}/v1/drafts/${activeDraftId}/notes/stream?limit=10`,
        { withCredentials: true },
      );
      draftNoteStreamRef.current = draftNoteStream;

      draftNoteStream.addEventListener("snapshot", (event) => {
        try {
          const payload = JSON.parse(event.data || "{}");
          if (Array.isArray(payload?.updates)) {
            applyPlayerUpdates(payload.updates);
          }
        } catch {
          setPlayerUpdatesError("Could not read the draft note snapshot.");
        }
      });

      draftNoteStream.addEventListener("draft-note", (event) => {
        try {
          const payload = JSON.parse(event.data || "{}");
          if (payload?.update) {
            applyPlayerUpdates([payload.update], { announce: true });
          }
        } catch {
          setPlayerUpdatesError("Could not read a pushed draft note.");
        }
      });

      draftNoteStream.addEventListener("draft-note-delete", (event) => {
        try {
          const payload = JSON.parse(event.data || "{}");
          if (payload?.update) {
            removePlayerUpdateFromState(payload.update);
          }
        } catch {
          setPlayerUpdatesError("Could not read a draft note removal.");
        }
      });
    }

    return () => {
      stream.close();
      if (playerUpdateStreamRef.current === stream) {
        playerUpdateStreamRef.current = null;
      }
      draftNoteStream?.close();
      if (draftNoteStreamRef.current === draftNoteStream) {
        draftNoteStreamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiStatus, screen, activeDraftId, user]);

  function findAssignmentForPlayer(playerId) {
    if (playerId == null) return null;

    for (const team of league.teams || []) {
      const rosterEntry = (team.roster || []).find(
        (entry) => entry?.playerId === playerId,
      );
      if (rosterEntry) {
        return {
          type: rosterEntry.isKeeper ? "keeper" : "main roster",
          team,
          entry: rosterEntry,
        };
      }

      const taxiEntry = (team.taxiSquad || []).find(
        (entry) => entry?.playerId === playerId,
      );
      if (taxiEntry) {
        return { type: "taxi squad", team, entry: taxiEntry };
      }

      const prospectEntry = (team.minorLeague || []).find(
        (entry) => entry?.playerId === playerId,
      );
      if (prospectEntry) {
        return { type: "minor league roster", team, entry: prospectEntry };
      }
    }

    return null;
  }

  function findOpenRosterSlot(team, player) {
    if (!team || !player) return null;

    const rosterSlots = buildRosterPositions(league.roster);
    const occupiedSlots = new Set(
      (team.roster || [])
        .map((entry) => entry?.slotIndex)
        .filter((slotIndex) => slotIndex != null),
    );

    for (let index = 0; index < rosterSlots.length; index += 1) {
      const slot = rosterSlots[index];
      if (occupiedSlots.has(index)) continue;
      if (canPlayerFillSlot(player, slot)) {
        return { slotIndex: index, draftedPos: slot };
      }
    }

    return null;
  }

  function normalizeKeeperCost(cost) {
    const numericCost = Number(cost);
    if (!Number.isInteger(numericCost) || numericCost < 1) {
      return null;
    }
    return numericCost;
  }

  function validateKeeperContract({ teamId, playerId, cost, replacePlayerId = null }) {
    const team = league.teams.find((entry) => entry.id === Number(teamId));
    const player = players.find((entry) => entry.id === playerId);
    const numericCost = normalizeKeeperCost(cost);

    if (!league.keeperLeague) {
      return {
        ok: false,
        message: "Keeper entries are disabled because this league is not marked as a keeper league.",
      };
    }

    if (!team) {
      return { ok: false, message: "Select a valid owner before adding a keeper." };
    }

    if (!player) {
      return {
        ok: false,
        message: "Choose a player from the Draft Kit player database before saving a keeper.",
      };
    }

    if (numericCost == null) {
      return {
        ok: false,
        message: "Keeper cost must be a whole-dollar value of at least $1.",
      };
    }

    const replacingEntry = (team.roster || []).find(
      (entry) => entry?.isKeeper && entry.playerId === replacePlayerId,
    );
    const effectiveBudget =
      replacePlayerId != null && replacingEntry
        ? team.budget_remaining + (Number(replacingEntry.price) || 0)
        : team.budget_remaining;
    const effectiveRoster =
      replacePlayerId != null && replacingEntry
        ? (team.roster || []).filter(
            (entry) => !(entry?.isKeeper && entry.playerId === replacePlayerId),
          )
        : team.roster || [];
    const activeRosterSlots = buildRosterPositions(league.roster).length;
    const slotsLeft = activeRosterSlots - effectiveRoster.length;
    const maxKeeperCost = calcMaxBid(effectiveBudget, slotsLeft);

    if (slotsLeft <= 0) {
      return {
        ok: false,
        message: `${team.name} has no open active roster slots for another keeper.`,
      };
    }

    if (numericCost > maxKeeperCost) {
      return {
        ok: false,
        message: `${team.name} can spend at most $${maxKeeperCost} on this keeper and still leave $1 for each remaining active slot.`,
      };
    }

    const assignment = findAssignmentForPlayer(player.id);
    if (assignment && assignment.entry?.playerId !== replacePlayerId) {
      return {
        ok: false,
        message: `${player.name} is already assigned to ${assignment.team.name}'s ${assignment.type}.`,
      };
    }

    const slotTarget = findOpenRosterSlot(
      { ...team, roster: effectiveRoster },
      player,
    );

    if (!slotTarget) {
      return {
        ok: false,
        message: `${player.name} does not fit any open active roster slot for ${team.name}.`,
      };
    }

    return {
      ok: true,
      team,
      player,
      cost: numericCost,
      slotTarget,
      replacingEntry,
      effectiveBudget,
      effectiveRoster,
    };
  }

  function addKeeperContract({ teamId, playerId, cost }) {
    const result = validateKeeperContract({ teamId, playerId, cost });
    if (!result.ok) {
      setBoardNotice({ tone: "warning", message: result.message });
      return false;
    }

    const actionTime = Date.now();
    pushUndoSnapshot();

    setLeague((prev) => {
      const event = makeDraftHistoryEventWithValuation({
        type: "keeper",
        player: result.player,
        team: result.team,
        rosterSlot: result.slotTarget.draftedPos,
        price: result.cost,
        timestamp: actionTime,
        remainingBudgetAfter: result.team.budget_remaining - result.cost,
        note: "Keeper contract",
      });

      return withDraftHistory({
        ...prev,
        teams: prev.teams.map((team) => {
        if (team.id !== result.team.id) return team;
        return {
          ...team,
          budget_remaining: team.budget_remaining - result.cost,
          roster: [
            ...(team.roster || []),
            {
              playerId: result.player.id,
              name: result.player.name,
              price: result.cost,
              pos: result.player.pos,
              slotIndex: result.slotTarget.slotIndex,
              draftedPos: result.slotTarget.draftedPos,
              draftedAt: actionTime,
              isKeeper: true,
            },
          ],
        };
        }),
      }, event);
    });

    setPlayers((prev) =>
      prev.map((player) =>
        player.id === result.player.id
          ? {
              ...player,
              drafted: true,
              draftedBy: result.team.id,
              draftPrice: result.cost,
              draftedAt: actionTime,
              taxi: false,
              minorLeague: false,
            }
          : player,
      ),
    );

    setBoardNotice({
      tone: "success",
      message: `${result.player.name} saved as a $${result.cost} keeper for ${result.team.name}.`,
    });
    return true;
  }

  function updateKeeperContract({ teamId, oldPlayerId, playerId, cost }) {
    const result = validateKeeperContract({
      teamId,
      playerId,
      cost,
      replacePlayerId: oldPlayerId,
    });

    if (!result.ok) {
      setBoardNotice({ tone: "warning", message: result.message });
      return false;
    }

    const actionTime = Date.now();
    pushUndoSnapshot();

    setLeague((prev) => {
      const event = makeDraftHistoryEventWithValuation({
        type: "keeper_update",
        player: result.player,
        team: result.team,
        rosterSlot: result.slotTarget.draftedPos,
        price: result.cost,
        timestamp: actionTime,
        remainingBudgetAfter: result.effectiveBudget - result.cost,
        note: oldPlayerId === result.player.id ? "Keeper cost updated" : "Keeper player replaced",
      });

      return withDraftHistory({
        ...prev,
        teams: prev.teams.map((team) => {
        if (team.id !== result.team.id) return team;
        return {
          ...team,
          budget_remaining: result.effectiveBudget - result.cost,
          roster: [
            ...result.effectiveRoster,
            {
              playerId: result.player.id,
              name: result.player.name,
              price: result.cost,
              pos: result.player.pos,
              slotIndex: result.slotTarget.slotIndex,
              draftedPos: result.slotTarget.draftedPos,
              draftedAt: actionTime,
              isKeeper: true,
            },
          ],
        };
        }),
      }, event);
    });

    setPlayers((prev) =>
      prev.map((player) => {
        if (player.id === oldPlayerId && oldPlayerId !== result.player.id) {
          return {
            ...player,
            drafted: false,
            draftedBy: null,
            draftPrice: null,
            draftedAt: null,
            taxi: false,
            minorLeague: false,
          };
        }

        if (player.id === result.player.id) {
          return {
            ...player,
            drafted: true,
            draftedBy: result.team.id,
            draftPrice: result.cost,
            draftedAt: actionTime,
            taxi: false,
            minorLeague: false,
          };
        }

        return player;
      }),
    );

    setBoardNotice({
      tone: "success",
      message: `${result.player.name} keeper contract updated for ${result.team.name}.`,
    });
    return true;
  }

  function removeKeeperContract(teamId, playerId) {
    const team = league.teams.find((entry) => entry.id === Number(teamId));
    const rosterEntry = team?.roster?.find(
      (entry) => entry?.isKeeper && entry.playerId === playerId,
    );

    if (!team || !rosterEntry) {
      setBoardNotice({
        tone: "warning",
        message: "Could not remove that keeper because the roster entry changed.",
      });
      return false;
    }

    pushUndoSnapshot();

    setLeague((prev) => {
      const player = players.find((entry) => entry.id === playerId) || {
        id: playerId,
        name: rosterEntry.name,
        pos: rosterEntry.pos,
      };
      const event = makeDraftHistoryEventWithValuation({
        type: "keeper_remove",
        player,
        team,
        rosterSlot: rosterEntry.draftedPos,
        price: rosterEntry.price,
        timestamp: Date.now(),
        remainingBudgetAfter:
          team.budget_remaining + (Number(rosterEntry.price) || 0),
        note: "Keeper removed",
      });

      return withDraftHistory({
        ...prev,
        teams: prev.teams.map((entry) => {
        if (entry.id !== team.id) return entry;
        return {
          ...entry,
          budget_remaining:
            entry.budget_remaining + (Number(rosterEntry.price) || 0),
          roster: (entry.roster || []).filter(
            (candidate) =>
              !(candidate?.isKeeper && candidate.playerId === playerId),
          ),
        };
        }),
      }, event);
    });

    setPlayers((prev) =>
      prev.map((player) =>
        player.id === playerId
          ? {
              ...player,
              drafted: false,
              draftedBy: null,
              draftPrice: null,
              draftedAt: null,
              taxi: false,
              minorLeague: false,
            }
          : player,
      ),
    );

    setBoardNotice({
      tone: "warning",
      message: `${rosterEntry.name} was removed from ${team.name}'s keepers.`,
    });
    return true;
  }

  function markNotKeeperLeagueFromBoard() {
    pushUndoSnapshot();
    setLeague((prev) => ({
      ...prev,
      keeperLeague: false,
    }));
    setKeeperPromptDismissed(true);
    setBoardNotice({
      tone: "info",
      message: "Keeper setup skipped. This draft is now marked as a redraft league.",
    });
  }

  function addCustomPlayer({ name, team }) {
    const normalizedName = String(name || "")
      .replace(/\s+/g, " ")
      .trim();
    const normalizedTeam = String(team || "")
      .trim()
      .toUpperCase();

    if (!normalizedName || !MLB_TEAM_CODE_SET.has(normalizedTeam)) {
      setBoardNotice({
        tone: "warning",
        message:
          "Custom players need a full name and a valid MLB team code.",
      });
      return null;
    }

    const existingTeamPlayer = players.find(
      (player) => player.team === normalizedTeam && player.league,
    );
    const customPlayer = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: normalizedName,
      team: normalizedTeam,
      league:
        existingTeamPlayer?.league ||
        (league.pool === "AL" || league.pool === "NL" ? league.pool : "MLB"),
      pos: [],
      tier: "Custom",
      baseValue: 0,
      fpts: null,
      photoUrl: CUSTOM_PLAYER_BLANK_PHOTO,
      note: "",
      custom: true,
      drafted: false,
      draftedBy: null,
      draftPrice: null,
      draftedAt: null,
      taxi: false,
      minorLeague: false,
    };

    setPlayers((prev) => [customPlayer, ...prev]);
    setSelectedPlayer(customPlayer);
    setBoardNotice({
      tone: "success",
      message: `${normalizedName} was added to the player pool as a custom player.`,
    });
    return customPlayer;
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

    const currentTeamSlotsLeft = totalSlots - currentTeam.roster.length;
    const currentTeamMaxBid = calcMaxBid(
      currentTeam.budget_remaining,
      currentTeamSlotsLeft,
    );

    if (numericPrice > currentTeamMaxBid) {
      setBoardNotice({
        tone: "warning",
        message: `${currentTeam.name} can bid at most $${currentTeamMaxBid} and still leave $1 for each remaining open roster spot.`,
      });
      return false;
    }

    const actionTime = Date.now();
    pushUndoSnapshot();

    // Update the winning team's budget and roster
    setLeague((prev) => {
      const event = makeDraftHistoryEventWithValuation({
        type: "auction",
        player: {
          ...currentPlayer,
          name: player.name || currentPlayer.name,
          pos: effectivePlayer.pos,
        },
        team: currentTeam,
        rosterSlot: draftedPos,
        price: numericPrice,
        timestamp: actionTime,
        remainingBudgetAfter: currentTeam.budget_remaining - numericPrice,
      });

      return withDraftHistory({
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
      }, event);
    });

    // Mark the player as drafted in the pool
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === player.id
          ? {
              ...p,
              pos: effectivePlayer.pos,
              drafted: true,
              draftedBy: teamId,
              draftPrice: numericPrice,
              draftedAt: actionTime,
              taxi: false,
              minorLeague: false,
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
  //   [C=0, C=1, 1B=2, 3B=3, CI=4, 2B=5, SS=6, MI=7,
  //    OF=8, OF=9, OF=10, OF=11, OF=12, UTIL=13, P=14..22]
  // ─────────────────────────────────────────────────────────────────────────
  function fillSampleDraft() {
    const baseTime = Date.now();
    pushUndoSnapshot();

    // Build accumulated per-team changes: teamId → { budgetDelta, newRoster[] }
    const teamChanges = {};
    const historyEvents = [];
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
      const draftedAt = baseTime + draftedPlayerIds.size;
      teamChanges[team.id].newRoster.push({
        playerId: player.id,
        name: player.name,
        price: pick.price,
        pos: player.pos,
        slotIndex: pick.slotIndex,
        draftedPos: pick.draftedPos,
        draftedAt,
      });

      historyEvents.push({
        event: makeDraftHistoryEventWithValuation({
          type: "auction",
          player,
          team,
          rosterSlot: pick.draftedPos,
          price: pick.price,
          timestamp: draftedAt,
          remainingBudgetAfter:
            team.budget_remaining +
            teamChanges[team.id].budgetDelta,
          note: "Sample draft pick",
          source: "sample",
        }),
        playerId: player.id,
        draftedAt,
      });

      draftedPlayerIds.add(player.id);
    });

    // Apply all team changes in a single setLeague call
    setLeague((prev) => {
      let nextLeague = {
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
      };

      historyEvents.forEach(({ event }) => {
        nextLeague = withDraftHistory(nextLeague, event);
      });

      return nextLeague;
    });

    // Mark all drafted players in a single setPlayers call
    setPlayers((prev) =>
      prev.map((p) =>
        draftedPlayerIds.has(p.id)
          ? {
              ...p,
              drafted: true,
              draftedBy:
                historyEvents.find((entry) => entry.playerId === p.id)?.event
                  ?.fantasyOwnerId || null,
              draftPrice:
                historyEvents.find((entry) => entry.playerId === p.id)?.event
                  ?.price || null,
              draftedAt:
                historyEvents.find((entry) => entry.playerId === p.id)
                  ?.draftedAt || baseTime,
              taxi: false,
              minorLeague: false,
            }
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

    setLeague((prev) => {
      const player = p || {
        id: playerId,
        name: rosterEntry.name,
        pos: rosterEntry.pos,
      };
      const event = makeDraftHistoryEventWithValuation({
        type: "auction_remove",
        player,
        team,
        rosterSlot: rosterEntry.draftedPos || rosterPositions[slotIndex],
        price: rosterEntry.price,
        timestamp: Date.now(),
        remainingBudgetAfter: team.budget_remaining + (rosterEntry?.price || 0),
        note: "Roster entry removed",
      });

      return withDraftHistory({
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
      }, event);
    });

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
    const team = league.teams.find((entry) => entry.id === Number(teamId));
    const currentPlayer = players.find((entry) => entry.id === player?.id);
    const taxiSlots = Math.max(0, Number(league.roster?.TAXI) || 0);
    const currentTaxiCount = (team?.taxiSquad || []).length;

    if (!team) {
      setBoardNotice({
        tone: "warning",
        message: "Choose a valid active team before adding a taxi pick.",
      });
      return false;
    }

    if (!currentPlayer) {
      setBoardNotice({
        tone: "warning",
        message: "That player is no longer available in the player pool.",
      });
      return false;
    }

    if (taxiSlots <= 0) {
      setBoardNotice({
        tone: "warning",
        message:
          "This league has no taxi slots configured. Add TAXI slots in League Settings first.",
      });
      return false;
    }

    if (currentTaxiCount >= taxiSlots) {
      setBoardNotice({
        tone: "warning",
        message: `${team.name}'s taxi squad is already full.`,
      });
      return false;
    }

    const assignment = findAssignmentForPlayer(currentPlayer.id);
    if (assignment || currentPlayer.drafted) {
      setBoardNotice({
        tone: "warning",
        message: `${currentPlayer.name} is already assigned${assignment ? ` to ${assignment.team.name}'s ${assignment.type}` : ""}.`,
      });
      return false;
    }

    pushUndoSnapshot();
    const actionTime = Date.now();

    setLeague((prev) => {
      const event = makeDraftHistoryEventWithValuation({
        type: "taxi",
        player: currentPlayer,
        team,
        rosterSlot: `TAXI ${currentTaxiCount + 1}`,
        price: 1,
        timestamp: actionTime,
        remainingBudgetAfter: team.budget_remaining,
        note: "Taxi squad",
      });

      return withDraftHistory({
        ...prev,
        teams: prev.teams.map((t) => {
        if (t.id !== team.id) return t;
        return {
          ...t,
          taxiSquad: [
            ...(t.taxiSquad || []),
            {
              playerId: currentPlayer.id,
              name: currentPlayer.name,
              price: 1,
              pos: currentPlayer.pos,
              draftedAt: actionTime,
            },
          ],
        };
        }),
      }, event);
    });

    // Mark as drafted (taxi) so player doesn't show in the main pool
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === currentPlayer.id
          ? {
              ...p,
              drafted: true,
              draftedBy: team.id,
              draftPrice: 1,
              draftedAt: actionTime,
              taxi: true,
            }
          : p,
      ),
    );

    setBoardNotice({
      tone: "info",
      message: `${currentPlayer.name} added to ${team.name}'s taxi squad for $1.`,
    });
    return true;
  }

  function removeTaxiPick(teamId, playerId) {
    const team = league.teams.find((entry) => entry.id === Number(teamId));
    const taxiEntry = team?.taxiSquad?.find(
      (entry) => entry?.playerId === playerId,
    );

    if (!team || !taxiEntry) {
      setBoardNotice({
        tone: "warning",
        message: "Could not remove that taxi pick because the entry changed.",
      });
      return false;
    }

    pushUndoSnapshot();

    setLeague((prev) => {
      const player = players.find((entry) => entry.id === playerId) || {
        id: playerId,
        name: taxiEntry.name,
        pos: taxiEntry.pos,
      };
      const taxiIndex = (team.taxiSquad || []).findIndex(
        (entry) => entry?.playerId === playerId,
      );
      const event = makeDraftHistoryEventWithValuation({
        type: "taxi_remove",
        player,
        team,
        rosterSlot: `TAXI ${taxiIndex + 1}`,
        price: taxiEntry.price || 1,
        timestamp: Date.now(),
        remainingBudgetAfter: team.budget_remaining,
        note: "Taxi pick removed",
      });

      return withDraftHistory({
        ...prev,
        teams: prev.teams.map((entry) => {
        if (entry.id !== team.id) return entry;
        return {
          ...entry,
          taxiSquad: (entry.taxiSquad || []).filter(
            (candidate) => candidate?.playerId !== playerId,
          ),
        };
        }),
      }, event);
    });

    setPlayers((prev) =>
      prev.map((player) =>
        player.id === playerId
          ? {
              ...player,
              drafted: false,
              draftedBy: null,
              draftPrice: null,
              draftedAt: null,
              taxi: false,
            }
          : player,
      ),
    );

    setBoardNotice({
      tone: "warning",
      message: `${taxiEntry.name} was removed from ${team.name}'s taxi squad.`,
    });
    return true;
  }

  function addProspectToMinorLeague(player, teamId) {
    const team = league.teams.find((entry) => entry.id === Number(teamId));
    const currentPlayer = players.find((entry) => entry.id === player?.id);

    if (!team) {
      setBoardNotice({
        tone: "warning",
        message: "Choose a valid fantasy team before adding a prospect.",
      });
      return false;
    }

    if (!currentPlayer) {
      setBoardNotice({
        tone: "warning",
        message: "That player is no longer available in the player pool.",
      });
      return false;
    }

    const assignment = findAssignmentForPlayer(currentPlayer.id);
    if (assignment || currentPlayer.drafted) {
      setBoardNotice({
        tone: "warning",
        message: `${currentPlayer.name} is already assigned${assignment ? ` to ${assignment.team.name}'s ${assignment.type}` : ""}.`,
      });
      return false;
    }

    pushUndoSnapshot();
    const actionTime = Date.now();

    setLeague((prev) => {
      const event = makeDraftHistoryEventWithValuation({
        type: "minor_league",
        player: currentPlayer,
        team,
        rosterSlot: `MiLB ${(team.minorLeague || []).length + 1}`,
        price: 0,
        timestamp: actionTime,
        remainingBudgetAfter: team.budget_remaining,
        note: "Minor league/prospect roster",
      });

      return withDraftHistory({
        ...prev,
        teams: prev.teams.map((entry) => {
          if (entry.id !== team.id) return entry;
          return {
            ...entry,
            minorLeague: [
              ...(entry.minorLeague || []),
              {
                playerId: currentPlayer.id,
                name: currentPlayer.name,
                pos: currentPlayer.pos,
                draftedAt: actionTime,
              },
            ],
          };
        }),
      }, event);
    });

    setPlayers((prev) =>
      prev.map((entry) =>
        entry.id === currentPlayer.id
          ? {
              ...entry,
              drafted: true,
              draftedBy: team.id,
              draftPrice: 0,
              draftedAt: actionTime,
              taxi: false,
              minorLeague: true,
            }
          : entry,
      ),
    );

    setBoardNotice({
      tone: "success",
      message: `${currentPlayer.name} added to ${team.name}'s minor league roster and removed from the draft pool.`,
    });
    return true;
  }

  function removeProspectFromMinorLeague(teamId, playerId) {
    const team = league.teams.find((entry) => entry.id === Number(teamId));
    const prospectEntry = team?.minorLeague?.find(
      (entry) => entry?.playerId === playerId,
    );

    if (!team || !prospectEntry) {
      setBoardNotice({
        tone: "warning",
        message: "Could not release that prospect because the roster entry changed.",
      });
      return false;
    }

    pushUndoSnapshot();

    setLeague((prev) => {
      const player = players.find((entry) => entry.id === playerId) || {
        id: playerId,
        name: prospectEntry.name,
        pos: prospectEntry.pos,
      };
      const event = makeDraftHistoryEventWithValuation({
        type: "minor_league_remove",
        player,
        team,
        rosterSlot: "MiLB",
        price: 0,
        timestamp: Date.now(),
        remainingBudgetAfter: team.budget_remaining,
        note: "Prospect released back to draft pool",
      });

      return withDraftHistory({
        ...prev,
        teams: prev.teams.map((entry) => {
          if (entry.id !== team.id) return entry;
          return {
            ...entry,
            minorLeague: (entry.minorLeague || []).filter(
              (candidate) => candidate?.playerId !== playerId,
            ),
          };
        }),
      }, event);
    });

    setPlayers((prev) =>
      prev.map((entry) =>
        entry.id === playerId
          ? {
              ...entry,
              drafted: false,
              draftedBy: null,
              draftPrice: null,
              draftedAt: null,
              taxi: false,
              minorLeague: false,
            }
          : entry,
      ),
    );

    setBoardNotice({
      tone: "info",
      message: `${prospectEntry.name} released from ${team.name}'s minor league roster and restored to the draft pool.`,
    });
    return true;
  }

  function moveRosterEntry(teamId, playerId, fromSlotIndex, toSlotIndex) {
    const team = league.teams.find((entry) => entry.id === Number(teamId));
    const rosterEntry = team?.roster?.find(
      (entry) =>
        entry?.playerId === playerId &&
        Number(entry.slotIndex) === Number(fromSlotIndex),
    );
    const player = players.find((entry) => entry.id === playerId) || rosterEntry;
    const targetSlot = rosterPositions[Number(toSlotIndex)];

    if (!team || !rosterEntry || !targetSlot || Number(fromSlotIndex) === Number(toSlotIndex)) {
      setBoardNotice({
        tone: "warning",
        message: "Choose a valid open roster slot before moving that player.",
      });
      return false;
    }

    const targetOccupied = (team.roster || []).some(
      (entry) => Number(entry.slotIndex) === Number(toSlotIndex),
    );
    if (targetOccupied) {
      setBoardNotice({
        tone: "warning",
        message: `${team.name} already has a player in that target slot.`,
      });
      return false;
    }

    if (!canPlayerFillSlot({ ...player, pos: rosterEntry.pos || player?.pos }, targetSlot)) {
      setBoardNotice({
        tone: "warning",
        message: `${rosterEntry.name} is not eligible for the ${targetSlot} slot.`,
      });
      return false;
    }

    pushUndoSnapshot();
    const actionTime = Date.now();

    setLeague((prev) => {
      const event = makeDraftHistoryEventWithValuation({
        type: "roster_move",
        player,
        team,
        rosterSlot: `${rosterEntry.draftedPos || rosterPositions[fromSlotIndex]} -> ${targetSlot}`,
        price: rosterEntry.price,
        timestamp: actionTime,
        remainingBudgetAfter: team.budget_remaining,
        note: "Roster slot correction",
      });

      return withDraftHistory({
        ...prev,
        teams: prev.teams.map((entry) => {
          if (entry.id !== team.id) return entry;
          return {
            ...entry,
            roster: (entry.roster || []).map((candidate) =>
              candidate?.playerId === playerId &&
              Number(candidate.slotIndex) === Number(fromSlotIndex)
                ? {
                    ...candidate,
                    slotIndex: Number(toSlotIndex),
                    draftedPos: targetSlot,
                    movedAt: actionTime,
                  }
                : candidate,
            ),
          };
        }),
      }, event);
    });

    setBoardNotice({
      tone: "success",
      message: `${rosterEntry.name} moved to ${team.name}'s ${targetSlot} slot.`,
    });
    return true;
  }

  function transferRosterEntry(fromTeamId, toTeamId, playerId, toSlotIndex) {
    const fromTeam = league.teams.find((entry) => entry.id === Number(fromTeamId));
    const targetTeam = league.teams.find((entry) => entry.id === Number(toTeamId));
    const rosterEntry = fromTeam?.roster?.find(
      (entry) => entry?.playerId === playerId,
    );
    const player = players.find((entry) => entry.id === playerId) || rosterEntry;
    const targetSlot = rosterPositions[Number(toSlotIndex)];
    const price = Number(rosterEntry?.price || 0);

    if (!fromTeam || !targetTeam || !rosterEntry || !targetSlot || fromTeam.id === targetTeam.id) {
      setBoardNotice({
        tone: "warning",
        message: "Choose a valid destination team and open slot before transferring that player.",
      });
      return false;
    }

    const targetOccupied = (targetTeam.roster || []).some(
      (entry) => Number(entry.slotIndex) === Number(toSlotIndex),
    );
    if (targetOccupied) {
      setBoardNotice({
        tone: "warning",
        message: `${targetTeam.name} already has a player in that target slot.`,
      });
      return false;
    }

    if (!canPlayerFillSlot({ ...player, pos: rosterEntry.pos || player?.pos }, targetSlot)) {
      setBoardNotice({
        tone: "warning",
        message: `${rosterEntry.name} is not eligible for the ${targetSlot} slot.`,
      });
      return false;
    }

    const targetSlotsLeft = totalSlots - (targetTeam.roster || []).length;
    const targetMaxBid = calcMaxBid(targetTeam.budget_remaining, targetSlotsLeft);
    if (price > targetMaxBid) {
      setBoardNotice({
        tone: "warning",
        message: `${targetTeam.name} can only absorb a $${targetMaxBid} transfer and still leave $1 for each remaining slot.`,
      });
      return false;
    }

    pushUndoSnapshot();
    const actionTime = Date.now();

    setLeague((prev) => {
      const event = makeDraftHistoryEventWithValuation({
        type: "roster_transfer",
        player,
        team: targetTeam,
        rosterSlot: targetSlot,
        price,
        timestamp: actionTime,
        remainingBudgetAfter: targetTeam.budget_remaining - price,
        note: `Transferred from ${fromTeam.name}`,
      });

      return withDraftHistory({
        ...prev,
        teams: prev.teams.map((entry) => {
          if (entry.id === fromTeam.id) {
            return {
              ...entry,
              budget_remaining: entry.budget_remaining + price,
              roster: (entry.roster || []).filter(
                (candidate) => candidate?.playerId !== playerId,
              ),
            };
          }

          if (entry.id === targetTeam.id) {
            return {
              ...entry,
              budget_remaining: entry.budget_remaining - price,
              roster: [
                ...(entry.roster || []),
                {
                  ...rosterEntry,
                  slotIndex: Number(toSlotIndex),
                  draftedPos: targetSlot,
                  transferredAt: actionTime,
                  transferredFrom: fromTeam.id,
                },
              ],
            };
          }

          return entry;
        }),
      }, event);
    });

    setPlayers((prev) =>
      prev.map((entry) =>
        entry.id === playerId
          ? {
              ...entry,
              draftedBy: targetTeam.id,
              draftedAt: actionTime,
              taxi: false,
              minorLeague: false,
            }
          : entry,
      ),
    );

    setBoardNotice({
      tone: "success",
      message: `${rosterEntry.name} transferred from ${fromTeam.name} to ${targetTeam.name}.`,
    });
    return true;
  }

  function transferProspect(teamId, targetTeamId, playerId) {
    const fromTeam = league.teams.find((entry) => entry.id === Number(teamId));
    const targetTeam = league.teams.find(
      (entry) => entry.id === Number(targetTeamId),
    );
    const prospectEntry = fromTeam?.minorLeague?.find(
      (entry) => entry?.playerId === playerId,
    );

    if (!fromTeam || !targetTeam || !prospectEntry || fromTeam.id === targetTeam.id) {
      setBoardNotice({
        tone: "warning",
        message: "Choose a valid prospect and destination team before transferring.",
      });
      return false;
    }

    pushUndoSnapshot();
    const actionTime = Date.now();

    setLeague((prev) => {
      const player = players.find((entry) => entry.id === playerId) || {
        id: playerId,
        name: prospectEntry.name,
        pos: prospectEntry.pos,
      };
      const event = makeDraftHistoryEventWithValuation({
        type: "minor_league_transfer",
        player,
        team: targetTeam,
        rosterSlot: "MiLB",
        price: 0,
        timestamp: actionTime,
        remainingBudgetAfter: targetTeam.budget_remaining,
        note: `Transferred from ${fromTeam.name}`,
      });

      return withDraftHistory({
        ...prev,
        teams: prev.teams.map((entry) => {
          if (entry.id === fromTeam.id) {
            return {
              ...entry,
              minorLeague: (entry.minorLeague || []).filter(
                (candidate) => candidate?.playerId !== playerId,
              ),
            };
          }

          if (entry.id === targetTeam.id) {
            return {
              ...entry,
              minorLeague: [
                ...(entry.minorLeague || []),
                {
                  ...prospectEntry,
                  transferredAt: actionTime,
                  transferredFrom: fromTeam.id,
                },
              ],
            };
          }

          return entry;
        }),
      }, event);
    });

    setPlayers((prev) =>
      prev.map((entry) =>
        entry.id === playerId
          ? {
              ...entry,
              drafted: true,
              draftedBy: targetTeam.id,
              draftPrice: 0,
              taxi: false,
              minorLeague: true,
            }
          : entry,
      ),
    );

    setBoardNotice({
      tone: "success",
      message: `${prospectEntry.name} transferred from ${fromTeam.name} to ${targetTeam.name}'s minor league roster.`,
    });
    return true;
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

  useEffect(() => {
    function onKeyDown(event) {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      const target = event.target;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        redoLastAction();
      } else if (key === "z") {
        event.preventDefault();
        undoLastAction();
      } else if (key === "y") {
        event.preventDefault();
        redoLastAction();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undoStack, redoStack]);

  // ─────────────────────────────────────────────────────────────────────────
  // saveNote — persists a scouting note for a player ID.
  //
  // @param {number} playerId - Player ID (from players array)
  // @param {string} text     - Note text to save
  // ─────────────────────────────────────────────────────────────────────────
  function renameTeam(teamIndex, nextName) {
    const trimmed = String(nextName || "").trim();
    if (!trimmed) return;
    pushUndoSnapshot();
    setLeague((prev) => {
      const teams = prev.teams.map((team, idx) =>
        idx === teamIndex ? { ...team, name: trimmed } : team,
      );
      return { ...prev, teams };
    });
    setBoardNotice({
      tone: "info",
      message: `Renamed team ${teamIndex + 1} to "${trimmed}".`,
    });
  }

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
          drafts={savedDrafts}
          activeDraftId={activeDraftId}
          storageMode={storageMode}
          cloudSyncMessage={cloudSyncMessage}
          busy={authBusy}
          error={authError}
          resetToken={passwordResetToken}
          onClose={closeAuthModal}
          onLogin={handleLogin}
          onSignup={handleSignup}
          onRequestPasswordReset={handlePasswordResetRequest}
          onConfirmPasswordReset={handlePasswordResetConfirm}
          onLogout={handleLogout}
          onDismissError={() => setAuthError("")}
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
  const draftHistoryRows = buildDraftHistoryRows(
    league,
    players,
    rosterPositions,
  );
  const ownerRankings = buildOwnerRankings(league, players, rosterPositions);
  const depthCharts = buildMlbDepthCharts(players, league, liveDepthData);
  const keeperCount = (league.teams || []).reduce(
    (total, team) =>
      total + (team.roster || []).filter((entry) => entry?.isKeeper).length,
    0,
  );
  const taxiSlots = Math.max(0, Number(league.roster?.TAXI) || 0);
  const minorLeagueCount = countMinorLeagueEntries(league);
  const showKeeperBoardPrompt =
    activeTab === "board" &&
    league.keeperLeague &&
    keeperCount === 0 &&
    !keeperPromptDismissed;

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
            ["prospects", "Minor League"],
            // "sandbox" tab intentionally omitted from nav — use setActiveTab("sandbox")
            // programmatically or navigate directly for API diagnostics.
            ["taxi", "Taxi Squad"],
            ["insights", "Depth + Rankings"],
            ["history", "Draft History"],
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

          {activeTab === "board" && (
            <button
              type="button"
              className="sample-draft-btn"
              onClick={fillSampleDraft}
              title="Fill 10 sample picks for debugging the draft grid"
            >
              Sample Draft
            </button>
          )}

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
            title={user ? "Open your Draft Kit account and cloud library" : "Open Draft Kit login and cloud library"}
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
            <span className="nav-avatar-copy">
              <span className="nav-avatar-label">
                {user ? user.displayName || user.email : "Account"}
              </span>
              <span className="nav-avatar-sub">
                {user
                  ? "Cloud library active"
                  : "Sign in + cloud library"}
              </span>
            </span>
          </button>
        </div>
      </nav>

      <div className="owner-strip">
        {league.teams.map((team, idx) => {
          const rosterCount = team.roster?.length || 0;
          const teamSlotsLeft = totalSlots - rosterCount;
          const teamMaxBid = calcMaxBid(team.budget_remaining, teamSlotsLeft);
          const fillPct = totalSlots > 0
            ? Math.min(100, Math.round((rosterCount / totalSlots) * 100))
            : 0;
          const budget = Number(team.budget_remaining) || 0;
          const budgetClass = budget <= 0 ? "zero" : budget <= 5 ? "low" : "";

          return (
            <div
              key={team.id}
              className="owner-strip-card readonly"
              role="status"
              aria-label={`${team.name} status — $${budget} budget, ${rosterCount} of ${totalSlots} slots`}
            >
              <div className="owner-strip-top">
                <span className="owner-strip-name">{team.name}</span>
                <button
                  type="button"
                  className="owner-strip-rename"
                  aria-label={`Rename ${team.name}`}
                  title="Rename team"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = window.prompt(
                      "Rename team",
                      team.name,
                    );
                    if (next != null) renameTeam(idx, next);
                  }}
                >
                  ✎
                </button>
              </div>
              <div className="owner-strip-stats">
                <span
                  className={`owner-strip-stat owner-strip-stat-budget budget ${budgetClass}`}
                  title={
                    budget <= 0
                      ? `${team.name} has no budget remaining — locked from bidding`
                      : `${team.budget_remaining} budget left`
                  }
                >
                  ${team.budget_remaining}
                </span>
                <span
                  className="owner-strip-stat owner-strip-stat-roster"
                  title={`${rosterCount} of ${totalSlots} roster slots filled (${fillPct}%)`}
                >
                  {rosterCount}/{totalSlots}
                </span>
                <span
                  className="owner-strip-stat owner-strip-stat-max"
                  title={`Maximum bid ${teamMaxBid}`}
                >
                  max {teamMaxBid}
                </span>
              </div>
              <div className="owner-strip-fill-bar" aria-hidden="true">
                <span style={{ width: `${fillPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Main Content Area (tab-driven) ────────────────────────────────── */}
      <div className="main-content">
        {/* Draft Board — the primary screen */}
        {activeTab === "board" && (
          <div className="board-first-run-wrap">
            {showKeeperBoardPrompt && (
              <div className="keeper-board-prompt">
                <div className="keeper-board-copy">
                  <span className="keeper-board-eyebrow">Keeper league setup</span>
                  <strong>Keeper contracts are pending.</strong>
                  <span>
                    Review the board first, then add keeper contracts before
                    recording auction picks.
                  </span>
                </div>
                <div className="keeper-board-stats">
                  <span>{keeperCount} keepers entered</span>
                  <span>{totalRecordedPicks} board entries</span>
                  <span>{taxiSlots} taxi slots</span>
                  <span>{minorLeagueCount} minor league</span>
                </div>
                <div className="keeper-board-actions">
                  <button
                    type="button"
                    className="keeper-board-primary"
                    onClick={() => setActiveTab("keeper")}
                  >
                    Set Up Keepers
                  </button>
                  <button
                    type="button"
                    onClick={() => setKeeperPromptDismissed(true)}
                  >
                    Skip For Now
                  </button>
                  <button
                    type="button"
                    onClick={markNotKeeperLeagueFromBoard}
                  >
                    Not a Keeper League
                  </button>
                </div>
              </div>
            )}
            {ownerRankings.length > 0 && (() => {
              const leader = ownerRankings[0];
              if (!leader) return null;
              return (
                <button
                  type="button"
                  className="rank-pill"
                  onClick={() => setActiveTab("insights")}
                  title={`Open Depth + Rankings — leader strength score ${leader.strengthScore}`}
                >
                  <span>★ Leader: {leader.name}</span>
                  <span className="rank-pill-arrow">View Rankings →</span>
                </button>
              );
            })()}
            <PlayerUpdateCenter
              updates={playerUpdates}
              loading={playerUpdatesLoading}
              error={playerUpdatesError}
              apiStatus={apiStatus}
              pushStatus={playerPushStatus}
              targetPlayer={selectedPlayer}
              onRefresh={() => fetchPlayerUpdates()}
              onPublishInjury={publishInjuryUpdate}
              onOpenPlayer={openPlayerFromUpdate}
              onDeleteUpdate={deletePlayerUpdate}
            />
            <DraftBoard
              league={league}
              players={players}
              selectedPlayer={selectedPlayer}
              setSelectedPlayer={setSelectedPlayer}
              onSale={recordSale}
              onUndo={undoLast}
              onRedo={redoLast}
              onUndoCell={undoSale}
              onMoveRosterEntry={moveRosterEntry}
              onTransferRosterEntry={transferRosterEntry}
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
              valuationLoading={valuationLoading}
              requestValuation={requestValuation}
              draftStateKey={draftStateKey}
              canUndo={undoStack.length > 0}
              canRedo={redoStack.length > 0}
              boardNotice={boardNotice}
              onAddCustomPlayer={addCustomPlayer}
            />
          </div>
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
            valuationLoading={valuationLoading}
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
            players={players}
            onAddKeeper={addKeeperContract}
            onUpdateKeeper={updateKeeperContract}
            onRemoveKeeper={removeKeeperContract}
            onReturnToBoard={() => setActiveTab("board")}
          />
        )}

        {/* API Sandbox — raw JSON request/response tester */}
        {activeTab === "sandbox" && (
          <ApiSandbox league={league} apiStatus={apiStatus} />
        )}

        {/* Prospect Rosters — protected minor league player assignments */}
        {activeTab === "prospects" && (
          <ProspectRosters
            league={league}
            players={players}
            currentOwnerIdx={currentOwnerIdx}
            onSetCurrentOwnerIdx={setCurrentOwnerIdx}
            onAddProspect={addProspectToMinorLeague}
            onRemoveProspect={removeProspectFromMinorLeague}
            onTransferProspect={transferProspect}
          />
        )}

        {/* Taxi Squad — $1 reserve picks */}
        {activeTab === "taxi" && (
          <TaxiSquad
            league={league}
            players={players}
            onTaxiPick={addTaxiPick}
            onRemoveTaxiPick={removeTaxiPick}
            currentOwnerIdx={currentOwnerIdx}
            onSetCurrentOwnerIdx={setCurrentOwnerIdx}
            rosterPositions={rosterPositions}
          />
        )}

        {/* Depth + Rankings — MLB depth charts and fantasy team strength */}
        {activeTab === "insights" && (
          <DepthCharts
            depthCharts={depthCharts}
            ownerRankings={ownerRankings}
            league={league}
            selectedPlayer={selectedPlayer}
            setSelectedPlayer={setSelectedPlayer}
            notes={notes}
            favorites={favorites}
            saveNote={saveNote}
            toggleFavorite={toggleFavorite}
            valuationCache={valuationCache}
            valuationLoading={valuationLoading}
            valuationError={valuationError}
            requestValuation={requestValuation}
            liveDepthLoading={liveDepthLoading}
            liveDepthError={liveDepthError}
            onRefreshLiveDepth={() => fetchLiveDepthCharts({ refresh: true })}
          />
        )}

        {/* Draft History — ordered audit trail and CSV export */}
        {activeTab === "history" && (
          <DraftHistory league={league} rows={draftHistoryRows} />
        )}
      </div>

      <AuthModal
        open={showAuthModal}
        user={user}
        drafts={savedDrafts}
        activeDraftId={activeDraftId}
        storageMode={storageMode}
        cloudSyncMessage={cloudSyncMessage}
        busy={authBusy}
        error={authError}
        resetToken={passwordResetToken}
        onClose={closeAuthModal}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onRequestPasswordReset={handlePasswordResetRequest}
        onConfirmPasswordReset={handlePasswordResetConfirm}
        onLogout={handleLogout}
        onDismissError={() => setAuthError("")}
      />
    </div>
  );
}
