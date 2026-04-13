// ─────────────────────────────────────────────────────────────────────────────
// components/DraftBoard.jsx
//
// The main draft screen. Left: interactive team roster grid + player search.
// Right: budget panel, player card, recommendations.
//
// ── Grid Cell Behavior ────────────────────────────────────────────────────────
//
//  FILLED CELL:
//    • Hover → tooltip: name / price / base value / FPTS / "click to remove"
//    • Left border color: green=steal, red=overpaid, transparent=fair
//    • Click → RemoveModal (confirms, refunds budget)
//
//  EMPTY CELL:
//    • Hover → tooltip: position slot label + best available player
//    • Click → InlineCellSearch (mini search box inside the cell)
//             Also opens sale modal when a player is selected from it.
//
//  COLUMN HEADER (position badge):
//    • Click → toggles position filter in the bottom search bar
//
// ── Roster Slot Storage ───────────────────────────────────────────────────────
// Each roster entry: { name, price, pos, slotIndex, draftedPos, isKeeper? }
// Grid displays via: team.roster.find(r => r.slotIndex === si)
// This means position matters — a C drafted into slot 0 stays in that cell.
// ─────────────────────────────────────────────────────────────────────────────-

import { useState, useEffect, useMemo, useRef } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import PlayerCard from "./PlayerCard.jsx";
import { posColor, calcMaxBid, getValueClass } from "../utils/helpers.js";

const SCOUT_RAIL_HELP_STORAGE_KEY = "draftkit-hide-scout-rail-help";
const SCOUT_RAIL_TAB_STORAGE_KEY = "draftkit-scout-rail-tab";

function normalizePosLabel(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function slotAcceptsPlayer(player, slotPos) {
  const normalizedSlot = normalizePosLabel(slotPos);
  const playerPositions = (player?.pos || []).map(normalizePosLabel);

  if (normalizedSlot === "BN") return true;
  if (normalizedSlot === "UTIL") {
    return playerPositions.some((p) => !["SP", "RP"].includes(p));
  }
  return playerPositions.includes(normalizedSlot);
}

function sortPlayersForScout(
  players,
  { searchQ, posFilter, notesOnly, favoritesOnly, favorites, notes, slotPos },
) {
  const q = searchQ.trim().toLowerCase();

  return players
    .filter((player) => {
      const noteText = notes?.[player.id] || player.note;
      const playerPositions = (player.pos || []).map(normalizePosLabel);
      const normalizedFilter = normalizePosLabel(posFilter);
      if (player.drafted) return false;
      if (slotPos && !slotAcceptsPlayer(player, slotPos)) return false;
      if (q) {
        const haystack = `${player.name} ${player.team || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (
        normalizedFilter !== "ALL" &&
        !playerPositions.includes(normalizedFilter)
      )
        return false;
      if (notesOnly && !noteText) return false;
      if (favoritesOnly && !favorites?.[player.id]) return false;
      return true;
    })
    .sort((a, b) => {
      const aFavorite = favorites?.[a.id] ? 1 : 0;
      const bFavorite = favorites?.[b.id] ? 1 : 0;
      if (aFavorite !== bFavorite) return bFavorite - aFavorite;

      const aHasNote = notes?.[a.id] || a.note ? 1 : 0;
      const bHasNote = notes?.[b.id] || b.note ? 1 : 0;
      if (aHasNote !== bHasNote) return bHasNote - aHasNote;

      const aValue = a.baseValue ?? 0;
      const bValue = b.baseValue ?? 0;
      if (aValue !== bValue) return bValue - aValue;

      return a.name.localeCompare(b.name);
    });
}

export default function DraftBoard({
  league,
  players,
  selectedPlayer,
  setSelectedPlayer,
  onSale, // (player, price, teamId, slotIndex, draftedPos) => void
  onUndo,
  onRedo,
  onUndoCell,
  currentOwnerIdx,
  setCurrentOwnerIdx,
  notes,
  favorites,
  saveNote,
  toggleFavorite,
  apiStatus,
  rosterPositions, // flat ordered array e.g. ["C","1B","2B","3B","SS","OF","OF","OF","SP"...]
  totalSlots,
  maxBid,
  valuationCache, // shared valuation cache from App { [playerId]: "loading" | apiResponse }
  requestValuation, // (player) => void  — requests a valuation and stores it in the cache
  draftStateKey, // compact string that changes on every pick/undo (cache version key)
  canUndo = false,
  canRedo = false,
  boardNotice = null,
}) {
  // ── Search / filter state (right scouting rail) ───────────────────────────
  const [searchQ, setSearchQ] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [notesOnly, setNotesOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [activeRailTab, setActiveRailTab] = useState(() => {
    try {
      return (
        window.localStorage.getItem(SCOUT_RAIL_TAB_STORAGE_KEY) || "search"
      );
    } catch {
      return "search";
    }
  });
  const [isPinnedExpanded, setIsPinnedExpanded] = useState(false);
  const [hoverPreviewPlayer, setHoverPreviewPlayer] = useState(null);

  // ── Sale modal state ──────────────────────────────────────────────────────
  const [saleModal, setSaleModal] = useState(null); // player obj or null
  const [saleTeam, setSaleTeam] = useState(1); // winning team ID
  const [salePrice, setSalePrice] = useState(""); // bid amount
  const [saleSlot, setSaleSlot] = useState(null); // slotIndex to fill
  const [customPosInput, setCustomPosInput] = useState(""); // custom eligibility override

  // ── Remove confirmation modal state ──────────────────────────────────────
  const [removeModal, setRemoveModal] = useState(null); // {playerName, teamId, price, pos}

  // ── Active slot context ───────────────────────────────────────────────────
  // When set, the right scouting rail filters to players for this slot.
  const [activeCellSearch, setActiveCellSearch] = useState(null); // {teamId, slotIdx, pos}

  // ── Grid tooltip hover state ──────────────────────────────────────────────
  const [hoveredCell, setHoveredCell] = useState(null);
  const [hideScoutRailHelp, setHideScoutRailHelp] = useState(() => {
    try {
      return window.localStorage.getItem(SCOUT_RAIL_HELP_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [dismissScoutRailHelp, setDismissScoutRailHelp] = useState(false);

  const searchRef = useRef(null);
  const pinnedPopoverRef = useRef(null);
  const pinnedStripRef = useRef(null);
  const previousFocusRef = useRef(null);
  const hoverPreviewTimeoutRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Derived: extend saleModal player with custom eligibility override.
  // If user typed extra positions in the override box, temporarily add them
  // to the player's pos list so they appear as valid slot options.
  // ─────────────────────────────────────────────────────────────────────────
  const extendedSalePlayer = saleModal
    ? {
        ...saleModal,
        pos: [
          ...new Set([
            ...(Array.isArray(saleModal.pos) ? saleModal.pos : []),
            ...customPosInput
              .toUpperCase()
              .split(/[,\s]+/)
              .map((p) => p.trim())
              .filter(Boolean),
          ]),
        ],
      }
    : null;

  // Valid slots for the current modal player + selected team
  const validSlotsForModal = extendedSalePlayer
    ? getValidSlotsForPlayer(extendedSalePlayer, saleTeam)
    : [];

  // ─────────────────────────────────────────────────────────────────────────
  // getValidSlotsForPlayer — returns all valid empty roster slots for a player
  // on a given team. Used in both the sale modal slot picker and inline search.
  //
  // Slot eligibility rules:
  //   BN   → any player
  //   UTIL → any player with at least one non-pitcher position (not pure SP/RP)
  //   other → player.pos.includes(slotPos)
  //
  // @param {Object} player - Player object (uses .pos array)
  // @param {number} teamId - Team to check slots for
  // @returns {{ slotIdx: number, pos: string }[]}
  // ─────────────────────────────────────────────────────────────────────────
  function getValidSlotsForPlayer(player, teamId) {
    const team = league.teams.find((t) => t.id === teamId);
    if (!team) return [];
    const playerPositions = (Array.isArray(player?.pos) ? player.pos : []).map(
      normalizePosLabel,
    );

    // Occupied slot indices for this team
    const takenSlots = new Set(team.roster.map((r) => r.slotIndex));

    return rosterPositions.reduce((acc, slotPos, si) => {
      // Skip occupied slots
      if (takenSlots.has(si)) return acc;

      if (slotPos === "BN") {
        // Bench: accepts any player
        acc.push({ slotIdx: si, pos: slotPos });
        return acc;
      }

      if (slotPos === "UTIL") {
        // UTIL: accepts any hitter (player has at least one non-pitcher position)
        const hasHitterEligibility = playerPositions.some(
          (p) => !["SP", "RP"].includes(normalizePosLabel(p)),
        );
        if (hasHitterEligibility) {
          acc.push({ slotIdx: si, pos: slotPos });
        }
        return acc;
      }

      // Standard slot: player must have this position in their eligibility
      if (playerPositions.includes(normalizePosLabel(slotPos))) {
        acc.push({ slotIdx: si, pos: slotPos });
      }

      return acc;
    }, []);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Effects
  // ─────────────────────────────────────────────────────────────────────────

  // Auto-fetch valuation when selected player OR draft state changes.
  // draftStateKey re-triggers this whenever a player is added/removed,
  // so the API inflation & scarcity math stays accurate without a manual re-click.
  useEffect(() => {
    if (selectedPlayer) requestValuation(selectedPlayer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayer?.id, draftStateKey]);

  useEffect(() => {
    try {
      if (hideScoutRailHelp) {
        window.localStorage.setItem(SCOUT_RAIL_HELP_STORAGE_KEY, "1");
      } else {
        window.localStorage.removeItem(SCOUT_RAIL_HELP_STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures in private browsing or restricted environments.
    }
  }, [hideScoutRailHelp]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SCOUT_RAIL_TAB_STORAGE_KEY, activeRailTab);
    } catch {
      // Ignore storage failures.
    }
  }, [activeRailTab]);

  useEffect(() => {
    if (!selectedPlayer) {
      setIsPinnedExpanded(false);
    }
  }, [selectedPlayer?.id]);

  useEffect(() => {
    return () => {
      if (hoverPreviewTimeoutRef.current) {
        window.clearTimeout(hoverPreviewTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isPinnedExpanded || !selectedPlayer) return undefined;

    previousFocusRef.current = document.activeElement;
    const popoverEl = pinnedPopoverRef.current;
    if (!popoverEl) return undefined;

    const focusFirst = () => {
      const focusables = popoverEl.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        popoverEl.focus();
      }
    };

    const rafId = window.requestAnimationFrame(focusFirst);

    const trapFocus = (event) => {
      if (event.key !== "Tab") return;
      const focusables = Array.from(
        popoverEl.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));

      if (focusables.length === 0) {
        event.preventDefault();
        popoverEl.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    popoverEl.addEventListener("keydown", trapFocus);

    return () => {
      window.cancelAnimationFrame(rafId);
      popoverEl.removeEventListener("keydown", trapFocus);
      const previous = previousFocusRef.current;
      if (previous instanceof HTMLElement) {
        previous.focus();
      } else {
        pinnedStripRef.current?.focus();
      }
    };
  }, [isPinnedExpanded, selectedPlayer?.id]);

  // Close modals on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key !== "Escape") return;

      if (saleModal) {
        closeSaleModal();
        return;
      }

      if (removeModal) {
        setRemoveModal(null);
        return;
      }

      if (isPinnedExpanded) {
        setIsPinnedExpanded(false);
        return;
      }

      if (activeCellSearch) {
        setActiveCellSearch(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeCellSearch, isPinnedExpanded, removeModal, saleModal]);

  // When saleTeam changes while modal is open, recalculate valid slots
  // and reset saleSlot to the first valid option
  useEffect(() => {
    if (!saleModal || !extendedSalePlayer) return;
    const slots = getValidSlotsForPlayer(extendedSalePlayer, saleTeam);
    setSaleSlot(slots[0]?.slotIdx ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customPosInput, saleModal?.id, saleTeam]);

  function handleSelectPlayer(player) {
    if (!player) return;
    setHoverPreviewPlayer(null);
    setSelectedPlayer(player);
    requestValuation(player);
  }

  function openPlayerCard(player) {
    if (!player) return;
    clearHoverPreview();
    handleSelectPlayer(player);
    setIsPinnedExpanded(true);
  }

  function clearHoverPreview() {
    if (hoverPreviewTimeoutRef.current) {
      window.clearTimeout(hoverPreviewTimeoutRef.current);
      hoverPreviewTimeoutRef.current = null;
    }
    setHoverPreviewPlayer(null);
  }

  function scheduleHoverPreview(player) {
    if (!player || isPinnedExpanded || saleModal || removeModal) return;
    if (selectedPlayer?.id === player.id) return;
    if (hoverPreviewTimeoutRef.current) {
      window.clearTimeout(hoverPreviewTimeoutRef.current);
    }
    hoverPreviewTimeoutRef.current = window.setTimeout(() => {
      setHoverPreviewPlayer(player);
      const cachedValuation = valuationCache?.[player.id];
      if (!cachedValuation) {
        requestValuation(player);
      }
    }, 140);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getRecommendedBid — returns the best available bid suggestion for a player.
  // Uses the live API value from cache when available, falls back to baseValue.
  // @param {Object} player
  // @returns {number|string}
  // ─────────────────────────────────────────────────────────────────────────
  function getRecommendedBid(player) {
    const cached = valuationCache?.[player?.id];
    if (
      cached &&
      cached !== "loading" &&
      cached.max_bid_recommendation != null
    ) {
      return cached.max_bid_recommendation;
    }
    return player?.baseValue ?? "";
  }

  // ─────────────────────────────────────────────────────────────────────────
  // openSaleModal — open the sale modal for a player.
  // Pre-selects the first valid slot for the current active owner's team.
  // ─────────────────────────────────────────────────────────────────────────
  function openSaleModal(player) {
    // Kick off a valuation request immediately so the modal can update
    // its suggested bid as soon as the API responds (even after it opens).
    setIsPinnedExpanded(false);
    clearHoverPreview();
    requestValuation(player);
    const team = league.teams[currentOwnerIdx];
    const initialSlots = getValidSlotsForPlayer(player, team?.id || 1);
    setSaleModal(player);
    setSaleTeam(team?.id || 1);
    setSaleSlot(initialSlots[0]?.slotIdx ?? null);
    setSalePrice(getRecommendedBid(player));
    setCustomPosInput("");
    setSelectedPlayer(player);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // openSaleModalForCell — opens sale modal pre-filled for a specific cell.
  // Called when a player is selected from the InlineCellSearch dropdown.
  //
  // @param {Object} player  - Player selected
  // @param {number} teamId  - Team ID of the clicked cell
  // @param {number} slotIdx - Slot index of the clicked cell
  // ─────────────────────────────────────────────────────────────────────────
  function openSaleModalForCell(player, teamId, slotIdx) {
    setIsPinnedExpanded(false);
    clearHoverPreview();
    requestValuation(player); // same as openSaleModal — trigger early so bid updates live
    // Switch the active owner to the team being filled
    const ti = league.teams.findIndex((t) => t.id === teamId);
    if (ti >= 0) setCurrentOwnerIdx(ti);

    setSaleModal(player);
    setSaleTeam(teamId);
    setSaleSlot(slotIdx); // pre-select the exact slot that was clicked
    setSalePrice(getRecommendedBid(player));
    setCustomPosInput("");
    setSelectedPlayer(player);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // When the modal is already open and a valuation response arrives, update
  // the suggested bid if the user hasn't manually changed it yet.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!saleModal) return;
    const cached = valuationCache?.[saleModal.id];
    if (
      !cached ||
      cached === "loading" ||
      cached.max_bid_recommendation == null
    )
      return;
    setSalePrice((prev) => {
      const prevNum = Number(prev);
      // Only auto-fill if the field still holds the baseValue default (hasn't been manually edited)
      if (
        prev === "" ||
        Number.isNaN(prevNum) ||
        prevNum === Number(saleModal.baseValue)
      ) {
        return String(cached.max_bid_recommendation);
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleModal?.id, valuationCache]);

  // ─────────────────────────────────────────────────────────────────────────
  // confirmSale — validates and fires onSale with slotIndex + draftedPos.
  // Clears all modal state on success.
  // ─────────────────────────────────────────────────────────────────────────
  function confirmSale() {
    if (!saleModal || !salePrice || saleSlot == null) return;
    // The draftedPos is the position label of the selected slot
    // (could differ from player.pos[0] if going into UTIL or BN)
    const draftedPos = rosterPositions[saleSlot] || "BN";
    const saved = onSale(
      extendedSalePlayer || saleModal,
      +salePrice,
      saleTeam,
      saleSlot,
      draftedPos,
    );
    if (saved === false) return;
    closeSaleModal();
    setActiveCellSearch(null);
    setSelectedPlayer(null);
  }

  function closeSaleModal() {
    setSaleModal(null);
    setSalePrice("");
    setSaleSlot(null);
    setCustomPosInput("");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // handleFilledCellClick — opens the remove confirmation modal.
  // ─────────────────────────────────────────────────────────────────────────
  function handleFilledCellClick(entry, teamId, pos, e) {
    e.stopPropagation();
    setActiveCellSearch(null); // close any open inline search
    setRemoveModal({
      playerId: entry.playerId,
      playerName: entry.name,
      teamId,
      slotIndex: entry.slotIndex,
      price: entry.price,
      pos,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // handleEmptyCellClick — opens the inline cell search for this specific slot.
  // This lets the user search + add a player directly from the grid cell.
  // ─────────────────────────────────────────────────────────────────────────
  function handleEmptyCellClick(pos, teamId, slotIdx, e) {
    e.stopPropagation();
    // Toggle: clicking the same cell again closes it
    if (
      activeCellSearch?.teamId === teamId &&
      activeCellSearch?.slotIdx === slotIdx
    ) {
      setActiveCellSearch(null);
      return;
    }
    setPosFilter(pos !== "BN" && pos !== "UTIL" ? pos : "ALL");
    setActiveCellSearch({ teamId, slotIdx, pos });
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // confirmRemove — removes a player and refunds budget.
  // ─────────────────────────────────────────────────────────────────────────
  function confirmRemove() {
    if (!removeModal) return;
    onUndoCell(removeModal.playerId, removeModal.teamId, removeModal.slotIndex);
    setRemoveModal(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getBestAvailable — top undrafted player eligible for a position slot.
  // Used in hover tooltips on empty cells.
  // ─────────────────────────────────────────────────────────────────────────
  function getBestAvailable(pos) {
    return (
      sortPlayersForScout(players, {
        searchQ: "",
        posFilter: "ALL",
        notesOnly: false,
        favoritesOnly: false,
        favorites,
        notes,
        slotPos: pos,
      })[0] || null
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  const scoutResults = useMemo(
    () =>
      sortPlayersForScout(players, {
        searchQ,
        posFilter,
        notesOnly,
        favoritesOnly,
        favorites,
        notes,
        slotPos: activeCellSearch?.pos || null,
      }),
    [
      activeCellSearch?.pos,
      favorites,
      favoritesOnly,
      notes,
      notesOnly,
      players,
      posFilter,
      searchQ,
    ],
  );

  const recommendationRows = useMemo(
    () => scoutResults.slice(0, 4),
    [scoutResults],
  );

  useEffect(() => {
    const targets = scoutResults.slice(0, searchQ || activeCellSearch ? 4 : 2);
    if (targets.length === 0) return undefined;

    const timeoutId = window.setTimeout(() => {
      targets.forEach((player) => requestValuation(player));
    }, 180);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeCellSearch?.slotIdx,
    draftStateKey,
    favoritesOnly,
    notesOnly,
    posFilter,
    searchQ,
    scoutResults,
  ]);

  const myTeam = league.teams[currentOwnerIdx];
  const slotsLeft = totalSlots - (myTeam?.roster?.length || 0);
  const displayedPinnedPlayer = hoverPreviewPlayer ?? selectedPlayer;
  const previewingPinnedPlayer = Boolean(hoverPreviewPlayer);
  const activeContextTeam = activeCellSearch
    ? league.teams.find((team) => team.id === activeCellSearch.teamId) || null
    : null;
  const showScoutRailHelper =
    !activeCellSearch && !hideScoutRailHelp && !dismissScoutRailHelp;

  // ─────────────────────────────────────────────────────────────────────────
  // undraftedByPos — count of undrafted players eligible at each position.
  // Used to show scarcity counts in column headers and tint empty cells red
  // when a position is completely exhausted from the available pool.
  //
  // Recomputed only when the players array changes (memoized for performance
  // since this touches every player for every render).
  // ─────────────────────────────────────────────────────────────────────────
  const undraftedByPos = useMemo(() => {
    const map = {};
    players
      .filter((p) => !p.drafted)
      .forEach((p) => {
        p.pos.forEach((pos) => {
          map[pos] = (map[pos] || 0) + 1;
        });
      });
    return map;
  }, [players]);

  // ─────────────────────────────────────────────────────────────────────────
  // totalDraftedCount / totalSpend — aggregate counters shown in the
  // table summary footer row (below the last team row).
  // ─────────────────────────────────────────────────────────────────────────
  const totalDraftedCount = league.teams.reduce(
    (sum, t) => sum + t.roster.length,
    0,
  );
  const totalSpend = league.teams.reduce(
    (sum, t) => sum + (league.budget - t.budget_remaining),
    0,
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="board-layout">
      {/* ════════════════════════════════════════════════════════════════════
          GRID + SEARCH (main/left area)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="board-main">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="board-header">
          <div>
            <h2 className="board-title">DRAFT LEAGUE TEAMS TABLE</h2>
            <span className="board-hint">
              Click an empty cell, and search for a player in the side-bar to
              add a player to that cell · Click an empty cell to remove
            </span>
            <div className="board-current-owner">
              Now drafting: <strong>{myTeam?.name}</strong> · $
              {myTeam?.budget_remaining ?? league.budget} left · {slotsLeft}{" "}
              slots left
              {activeCellSearch && activeContextTeam && (
                <>
                  {" "}
                  · Filling <strong>{activeContextTeam.name}</strong>{" "}
                  <strong>{activeCellSearch.pos}</strong>
                </>
              )}
            </div>
          </div>
          <div className="board-actions">
            <button
              className="undo-btn"
              onClick={onUndo}
              disabled={!canUndo}
              title={
                canUndo
                  ? "Undo the most recent board change"
                  : "No board changes to undo"
              }
            >
              ↩ Undo
            </button>
            <button
              className="undo-btn redo-btn"
              onClick={onRedo}
              disabled={!canRedo}
              title={
                canRedo
                  ? "Redo the most recent undo"
                  : "Redo becomes available after an undo"
              }
            >
              ↪ Redo
            </button>
            {boardNotice && (
              <div
                className={`board-toast ${boardNotice.tone || "info"}`}
                role="status"
                aria-live="polite"
              >
                {boardNotice.message}
              </div>
            )}
          </div>
        </div>

        {/* ── Teams Grid ──────────────────────────────────────────────────── */}
        <div className="teams-table-wrap">
          <table className="teams-table">
            <thead>
              <tr>
                <th className="col-owner">OWNER</th>
                <th className="col-budget">$ LEFT</th>
                {rosterPositions.map((pos, i) => {
                  // Number of undrafted players still eligible at this position
                  const availCount = undraftedByPos[pos] ?? 0;
                  // BN/UTIL have all undrafted hitters available — show total undrafted
                  const displayCount =
                    pos === "BN" || pos === "UTIL"
                      ? players.filter((p) => !p.drafted).length
                      : availCount;

                  return (
                    <th
                      key={i}
                      style={{ cursor: "pointer" }}
                      title={`${pos} · ${displayCount} available · Click to filter`}
                      onClick={() => {
                        setPosFilter(pos === posFilter ? "ALL" : pos);
                        searchRef.current?.focus();
                      }}
                    >
                      <span
                        className="pos-badge-header"
                        style={{
                          background: posColor(pos),
                          outline:
                            posFilter === pos ? "2px solid white" : "none",
                          outlineOffset: 1,
                        }}
                      >
                        {pos}
                      </span>
                      {/* Availability count — green=plenty, yellow=low, red=scarce/empty */}
                      <div
                        className="pos-avail-count"
                        style={{
                          color:
                            displayCount === 0
                              ? "var(--red)"
                              : displayCount < 3
                                ? "var(--yellow)"
                                : "var(--muted)",
                        }}
                      >
                        {displayCount}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {league.teams.map((team, ti) => {
                const isMe = ti === currentOwnerIdx;
                const teamMaxBid = calcMaxBid(
                  team.budget_remaining,
                  totalSlots - team.roster.length,
                );

                return (
                  <tr
                    key={team.id}
                    className={isMe ? "my-row" : ""}
                    onClick={() => setCurrentOwnerIdx(ti)}
                    title={`Click row to set ${team.name} as drafting owner`}
                  >
                    {/* Owner label + roster progress */}
                    <td className="col-owner">
                      {isMe && <span className="star">★ </span>}
                      {team.name}
                      {isMe && (
                        <div className="max-bid-mini">
                          max bid ${teamMaxBid}
                        </div>
                      )}
                      {/* Mini progress bar: green fill = % of slots filled */}
                      <div
                        className="roster-progress-wrap"
                        title={`${team.roster.length} of ${totalSlots} slots filled`}
                      >
                        <div
                          className="roster-progress-bar"
                          style={{
                            width: `${Math.min((team.roster.length / totalSlots) * 100, 100)}%`,
                            // Turns amber when roster is >80% full
                            background:
                              team.roster.length / totalSlots > 0.8
                                ? "var(--yellow)"
                                : "var(--green)",
                          }}
                        />
                      </div>
                      <div className="roster-progress-label">
                        {team.roster.length}/{totalSlots}
                      </div>
                    </td>

                    {/* Budget */}
                    <td
                      className="col-budget"
                      style={{
                        color:
                          team.budget_remaining > 50
                            ? "#22c55e"
                            : team.budget_remaining > 20
                              ? "#f59e0b"
                              : "#ef4444",
                      }}
                    >
                      ${team.budget_remaining}
                    </td>

                    {/* Roster slot cells */}
                    {rosterPositions.map((pos, si) => {
                      // ── KEY FIX: look up entry by slotIndex, not array index ──
                      // This ensures a drafted player stays in the correct column
                      // regardless of the order they were added to the roster array.
                      const entry = team.roster.find((r) => r.slotIndex === si);
                      const isHovered =
                        hoveredCell?.teamId === team.id &&
                        hoveredCell?.slotIdx === si;
                      const isCellSearchActive =
                        activeCellSearch?.teamId === team.id &&
                        activeCellSearch?.slotIdx === si;

                      if (entry) {
                        // ── FILLED CELL ────────────────────────────────────
                        const matchedPlayer = players.find(
                          (p) => p.name === entry.name,
                        );
                        const valueClass = getValueClass(
                          entry.price,
                          matchedPlayer?.baseValue,
                        );

                        return (
                          <td
                            key={si}
                            className={`roster-cell roster-cell-filled ${valueClass}`}
                            onClick={(e) =>
                              handleFilledCellClick(entry, team.id, pos, e)
                            }
                            onMouseEnter={() =>
                              setHoveredCell({
                                teamId: team.id,
                                slotIdx: si,
                                entry,
                                pos,
                                matchedPlayer,
                              })
                            }
                            onMouseLeave={() => setHoveredCell(null)}
                            title={`${entry.name} · $${entry.price} · Click to remove`}
                            style={{ position: "relative" }}
                          >
                            <div className="roster-entry">
                              {entry.isKeeper && (
                                <span className="keeper-badge">K</span>
                              )}
                              <span className="roster-name">{entry.name}</span>
                              <div className="roster-price-row">
                                <span className="roster-price">
                                  ${entry.price}
                                </span>
                                {/* Show the position slot they were drafted into (not just pos[0]) */}
                                <span
                                  className="roster-drafted-pos"
                                  style={{
                                    color: posColor(entry.draftedPos || pos),
                                  }}
                                >
                                  {entry.draftedPos || pos}
                                </span>
                                {matchedPlayer &&
                                  valueClass === "value-steal" && (
                                    <span
                                      className="value-label steal"
                                      title="Great value!"
                                    >
                                      ▲
                                    </span>
                                  )}
                                {matchedPlayer &&
                                  valueClass === "value-overpaid" && (
                                    <span
                                      className="value-label overpaid"
                                      title="Overpaid"
                                    >
                                      ▼
                                    </span>
                                  )}
                              </div>
                            </div>

                            {/* Hover tooltip */}
                            {isHovered && (
                              <div className="cell-tooltip">
                                <div className="ct-name">{entry.name}</div>
                                <div className="ct-row">
                                  <span className="ct-label">SLOT</span>
                                  <span
                                    className="ct-val"
                                    style={{
                                      color: posColor(entry.draftedPos || pos),
                                    }}
                                  >
                                    {entry.draftedPos || pos}
                                  </span>
                                </div>
                                <div className="ct-row">
                                  <span className="ct-label">PAID</span>
                                  <span className="ct-val">${entry.price}</span>
                                </div>
                                {matchedPlayer && (
                                  <>
                                    <div className="ct-row">
                                      <span className="ct-label">VALUE</span>
                                      <span className="ct-val">
                                        ${matchedPlayer.baseValue}
                                      </span>
                                    </div>
                                    <div className="ct-row">
                                      <span className="ct-label">FPTS</span>
                                      <span className="ct-val">
                                        {matchedPlayer.fpts}
                                      </span>
                                    </div>
                                  </>
                                )}
                                <div className="ct-hint">↩ Click to remove</div>
                              </div>
                            )}
                          </td>
                        );
                      } else {
                        // ── EMPTY CELL ─────────────────────────────────────
                        const bestAvail = isHovered
                          ? getBestAvailable(pos)
                          : null;
                        // No players left for this position — tint cell red
                        const posExhausted =
                          pos !== "BN" &&
                          pos !== "UTIL" &&
                          (undraftedByPos[pos] ?? 0) === 0;

                        return (
                          <td
                            key={si}
                            className={`roster-cell roster-cell-empty ${posExhausted ? "cell-no-avail" : ""} ${isCellSearchActive ? "cell-active" : ""}`}
                            onClick={(e) =>
                              handleEmptyCellClick(pos, team.id, si, e)
                            }
                            onMouseEnter={() =>
                              setHoveredCell({
                                teamId: team.id,
                                slotIdx: si,
                                entry: null,
                                pos,
                              })
                            }
                            onMouseLeave={() => setHoveredCell(null)}
                            title={
                              isCellSearchActive
                                ? `Scouting ${pos} options in the right panel`
                                : posExhausted
                                  ? `No ${pos} players remaining in pool`
                                  : `Empty ${pos} — click to scout and add player`
                            }
                            style={{ position: "relative", minWidth: 80 }}
                          >
                            <>
                              <span className="roster-empty">
                                {isCellSearchActive ? "◉" : "–"}
                              </span>

                              {/* Hover tooltip for empty cell */}
                              {isHovered && (
                                <div className="cell-tooltip cell-tooltip-empty">
                                  <div
                                    className="ct-name"
                                    style={{ color: posColor(pos) }}
                                  >
                                    {pos} SLOT
                                  </div>
                                  {/* Remaining count badge */}
                                  <div
                                    className="ct-row"
                                    style={{ marginBottom: 3 }}
                                  >
                                    <span className="ct-label">AVAIL</span>
                                    <span
                                      className="ct-val"
                                      style={{
                                        color: posExhausted
                                          ? "var(--red)"
                                          : (undraftedByPos[pos] ?? 0) < 3
                                            ? "var(--yellow)"
                                            : "var(--green)",
                                      }}
                                    >
                                      {pos === "BN" || pos === "UTIL"
                                        ? players.filter((p) => !p.drafted)
                                            .length
                                        : (undraftedByPos[pos] ?? 0)}
                                    </span>
                                  </div>
                                  {bestAvail ? (
                                    <>
                                      <div
                                        className="ct-hint"
                                        style={{ marginBottom: 3 }}
                                      >
                                        Best available:
                                      </div>
                                      <div className="ct-row">
                                        <span
                                          className="ct-val"
                                          style={{ color: "var(--white)" }}
                                        >
                                          {bestAvail.name}
                                        </span>
                                      </div>
                                      <div className="ct-row">
                                        <span className="ct-label">VALUE</span>
                                        <span
                                          className="ct-val"
                                          style={{ color: "var(--green)" }}
                                        >
                                          $
                                          {valuationCache[bestAvail.id]
                                            ?.max_bid_recommendation ??
                                            bestAvail.baseValue}
                                        </span>
                                      </div>
                                    </>
                                  ) : (
                                    <div
                                      className="ct-hint"
                                      style={{ color: "var(--red)" }}
                                    >
                                      No {pos} players left
                                    </div>
                                  )}
                                  <div
                                    className="ct-hint"
                                    style={{ marginTop: 4 }}
                                  >
                                    ↓ Click to scout this slot in the right
                                    panel
                                  </div>
                                </div>
                              )}
                            </>
                          </td>
                        );
                      }
                    })}
                  </tr>
                );
              })}
            </tbody>

            {/* ── Summary Footer Row ─────────────────────────────────────────
                Shows totals: overall picks drafted per slot column, and
                total spend across all teams in the $ LEFT column.
                Helps quickly identify which roster positions are fully
                filled league-wide vs. still have open slots.
            ─────────────────────────────────────────────────────────────── */}
            <tfoot>
              <tr className="summary-row">
                <td className="col-owner">
                  LEAGUE TOTALS
                  <div className="roster-progress-label">
                    {totalDraftedCount} picks · ${totalSpend} spent
                  </div>
                </td>
                <td
                  className="col-budget"
                  style={{ color: "var(--muted)", fontSize: 10 }}
                >
                  ${totalSpend}
                </td>
                {rosterPositions.map((pos, si) => {
                  // Count how many teams have a player in this exact slot
                  const filledCount = league.teams.filter(
                    (t) => !!t.roster.find((r) => r.slotIndex === si),
                  ).length;
                  const pct = filledCount / league.teams.length;
                  return (
                    <td
                      key={si}
                      title={`${filledCount}/${league.teams.length} teams have a ${pos} here`}
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color:
                          pct === 1
                            ? "var(--green)"
                            : pct > 0.5
                              ? "var(--muted2)"
                              : "var(--muted)",
                      }}
                    >
                      {filledCount}/{league.teams.length}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          RIGHT PANEL
      ════════════════════════════════════════════════════════════════════ */}
      <div
        className={`right-panel ${displayedPinnedPlayer ? "has-selected" : ""}`}
      >
        {/* Current player section */}
        <div className="current-player-section">
          <div className="cp-header">
            PINNED PLAYER
          </div>

          {displayedPinnedPlayer ? (
            <>
              <div className="pinned-player-shell">
                <button
                  type="button"
                  className={`pinned-player-strip ${previewingPinnedPlayer ? "previewing" : ""}`}
                  ref={pinnedStripRef}
                  onClick={() => {
                    if (previewingPinnedPlayer) {
                      handleSelectPlayer(displayedPinnedPlayer);
                      setIsPinnedExpanded(true);
                      return;
                    }
                    setIsPinnedExpanded((prev) => !prev);
                  }}
                >
                  <div className="pinned-player-main">
                    <PlayerAvatar
                      name={displayedPinnedPlayer.name}
                      size={36}
                      photoUrl={displayedPinnedPlayer.photoUrl}
                    />
                    <div className="pinned-player-copy">
                      <div className="pinned-player-name">
                        {displayedPinnedPlayer.name}
                      </div>
                      <div className="pinned-player-meta">
                        <span>{displayedPinnedPlayer.team}</span>
                        <span>·</span>
                        <span>
                          {(displayedPinnedPlayer.pos || []).join("/")}
                        </span>
                        <span>·</span>
                        <span className="green">
                          ${getRecommendedBid(displayedPinnedPlayer)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="pinned-player-toggle">
                    {previewingPinnedPlayer
                      ? "Pin + Open"
                      : isPinnedExpanded
                        ? "Close Card"
                        : "Open Card"}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <div className="cp-empty pinned-player-empty">
              Pick a player from the scouting rail or click a cell to lock the
              next slot.
            </div>
          )}
        </div>

        <div className="right-panel-body">
          <div className="panel-section-label">SCOUT RAIL</div>
          <div className="rail-tabs">
            <button
              type="button"
              className={`rail-tab ${activeRailTab === "search" ? "active" : ""}`}
              onClick={() => setActiveRailTab("search")}
            >
              Search
            </button>
            <button
              type="button"
              className={`rail-tab ${activeRailTab === "best" ? "active" : ""}`}
              onClick={() => setActiveRailTab("best")}
            >
              Best Available
            </button>
          </div>

          {activeRailTab === "search" ? (
            <div className="scout-panel tabbed-scout-panel">

              <div className="search-label-row scout-label-row">
                <span className="search-label">PLAYER SEARCH</span>
              </div>

              <div className="pos-filters scout-filter-row">
                {["ALL", "C", "1B", "2B", "3B", "SS", "OF", "SP", "RP"].map(
                  (p) => (
                    <button
                      key={p}
                      className={`pos-filter ${posFilter === p ? "active" : ""}`}
                      onClick={() => setPosFilter(p)}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  className={`notes-filter-btn ${notesOnly ? "active" : ""}`}
                  onClick={() => setNotesOnly((prev) => !prev)}
                  title="Only show players with notes"
                >
                  Notes
                </button>
                <button
                  className={`notes-filter-btn ${favoritesOnly ? "active" : ""}`}
                  onClick={() => setFavoritesOnly((prev) => !prev)}
                  title="Only show favorite players"
                >
                  Favorites
                </button>
              </div>

              <input
                ref={searchRef}
                className="search-input scout-search-input"
                placeholder={
                  activeCellSearch
                    ? `Search ${activeCellSearch.pos} fits for ${activeContextTeam?.name ?? "this slot"}`
                    : posFilter !== "ALL"
                      ? `Search ${posFilter} players…`
                      : "Search by name or team…"
                }
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setPosFilter("ALL");
                    setSearchQ("");
                    setActiveCellSearch(null);
                  }
                }}
              />

              <div className="scout-results-meta">
                <span>{scoutResults.length} available</span>
                {activeCellSearch && <span>slot locked</span>}
              </div>

              <div
                className="scout-results-list"
                onMouseLeave={clearHoverPreview}
              >
                {scoutResults.slice(0, 10).map((p) => (
                  <SearchResult
                    key={p.id}
                    player={p}
                    noteText={notes?.[p.id] || p.note}
                    isFavorite={Boolean(favorites?.[p.id])}
                    recValue={valuationCache[p.id]?.max_bid_recommendation}
                    contextTag={
                      activeCellSearch ? `Fits ${activeCellSearch.pos}` : null
                    }
                    actionLabel={activeCellSearch ? "Add To Slot" : "Open Sale"}
                    onSelect={() => handleSelectPlayer(p)}
                    onOpenCard={() => openPlayerCard(p)}
                    onRecord={() =>
                      activeCellSearch
                        ? openSaleModalForCell(
                            p,
                            activeCellSearch.teamId,
                            activeCellSearch.slotIdx,
                          )
                        : openSaleModal(p)
                    }
                    onToggleFavorite={() => toggleFavorite(p.id)}
                    onPreviewStart={() => scheduleHoverPreview(p)}
                    onPreviewEnd={() => {
                      if (hoverPreviewPlayer?.id === p.id) {
                        clearHoverPreview();
                      }
                    }}
                  />
                ))}
                {scoutResults.length === 0 && (
                  <div className="cp-empty scout-empty-state">
                    {searchQ
                      ? `No available players match "${searchQ}".`
                      : activeCellSearch
                        ? `No ${activeCellSearch.pos} players are currently available.`
                        : "No available players match the current filters."}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              className="recommendations rail-tab-panel"
              onMouseLeave={clearHoverPreview}
            >
              <div className="rec-header">
                BEST AVAILABLE{" "}
                <span className="rec-sub">
                  {activeCellSearch
                    ? `${activeCellSearch.pos} Fits`
                    : posFilter !== "ALL"
                      ? posFilter
                      : "Overall"}
                </span>
              </div>
              {recommendationRows.map((p) => (
                <div
                  key={p.id}
                  className="rec-row"
                  onClick={() => handleSelectPlayer(p)}
                  onMouseEnter={() => scheduleHoverPreview(p)}
                  onMouseLeave={() => {
                    if (hoverPreviewPlayer?.id === p.id) {
                      clearHoverPreview();
                    }
                  }}
                >
                  <PlayerAvatar name={p.name} size={32} photoUrl={p.photoUrl} />
                  <div className="rec-info">
                    <div className="rec-name-row">
                      <div className="rec-name">{p.name}</div>
                      <button
                        type="button"
                        className={`favorite-btn compact ${favorites?.[p.id] ? "active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(p.id);
                        }}
                        title={
                          favorites?.[p.id]
                            ? "Remove favorite"
                            : "Favorite this player"
                        }
                      >
                        ★
                      </button>
                    </div>
                    <div className="rec-team">{p.team}</div>
                    <div className="rec-pos">
                      {p.pos.map((pos) => (
                        <span
                          key={pos}
                          className="pos-badge"
                          style={{ background: posColor(pos) }}
                        >
                          {pos}
                        </span>
                      ))}
                    </div>
                    {(notes?.[p.id] || p.note) && (
                      <div className="rec-note-pill">✎ note saved</div>
                    )}
                  </div>
                  <div className="rec-right">
                    <div className="rec-value green">
                      $
                      {valuationCache[p.id]?.max_bid_recommendation ??
                        p.baseValue}
                    </div>
                    <div className={`tier-badge ${p.tier?.toLowerCase()}`}>
                      {p.tier?.toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
              {recommendationRows.length === 0 && (
                <div className="cp-empty scout-empty-state">
                  No best-available rows for the current view.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedPlayer && isPinnedExpanded && (
        <div
          className="pinned-popover-backdrop"
          onMouseDown={() => setIsPinnedExpanded(false)}
        >
          <div
            className="pinned-popover"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedPlayer.name} details`}
            tabIndex={-1}
            ref={pinnedPopoverRef}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="pinned-popover-topbar">
              <div className="pinned-popover-label">PLAYER DETAIL</div>
              <button
                type="button"
                className="pinned-popover-close"
                onClick={() => setIsPinnedExpanded(false)}
              >
                Close
              </button>
            </div>

            <PlayerCard
              player={selectedPlayer}
              valuation={valuationCache[selectedPlayer?.id] ?? null}
              notes={notes}
              favorites={favorites}
              saveNote={saveNote}
              toggleFavorite={toggleFavorite}
            />

            <div className="player-card-actions popover-actions">
              <button
                className="record-sale-btn"
                onClick={() =>
                  activeCellSearch
                    ? openSaleModalForCell(
                        selectedPlayer,
                        activeCellSearch.teamId,
                        activeCellSearch.slotIdx,
                      )
                    : openSaleModal(selectedPlayer)
                }
              >
                {activeCellSearch ? "ADD TO SELECTED CELL" : "OPEN SALE MODAL"}
              </button>
              {activeCellSearch && (
                <button
                  type="button"
                  className="undo-btn ghost-btn"
                  onClick={() => setActiveCellSearch(null)}
                >
                  Clear Slot
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {hoverPreviewPlayer &&
        !isPinnedExpanded &&
        !saleModal &&
        !removeModal && (
          <div className="pinned-popover preview-popover" aria-hidden="true">
            <div className="pinned-popover-topbar preview-topbar">
              <div className="pinned-popover-label">HOVER PREVIEW</div>
              <div className="preview-popover-copy">
                Click row to pin this player
              </div>
            </div>
            <PlayerCard
              player={hoverPreviewPlayer}
              valuation={valuationCache[hoverPreviewPlayer?.id] ?? null}
              notes={notes}
              favorites={favorites}
              saveNote={saveNote}
              toggleFavorite={toggleFavorite}
              previewMode
            />
          </div>
        )}

      {/* ════════════════════════════════════════════════════════════════════
          SALE MODAL
          Opened by: "Record Sale" button, search result, or inline cell search
      ════════════════════════════════════════════════════════════════════ */}
      {saleModal && (
        <div className="modal-overlay" onClick={closeSaleModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>RECORD AUCTION SALE</h3>
            <p className="modal-player">{saleModal.name}</p>

            <div
              style={{
                display: "flex",
                gap: 4,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              {(Array.isArray(saleModal.pos) ? saleModal.pos : []).map((p) => (
                <span
                  key={p}
                  className="pos-badge"
                  style={{ background: posColor(p) }}
                >
                  {p}
                </span>
              ))}
              <span className={`tier-badge ${saleModal.tier?.toLowerCase()}`}>
                {saleModal.tier?.toUpperCase()}
              </span>
            </div>

            {/* Winning team selector */}
            <div className="form-group">
              <label>WINNING TEAM</label>
              <select
                value={saleTeam}
                onChange={(e) => setSaleTeam(+e.target.value)}
              >
                {league.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (${t.budget_remaining} left)
                  </option>
                ))}
              </select>
              <div className="modal-hint" style={{ marginTop: 8 }}>
                Active owner: <strong>{myTeam?.name}</strong>
                {saleTeam !== myTeam?.id && (
                  <>
                    {" "}
                    · Recording this to{" "}
                    <strong>
                      {league.teams.find((t) => t.id === saleTeam)?.name}
                    </strong>{" "}
                    instead
                  </>
                )}
              </div>
            </div>

            {/* ── Position Slot Picker ─────────────────────────────────────── */}
            {/* Shows all empty roster slots this player is eligible to fill.    */}
            {/* Clicking a slot badge selects it. The sale places the player     */}
            {/* into the grid at that exact column position.                     */}
            <div className="form-group">
              <label>DRAFT INTO SLOT</label>
              {validSlotsForModal.length > 0 ? (
                <div className="slot-picker">
                  {validSlotsForModal.map(({ slotIdx, pos }) => (
                    <button
                      key={slotIdx}
                      type="button"
                      className={`slot-btn ${saleSlot === slotIdx ? "active" : ""}`}
                      onClick={() => setSaleSlot(slotIdx)}
                      title={`Slot ${slotIdx + 1}: ${pos}`}
                    >
                      <span
                        className="pos-badge"
                        style={{
                          background: posColor(pos),
                          pointerEvents: "none",
                        }}
                      >
                        {pos}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    color: "var(--red)",
                    fontSize: 11,
                    padding: "6px 0",
                  }}
                >
                  ⚠ No eligible slots available for{" "}
                  {league.teams.find((t) => t.id === saleTeam)?.name}— try a
                  different team or add a custom position below.
                </div>
              )}

              {/* Custom eligibility override */}
              {/* Lets you temporarily grant a player eligibility at a position  */}
              {/* not in their database profile (e.g., multi-pos player listed    */}
              {/* only as OF but has 1B eligibility in your league).              */}
              <div className="custom-pos-row">
                <span className="custom-pos-label">
                  Override/add eligibility:
                </span>
                <input
                  className="custom-pos-input"
                  value={customPosInput}
                  onChange={(e) => setCustomPosInput(e.target.value)}
                  placeholder="e.g. 2B or SS,3B"
                  title="Add custom position eligibility for this player"
                />
              </div>
            </div>

            {/* Bid amount */}
            <div className="form-group">
              <label>WINNING BID ($)</label>
              <input
                type="number"
                value={salePrice}
                min={1}
                onChange={(e) => setSalePrice(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmSale();
                }}
              />
            </div>

            {/* API / base value hint */}
            {valuationCache[saleModal?.id] &&
            valuationCache[saleModal?.id] !== "loading" &&
            !valuationCache[saleModal?.id]?.error ? (
              <div className="modal-hint">
                API suggests:{" "}
                <strong>
                  ${valuationCache[saleModal?.id].max_bid_recommendation}
                </strong>{" "}
                max bid
                {valuationCache[saleModal?.id].true_dollar_value && (
                  <>
                    {" "}
                    · TDV:{" "}
                    <strong>
                      ${valuationCache[saleModal?.id].true_dollar_value}
                    </strong>
                  </>
                )}
                {valuationCache[saleModal?.id].scarcity_tier && (
                  <> · {valuationCache[saleModal?.id].scarcity_tier}</>
                )}
              </div>
            ) : valuationCache[saleModal?.id]?.error ? (
              <div className="modal-hint">
                Base value: <strong>${saleModal.baseValue}</strong> ·{" "}
                {valuationCache[saleModal?.id].message}
              </div>
            ) : (
              <div className="modal-hint">
                Base value: <strong>${saleModal.baseValue}</strong>
                {apiStatus !== "online" &&
                  " (API offline — using pre-calc value)"}
              </div>
            )}

            <div className="modal-actions">
              <button className="modal-cancel" onClick={closeSaleModal}>
                Cancel
              </button>
              <button
                className="modal-confirm"
                onClick={confirmSale}
                disabled={!salePrice || saleSlot == null}
                title={saleSlot == null ? "Select a roster slot above" : ""}
              >
                {saleSlot == null
                  ? "Select a slot ↑"
                  : `Confirm Sale — $${salePrice} → ${rosterPositions[saleSlot]}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          REMOVE MODAL
      ════════════════════════════════════════════════════════════════════ */}
      {removeModal && (
        <div className="modal-overlay" onClick={() => setRemoveModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>REMOVE PLAYER FROM ROSTER?</h3>
            <p className="modal-player">{removeModal.playerName}</p>

            <div className="modal-hint" style={{ marginBottom: 16 }}>
              <div>
                Team:{" "}
                <strong>
                  {league.teams.find((t) => t.id === removeModal.teamId)?.name}
                </strong>
              </div>
              <div>
                Slot:{" "}
                <strong style={{ color: posColor(removeModal.pos) }}>
                  {removeModal.pos}
                </strong>
              </div>
              <div>
                Paid:{" "}
                <strong style={{ color: "var(--red)" }}>
                  ${removeModal.price}
                </strong>
              </div>
              <div style={{ marginTop: 6, color: "var(--green)" }}>
                ✓ Budget refunded: +${removeModal.price}
              </div>
              <div style={{ marginTop: 4 }}>
                Player returns to available pool.
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="modal-cancel"
                onClick={() => setRemoveModal(null)}
              >
                Cancel
              </button>
              <button
                className="modal-confirm"
                style={{ background: "var(--red)" }}
                onClick={confirmRemove}
              >
                Remove Player
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchResult — single row in the bottom search bar autocomplete dropdown
// recValue: live API max_bid_recommendation when available; falls back to player.baseValue
function SearchResult({
  player,
  noteText,
  isFavorite,
  recValue,
  contextTag,
  actionLabel = "Record Sale",
  onSelect,
  onOpenCard,
  onRecord,
  onToggleFavorite,
  onPreviewStart,
  onPreviewEnd,
}) {
  return (
    <div
      className="search-result"
      onClick={onSelect}
      onMouseEnter={onPreviewStart}
      onMouseLeave={onPreviewEnd}
      title={`Pin ${player.name} in the scouting rail`}
    >
      <PlayerAvatar name={player.name} size={28} photoUrl={player.photoUrl} />
      <div className="sr-copy">
        <div className="sr-head">
          <span className="sr-name">{player.name}</span>
          <span className="sr-team">
            {player.team} · {player.league}
          </span>
        </div>
        <div className="sr-tags">
          {player.pos.map((pos) => (
            <span
              key={pos}
              className="pos-badge"
              style={{ background: posColor(pos) }}
            >
              {pos}
            </span>
          ))}
          {player.fpts && <span className="sr-fpts">{player.fpts}pts</span>}
          {noteText && (
            <span className="sr-note">
              ✎ {noteText.length > 22 ? `${noteText.slice(0, 22)}…` : noteText}
            </span>
          )}
          {contextTag && <span className="sr-context">{contextTag}</span>}
        </div>
      </div>
      <button
        type="button"
        className={`favorite-btn compact ${isFavorite ? "active" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        title={isFavorite ? "Remove favorite" : "Favorite this player"}
      >
        ★
      </button>
      <span className="sr-value">${recValue ?? player.baseValue}</span>
      <div className="sr-actions">
        <button
          type="button"
          className="sr-open-card"
          onClick={(e) => {
            e.stopPropagation();
            onOpenCard();
          }}
        >
          Open Card
        </button>
        <button
          type="button"
          className="sr-record"
          onClick={(e) => {
            e.stopPropagation();
            onRecord();
          }}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InlineCellSearch — mini search box rendered directly inside an empty grid cell
//
// Shown when user clicks an empty cell. Provides an auto-focused input and a
// small dropdown of eligible players. Selecting a player opens the full sale
// modal pre-filled for this specific team and slot.
//
// @param {Object}    props
// @param {string}    props.pos                  - Position label for this slot
// @param {number}    props.teamId               - Team this cell belongs to
// @param {number}    props.slotIdx              - Slot index of this cell
// @param {Object[]}  props.players              - Full player array
// @param {string[]}  props.rosterPositions      - Ordered roster position labels
// @param {Function}  props.getValidSlotsForPlayer - Slot eligibility helper
// @param {Function}  props.onSelect             - (player) => void
// @param {Function}  props.onClose              - () => void
// ─────────────────────────────────────────────────────────────────────────────
function InlineCellSearch({
  pos,
  teamId,
  slotIdx,
  players,
  rosterPositions,
  getValidSlotsForPlayer,
  onSelect,
  onClose,
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  // Auto-focus input when dropdown appears
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Filter players eligible for this specific slot position
  // BN/UTIL slots show all undrafted players; others filter by pos eligibility.
  const results = players
    .filter((p) => {
      if (p.drafted) return false;
      // Filter by position eligibility for this slot type
      if (pos !== "BN" && pos !== "UTIL" && !p.pos.includes(pos)) return false;
      if (pos === "UTIL") {
        // UTIL: hitters only
        if (!p.pos.some((pp) => !["SP", "RP"].includes(pp))) return false;
      }
      // Text search if user has typed something
      if (q) {
        const lq = q.toLowerCase();
        if (
          !p.name.toLowerCase().includes(lq) &&
          !(p.team || "").toLowerCase().includes(lq)
        ) {
          return false;
        }
      }
      return true;
    })
    .slice(0, 6);

  return (
    // stopPropagation prevents the document click listener from closing this immediately
    <div
      className="cell-search-container"
      onClick={(e) => e.stopPropagation()}
      style={{ position: "relative" }}
    >
      {/* Mini input — fills the cell */}
      <input
        ref={inputRef}
        className="cell-search-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
          // Enter selects first result
          if (e.key === "Enter" && results.length > 0) onSelect(results[0]);
        }}
        placeholder={`${pos}…`}
      />

      {/* Results dropdown */}
      {results.length > 0 && (
        <div className="cell-search-dropdown">
          {results.map((p) => (
            <div
              key={p.id}
              className="cell-search-result"
              // Use onMouseDown to fire before input blur closes the dropdown
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(p);
              }}
            >
              <PlayerAvatar name={p.name} size={20} photoUrl={p.photoUrl} />
              <div className="csr-info">
                <span className="csr-name">{p.name}</span>
                <span className="csr-team">{p.team}</span>
              </div>
              <div style={{ display: "flex", gap: 2 }}>
                {p.pos.map((pp) => (
                  <span
                    key={pp}
                    className="pos-badge"
                    style={{ background: posColor(pp), fontSize: 7 }}
                  >
                    {pp}
                  </span>
                ))}
              </div>
              <span className="csr-value">${p.baseValue}</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && (
        <div className="cell-search-dropdown">
          <div className="csr-empty">
            {q
              ? `No ${pos === "BN" || pos === "UTIL" ? "" : pos + " "}players match "${q}"`
              : `No ${pos} players available`}
          </div>
        </div>
      )}
    </div>
  );
}
