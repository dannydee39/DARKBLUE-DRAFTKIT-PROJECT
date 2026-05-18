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
import { createPortal } from "react-dom";
import { MLB_TEAM_CODES } from "../constants.js";
import PlayerAvatar from "./PlayerAvatar.jsx";
import PlayerCard from "./PlayerCard.jsx";
import {
  posColor,
  calcMaxBid,
  getValueClass,
  slotAcceptsPlayer,
} from "../utils/helpers.js";
import {
  formatAdjustmentPercent,
  formatValuationSource,
  getValuationSource,
  makeValuationSnapshot,
  summarizeValuationSnapshot,
} from "../utils/draftHistory.js";

const SCOUT_RAIL_HELP_STORAGE_KEY = "draftkit-hide-scout-rail-help";
const MLB_TEAM_CODE_SET = new Set(MLB_TEAM_CODES);

function normalizePosLabel(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function sortPlayersForScout(
  players,
  { searchQ, posFilter, notesOnly, favoritesOnly, favorites, notes, slotPos },
) {
  const q = normalizeSearchText(searchQ);

  return players
    .filter((player) => {
      const noteText = notes?.[player.id] || player.note;
      const playerPositions = (player.pos || []).map(normalizePosLabel);
      const normalizedFilter = normalizePosLabel(posFilter);
      if (player.drafted) return false;
      if (slotPos && !player.custom && !slotAcceptsPlayer(player, slotPos)) {
        return false;
      }
      if (q) {
        const haystack = normalizeSearchText(
          `${player.name} ${player.team || ""}`,
        );
        if (!haystack.includes(q)) return false;
      }
      if (
        normalizedFilter !== "ALL" &&
        !player.custom &&
        !slotAcceptsPlayer({ pos: playerPositions }, normalizedFilter)
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
  onMoveRosterEntry,
  onTransferRosterEntry,
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
  valuationCache,
  valuationLoading,
  valuationStale = false,
  requestValuation, // (player) => void  — requests a valuation and stores it in the cache
  draftStateKey, // compact string that changes on every pick/undo (cache version key)
  canUndo = false,
  canRedo = false,
  boardNotice = null,
  onAddCustomPlayer,
}) {
  // ── Search / filter state (right scouting rail) ───────────────────────────
  const [searchQ, setSearchQ] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [notesOnly, setNotesOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [isPinnedExpanded, setIsPinnedExpanded] = useState(false);
  const [hoverPreviewPlayer, setHoverPreviewPlayer] = useState(null);
  const [hoverPreviewAnchorEl, setHoverPreviewAnchorEl] = useState(null);
  const [hoverPreviewAnchorRect, setHoverPreviewAnchorRect] = useState(null);

  // ── Sale modal state ──────────────────────────────────────────────────────
  const [saleModal, setSaleModal] = useState(null); // player obj or null
  const [saleTeam, setSaleTeam] = useState(1); // winning team ID
  const [salePrice, setSalePrice] = useState(""); // bid amount
  const [salePriceManuallyEdited, setSalePriceManuallyEdited] = useState(false);
  const [saleSlot, setSaleSlot] = useState(null); // slotIndex to fill
  const [preferredSaleSlot, setPreferredSaleSlot] = useState(null); // clicked cell slotIndex to preserve when possible
  const [customPosInput, setCustomPosInput] = useState(""); // custom eligibility override
  const [customPlayerModalOpen, setCustomPlayerModalOpen] = useState(false);
  const [customPlayerName, setCustomPlayerName] = useState("");
  const [customPlayerTeam, setCustomPlayerTeam] = useState("");
  const [customPlayerError, setCustomPlayerError] = useState("");

  // ── Remove confirmation modal state ──────────────────────────────────────
  const [removeModal, setRemoveModal] = useState(null); // {playerName, teamId, price, pos, mode}
  const [moveSlotChoice, setMoveSlotChoice] = useState("");
  const [transferTeamChoice, setTransferTeamChoice] = useState("");
  const [transferSlotChoice, setTransferSlotChoice] = useState("");

  // ── Active slot context ───────────────────────────────────────────────────
  // When set, the right scouting rail filters to players for this slot.
  const [activeCellSearch, setActiveCellSearch] = useState(null); // {teamId, slotIdx, pos}

  // ── Grid tooltip hover state ──────────────────────────────────────────────
  const [hoveredCell, setHoveredCell] = useState(null);
  const [hoveredCellRect, setHoveredCellRect] = useState(null);
  const [hideScoutRailHelp, setHideScoutRailHelp] = useState(() => {
    try {
      return window.localStorage.getItem(SCOUT_RAIL_HELP_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [dismissScoutRailHelp, setDismissScoutRailHelp] = useState(false);

  // ── Right panel resize state ──────────────────────────────────────────────
  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const searchRef = useRef(null);
  const pinnedPopoverRef = useRef(null);
  const pinnedStripRef = useRef(null);
  const rightPanelRef = useRef(null);
  const previousFocusRef = useRef(null);
  const hoverPreviewTimeoutRef = useRef(null);
  const resizeHandleRef = useRef(null);
  const modalBackdropPressStartedRef = useRef(false);

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

  const slotCountsByPos = useMemo(() => {
    return rosterPositions.reduce((acc, pos) => {
      acc[pos] = (acc[pos] || 0) + 1;
      return acc;
    }, {});
  }, [rosterPositions]);

  const slotOrdinalsByIndex = useMemo(() => {
    const seen = {};
    return rosterPositions.map((pos) => {
      seen[pos] = (seen[pos] || 0) + 1;
      return seen[pos];
    });
  }, [rosterPositions]);

  const slotOptionsForModal = validSlotsForModal.map(({ slotIdx, pos }) => ({
    slotIdx,
    pos,
    ordinal: slotOrdinalsByIndex[slotIdx] || 1,
    total: slotCountsByPos[pos] || 1,
  }));

  // Positions available for override (not already eligible)
  const playerEligiblePositions = new Set(
    Array.isArray(saleModal?.pos) ? saleModal.pos : [],
  );
  const availableOverridePositions = [...new Set(rosterPositions)].filter(
    (pos) =>
      !playerEligiblePositions.has(pos) &&
      !slotAcceptsPlayer(extendedSalePlayer || saleModal || { pos: [] }, pos),
  );

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

      if (slotAcceptsPlayer({ pos: playerPositions }, slotPos)) {
        acc.push({ slotIdx: si, pos: slotPos });
      }

      return acc;
    }, []);
  }

  function findRosterAssignmentForPlayer(player) {
    if (!player) return null;
    const playerId = player.id;
    const playerName = String(player.name || "").trim().toLowerCase();

    for (const team of league.teams) {
      const rosterEntry = (team.roster || []).find((entry) => {
        if (playerId != null && entry.playerId === playerId) return true;
        return (
          playerName &&
          String(entry.name || "").trim().toLowerCase() === playerName
        );
      });

      if (rosterEntry) {
        const slotIndex = Number(rosterEntry.slotIndex);
        return {
          team,
          rosterEntry,
          slotIndex,
          slotLabel: rosterEntry.draftedPos || rosterPositions[slotIndex] || "BN",
        };
      }
    }

    return null;
  }

  function isEligibleOpenSlot(player, teamId, slotIndex, sourceSlotIndex = null) {
    const team = league.teams.find((candidate) => candidate.id === teamId);
    const slotLabel = rosterPositions[slotIndex];
    if (!team || !slotLabel) return false;

    const occupiedByOtherPlayer = (team.roster || []).some(
      (entry) =>
        Number(entry.slotIndex) === Number(slotIndex) &&
        Number(sourceSlotIndex) !== Number(slotIndex),
    );
    if (occupiedByOtherPlayer) return false;

    return slotAcceptsPlayer(player, slotLabel);
  }

  function openDraftedPlayerActionModal(player, preferredTarget = null) {
    const assignment = findRosterAssignmentForPlayer(player);
    if (!assignment) return false;

    setIsPinnedExpanded(false);
    clearHoverPreview();
    requestValuation();

    const { team, rosterEntry, slotIndex, slotLabel } = assignment;
    const eligibilityPlayer = {
      ...player,
      pos: rosterEntry.pos || player?.pos || [],
    };
    const defaultTransferTeam = league.teams.find(
      (candidate) => candidate.id !== team.id,
    );

    let nextMoveSlotChoice = "";
    let nextTransferTeamChoice = defaultTransferTeam
      ? String(defaultTransferTeam.id)
      : "";
    let nextTransferSlotChoice = "";

    // When the user clicked an empty grid cell first, use that cell as the
    // proposed destination if it can legally hold this already-drafted player.
    if (preferredTarget) {
      const preferredTeamId = Number(preferredTarget.teamId);
      const preferredSlotIndex = Number(preferredTarget.slotIdx);
      const targetIsCurrentTeam = preferredTeamId === team.id;
      const preferredSlotIsValid = isEligibleOpenSlot(
        eligibilityPlayer,
        preferredTeamId,
        preferredSlotIndex,
        targetIsCurrentTeam ? slotIndex : null,
      );

      if (preferredSlotIsValid && targetIsCurrentTeam) {
        nextMoveSlotChoice =
          preferredSlotIndex === slotIndex ? "" : String(preferredSlotIndex);
      } else if (preferredSlotIsValid) {
        nextTransferTeamChoice = String(preferredTeamId);
        nextTransferSlotChoice = String(preferredSlotIndex);
      }
    }

    setRemoveModal({
      playerId: rosterEntry.playerId,
      playerName: rosterEntry.name || player.name,
      teamId: team.id,
      slotIndex,
      price: rosterEntry.price,
      pos: slotLabel,
      mode: "manage",
    });
    setMoveSlotChoice(nextMoveSlotChoice);
    setTransferTeamChoice(nextTransferTeamChoice);
    setTransferSlotChoice(nextTransferSlotChoice);
    setSelectedPlayer({
      ...player,
      drafted: true,
      draftedBy: team.id,
      draftPrice: rosterEntry.price,
      draftedPos: slotLabel,
    });

    return true;
  }

  const hoveredFilledCellTooltip =
    hoveredCell?.entry && hoveredCellRect
      ? createPortal(
          <div
            className="cell-tooltip cell-tooltip-floating"
            style={{
              top: Math.max(8, hoveredCellRect.top - 6),
              left: hoveredCellRect.left + hoveredCellRect.width / 2,
            }}
          >
            <div className="ct-name">{hoveredCell.entry.name}</div>
            <div className="ct-row">
              <span className="ct-label">SLOT</span>
              <span
                className="ct-val"
                style={{
                  color: posColor(
                    hoveredCell.entry.draftedPos || hoveredCell.pos,
                  ),
                }}
              >
                {hoveredCell.entry.draftedPos || hoveredCell.pos}
              </span>
            </div>
            <div className="ct-row">
              <span className="ct-label">PAID</span>
              <span className="ct-val">${hoveredCell.entry.price}</span>
            </div>
            {hoveredCell.matchedPlayer && (
              <>
                <div className="ct-row">
                  <span className="ct-label">VALUE</span>
                  <span className="ct-val">
                    ${hoveredCell.matchedPlayer.baseValue}
                  </span>
                </div>
                <div className="ct-row">
                  <span className="ct-label">FPTS</span>
                  <span className="ct-val">
                    {hoveredCell.matchedPlayer.fpts}
                  </span>
                </div>
              </>
            )}
            <div className="ct-hint">↩ Click to remove</div>
          </div>,
          document.body,
        )
      : null;

  // ─────────────────────────────────────────────────────────────────────────
  // Effects
  // ─────────────────────────────────────────────────────────────────────────

  // Auto-fetch valuation when selected player OR draft state changes.
  // draftStateKey re-triggers this whenever a player is added/removed,
  // so the API inflation & scarcity math stays accurate without a manual re-click.
  useEffect(() => {
    if (selectedPlayer) requestValuation();
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

  // ── Resize handling for right panel ───────────────────────────────────────
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setRightPanelWidth(Math.max(400, Math.min(800, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

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
    if (!hoverPreviewPlayer || !hoverPreviewAnchorEl || !rightPanelRef.current) {
      setHoverPreviewAnchorRect(null);
      return undefined;
    }

    const updateHoverPreviewRect = () => {
      const nextAnchorRect =
        hoverPreviewAnchorEl?.getBoundingClientRect?.() || null;
      if (!nextAnchorRect) {
        setHoverPreviewAnchorRect(null);
        return;
      }

      setHoverPreviewAnchorRect({
        top: nextAnchorRect.top,
        right: nextAnchorRect.right,
        bottom: nextAnchorRect.bottom,
        left: nextAnchorRect.left,
        width: nextAnchorRect.width,
        height: nextAnchorRect.height,
      });
    };

    updateHoverPreviewRect();
    window.addEventListener("resize", updateHoverPreviewRect);
    window.addEventListener("scroll", updateHoverPreviewRect, true);

    return () => {
      window.removeEventListener("resize", updateHoverPreviewRect);
      window.removeEventListener("scroll", updateHoverPreviewRect, true);
    };
  }, [hoverPreviewAnchorEl, hoverPreviewPlayer?.id, rightPanelWidth]);

  useEffect(() => {
    if (!hoveredCell?.anchorEl) {
      setHoveredCellRect(null);
      return undefined;
    }

    const updateHoveredCellRect = () => {
      const nextRect = hoveredCell.anchorEl?.getBoundingClientRect?.();
      if (!nextRect) {
        setHoveredCellRect(null);
        return;
      }

      setHoveredCellRect({
        top: nextRect.top,
        left: nextRect.left,
        width: nextRect.width,
        height: nextRect.height,
      });
    };

    updateHoveredCellRect();
    window.addEventListener("resize", updateHoveredCellRect);
    window.addEventListener("scroll", updateHoveredCellRect, true);

    return () => {
      window.removeEventListener("resize", updateHoveredCellRect);
      window.removeEventListener("scroll", updateHoveredCellRect, true);
    };
  }, [hoveredCell]);

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
    setSaleSlot((currentSaleSlot) => {
      if (
        preferredSaleSlot != null &&
        slots.some((slot) => slot.slotIdx === preferredSaleSlot)
      ) {
        return preferredSaleSlot;
      }

      if (
        currentSaleSlot != null &&
        slots.some((slot) => slot.slotIdx === currentSaleSlot)
      ) {
        return currentSaleSlot;
      }

      return slots[0]?.slotIdx ?? null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customPosInput, preferredSaleSlot, saleModal?.id, saleTeam]);

  function handleSelectPlayer(player) {
    if (!player) return;
    setHoverPreviewPlayer(null);
    setSelectedPlayer(player);
    requestValuation();
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
    setHoverPreviewAnchorEl(null);
    setHoverPreviewAnchorRect(null);
  }

  function scheduleHoverPreview(player, anchorEl) {
    if (!player || isPinnedExpanded || saleModal || removeModal) return;
    if (selectedPlayer?.id === player.id) return;
    if (hoverPreviewTimeoutRef.current) {
      window.clearTimeout(hoverPreviewTimeoutRef.current);
    }
    hoverPreviewTimeoutRef.current = window.setTimeout(() => {
      setHoverPreviewPlayer(player);
      setHoverPreviewAnchorEl(anchorEl || null);
      if (!valuationCache?.[player.id]) requestValuation();
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
    if (cached && cached.max_bid_recommendation != null) {
      return cached.max_bid_recommendation;
    }
    return player?.baseValue ?? "";
  }

  function getDisplayedValuation(player) {
    if (!player) return null;
    const cached = valuationCache?.[player.id];
    if (cached) return valuationStale ? { ...cached, __stale: true } : cached;
    return valuationLoading ? "loading" : null;
  }

  // Sale modal valuation context. The dollar input still uses the max-bid
  // recommendation, while this block explains why that recommendation exists:
  // stat baseline, scoring/scarcity multipliers, risk, depth, and market state.
  const rawSaleValuation = saleModal ? valuationCache?.[saleModal.id] : null;
  const saleValuation =
    rawSaleValuation && valuationStale
      ? { ...rawSaleValuation, __stale: true }
      : rawSaleValuation;
  const saleValuationSource = saleModal
    ? getValuationSource(saleModal, saleValuation || (valuationLoading ? "loading" : null))
    : "unknown";
  const saleValuationSourceLabel = formatValuationSource(saleValuationSource);
  const saleValuationSnapshot =
    saleModal && saleValuation && !saleValuation.error
      ? makeValuationSnapshot(saleModal, saleValuation)
      : null;
  const saleFactorRows = summarizeValuationSnapshot(saleValuationSnapshot);

  // ─────────────────────────────────────────────────────────────────────────
  // openSaleModal — open the sale modal for a player.
  // Pre-selects the first valid slot for the current active owner's team.
  // ─────────────────────────────────────────────────────────────────────────
  function openSaleModal(player) {
    if (findRosterAssignmentForPlayer(player)) {
      openDraftedPlayerActionModal(player);
      return;
    }

    // Kick off a valuation request immediately so the modal can update
    // its suggested bid as soon as the API responds (even after it opens).
    setIsPinnedExpanded(false);
    clearHoverPreview();
    requestValuation();
    // Slot-first model: no "active owner". Default to the team with the most
    // open slots; commissioner can change via the modal's team selector.
    const team =
      [...league.teams].sort(
        (a, b) =>
          (totalSlots - (b.roster?.length || 0)) -
          (totalSlots - (a.roster?.length || 0)),
      )[0] || league.teams[0];
    const initialSlots = getValidSlotsForPlayer(player, team?.id || 1);
    setSaleModal(player);
    setSaleTeam(team?.id || 1);
    setSaleSlot(initialSlots[0]?.slotIdx ?? null);
    setPreferredSaleSlot(null);
    setSalePrice(getRecommendedBid(player));
    setSalePriceManuallyEdited(false);
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
    if (findRosterAssignmentForPlayer(player)) {
      openDraftedPlayerActionModal(player, { teamId, slotIdx });
      return;
    }

    setIsPinnedExpanded(false);
    clearHoverPreview();
    requestValuation();

    setSaleModal(player);
    setSaleTeam(teamId);
    setSaleSlot(slotIdx); // pre-select the exact slot that was clicked
    setPreferredSaleSlot(slotIdx);
    setSalePrice(getRecommendedBid(player));
    setSalePriceManuallyEdited(false);
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
    if (!cached || cached.max_bid_recommendation == null) return;
    if (salePriceManuallyEdited) return;
    setSalePrice((prev) => {
      const next = String(cached.max_bid_recommendation);
      return prev === next ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleModal?.id, salePriceManuallyEdited, valuationCache]);

  // ─────────────────────────────────────────────────────────────────────────
  // confirmSale — validates and fires onSale with slotIndex + draftedPos.
  // Clears all modal state on success.
  // ─────────────────────────────────────────────────────────────────────────
  function confirmSale() {
    if (!saleModal || !salePrice || saleSlot == null) return;
    if (saleBudgetError) return;
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
    setSalePriceManuallyEdited(false);
    setSaleSlot(null);
    setPreferredSaleSlot(null);
    setCustomPosInput("");
  }

  function handleModalBackdropMouseDown(e) {
    modalBackdropPressStartedRef.current = e.target === e.currentTarget;
  }

  function handleSaleModalBackdropClick(e) {
    const shouldClose =
      modalBackdropPressStartedRef.current && e.target === e.currentTarget;
    modalBackdropPressStartedRef.current = false;
    if (shouldClose) {
      closeSaleModal();
    }
  }

  function openCustomPlayerModal() {
    setCustomPlayerModalOpen(true);
    setCustomPlayerName(searchQ.trim());
    setCustomPlayerTeam("");
    setCustomPlayerError("");
  }

  function closeCustomPlayerModal() {
    setCustomPlayerModalOpen(false);
    setCustomPlayerName("");
    setCustomPlayerTeam("");
    setCustomPlayerError("");
  }

  function submitCustomPlayer() {
    const normalizedName = String(customPlayerName || "")
      .replace(/\s+/g, " ")
      .trim();
    const normalizedTeam = String(customPlayerTeam || "")
      .trim()
      .toUpperCase();

    if (!normalizedName) {
      setCustomPlayerError("Enter the player's full name.");
      return;
    }

    if (!MLB_TEAM_CODE_SET.has(normalizedTeam)) {
      setCustomPlayerError(
        `Player Team must be a valid MLB code like ${MLB_TEAM_CODES.slice(0, 5).join(", ")}.`,
      );
      return;
    }

    const createdPlayer = onAddCustomPlayer?.({
      name: normalizedName,
      team: normalizedTeam,
    });

    if (!createdPlayer) {
      setCustomPlayerError(
        "That player could not be added right now. Try again.",
      );
      return;
    }

    clearHoverPreview();
    setSearchQ(createdPlayer.name);
    setPosFilter("ALL");
    setCustomPlayerError("");
    setCustomPlayerModalOpen(false);
    requestValuation();
  }

  // ─────────────────────────────────────────────────────────────────────────
  function openRosterCorrectionModal(entry, teamId, pos) {
    setActiveCellSearch(null); // close any open inline search
    const defaultTransferTeam = league.teams.find((team) => team.id !== teamId);
    setRemoveModal({
      playerId: entry.playerId,
      playerName: entry.name,
      teamId,
      slotIndex: entry.slotIndex,
      price: entry.price,
      pos,
      mode: "manage",
    });
    setMoveSlotChoice("");
    setTransferTeamChoice(defaultTransferTeam ? String(defaultTransferTeam.id) : "");
    setTransferSlotChoice("");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // handleFilledCellClick — opens the drafted player's full card.
  // Roster corrections stay available through the explicit Fix button.
  // ─────────────────────────────────────────────────────────────────────────
  function handleFilledCellClick(entry, teamId, pos, matchedPlayer, e) {
    e.stopPropagation();
    setActiveCellSearch(null);

    if (matchedPlayer) {
      openPlayerCard({
        ...matchedPlayer,
        drafted: true,
        draftedBy: teamId,
        draftPrice: entry.price,
        draftedPos: entry.draftedPos || pos,
      });
      return;
    }

    openRosterCorrectionModal(entry, teamId, pos);
  }

  function getCorrectionContext() {
    if (!removeModal) {
      return {
        sourceTeam: null,
        rosterEntry: null,
        player: null,
        moveSlots: [],
        transferTeam: null,
        transferSlots: [],
      };
    }

    const sourceTeam = league.teams.find(
      (team) => team.id === removeModal.teamId,
    );
    const rosterEntry = sourceTeam?.roster?.find(
      (entry) =>
        entry?.playerId === removeModal.playerId &&
        Number(entry.slotIndex) === Number(removeModal.slotIndex),
    );
    const player =
      players.find((candidate) => candidate.id === removeModal.playerId) ||
      rosterEntry ||
      null;
    const eligibilityPlayer = {
      ...(player || {}),
      pos: rosterEntry?.pos || player?.pos || [],
    };

    const moveSlots = sourceTeam && rosterEntry
      ? rosterPositions
          .map((slot, slotIndex) => ({ slot, slotIndex }))
          .filter(({ slot, slotIndex }) => {
            if (Number(slotIndex) === Number(rosterEntry.slotIndex)) return false;
            if ((sourceTeam.roster || []).some((entry) => Number(entry.slotIndex) === Number(slotIndex))) {
              return false;
            }
            return slotAcceptsPlayer(eligibilityPlayer, slot);
          })
      : [];

    const transferTeam =
      league.teams.find((team) => String(team.id) === String(transferTeamChoice)) ||
      league.teams.find((team) => team.id !== removeModal.teamId) ||
      null;
    const transferSlots = transferTeam && rosterEntry
      ? rosterPositions
          .map((slot, slotIndex) => ({ slot, slotIndex }))
          .filter(({ slot, slotIndex }) => {
            if ((transferTeam.roster || []).some((entry) => Number(entry.slotIndex) === Number(slotIndex))) {
              return false;
            }
            return slotAcceptsPlayer(eligibilityPlayer, slot);
          })
      : [];

    return {
      sourceTeam,
      rosterEntry,
      player,
      moveSlots,
      transferTeam,
      transferSlots,
    };
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

  function confirmMoveSlot() {
    if (!removeModal || moveSlotChoice === "") return;
    const saved = onMoveRosterEntry?.(
      removeModal.teamId,
      removeModal.playerId,
      removeModal.slotIndex,
      Number(moveSlotChoice),
    );
    if (saved !== false) setRemoveModal(null);
  }

  function confirmTransferTeam() {
    if (!removeModal || !transferTeamChoice || transferSlotChoice === "") return;
    const saved = onTransferRosterEntry?.(
      removeModal.teamId,
      Number(transferTeamChoice),
      removeModal.playerId,
      Number(transferSlotChoice),
    );
    if (saved !== false) setRemoveModal(null);
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
      activeCellSearch,
      favorites,
      favoritesOnly,
      notes,
      notesOnly,
      players,
      posFilter,
      searchQ,
    ],
  );

  useEffect(() => {
    // Prefetch valuations for every row the user can currently see (scout list shows
    // up to 10, recommendations show 4). Without this, the displayed max bid is the
    // stale baseValue until the user hovers and the live valuation resolves — the
    // number then changes under the cursor.
    const targets = scoutResults.slice(0, 10);
    if (targets.length === 0) return undefined;

    const timeoutId = window.setTimeout(() => {
      requestValuation();
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

  const displayedPinnedPlayer = hoverPreviewPlayer ?? selectedPlayer;
  const previewingPinnedPlayer = Boolean(hoverPreviewPlayer);
  const displayedPinnedPlayerAssignment = displayedPinnedPlayer
    ? findRosterAssignmentForPlayer(displayedPinnedPlayer)
    : null;
  const displayedPinnedPlayerIsDrafted = Boolean(
    displayedPinnedPlayerAssignment || displayedPinnedPlayer?.drafted,
  );
  const activeContextTeam = activeCellSearch
    ? league.teams.find((team) => team.id === activeCellSearch.teamId) || null
    : null;
  const selectedSaleTeam =
    league.teams.find((team) => team.id === saleTeam) || null;
  const selectedSaleTeamSlotsLeft = selectedSaleTeam
    ? totalSlots - (selectedSaleTeam.roster?.length || 0)
    : 0;
  const selectedSaleTeamMaxBid = selectedSaleTeam
    ? calcMaxBid(
        selectedSaleTeam.budget_remaining,
        selectedSaleTeamSlotsLeft,
      )
    : 0;
  const numericSalePrice = Number(salePrice);
  const saleBudgetError =
    salePrice !== "" &&
    !Number.isNaN(numericSalePrice) &&
    selectedSaleTeam &&
    numericSalePrice > selectedSaleTeamMaxBid
      ? `${selectedSaleTeam.name} can bid at most $${selectedSaleTeamMaxBid} to ensure they can fill all their remaining slots.`
      : "";
  const saleHasPlacementOptions =
    slotOptionsForModal.length > 0 || availableOverridePositions.length > 0;
  const correctionContext = getCorrectionContext();
  const hoverPreviewLayout = useMemo(() => {
    if (!hoverPreviewPlayer || !hoverPreviewAnchorRect || !rightPanelRef.current) {
      return null;
    }

    const rightPanelRect = rightPanelRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const railGap = 16;
    const safeLeft = 16;
    const safeRight = Math.max(safeLeft, rightPanelRect.left - railGap);
    const availableWidth = safeRight - safeLeft;

    if (availableWidth < 180) {
      return null;
    }

    let width = Math.min(360, availableWidth);
    if (availableWidth >= 320) {
      width = Math.min(360, Math.max(280, Math.floor(availableWidth * 0.42)));
    }

    const maxHeight = Math.min(520, Math.max(220, viewportHeight - 92));
    const minTop = 52;
    const maxTop = Math.max(minTop, viewportHeight - maxHeight - 16);
    const preferredTop = hoverPreviewAnchorRect.top - 18;
    const top = Math.max(minTop, Math.min(preferredTop, maxTop));
    const left = Math.max(
      safeLeft,
      Math.min(safeRight - width, viewportWidth - width - 16),
    );

    return {
      top,
      left,
      width,
      maxHeight,
    };
  }, [hoverPreviewAnchorRect, hoverPreviewPlayer, rightPanelWidth]);
  const hoverPreviewPopover =
    hoverPreviewPlayer &&
    hoverPreviewLayout &&
    !isPinnedExpanded &&
    !saleModal &&
    !removeModal
      ? createPortal(
          <div
            className="pinned-popover preview-popover preview-popover-floating"
            aria-hidden="true"
            style={{
              top: hoverPreviewLayout.top,
              left: hoverPreviewLayout.left,
              right: "auto",
              width: hoverPreviewLayout.width,
              maxHeight: hoverPreviewLayout.maxHeight,
            }}
          >
            <div className="pinned-popover-topbar preview-topbar">
              <div className="pinned-popover-label">HOVER PREVIEW</div>
              <div className="preview-popover-copy">
                Click row to pin this player
              </div>
            </div>
            <PlayerCard
              player={hoverPreviewPlayer}
              valuation={getDisplayedValuation(hoverPreviewPlayer)}
              notes={notes}
              favorites={favorites}
              saveNote={saveNote}
              toggleFavorite={toggleFavorite}
              previewMode
            />
          </div>,
          document.body,
        )
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
    const map = Object.fromEntries(
      [...new Set(rosterPositions)].map((slotPos) => [slotPos, 0]),
    );

    players
      .filter((p) => !p.drafted)
      .forEach((player) => {
        Object.keys(map).forEach((slotPos) => {
          if (slotAcceptsPlayer(player, slotPos)) {
            map[slotPos] += 1;
          }
        });
      });

    return map;
  }, [players, rosterPositions]);

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
              add a player to that cell
            </span>
            <div className="board-current-owner">
              {activeCellSearch && activeContextTeam ? (
                <>
                  Filling <strong>{activeContextTeam.name}</strong>{" "}
                  <strong>{activeCellSearch.pos}</strong> slot — search a
                  player below
                </>
              ) : (
                <>Click any empty slot to start drafting</>
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
                  const displayCount = undraftedByPos[pos] ?? 0;

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
                const teamMaxBid = calcMaxBid(
                  team.budget_remaining,
                  totalSlots - team.roster.length,
                );

                return (
                  <tr key={team.id}>
                    {/* Owner label + roster progress */}
                    <td className="col-owner">
                      {team.name}
                      <div className="max-bid-mini">
                        max bid ${teamMaxBid}
                      </div>
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
                        const matchedPlayer =
                          players.find((p) => p.id === entry.playerId) ||
                          players.find((p) => p.name === entry.name);
                        const valueClass = getValueClass(
                          entry.price,
                          matchedPlayer?.baseValue,
                        );

                        return (
                          <td
                            key={si}
                            className={`roster-cell roster-cell-filled ${valueClass}`}
                            onClick={(e) =>
                              handleFilledCellClick(
                                entry,
                                team.id,
                                pos,
                                matchedPlayer,
                                e,
                              )
                            }
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openRosterCorrectionModal(entry, team.id, pos);
                            }}
                            onMouseEnter={(e) =>
                              setHoveredCell({
                                teamId: team.id,
                                slotIdx: si,
                                entry,
                                pos,
                                matchedPlayer,
                                anchorEl: e.currentTarget,
                              })
                            }
                            onMouseLeave={() => setHoveredCell(null)}
                            title={`${entry.name} · $${entry.price} · Click to open card`}
                            style={{ position: "relative" }}
                          >
                            <div className="roster-entry">
                              <button
                                type="button"
                                className="roster-cell-fix"
                                title={`Move, transfer, or remove ${entry.name}`}
                                aria-label={`Move, transfer, or remove ${entry.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRosterCorrectionModal(entry, team.id, pos);
                                }}
                              >
                                Fix
                              </button>
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
                            {false && isHovered && (
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
                        // No players left for this position — tint cell red
                        const posExhausted =
                          pos !== "BN" &&
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
        style={{ 
          width: rightPanelWidth, 
          position: 'relative',
          borderLeft: isResizing ? '3px solid #22c55e' : 'none'
        }}
        ref={rightPanelRef}
      >
        {/* Resize handle */}
        <div
          ref={resizeHandleRef}
          className="resize-handle"
          onMouseDown={() => setIsResizing(true)}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 5,
            cursor: 'ew-resize',
            background: 'transparent',
            zIndex: 10,
          }}
        />
        {/* Current player section */}
        <div className="current-player-section">
          <div className="cp-header">
            PINNED PLAYER
          </div>

          {displayedPinnedPlayer ? (
            <>
              <div className="pinned-player-shell">
                <div
                  className={`pinned-player-strip ${previewingPinnedPlayer ? "previewing" : ""}`}
                  role="button"
                  tabIndex={0}
                  ref={pinnedStripRef}
                  onClick={() => {
                    if (previewingPinnedPlayer) {
                      handleSelectPlayer(displayedPinnedPlayer);
                      setIsPinnedExpanded(true);
                      return;
                    }
                    setIsPinnedExpanded((prev) => !prev);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (previewingPinnedPlayer) {
                        handleSelectPlayer(displayedPinnedPlayer);
                        setIsPinnedExpanded(true);
                        return;
                      }
                      setIsPinnedExpanded((prev) => !prev);
                    }
                  }}
                >
                  <div className="pinned-player-main">
                    <PlayerAvatar
                      name={displayedPinnedPlayer.name}
                      size={48}
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
                  {activeCellSearch && (
                    <button
                      type="button"
                      className="sr-record pinned-player-add-slot"
                      onClick={(e) => {
                        e.stopPropagation();
                        openSaleModalForCell(
                          displayedPinnedPlayer,
                          activeCellSearch.teamId,
                          activeCellSearch.slotIdx,
                        );
                      }}
                    >
                      {displayedPinnedPlayerIsDrafted ? "Move to Slot" : "Add to Slot"}
                    </button>
                  )}
                </div>
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
          <div className="scout-panel">

              <div className="search-label-row scout-label-row">
                <span className="search-label">PLAYER SEARCH</span>
              </div>

              <div className="pos-filters scout-filter-row">
                {["ALL", "C", "1B", "2B", "3B", "SS", "CI", "MI", "OF", "P", "SP", "RP"].map(
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

              <div className="scout-results-meta">
                <span>{scoutResults.length} available</span>
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
                    recLoading={valuationLoading && !valuationCache[p.id]}
                    recStale={valuationStale && Boolean(valuationCache[p.id])}
                    actionLabel={activeCellSearch ? "Add To Slot" : "Open Sale"}
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
                    onPreviewStart={(anchorEl) => scheduleHoverPreview(p, anchorEl)}
                    onPreviewEnd={() => {
                      if (hoverPreviewPlayer?.id === p.id) {
                        clearHoverPreview();
                      }
                    }}
                  />
                ))}
                {scoutResults.length === 0 && (
                  <div className="cp-empty scout-empty-state">
                    <div className="scout-empty-copy">
                      {searchQ
                        ? `No available players match "${searchQ}".`
                        : false
                          ? `No ${activeCellSearch.pos} players are currently available.`
                          : "No available players match the current filters."}
                    </div>
                    <button
                      type="button"
                      className="scout-empty-action"
                      onClick={openCustomPlayerModal}
                    >
                      Override With A Custom Player
                    </button>
                  </div>
                )}
              </div>
          </div>
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
              valuation={getDisplayedValuation(selectedPlayer)}
              notes={notes}
              favorites={favorites}
              saveNote={saveNote}
              toggleFavorite={toggleFavorite}
            />

            <div className="player-card-actions popover-actions">
              <button
                className="record-sale-btn"
                onClick={() =>
                  displayedPinnedPlayerIsDrafted
                    ? openDraftedPlayerActionModal(
                        selectedPlayer,
                        activeCellSearch
                          ? {
                              teamId: activeCellSearch.teamId,
                              slotIdx: activeCellSearch.slotIdx,
                            }
                          : null,
                      )
                    : activeCellSearch
                    ? openSaleModalForCell(
                        selectedPlayer,
                        activeCellSearch.teamId,
                        activeCellSearch.slotIdx,
                      )
                    : openSaleModal(selectedPlayer)
                }
              >
                {displayedPinnedPlayerIsDrafted
                  ? activeCellSearch
                    ? "MOVE TO SELECTED CELL"
                    : "MOVE PLAYER"
                  : activeCellSearch
                    ? "ADD TO SELECTED CELL"
                    : "RECORD SALE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {hoverPreviewPopover}

      {/* ════════════════════════════════════════════════════════════════════
          SALE MODAL
          Opened by: "Record Sale" button, search result, or inline cell search
      ════════════════════════════════════════════════════════════════════ */}
      {hoveredFilledCellTooltip}

      {customPlayerModalOpen && (
        <div className="modal-overlay" onClick={closeCustomPlayerModal}>
          <div
            className="modal custom-player-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>ADD CUSTOM PLAYER</h3>
            <div className="modal-hint">
              No players found? Add a custom player to this draft and place
              them with a position override when you record the sale.
            </div>

            <div className="form-group">
              <label>PLAYER FULL NAME</label>
              <input
                type="text"
                value={customPlayerName}
                onChange={(e) => {
                  setCustomPlayerName(e.target.value);
                  if (customPlayerError) setCustomPlayerError("");
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitCustomPlayer();
                  }
                }}
                placeholder="Juan Soto"
              />
            </div>

            <div className="form-group">
              <label>PLAYER TEAM</label>
              <input
                type="text"
                value={customPlayerTeam}
                onChange={(e) => {
                  setCustomPlayerTeam(e.target.value.toUpperCase());
                  if (customPlayerError) setCustomPlayerError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitCustomPlayer();
                  }
                }}
                placeholder="NYY"
                spellCheck={false}
                maxLength={3}
              />
            </div>

            <div className="modal-hint">
              Use one of the MLB team codes already used by the player library,
              like NYY, NYM, LAA, LAD, BOS, or ATL.
            </div>

            {customPlayerError && (
              <div className="modal-hint modal-error" role="alert">
                {customPlayerError}
              </div>
            )}

            <div className="modal-actions">
              <button className="modal-cancel" onClick={closeCustomPlayerModal}>
                Cancel
              </button>
              <button className="modal-confirm" onClick={submitCustomPlayer}>
                Add Custom Player
              </button>
            </div>
          </div>
        </div>
      )}

      {saleModal && (
        <div
          className="modal-overlay"
          onMouseDown={handleModalBackdropMouseDown}
          onClick={handleSaleModalBackdropClick}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>RECORD AUCTION SALE</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <PlayerAvatar
                name={saleModal.name}
                size={36}
                photoUrl={saleModal.photoUrl}
              />
              <p className="modal-player" style={{ margin: 0 }}>{saleModal.name}</p>
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
            </div>

            {/* ── Position Slot Picker ─────────────────────────────────────── */}
            {/* Shows all empty roster slots this player is eligible to fill.    */}
            {/* Clicking a slot badge selects it. The sale places the player     */}
            {/* into the grid at that exact column position.                     */}
            <div className="form-group">
              <label>DRAFT INTO SLOT</label>
              {saleHasPlacementOptions ? (
                <div className="slot-picker">
                  {slotOptionsForModal.map(({ slotIdx, pos, ordinal, total }) => (
                    <button
                      key={`${pos}-${slotIdx}`}
                      type="button"
                      className={`slot-btn ${saleSlot === slotIdx ? "active" : ""}`}
                      onClick={() => setSaleSlot(slotIdx)}
                      title={
                        total > 1
                          ? `Slot: ${pos} ${ordinal} of ${total}`
                          : `Slot: ${pos}`
                      }
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
                      {total > 1 && (
                        <span className="slot-btn-copy">#{ordinal}</span>
                      )}
                    </button>
                  ))}
                  {availableOverridePositions.length > 0 && (
                    <select
                      className="pos-override-select"
                      value={customPosInput || ""}
                      onChange={(e) => {
                        const selectedPos = e.target.value;
                        setCustomPosInput(selectedPos);
                        // Recalculate valid slots with the new override
                        const overriddenPlayer = {
                          ...saleModal,
                          pos: [
                            ...new Set([
                              ...(Array.isArray(saleModal.pos) ? saleModal.pos : []),
                              selectedPos,
                            ]),
                          ],
                        };
                        const nextSlots = getValidSlotsForPlayer(overriddenPlayer, saleTeam);
                        if (nextSlots[0]) {
                          setSaleSlot(nextSlots[0].slotIdx);
                        }
                      }}
                      title="Click to override eligibility for an additional position"
                    >
                      <option value=""></option>
                      {availableOverridePositions.map((pos) => (
                        <option key={pos} value={pos}>
                          {pos}
                        </option>
                      ))}
                    </select>
                  )}
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
                  {league.teams.find((t) => t.id === saleTeam)?.name}
                </div>
              )}
              {slotOptionsForModal.length === 0 &&
                availableOverridePositions.length > 0 && (
                  <div className="modal-hint" style={{ marginTop: 8 }}>
                    This player has no default eligibility yet. Choose a
                    position override above to open a valid roster slot.
                  </div>
                )}
            </div>

            {/* Bid amount */}
            <div className="form-group">
              <label>WINNING BID ($)</label>
              <input
                type="text"
                value={salePrice}
                inputMode="numeric"
                pattern="[0-9]*"
                onChange={(e) => {
                  setSalePriceManuallyEdited(true);
                  setSalePrice(e.target.value.replace(/[^\d]/g, ""));
                }}
                onDoubleClick={(e) => e.currentTarget.select()}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmSale();
                }}
              />
            </div>

            {saleBudgetError && (
              <div className="modal-hint modal-error" role="alert">
                {saleBudgetError}
              </div>
            )}

            <div className={`sale-valuation-panel source-${saleValuationSource}`}>
              <div className="sale-valuation-head">
                <span>Live valuation</span>
                <strong>
                  {saleValuationSnapshot
                    ? `$${saleValuationSnapshot.maxBidRecommendation} max`
                    : `$${saleModal.baseValue} base`}
                </strong>
              </div>
              <div className="sale-valuation-status">
                Pricing: <strong>{saleValuationSourceLabel}</strong>
                {saleValuationSource === "refreshing" &&
                  " · refreshing before the sale is recorded"}
                {saleValuationSource === "stale_live" &&
                  " · refreshing from the last live API value"}
                {apiStatus === "offline" &&
                  " · live values unavailable, using starting value"}
                {saleValuation?.error &&
                  ` · ${saleValuation.message || "live value unavailable"}`}
              </div>
              {saleValuationSnapshot && (
                <>
                  <div className="sale-valuation-metrics">
                    <span>TDV ${saleValuationSnapshot.trueDollarValue}</span>
                    {saleValuationSnapshot.scarcityTier && (
                      <span>{saleValuationSnapshot.scarcityTier} scarcity</span>
                    )}
                    {saleValuationSnapshot.riskLevel && (
                      <span>{saleValuationSnapshot.riskLevel} risk</span>
                    )}
                    {saleValuationSnapshot.marketContext?.label && (
                      <span>{saleValuationSnapshot.marketContext.label} market</span>
                    )}
                    {saleValuationSnapshot.depthChartAdjustment?.depth_position && (
                      <span>{saleValuationSnapshot.depthChartAdjustment.depth_position} depth</span>
                    )}
                    {saleValuationSnapshot.ageAdjustment?.band && (
                      <span>{saleValuationSnapshot.ageAdjustment.band} age</span>
                    )}
                  </div>
                  {saleFactorRows.length > 0 && (
                    <div className="sale-factor-grid">
                      {saleFactorRows.map(([label, value]) => (
                        <div key={label}>
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                  {saleValuationSnapshot.reasoning && (
                    <div className="sale-valuation-reasoning">
                      {saleValuationSnapshot.reasoning}
                    </div>
                  )}
                </>
              )}
              {saleValuationSnapshot?.predictiveAdjustment && (
                <div className="sale-valuation-status">
                  Predictive{" "}
                  {formatAdjustmentPercent(
                    saleValuationSnapshot.predictiveAdjustment.multiplier,
                  )}
                  {" "}· Depth{" "}
                  {formatAdjustmentPercent(
                    saleValuationSnapshot.depthChartAdjustment?.multiplier,
                  )}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="modal-cancel" onClick={closeSaleModal}>
                Cancel
              </button>
              <button
                className="modal-confirm"
                onClick={confirmSale}
                disabled={!salePrice || saleSlot == null || Boolean(saleBudgetError)}
                title={
                  saleSlot == null
                    ? "Select a roster slot above"
                    : saleBudgetError || ""
                }
              >
                Complete Sale
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
            <h3>MANAGE DRAFTED PLAYER</h3>
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
              <div style={{ marginTop: 6 }}>
                Move keeps the player on this team in a different eligible
                slot. Transfer moves the same purchase price to another team.
              </div>
            </div>

            <div className="correction-panel">
              <div className="correction-section">
                <div className="correction-title">Move Slot</div>
                <div className="correction-row">
                  <select
                    value={moveSlotChoice}
                    onChange={(event) => setMoveSlotChoice(event.target.value)}
                  >
                    <option value="">Choose open eligible slot</option>
                    {correctionContext.moveSlots.map(({ slot, slotIndex }) => (
                      <option key={slotIndex} value={slotIndex}>
                        {slot} slot {slotIndex + 1}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={confirmMoveSlot}
                    disabled={!moveSlotChoice || correctionContext.moveSlots.length === 0}
                  >
                    Move
                  </button>
                </div>
                {correctionContext.moveSlots.length === 0 && (
                  <div className="correction-empty">
                    No other open eligible slots on this team.
                  </div>
                )}
              </div>

              <div className="correction-section">
                <div className="correction-title">Transfer Team</div>
                <div className="correction-row stacked">
                  <select
                    value={transferTeamChoice}
                    onChange={(event) => {
                      setTransferTeamChoice(event.target.value);
                      setTransferSlotChoice("");
                    }}
                  >
                    {league.teams
                      .filter((team) => team.id !== removeModal.teamId)
                      .map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                  </select>
                  <select
                    value={transferSlotChoice}
                    onChange={(event) => setTransferSlotChoice(event.target.value)}
                  >
                    <option value="">Choose destination slot</option>
                    {correctionContext.transferSlots.map(({ slot, slotIndex }) => (
                      <option key={slotIndex} value={slotIndex}>
                        {slot} slot {slotIndex + 1}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={confirmTransferTeam}
                    disabled={
                      !transferTeamChoice ||
                      !transferSlotChoice ||
                      correctionContext.transferSlots.length === 0
                    }
                  >
                    Transfer
                  </button>
                </div>
                {correctionContext.transferSlots.length === 0 && (
                  <div className="correction-empty">
                    Selected team has no open eligible destination slot.
                  </div>
                )}
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
                title="Use only when the original sale was entered incorrectly."
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
  recLoading,
  recStale = false,
  contextTag,
  actionLabel = "Record Sale",
  onOpenCard,
  onRecord,
  onToggleFavorite,
  onPreviewStart,
  onPreviewEnd,
}) {
  // Show the live valuation once we have it; while it's in flight show a
  // placeholder so the number doesn't flip from baseValue to the API value
  // the moment the user hovers (which was confusing during the draft).
  const displayValue =
    recValue != null ? `$${recValue}` : recLoading ? "$…" : `$${player.baseValue}`;
  const valueSource =
    recValue != null
      ? recStale
        ? "stale_live"
        : "live_api"
      : recLoading
        ? "refreshing"
        : "base_value";
  const valueSourceLabel = formatValuationSource(valueSource);
  return (
    <div
      className="search-result"
      onClick={onOpenCard}
      onMouseEnter={(e) => onPreviewStart?.(e.currentTarget)}
      onMouseLeave={() => onPreviewEnd?.()}
      title={`Open ${player.name}'s full card`}
    >
      <PlayerAvatar name={player.name} size={40} photoUrl={player.photoUrl} />
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
        aria-label={isFavorite ? "Remove favorite" : "Favorite this player"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        title={isFavorite ? "Remove favorite" : "Favorite this player"}
      >
        ★
      </button>
      <span className="sr-value">
        {displayValue}
        <span className={`sr-value-source ${valueSource}`}>
          {valueSourceLabel}
        </span>
      </span>
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
      if (!slotAcceptsPlayer(p, pos)) return false;
      // Text search if user has typed something
      if (q) {
        const lq = normalizeSearchText(q);
        if (
          !normalizeSearchText(p.name).includes(lq) &&
          !normalizeSearchText(p.team || "").includes(lq)
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
