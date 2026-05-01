// ─────────────────────────────────────────────────────────────────────────────
// components/KeeperSetup.jsx
//
// Pre-draft keeper initialization screen. Keeper contracts are now stored in
// the real league/player draft state so budgets, board cells, reloads, cloud
// saves, and correction flows stay in sync.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { posColor } from "../utils/helpers.js";

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function formatPositions(player) {
  return Array.isArray(player?.pos) && player.pos.length > 0
    ? player.pos.join(", ")
    : "No position";
}

export default function KeeperSetup({
  league,
  players,
  onAddKeeper,
  onUpdateKeeper,
  onRemoveKeeper,
  onReturnToBoard,
}) {
  const [form, setForm] = useState({
    ownerId: String(league.teams?.[0]?.id || "1"),
    playerName: "",
    cost: "",
  });
  const [editing, setEditing] = useState(null);

  const selectedTeam = useMemo(
    () => league.teams.find((team) => String(team.id) === String(form.ownerId)),
    [form.ownerId, league.teams],
  );

  const query = normalizeName(form.playerName);
  const playerMatches = useMemo(() => {
    if (query.length < 2) return [];
    return players
      .filter((player) => normalizeName(player.name).includes(query))
      .slice(0, 8);
  }, [players, query]);

  const exactMatch = useMemo(
    () => players.find((player) => normalizeName(player.name) === query),
    [players, query],
  );
  const resolvedPlayer =
    exactMatch || (playerMatches.length === 1 ? playerMatches[0] : null);
  const costValue = Number(form.cost);
  const costValid = Number.isInteger(costValue) && costValue >= 1;
  const selectedTeamKeepers = (selectedTeam?.roster || []).filter(
    (entry) => entry?.isKeeper,
  );
  const isEditingSamePlayer =
    editing?.playerId != null && resolvedPlayer?.id === editing.playerId;
  const resolvedPlayerTaken = Boolean(resolvedPlayer?.drafted && !isEditingSamePlayer);
  const canSubmit =
    Boolean(selectedTeam && resolvedPlayer && costValid && !resolvedPlayerTaken);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm((prev) => ({ ...prev, playerName: "", cost: "" }));
    setEditing(null);
  }

  function handleSubmit() {
    if (!resolvedPlayer || !selectedTeam) return;

    const payload = {
      teamId: selectedTeam.id,
      playerId: resolvedPlayer.id,
      cost: costValue,
    };
    const saved = editing
      ? onUpdateKeeper?.({
          ...payload,
          oldPlayerId: editing.playerId,
          teamId: editing.teamId,
        })
      : onAddKeeper?.(payload);

    if (saved) resetForm();
  }

  function beginEdit(team, keeper) {
    setEditing({ teamId: team.id, playerId: keeper.playerId });
    setForm({
      ownerId: String(team.id),
      playerName: keeper.name,
      cost: String(keeper.price),
    });
  }

  function removeKeeper(team, keeper) {
    const removed = onRemoveKeeper?.(team.id, keeper.playerId);
    if (removed && editing?.playerId === keeper.playerId) {
      resetForm();
    }
  }

  return (
    <div className="keeper-layout">
      <div className="keeper-left">
        <div className="keeper-title-row">
          <h2 className="keeper-title">PRE-DRAFT KEEPER INITIALIZATION</h2>
          <button
            type="button"
            className="keeper-return-btn"
            onClick={() => onReturnToBoard?.()}
          >
            Return to Board
          </button>
        </div>
        <p className="dict-sub">
          Add keeper contracts before the auction. Each saved keeper fills a real
          roster slot, deducts budget, and marks the player unavailable.
        </p>

        {!league.keeperLeague && (
          <div className="keeper-alert warning">
            Keeper entries are disabled until Keeper League is turned on in
            League Settings.
          </div>
        )}

        <div className="settings-card" style={{ marginTop: 16 }}>
          <div className="settings-section-label">
            {editing ? "EDIT KEEPER CONTRACT" : "ADD KEEPER CONTRACT"}
          </div>

          <div className="form-group">
            <label>OWNER</label>
            <select
              value={form.ownerId}
              onChange={(event) => {
                setField("ownerId", event.target.value);
                setEditing(null);
              }}
            >
              {league.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} (${team.budget_remaining} remaining)
                </option>
              ))}
            </select>
          </div>

          <div className="keeper-owner-summary">
            <span>{selectedTeamKeepers.length} keepers saved</span>
            <span>
              ${selectedTeamKeepers.reduce((sum, keeper) => sum + Number(keeper.price || 0), 0)} committed
            </span>
          </div>

          <div className="form-group">
            <label>PLAYER SEARCH</label>
            <input
              className="search-input"
              value={form.playerName}
              onChange={(event) => setField("playerName", event.target.value)}
              placeholder="Search player name"
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSubmit) handleSubmit();
              }}
            />

            {form.playerName && (
              <div className="scout-results-list keeper-results-list">
                {resolvedPlayer && (
                  <div
                    className={`search-result keeper-resolved ${resolvedPlayerTaken ? "taken" : ""}`}
                    title={resolvedPlayerTaken ? "Player already drafted" : "Selected"}
                  >
                    <PlayerAvatar
                      name={resolvedPlayer.name}
                      size={26}
                      photoUrl={resolvedPlayer.photoUrl}
                    />
                    <span className="sr-name">
                      <strong>{resolvedPlayer.name}</strong>
                    </span>
                    <span className="sr-team">{resolvedPlayer.team}</span>
                    {(resolvedPlayer.pos || []).map((pos) => (
                      <span
                        key={pos}
                        className="pos-badge"
                        style={{ background: posColor(pos) }}
                      >
                        {pos}
                      </span>
                    ))}
                    <span className="sr-value">${resolvedPlayer.baseValue || 0}</span>
                  </div>
                )}

                {!exactMatch && playerMatches.length > 0 &&
                  playerMatches.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      className="search-result"
                      onClick={() => setField("playerName", player.name)}
                      title={`Use ${player.name}`}
                    >
                      <PlayerAvatar
                        name={player.name}
                        size={26}
                        photoUrl={player.photoUrl}
                      />
                      <span className="sr-name">{player.name}</span>
                      <span className="sr-team">{player.team}</span>
                      {(player.pos || []).map((pos) => (
                        <span
                          key={pos}
                          className="pos-badge"
                          style={{ background: posColor(pos) }}
                        >
                          {pos}
                        </span>
                      ))}
                      <span className="sr-value">${player.baseValue || 0}</span>
                    </button>
                  ))}

                {!resolvedPlayer && playerMatches.length === 0 && (
                  <div className="keeper-empty-results">
                    {query.length < 2
                      ? "Type at least 2 letters to search the player pool."
                      : `No matches for "${form.playerName}".`}
                  </div>
                )}

                {resolvedPlayerTaken && (
                  <div className="keeper-inline-error">
                    {resolvedPlayer.name} is already assigned in this draft.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>CONTRACT COST ($)</label>
            <input
              type="number"
              value={form.cost}
              min={1}
              step={1}
              onChange={(event) => setField("cost", event.target.value)}
              placeholder="e.g. 25"
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSubmit) handleSubmit();
              }}
            />
            {form.cost && !costValid && (
              <div className="keeper-inline-error">
                Keeper cost must be a whole-dollar value of at least $1.
              </div>
            )}
          </div>

          <button
            className="init-btn"
            onClick={handleSubmit}
            disabled={!canSubmit || !league.keeperLeague}
          >
            {editing ? "Save" : "Add Keeper"}
          </button>
          {editing && (
            <button
              type="button"
              className="keeper-secondary-btn"
              onClick={resetForm}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="keeper-right">
        <div className="settings-section-label">ADJUSTED STARTING BUDGETS</div>
        <div className="keeper-grid">
          {league.teams.map((team) => {
            const keepers = (team.roster || []).filter((entry) => entry?.isKeeper);
            const deducted = keepers.reduce(
              (sum, keeper) => sum + Number(keeper.price || 0),
              0,
            );

            return (
              <div key={team.id} className="keeper-card">
                <div className="kc-name">{team.name}</div>
                <div className="kc-count">
                  {keepers.length} keeper{keepers.length !== 1 ? "s" : ""}
                </div>

                <div className="kc-row">
                  <span className="kc-label">DEDUCTED</span>
                  <span className="kc-deducted">-${deducted}</span>
                </div>

                <div className="kc-row">
                  <span className="kc-label">STARTS WITH</span>
                  <span className="kc-budget green">${team.budget_remaining}</span>
                </div>

                {keepers.length === 0 && (
                  <div className="kc-empty">No keepers saved.</div>
                )}

                {keepers.map((keeper) => (
                  <div key={`${team.id}-${keeper.playerId}`} className="kc-keeper">
                    <div>
                      <strong>{keeper.name}</strong>
                      <span>
                        ${keeper.price} · {keeper.draftedPos || formatPositions(keeper)}
                      </span>
                    </div>
                    <div className="keeper-actions">
                      <button
                        type="button"
                        onClick={() => beginEdit(team, keeper)}
                        title={`Edit ${keeper.name}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => removeKeeper(team, keeper)}
                        title={`Remove ${keeper.name}`}
                      >
                        Remove
                      </button>
                    </div>
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
