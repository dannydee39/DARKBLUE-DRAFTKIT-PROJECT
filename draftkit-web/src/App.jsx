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
  mergePlayerPositions,
  remapRosterSlotIndex,
  slotAcceptsPlayer,
} from "./utils/helpers.js";
import {
  createCloudDraft,
  deleteCloudDraft,
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
import { getPlayerAlertTone } from "./utils/playerAlerts.js";

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

/*
 * Sample draft targets for the board action. The button is a one-click way to
 * populate a new workspace with realistic auction activity while still using
 * the live player pool, current roster settings, and normal draft history.
 */
const SAMPLE_DRAFT_PICKS = [
  { name: "Shohei Ohtani", teamIdx: 0, price: 65, preferredSlot: "UTIL" },
  { name: "William Contreras", teamIdx: 0, price: 22, preferredSlot: "C" },
  { name: "Juan Soto", teamIdx: 1, price: 72, preferredSlot: "OF" },
  { name: "Freddie Freeman", teamIdx: 1, price: 28, preferredSlot: "1B" },
  { name: "Kyle Tucker", teamIdx: 2, price: 55, preferredSlot: "OF" },
  { name: "Francisco Lindor", teamIdx: 2, price: 38, preferredSlot: "SS" },
  { name: "Corbin Carroll", teamIdx: 3, price: 40, preferredSlot: "OF" },
  { name: "Nolan Arenado", teamIdx: 3, price: 20, preferredSlot: "CI" },
  { name: "Elly De La Cruz", teamIdx: 4, price: 35, preferredSlot: "SS" },
  { name: "Logan Webb", teamIdx: 5, price: 25, preferredSlot: "P" },
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
  const [valuationStale, setValuationStale] = useState(false);
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
      } catch {
        setCloudSyncMessage("Draft save failed. Try again from the draft library.");
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
  // Marks live values stale whenever any meaningful draft-state input changes.
  // We intentionally keep the last successful valuation cache visible while the
  // refresh is running; clearing it made the board fall back to starting values
  // even when the API was healthy and only needed a moment to recalculate.
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
  const liveDepthStateKey = [
    liveDepthData?.source || "",
    liveDepthData?.generated_at || "",
    ...(liveDepthData?.teams || []).map((team) =>
      [
        team.team || "",
        (team.roster || [])
          .map((entry) =>
            [
              entry.name || "",
              entry.active ? 1 : 0,
              entry.statusCode || "",
              entry.statusDescription || "",
              entry.positionCode || "",
            ].join(":"),
          )
          .sort()
          .join(","),
      ].join("="),
    ),
  ].join("|");
  const draftStateKey = `${leagueSettingsStateKey}::${teamDraftStateKey}::${liveDepthStateKey}`;
  useEffect(() => {
    cacheVersionRef.current += 1;
    valuationRequestRef.current = { key: null, inFlight: false };
    setValuationStale(Object.keys(valuationCacheRef.current || {}).length > 0);
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
    if (apiStatus === "offline" || players.length === 0) return;

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

    let requestSucceeded = false;
    try {
      const draftState = buildDraftState(league, players, depthCharts);

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
          "Live values are unavailable. Showing the last known values instead.",
        );
        return;
      }

      const previousValuations = valuationCacheRef.current || {};
      const valuationsById = {};
      let missingValuationCount = 0;
      players.forEach((player) => {
        const match = data.valuations?.[player.name];
        if (match) {
          valuationsById[player.id] = match;
        } else if (previousValuations[player.id]) {
          valuationsById[player.id] = previousValuations[player.id];
          missingValuationCount += 1;
        } else {
          missingValuationCount += 1;
        }
      });

      valuationCacheRef.current = valuationsById;
      setValuationCache(valuationsById);
      setValuationStale(
        missingValuationCount > 0 && Object.keys(previousValuations).length > 0,
      );
      if (missingValuationCount > 0) {
        setValuationError(
          `Live values refreshed for ${players.length - missingValuationCount}/${players.length} players. Showing last known values where needed.`,
        );
      }
      requestSucceeded = true;
    } catch (error) {
      if (cacheVersionRef.current !== version) return;
      valuationRequestRef.current = { key: null, inFlight: false };
      setValuationError(
        error?.name === "AbortError"
          ? "Live values are taking too long. Showing the last known values instead."
          : "Live values are unavailable. Showing the last known values instead.",
      );
    } finally {
      window.clearTimeout(timeoutId);
      if (cacheVersionRef.current === version) {
        valuationRequestRef.current = {
          key: requestSucceeded ? requestKey : null,
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
      } catch {
        setCloudSyncMessage("Signed in, but this draft could not be saved yet.");
      }
    } catch {
      setAuthError("Account creation failed. Check your details and try again.");
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
      } catch {
        setCloudSyncMessage("Signed in, but this draft could not be saved yet.");
      }
    } catch {
      setAuthError("Sign in failed. Check your email and password.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePasswordResetRequest(payload) {
    setAuthBusy(true);
    setAuthError("");
    try {
      await requestPasswordReset(payload);
      const message = "If that account exists, a reset link will be sent shortly.";
      setCloudSyncMessage(message);
      return { ok: true, message };
    } catch (error) {
      if (error?.code === "MAIL_NOT_CONFIGURED") {
        const message =
          "Password reset is temporarily unavailable. Contact the league administrator.";
        setCloudSyncMessage(message);
        return { ok: true, message };
      }
      setAuthError("Could not request a password reset. Try again later.");
      return null;
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePasswordResetConfirm(payload) {
    setAuthBusy(true);
    setAuthError("");
    try {
      await confirmPasswordReset(payload);
      setPasswordResetToken("");
      const message = "Password reset complete. Sign in with your new password.";
      setCloudSyncMessage(message);
      return { ok: true, message };
    } catch {
      setAuthError("Could not reset password. Check the reset link and try again.");
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
    } catch {
      setAuthError("Sign out failed. Try again.");
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
    } catch {
      setCloudSyncMessage("Draft save failed. Sign in and try again before drafting.");
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
    } catch {
      setCloudSyncMessage("Could not duplicate that draft. Sign in and try again.");
    }
  }

  async function deleteDraft(draftId) {
    if (!window.confirm("Delete this saved draft workspace?")) return;

    const draft = savedDrafts.find((entry) => entry.id === draftId);
    if (draft?.source === "cloud") {
      try {
        await deleteCloudDraft(draftId);
      } catch {
        setBoardNotice({
          tone: "warning",
          message: "Could not delete that cloud draft right now.",
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

    setLeague((prev) => {
      const nextRoster = normalized.commissionerUnlocked
        ? normalized.roster
        : prev.roster;
      return {
        ...prev,
        name: normalized.name,
        season: normalized.season,
        scoring: normalized.scoring,
        keeperLeague: normalized.keeperLeague,
        commissionerUnlocked: normalized.commissionerUnlocked,
        budget: normalized.commissionerUnlocked ? normalized.budget : prev.budget,
        roster: nextRoster,
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
            roster: (renamedTeam.roster || []).map((entry) => ({
              ...entry,
              slotIndex: remapRosterSlotIndex(
                entry.slotIndex,
                prev.roster,
                nextRoster,
              ),
            })),
          };
        }),
      };
    });

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
          alert_status: null,
          alert_tone: null,
          alert_status_label: null,
          injury_status: null,
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
        alert_status: update.alert_status || null,
        alert_tone: getPlayerAlertTone(update),
        alert_status_label: update.status_label || null,
        injury_status: update.injury_status || null,
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
    setValuationStale(Object.keys(valuationCacheRef.current || {}).length > 0);
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
      const response = await fetch(`${DRAFTKIT_API_BASE}/v1/player-updates?limit=10`);
      const data = await response.json();

      if (!response.ok || !Array.isArray(data?.updates)) {
        throw new Error("Player alerts are unavailable right now.");
      }

      applyPlayerUpdates(data.updates, { replace: true });
      return data.updates;
    } catch {
      if (!silent) {
        setPlayerUpdatesError("Player alerts are unavailable right now.");
      }
      return [];
    } finally {
      if (!silent) {
        setPlayerUpdatesLoading(false);
      }
    }
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
        throw new Error("Depth charts are unavailable right now.");
      }

      setLiveDepthData(data);
      setLiveDepthError("");
      return data;
    } catch {
      if (!silent) {
        setLiveDepthError("Depth charts are unavailable right now.");
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
        tone: getPlayerAlertTone(pushedUpdate),
        message: `Player alert: ${pushedUpdate.headline || pushedUpdate.player_name}`,
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

  function openPlayerFromUpdate(update) {
    const matched = players.find(
      (player) => Number(player.id) === Number(update?.player_id),
    );
    if (!matched) return;

    setActiveTab("board");
    setSelectedPlayer({
      ...matched,
      risk_level: update.risk_level || update.severity || matched.risk_level,
      alert_status: update.alert_status || matched.alert_status || null,
      alert_tone: getPlayerAlertTone(update),
      alert_status_label: update.status_label || matched.alert_status_label || null,
      injury_status: update.injury_status || null,
      news_headline: update.headline || null,
      update_impact_summary: update.impact_summary || null,
      last_update_at: update.created_at || matched.last_update_at,
      latest_update: update,
    });
  }

  useEffect(() => {
    if (apiStatus !== "online") {
      playerUpdateStreamRef.current?.close?.();
      playerUpdateStreamRef.current = null;
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
        setPlayerUpdatesError("Player alerts are reconnecting.");
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
        setPlayerUpdatesError("Player alerts are reconnecting.");
      }
    });

    stream.onerror = () => {
      setPlayerPushStatus("reconnecting");
    };

    return () => {
      stream.close();
      if (playerUpdateStreamRef.current === stream) {
        playerUpdateStreamRef.current = null;
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
          pos: mergePlayerPositions(currentPlayer.pos || [], player?.pos || []),
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

  function findSampleRosterSlot(player, team, pendingRoster, preferredSlot) {
    const usedSlotIndexes = new Set(
      [...(team?.roster || []), ...(pendingRoster || [])].map((entry) =>
        Number(entry.slotIndex),
      ),
    );
    const preferred = String(preferredSlot || "").trim().toUpperCase();
    const openValidSlots = rosterPositions
      .map((slot, index) => ({ slot, index }))
      .filter(
        ({ slot, index }) =>
          !usedSlotIndexes.has(index) && canPlayerFillSlot(player, slot),
      );

    return (
      openValidSlots.find(({ slot }) => slot === preferred) ||
      openValidSlots[0] ||
      null
    );
  }

  function findSamplePlayer(playerName, draftedPlayerIds) {
    const normalizedName = String(playerName || "").trim().toLowerCase();
    if (!normalizedName) return null;

    return (
      players.find(
        (player) =>
          !player.drafted &&
          !draftedPlayerIds.has(player.id) &&
          String(player.name || "").trim().toLowerCase() === normalizedName,
      ) || null
    );
  }

  /*
   * Loads a short sample draft into the current board. It uses the same state
   * changes as a real auction sale: budgets change, players become drafted,
   * and draft history captures the valuation snapshot visible at the time.
   */
  function fillSampleDraft() {
    if (!players.length || !league.teams?.length || !rosterPositions.length) {
      setBoardNotice({
        tone: "warning",
        message: "Start a draft with a loaded player pool before adding sample picks.",
      });
      return;
    }

    const baseTime = Date.now();
    const teamChanges = {};
    const historyEntries = [];
    const draftedPlayerIds = new Set();
    let skippedCount = 0;

    SAMPLE_DRAFT_PICKS.forEach((pick) => {
      const player = findSamplePlayer(pick.name, draftedPlayerIds);
      const team = league.teams[pick.teamIdx];
      if (!player || !team) {
        skippedCount += 1;
        return;
      }

      if (!teamChanges[team.id]) {
        teamChanges[team.id] = { budgetDelta: 0, newRoster: [] };
      }

      const teamChange = teamChanges[team.id];
      const slot = findSampleRosterSlot(
        player,
        team,
        teamChange.newRoster,
        pick.preferredSlot,
      );
      if (!slot) {
        skippedCount += 1;
        return;
      }

      const pendingBudget = team.budget_remaining + teamChange.budgetDelta;
      const pendingRosterCount =
        (team.roster || []).length + teamChange.newRoster.length;
      const slotsLeftBeforePick = Math.max(0, totalSlots - pendingRosterCount);
      const allowedPrice = calcMaxBid(pendingBudget, slotsLeftBeforePick);
      const price = Math.max(1, Math.min(Number(pick.price) || 1, allowedPrice));
      const draftedAt = baseTime + draftedPlayerIds.size;
      const rosterEntry = {
        playerId: player.id,
        name: player.name,
        price,
        pos: player.pos,
        slotIndex: slot.index,
        draftedPos: slot.slot,
        draftedAt,
      };

      teamChange.budgetDelta -= price;
      teamChange.newRoster.push(rosterEntry);
      draftedPlayerIds.add(player.id);

      historyEntries.push({
        playerId: player.id,
        teamId: team.id,
        price,
        draftedAt,
        event: makeDraftHistoryEventWithValuation({
          type: "auction",
          player,
          team,
          rosterSlot: slot.slot,
          price,
          timestamp: draftedAt,
          remainingBudgetAfter: team.budget_remaining + teamChange.budgetDelta,
          note: "Sample draft pick",
          source: "sample",
        }),
      });
    });

    if (draftedPlayerIds.size === 0) {
      setBoardNotice({
        tone: "warning",
        message: "No sample picks were added because the target players are unavailable or already drafted.",
      });
      return;
    }

    pushUndoSnapshot();

    setLeague((prev) => {
      let nextLeague = {
        ...prev,
        teams: prev.teams.map((team) => {
          const changes = teamChanges[team.id];
          if (!changes) return team;
          return {
            ...team,
            budget_remaining: team.budget_remaining + changes.budgetDelta,
            roster: [...(team.roster || []), ...changes.newRoster],
          };
        }),
      };

      historyEntries.forEach(({ event }) => {
        nextLeague = withDraftHistory(nextLeague, event);
      });

      return nextLeague;
    });

    setPlayers((prev) =>
      prev.map((player) => {
        const historyEntry = historyEntries.find(
          (entry) => entry.playerId === player.id,
        );
        if (!historyEntry) return player;

        return {
          ...player,
          drafted: true,
          draftedBy: historyEntry.teamId,
          draftPrice: historyEntry.price,
          draftedAt: historyEntry.draftedAt,
          taxi: false,
          minorLeague: false,
        };
      }),
    );

    setBoardNotice({
      tone: "info",
      message:
        skippedCount > 0
          ? `Added ${draftedPlayerIds.size} sample picks. ${skippedCount} target players were unavailable.`
          : `Added ${draftedPlayerIds.size} sample picks to the draft board.`,
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
              title="Add a short sample auction sequence to the current board"
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
              onRefresh={() => fetchPlayerUpdates()}
              onOpenPlayer={openPlayerFromUpdate}
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
              valuationStale={valuationStale}
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
            valuationStale={valuationStale}
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
            valuationStale={valuationStale}
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
