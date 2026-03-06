import { useState, useEffect, useCallback } from "react";
import "./styles.css";

// ── Constants ──────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:3001";
const PROD_DISPLAY_URL = "https://api.darkblue.io";
const DEMO_KEY = "DB-2026-DEMO-0001";

const POSITIONS = ["C", "1B", "2B", "3B", "SS", "OF", "SP", "RP"];
const TIERS = ["Elite", "Starter", "Bench"];
const DEFAULT_ROSTER = { C: 1, "1B": 1, "2B": 1, "3B": 1, SS: 1, OF: 3, SP: 2, RP: 2, UTIL: 1, BN: 2, TAXI: 3 };
const DEFAULT_SCORING = {
  R: true, H: false, HR: true, RBI: true, SB: true, AVG: true, OBP: false, BB: false, TB: false, XBH: false,
  W: true, SV: true, ERA: true, WHIP: true, SO: true, HLD: false, "K/9": false, "BB/9": false, QS: false,
};
const HITTING_CATS = ["R", "H", "HR", "RBI", "SB", "AVG", "OBP", "BB", "TB", "XBH"];
const PITCHING_CATS = ["W", "SV", "ERA", "WHIP", "SO", "HLD", "K/9", "BB/9", "QS"];

function posColor(pos) {
  const map = {
    C: "#f59e0b", "1B": "#ef4444", "2B": "#f97316", "3B": "#a855f7",
    SS: "#06b6d4", OF: "#22c55e", SP: "#3b82f6", RP: "#ec4899",
    DH: "#6366f1", UTIL: "#84cc16", BN: "#6b7280", TAXI: "#8b5cf6",
  };
  return map[pos] || "#9ca3af";
}

// ── Player Avatar ──────────────────────────────────────────────────────────────
function PlayerAvatar({ name, size = 52 }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const palette = ["#22c55e", "#3b82f6", "#f59e0b", "#ec4899", "#06b6d4", "#a855f7", "#ef4444", "#f97316"];
  const idx = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % palette.length;
  const color = palette[idx];
  return (
    <div
      className="player-avatar"
      style={{ width: size, height: size, borderColor: `${color}55`, background: `${color}18`, color, fontSize: size * 0.34 }}
    >
      {initials}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function buildRosterPositions(roster) {
  const ORDER = ["C", "1B", "2B", "3B", "SS", "OF", "SP", "RP", "UTIL", "BN"];
  return ORDER.flatMap((slot) => Array(roster[slot] || 0).fill(slot));
}

function buildDraftState(league) {
  return {
    total_teams: league.owners,
    budget_per_team: league.budget,
    scoring_categories: Object.entries(league.scoring).filter(([, v]) => v).map(([k]) => k),
    teams: league.teams,
    roster_config: league.roster,
  };
}

function calcMaxBid(budget, slots) {
  return Math.max(budget - Math.max(slots - 1, 0), 1);
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("setup");
  const [activeTab, setActiveTab] = useState("board");
  const [apiStatus, setApiStatus] = useState("checking");
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [notes, setNotes] = useState({});

  const [league, setLeague] = useState({
    name: "",
    season: "2025",
    owners: 12,
    budget: 260,
    pool: "MLB",
    roster: { ...DEFAULT_ROSTER },
    scoring: { ...DEFAULT_SCORING },
    keeperLeague: true,
    teams: [],
  });

  const [currentOwnerIdx, setCurrentOwnerIdx] = useState(0);

  useEffect(() => { checkApiStatus(); }, []);

  async function checkApiStatus() {
    try {
      const r = await fetch(`${API_BASE}/health`);
      setApiStatus(r.ok ? "online" : "offline");
    } catch {
      setApiStatus("offline");
    }
  }

  async function fetchPlayers(leagueData) {
    try {
      const poolParam = leagueData?.pool === "AL" ? "AL" : leagueData?.pool === "NL" ? "NL" : "ALL";
      const r = await fetch(`${API_BASE}/v1/players?league=${poolParam}`, {
        headers: { "X-License-Key": DEMO_KEY },
      });
      const data = await r.json();
      setPlayers(data.players || []);
      return data.players || [];
    } catch {
      return [];
    }
  }

  function initDraft(formLeague) {
    const teams = Array.from({ length: formLeague.owners }, (_, i) => ({
      id: i + 1,
      name: `Owner ${i + 1}`,
      budget_remaining: formLeague.budget,
      roster: [],
      taxiSquad: [],
    }));
    const lg = { ...formLeague, teams };
    setLeague(lg);
    fetchPlayers(lg);
    setScreen("main");
    setActiveTab("board");
    setCurrentOwnerIdx(0);
  }

  function recordSale(player, price, teamId) {
    setLeague((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        return {
          ...t,
          budget_remaining: t.budget_remaining - price,
          roster: [...t.roster, { name: player.name, price, pos: player.pos }],
        };
      }),
    }));
    setPlayers((prev) =>
      prev.map((p) => p.id === player.id ? { ...p, drafted: true, draftedBy: teamId, draftPrice: price } : p)
    );
  }

  function undoLast() {
    // Find the last team with a roster entry (by iterating teams in reverse)
    let lastTeamId = null;
    let lastEntry = null;
    for (let i = league.teams.length - 1; i >= 0; i--) {
      const t = league.teams[i];
      if (t.roster.length > 0) {
        lastTeamId = t.id;
        lastEntry = t.roster[t.roster.length - 1];
        break;
      }
    }
    if (!lastTeamId || !lastEntry) return;
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
    const p = players.find((pl) => pl.name === lastEntry.name);
    if (p) {
      setPlayers((prev) => prev.map((pl) => pl.id === p.id ? { ...pl, drafted: false, draftedBy: null, draftPrice: null } : pl));
    }
  }

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
    if (p) setPlayers((prev) => prev.map((pl) => pl.id === p.id ? { ...pl, drafted: false, draftedBy: null, draftPrice: null } : pl));
  }

  function addTaxiPick(player, teamId) {
    setLeague((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        return { ...t, taxiSquad: [...(t.taxiSquad || []), { name: player.name, price: 1, pos: player.pos }] };
      }),
    }));
    setPlayers((prev) => prev.map((p) => p.id === player.id ? { ...p, drafted: true, draftedBy: teamId, draftPrice: 1, taxi: true } : p));
  }

  function saveNote(playerId, text) {
    setNotes((prev) => ({ ...prev, [playerId]: text }));
  }

  if (screen === "setup") return <SetupScreen onInit={initDraft} />;

  const myTeam = league.teams[currentOwnerIdx];
  const rosterPositions = buildRosterPositions(league.roster);
  const totalSlots = rosterPositions.length;
  const slotsLeft = totalSlots - (myTeam?.roster?.length || 0);
  const maxBid = calcMaxBid(myTeam?.budget_remaining || 0, slotsLeft);

  return (
    <div className="app">
      {/* ── Nav ── */}
      <nav className="nav">
        <div className="nav-left">
          <div className="nav-brand">
            <div className="nav-league">{league.name}</div>
            <div className="nav-season">SEASON {league.season}</div>
          </div>
          {[
            ["board", "Draft Board"],
            ["dictionary", "Player Dictionary"],
            ["settings", "League Settings"],
            ["keeper", "Keeper Setup"],
            ["sandbox", "API Sandbox"],
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
          <div className={`api-dot ${apiStatus}`} />
          <span className="api-status-label">API {apiStatus.toUpperCase()}</span>
          <div className="nav-badge">IN PROGRESS</div>
          <div className="nav-avatar">👤</div>
        </div>
      </nav>

      {/* ── Owner Bar ── */}
      <div className="owner-bar">
        <div className="owner-info">
          <div>
            <div className="owner-label">YOUR OWNER</div>
            <div className="owner-name">{myTeam?.name}</div>
          </div>
          <div className="owner-verified-badge">
            <span className="verified-check">✓</span> VERIFIED ${league.budget} budget
          </div>
        </div>
        <div className="owner-right">
          <div className="max-bid-block">
            <div className="max-bid-label">MAX BID</div>
            <div className="max-bid-value">${maxBid}</div>
          </div>
          <div className="turn-block">
            <span className="turn-label">Turn</span>
            <span className="turn-name">{myTeam?.name}</span>
            <span className="your-turn-badge">YOUR TURN</span>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="main-content">
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
        {activeTab === "dictionary" && (
          <PlayerDictionary
            players={players}
            selectedPlayer={selectedPlayer}
            setSelectedPlayer={setSelectedPlayer}
            notes={notes}
            saveNote={saveNote}
          />
        )}
        {activeTab === "settings" && (
          <LeagueSettings league={league} setLeague={setLeague} />
        )}
        {activeTab === "keeper" && (
          <KeeperSetup league={league} setLeague={setLeague} players={players} />
        )}
        {activeTab === "sandbox" && (
          <ApiSandbox league={league} apiStatus={apiStatus} />
        )}
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

// ════════════════════════════════════════════════════════════════════
// SETUP SCREEN
// ════════════════════════════════════════════════════════════════════
function SetupScreen({ onInit }) {
  const [form, setForm] = useState({
    name: "Valuation Test League",
    season: "2025",
    owners: 12,
    budget: 260,
    pool: "MLB",
    roster: { ...DEFAULT_ROSTER },
    scoring: { ...DEFAULT_SCORING },
    keeperLeague: true,
  });

  function set(key, val) { setForm((p) => ({ ...p, [key]: val })); }

  return (
    <div className="setup-page">
      <div className="setup-header">
        <div className="setup-brand">DARK BLUE SOFTWARE SOLUTIONS</div>
        <h1 className="setup-title">
          <span className="white">AUCTION</span>
          <br />
          <span className="green">DRAFT KIT</span>
        </h1>
        <p className="setup-sub">Fantasy Baseball · Dynamic Valuation Engine · v2.0</p>
      </div>

      <div className="setup-card">
        <h2 className="setup-card-title">CREATE NEW DRAFT INSTANCE</h2>
        <div className="form-group">
          <label>LEAGUE NAME</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Valuation Test League" />
        </div>
        <div className="form-group">
          <label>SEASON YEAR</label>
          <input value={form.season} onChange={(e) => set("season", e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>OWNERS</label>
            <input type="number" value={form.owners} min={2} max={20} onChange={(e) => set("owners", +e.target.value)} />
          </div>
          <div className="form-group">
            <label>BUDGET / OWNER</label>
            <input type="number" value={form.budget} min={100} max={500} onChange={(e) => set("budget", +e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>PLAYER POOL · SCRUM-28</label>
          <div className="toggle-group">
            {[["MLB", "MLB (All)"], ["AL", "AL Only"], ["NL", "NL Only"]].map(([val, label]) => (
              <button key={val} className={`toggle-btn ${form.pool === val ? "active" : ""}`} onClick={() => set("pool", val)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <button className="init-btn" disabled={!form.name.trim()} onClick={() => onInit(form)}>
          INITIALIZE DRAFT →
        </button>
        <p className="setup-hint">1,200 player pool auto-populated on initialization</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// DRAFT BOARD
// ════════════════════════════════════════════════════════════════════
function DraftBoard({
  league, players, selectedPlayer, setSelectedPlayer,
  onSale, onUndo, onUndoCell, currentOwnerIdx, setCurrentOwnerIdx,
  notes, saveNote, apiStatus, rosterPositions, totalSlots, maxBid,
}) {
  const [searchQ, setSearchQ] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [saleModal, setSaleModal] = useState(null);
  const [saleTeam, setSaleTeam] = useState(1);
  const [salePrice, setSalePrice] = useState("");
  const [valuation, setValuation] = useState(null);
  const [valuating, setValuating] = useState(false);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    const undrafted = players.filter((p) => !p.drafted);
    setRecommendations(undrafted.slice(0, 4));
  }, [players]);

  useEffect(() => {
    if (selectedPlayer && apiStatus === "online") fetchValuation(selectedPlayer);
    else setValuation(null);
  }, [selectedPlayer?.id, apiStatus]);

  async function fetchValuation(player) {
    setValuating(true);
    setValuation(null);
    try {
      const draftState = {
        total_teams: league.owners,
        budget_per_team: league.budget,
        scoring_categories: Object.entries(league.scoring).filter(([, v]) => v).map(([k]) => k),
        teams: league.teams.map((t) => ({ id: t.id, budget_remaining: t.budget_remaining, roster: t.roster.map((r) => r.name) })),
        nominated_player: player.name,
        roster_config: league.roster,
      };
      const r = await fetch(`${API_BASE}/v1/valuate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-License-Key": DEMO_KEY },
        body: JSON.stringify({ license_key: DEMO_KEY, draft_state: draftState }),
      });
      const data = await r.json();
      setValuation(data);
    } catch {
      setValuation(null);
    }
    setValuating(false);
  }

  function openSaleModal(player) {
    setSaleModal(player);
    setSaleTeam(league.teams[currentOwnerIdx]?.id || 1);
    setSalePrice(valuation?.max_bid_recommendation || player.baseValue || "");
    setSelectedPlayer(player);
  }

  function confirmSale() {
    if (!saleModal || !salePrice) return;
    onSale(saleModal, +salePrice, saleTeam);
    setSaleModal(null);
    setSalePrice("");
    setSelectedPlayer(null);
    setValuation(null);
  }

  const filteredPlayers = players.filter((p) => {
    if (p.drafted) return false;
    if (searchQ && !p.name.toLowerCase().includes(searchQ.toLowerCase()) && !(p.team || "").toLowerCase().includes(searchQ.toLowerCase())) return false;
    if (posFilter !== "ALL" && !p.pos.includes(posFilter)) return false;
    return true;
  });

  const myTeam = league.teams[currentOwnerIdx];
  const slotsLeft = totalSlots - (myTeam?.roster?.length || 0);

  return (
    <div className="board-layout">
      {/* ── Teams Table ── */}
      <div className="board-main">
        <div className="board-header">
          <div>
            <h2 className="board-title">DRAFT LEAGUE TEAMS TABLE</h2>
            <span className="board-hint">Click any cell to edit</span>
          </div>
          <button className="undo-btn" onClick={onUndo}>Undo</button>
        </div>

        <div className="teams-table-wrap">
          <table className="teams-table">
            <thead>
              <tr>
                <th className="col-owner">OWNER</th>
                <th className="col-budget">$ LEFT</th>
                {rosterPositions.map((pos, i) => (
                  <th key={i}>
                    <span className="pos-badge-header" style={{ background: posColor(pos) }}>{pos}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {league.teams.map((team, ti) => {
                const isMe = ti === currentOwnerIdx;
                const myMaxBid = calcMaxBid(team.budget_remaining, totalSlots - team.roster.length);
                return (
                  <tr key={team.id} className={isMe ? "my-row" : ""} onClick={() => setCurrentOwnerIdx(ti)}>
                    <td className="col-owner">
                      {isMe && <span className="star">★ </span>}
                      {team.name}
                      {isMe && <div className="max-bid-mini">max bid ${myMaxBid}</div>}
                    </td>
                    <td
                      className="col-budget"
                      style={{ color: team.budget_remaining > 50 ? "#22c55e" : team.budget_remaining > 20 ? "#f59e0b" : "#ef4444" }}
                    >
                      ${team.budget_remaining}
                    </td>
                    {rosterPositions.map((pos, si) => {
                      const entry = team.roster[si];
                      return (
                        <td
                          key={si}
                          className="roster-cell"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (entry) onUndoCell(entry.name, team.id);
                          }}
                        >
                          {entry ? (
                            <div className="roster-entry">
                              {entry.name}
                              <div className="roster-price">${entry.price}</div>
                            </div>
                          ) : (
                            <span className="roster-empty">–</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Player Search (bottom) ── */}
        <div className="search-bar-area">
          <div className="search-label-row">
            <span className="search-label">PLAYER SEARCH</span>
            <span className="search-hint">Quick search and autocomplete</span>
            <div className="pos-filters">
              {["ALL", "C", "1B", "2B", "3B", "SS", "OF", "SP", "RP"].map((p) => (
                <button key={p} className={`pos-filter ${posFilter === p ? "active" : ""}`} onClick={() => setPosFilter(p)}>{p}</button>
              ))}
              <span className="avail-count">{filteredPlayers.length} available</span>
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <input
              className="search-input"
              placeholder="Search players or teams for autocomplete… click result to view card or record sale"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
            {searchQ && filteredPlayers.length > 0 && (
              <div className="search-dropdown">
                {filteredPlayers.slice(0, 8).map((p) => (
                  <div key={p.id} className="search-result" onClick={() => { setSelectedPlayer(p); setSearchQ(""); }}>
                    <PlayerAvatar name={p.name} size={28} />
                    <span className="sr-name">{p.name}</span>
                    <span className="sr-team">{p.team} · {p.league}</span>
                    <div style={{ display: "flex", gap: 2 }}>
                      {p.pos.map((pos) => (
                        <span key={pos} className="pos-badge" style={{ background: posColor(pos) }}>{pos}</span>
                      ))}
                    </div>
                    <span className="sr-value">${p.baseValue}</span>
                    <button
                      className="sr-record"
                      onClick={(e) => { e.stopPropagation(); openSaleModal(p); }}
                    >
                      Record Sale
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="right-panel">
        {/* Budget / Slots */}
        <div className="panel-budget">
          <div>
            <div className="panel-label">BUDGET</div>
            <div className="panel-value green">${myTeam?.budget_remaining ?? league.budget}</div>
          </div>
          <div>
            <div className="panel-label">SLOTS LEFT</div>
            <div className="panel-value">{slotsLeft}</div>
          </div>
        </div>

        {/* Current Player */}
        <div className="current-player-section">
          <div className="cp-header">CURRENT PLAYER</div>
          <div className="cp-drafting-row">
            <span className="cp-drafting-label">DRAFTING OWNER:</span>
            <select className="cp-owner-select" value={currentOwnerIdx} onChange={(e) => setCurrentOwnerIdx(+e.target.value)}>
              {league.teams.map((t, i) => (
                <option key={i} value={i}>{t.name}</option>
              ))}
            </select>
            {selectedPlayer && (
              <button className="record-sale-btn" onClick={() => openSaleModal(selectedPlayer)}>RECORD SALE</button>
            )}
          </div>

          {selectedPlayer ? (
            <PlayerCard
              player={selectedPlayer}
              valuation={valuating ? "loading" : valuation}
              notes={notes}
              saveNote={saveNote}
            />
          ) : (
            <div className="cp-empty">Select a player to view card</div>
          )}
        </div>

        {/* Recommendations */}
        <div className="recommendations">
          <div className="rec-header">
            RECOMMENDED PLAYERS <span className="rec-sub">Suggestions</span>
          </div>
          {recommendations.map((p) => (
            <div key={p.id} className="rec-row" onClick={() => setSelectedPlayer(p)}>
              <PlayerAvatar name={p.name} size={32} />
              <div className="rec-info">
                <div className="rec-name">{p.name}</div>
                <div className="rec-team">{p.team}</div>
                <div className="rec-pos">
                  {p.pos.map((pos) => (
                    <span key={pos} className="pos-badge" style={{ background: posColor(pos) }}>{pos}</span>
                  ))}
                </div>
              </div>
              <div className="rec-right">
                <div className="rec-value green">${p.baseValue}</div>
                <div className={`tier-badge ${p.tier?.toLowerCase()}`}>{p.tier?.toUpperCase()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sale Modal ── */}
      {saleModal && (
        <div className="modal-overlay" onClick={() => setSaleModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>RECORD AUCTION SALE</h3>
            <p className="modal-player">{saleModal.name}</p>
            <div className="form-group">
              <label>WINNING TEAM</label>
              <select value={saleTeam} onChange={(e) => setSaleTeam(+e.target.value)}>
                {league.teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} (${t.budget_remaining} left)</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>WINNING BID ($)</label>
              <input type="number" value={salePrice} min={1} onChange={(e) => setSalePrice(e.target.value)} autoFocus />
            </div>
            {valuation && valuation !== "loading" && (
              <div className="modal-hint">
                API suggests max bid: <strong>${valuation.max_bid_recommendation}</strong>
                {valuation.true_dollar_value && <> · TDV: <strong>${valuation.true_dollar_value}</strong></>}
              </div>
            )}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setSaleModal(null)}>Cancel</button>
              <button className="modal-confirm" onClick={confirmSale} disabled={!salePrice}>Confirm Sale</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PLAYER CARD (shared)
// ════════════════════════════════════════════════════════════════════
function PlayerCard({ player, valuation, notes, saveNote }) {
  const [localNote, setLocalNote] = useState("");

  useEffect(() => {
    setLocalNote(notes?.[player.id] ?? player.note ?? "");
  }, [player.id, notes]);

  const maxBid =
    valuation === "loading" ? "…"
    : valuation?.max_bid_recommendation ?? player.baseValue;

  const isPitcher = player.era !== null && player.era !== undefined;
  const stats = isPitcher
    ? [
        { label: "ERA",  val: player.era  ?? "–" },
        { label: "SO",   val: player.so   ?? "–" },
        { label: "WHIP", val: player.whip ?? "–" },
      ]
    : [
        { label: "HR",  val: player.hr  ?? "–" },
        { label: "RBI", val: player.rbi ?? "–" },
        { label: "SB",  val: player.sb  ?? "–" },
      ];

  // show avg for hitters that have it
  if (!isPitcher && player.avg) {
    stats.push({ label: "AVG", val: player.avg });
  }
  const displayStats = stats.slice(0, 3);

  return (
    <div className="player-card">
      {/* Header: team/league + tier badge */}
      <div className="pc-header">
        <div className="pc-team-league">{player.team} · {player.league} LEAGUE</div>
        <span className={`tier-badge ${player.tier?.toLowerCase()}`}>{player.tier?.toUpperCase()}</span>
      </div>

      {/* Main: avatar + info */}
      <div className="pc-main">
        <PlayerAvatar name={player.name} size={52} />
        <div className="pc-info">
          <div className="pc-name">{player.name}</div>
          <div className="pc-badges">
            {player.pos.map((p) => (
              <span key={p} className="pos-badge" style={{ background: posColor(p) }}>{p}</span>
            ))}
          </div>
          <div className="pc-maxbid">
            <span className="pc-bid-val">${maxBid}</span>
            <span className="pc-bid-label"> MAX BID</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="pc-section-label">STATISTICS</div>
      <div className="pc-stats">
        {displayStats.map((s) => (
          <div key={s.label} className="pc-stat">
            <div className="pcs-label">{s.label}</div>
            <div className="pcs-val">{s.val}</div>
          </div>
        ))}
      </div>

      {/* Injury */}
      {player.injury && (
        <div className="pc-injury">⚠ {player.injury}</div>
      )}

      {/* News / API reasoning */}
      {valuation && valuation !== "loading" && valuation.reasoning && (
        <div className="pc-news">
          <span className="news-tag">[API]</span> {valuation.reasoning}
        </div>
      )}
      {!valuation && player.note && (
        <div className="pc-news">
          <span className="news-tag">[NOTE]</span> {player.note}
        </div>
      )}

      {/* Eligibility */}
      <div className="pc-section-label">ELIGIBILITY</div>
      <div className="pc-badges" style={{ marginBottom: 6 }}>
        {player.pos.map((p) => (
          <span key={p} className="pos-badge" style={{ background: posColor(p) }}>{p}</span>
        ))}
        {player.depth && <span className="depth-badge">{player.depth}</span>}
      </div>

      {/* Notes */}
      <div className="pc-section-label">MY NOTES</div>
      <textarea
        className="pc-notes"
        value={localNote}
        onChange={(e) => setLocalNote(e.target.value)}
        onBlur={() => saveNote(player.id, localNote)}
        placeholder="Add a note…"
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PLAYER DICTIONARY
// ════════════════════════════════════════════════════════════════════
function PlayerDictionary({ players, selectedPlayer, setSelectedPlayer, notes, saveNote }) {
  const [searchQ, setSearchQ] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [tierFilter, setTierFilter] = useState("ALL");
  const [showDrafted, setShowDrafted] = useState(false);

  const filtered = players.filter((p) => {
    if (!showDrafted && p.drafted) return false;
    if (searchQ && !p.name.toLowerCase().includes(searchQ.toLowerCase()) && !(p.team || "").toLowerCase().includes(searchQ.toLowerCase())) return false;
    if (posFilter !== "ALL" && !p.pos.includes(posFilter)) return false;
    if (tierFilter !== "ALL" && p.tier !== tierFilter) return false;
    return true;
  });

  const byTier = {};
  filtered.forEach((p) => {
    if (!byTier[p.tier]) byTier[p.tier] = [];
    byTier[p.tier].push(p);
  });

  return (
    <div className="dict-layout">
      <div className="dict-main">
        <h2 className="dict-title">PLAYER DICTIONARY</h2>
        <p className="dict-sub">Browse full pool · click for card · add notes anytime</p>

        <div className="dict-filters">
          <input
            className="dict-search"
            placeholder="Search name or team…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
          <div className="filter-row">
            {["ALL", "C", "1B", "2B", "3B", "SS", "OF", "SP", "RP", "DH"].map((p) => (
              <button key={p} className={`pos-filter ${posFilter === p ? "active" : ""}`} onClick={() => setPosFilter(p)}>{p}</button>
            ))}
            <span className="divider">|</span>
            {["ALL", "Elite", "Starter", "Bench"].map((t) => (
              <button key={t} className={`tier-filter ${tierFilter === t ? "active" : ""}`} onClick={() => setTierFilter(t)}>{t}</button>
            ))}
            <label className="drafted-toggle">
              <input type="checkbox" checked={showDrafted} onChange={(e) => setShowDrafted(e.target.checked)} />
              {" "}Show Drafted
            </label>
            <span className="avail-count">{filtered.length} players</span>
          </div>
        </div>

        {TIERS.map((tier) => {
          const group = byTier[tier] || [];
          if (group.length === 0) return null;
          return (
            <div key={tier} className="tier-group">
              <div className={`tier-label-row ${tier.toLowerCase()}`}>
                {tier.toUpperCase()} <span className="tier-count">{group.length}</span>
              </div>
              <div className="player-grid">
                {group.map((p) => (
                  <div
                    key={p.id}
                    className={`dict-card ${selectedPlayer?.id === p.id ? "selected" : ""} ${p.drafted ? "drafted" : ""}`}
                    onClick={() => setSelectedPlayer(p)}
                  >
                    <div className="dc-top">
                      <div>
                        <div className="dc-name">{p.name}</div>
                        <div className="dc-team">{p.team} · {p.league}</div>
                        <div className="dc-badges">
                          {p.pos.map((pos) => (
                            <span key={pos} className="pos-badge" style={{ background: posColor(pos) }}>{pos}</span>
                          ))}
                        </div>
                      </div>
                      <div className="dc-value green">${p.baseValue}</div>
                    </div>
                    {p.injury && <div className="dc-injury">⚠ {p.injury}</div>}
                    {(notes[p.id] || p.note) && (
                      <div className="dc-note">Note: {(notes[p.id] || p.note || "").slice(0, 40)}{((notes[p.id] || p.note || "").length > 40) ? "…" : ""}</div>
                    )}
                    {p.drafted && <div className="dc-drafted">DRAFTED</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right panel */}
      <div className="right-panel">
        <div className="panel-section-label">PLAYER CARD</div>
        {selectedPlayer ? (
          <PlayerCard player={selectedPlayer} valuation={null} notes={notes} saveNote={saveNote} />
        ) : (
          <div className="cp-empty">Select a player to view card</div>
        )}

        <div className="recommendations">
          <div className="rec-header">RECOMMENDED PLAYERS <span className="rec-sub">Suggestions</span></div>
          {players.filter((p) => !p.drafted).slice(0, 4).map((p) => (
            <div key={p.id} className="rec-row" onClick={() => setSelectedPlayer(p)}>
              <PlayerAvatar name={p.name} size={32} />
              <div className="rec-info">
                <div className="rec-name">{p.name}</div>
                <div className="rec-team">{p.team}</div>
                <div className="rec-pos">
                  {p.pos.map((pos) => (
                    <span key={pos} className="pos-badge" style={{ background: posColor(pos) }}>{pos}</span>
                  ))}
                </div>
              </div>
              <div className="rec-right">
                <div className="rec-value green">${p.baseValue}</div>
                <div className={`tier-badge ${p.tier?.toLowerCase()}`}>{p.tier?.toUpperCase()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// LEAGUE SETTINGS
// ════════════════════════════════════════════════════════════════════
function LeagueSettings({ league, setLeague }) {
  function toggleScoring(cat) {
    setLeague((p) => ({ ...p, scoring: { ...p.scoring, [cat]: !p.scoring[cat] } }));
  }
  function adjRoster(slot, delta) {
    setLeague((p) => ({ ...p, roster: { ...p.roster, [slot]: Math.max(0, (p.roster[slot] || 0) + delta) } }));
  }

  return (
    <div className="settings-layout">
      <div className="settings-left">
        <h2 className="settings-title">LEAGUE SETTINGS</h2>
        <div className="settings-card">
          <div className="settings-section-label">SCORING CATEGORIES</div>
          <div className="scoring-group-label">HITTING</div>
          <div className="scoring-cats">
            {HITTING_CATS.map((cat) => (
              <button key={cat} className={`cat-btn ${league.scoring[cat] ? "active" : ""}`} onClick={() => toggleScoring(cat)}>{cat}</button>
            ))}
          </div>
          <div className="scoring-group-label">PITCHING</div>
          <div className="scoring-cats">
            {PITCHING_CATS.map((cat) => (
              <button key={cat} className={`cat-btn ${league.scoring[cat] ? "active" : ""}`} onClick={() => toggleScoring(cat)}>{cat}</button>
            ))}
          </div>
        </div>

        <div className="settings-card" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label>SEASON YEAR</label>
            <input value={league.season} onChange={(e) => setLeague((p) => ({ ...p, season: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>OWNERS</label>
              <input type="number" value={league.owners} onChange={(e) => setLeague((p) => ({ ...p, owners: +e.target.value }))} />
            </div>
            <div className="form-group">
              <label>BUDGET / OWNER</label>
              <input type="number" value={league.budget} onChange={(e) => setLeague((p) => ({ ...p, budget: +e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>PLAYER POOL</label>
            <div className="toggle-group">
              {[["MLB", "MLB (All)"], ["AL", "AL Only"], ["NL", "NL Only"]].map(([val, label]) => (
                <button key={val} className={`toggle-btn ${league.pool === val ? "active" : ""}`} onClick={() => setLeague((p) => ({ ...p, pool: val }))}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>KEEPER LEAGUE?</label>
            <div className="toggle-group">
              <button className={`toggle-btn ${league.keeperLeague ? "active" : ""}`} onClick={() => setLeague((p) => ({ ...p, keeperLeague: true }))}>YES</button>
              <button className={`toggle-btn ${!league.keeperLeague ? "active" : ""}`} onClick={() => setLeague((p) => ({ ...p, keeperLeague: false }))}>NO</button>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-right">
        <div className="settings-card">
          <div className="settings-section-label">ROSTER CONFIGURATION</div>
          <div className="roster-grid">
            {Object.entries(league.roster).map(([slot, count]) => (
              <div key={slot} className="roster-row">
                <span className="roster-slot-label" style={{ color: posColor(slot) }}>{slot}</span>
                <div className="roster-adj">
                  <button className="adj-btn" onClick={() => adjRoster(slot, -1)}>−</button>
                  <span className="adj-val green">{count}</span>
                  <button className="adj-btn" onClick={() => adjRoster(slot, 1)}>+</button>
                </div>
              </div>
            ))}
          </div>
          <button className="init-btn" style={{ marginTop: 16 }} onClick={() => alert("Settings saved!")}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// KEEPER SETUP
// ════════════════════════════════════════════════════════════════════
function KeeperSetup({ league, setLeague, players }) {
  const [form, setForm] = useState({ ownerId: "1", playerName: "", cost: "" });
  const [keepersByTeam, setKeepersByTeam] = useState({});

  function addKeeper() {
    if (!form.playerName.trim() || !form.cost) return;
    const teamId = +form.ownerId;
    const cost = +form.cost;
    setKeepersByTeam((prev) => ({
      ...prev,
      [teamId]: [...(prev[teamId] || []), { name: form.playerName.trim(), cost }],
    }));
    setLeague((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        if (t.id !== teamId) return t;
        const matchedPlayer = players.find((p) => p.name.toLowerCase() === form.playerName.trim().toLowerCase());
        return {
          ...t,
          budget_remaining: t.budget_remaining - cost,
          roster: [...t.roster, { name: form.playerName.trim(), price: cost, pos: matchedPlayer?.pos || ["?"] }],
        };
      }),
    }));
    setForm((p) => ({ ...p, playerName: "", cost: "" }));
  }

  return (
    <div className="keeper-layout">
      <div className="keeper-left">
        <h2 className="keeper-title">PRE-DRAFT KEEPER INITIALIZATION</h2>
        <p className="dict-sub">Enter keeper contracts. Budgets auto-adjust per owner.</p>
        <div className="settings-card" style={{ marginTop: 16 }}>
          <div className="settings-section-label">ADD KEEPER CONTRACT</div>
          <div className="form-group">
            <label>OWNER</label>
            <select value={form.ownerId} onChange={(e) => setForm((p) => ({ ...p, ownerId: e.target.value }))}>
              {league.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>PLAYER NAME</label>
            <input value={form.playerName} onChange={(e) => setForm((p) => ({ ...p, playerName: e.target.value }))} placeholder="e.g. Shohei Ohtani" />
          </div>
          <div className="form-group">
            <label>CONTRACT COST ($)</label>
            <input type="number" value={form.cost} min={1} onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))} placeholder="e.g. 25" />
          </div>
          <button className="init-btn" onClick={addKeeper} disabled={!form.playerName.trim() || !form.cost}>
            Add Keeper
          </button>
        </div>
      </div>

      <div className="keeper-right">
        <div className="settings-section-label">ADJUSTED STARTING BUDGETS</div>
        <div className="keeper-grid">
          {league.teams.map((team) => {
            const keepers = keepersByTeam[team.id] || [];
            const deducted = keepers.reduce((s, k) => s + k.cost, 0);
            return (
              <div key={team.id} className="keeper-card">
                <div className="kc-name">{team.name}</div>
                <div className="kc-count">{keepers.length} keepers</div>
                <div className="kc-row">
                  <span className="kc-label">DEDUCTED</span>
                  <span className="kc-deducted">-${deducted}</span>
                </div>
                <div className="kc-row">
                  <span className="kc-label">STARTS WITH</span>
                  <span className="kc-budget green">${team.budget_remaining}</span>
                </div>
                {keepers.map((k, i) => (
                  <div key={i} className="kc-keeper">{k.name} · ${k.cost}</div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TAXI SQUAD
// ════════════════════════════════════════════════════════════════════
function TaxiSquad({ league, players, onTaxiPick, currentOwnerIdx, rosterPositions }) {
  const [taxiSearch, setTaxiSearch] = useState("");
  const taxiSlots = league.roster.TAXI || 3;
  const available = players.filter(
    (p) => !p.drafted && (taxiSearch === "" || p.name.toLowerCase().includes(taxiSearch.toLowerCase()))
  );

  const myTeam = league.teams[currentOwnerIdx];

  return (
    <div className="taxi-layout">
      <div className="taxi-main">
        <div className="taxi-header-row">
          <h2 className="taxi-mode-title">TAXI SQUAD MODE</h2>
          <span className="taxi-badge">$1 fixed per pick - does NOT reduce main ${league.budget} budget</span>
          <span className="taxi-hint" style={{ marginLeft: "auto" }}>Main auction complete. Reserve minor-league prospects below.</span>
        </div>

        <div className="settings-section-label" style={{ marginBottom: 8 }}>ALL TAXI SQUADS</div>
        <div className="teams-table-wrap">
          <table className="teams-table">
            <thead>
              <tr>
                <th className="col-owner">OWNER</th>
                {Array.from({ length: taxiSlots }, (_, i) => (
                  <th key={i} style={{ minWidth: 120 }}>
                    <span className="taxi-col-badge">TAXI $1</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {league.teams.map((team, ti) => {
                const isMe = ti === currentOwnerIdx;
                return (
                  <tr key={team.id} className={isMe ? "taxi-my-row" : ""}>
                    <td className="col-owner">
                      {isMe && <span className="star" style={{ color: "#8b5cf6" }}>★ </span>}
                      {team.name}
                    </td>
                    {Array.from({ length: taxiSlots }, (_, si) => {
                      const pick = (team.taxiSquad || [])[si];
                      return (
                        <td key={si} className="taxi-cell">
                          {pick ? (
                            <span className="taxi-pick">{pick.name}</span>
                          ) : isMe ? (
                            <span className="taxi-pick-slot">+ pick</span>
                          ) : (
                            <span className="taxi-empty">empty</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="taxi-search-area">
          <div className="search-label-row">
            <span className="search-label" style={{ color: "#8b5cf6" }}>TAXI PICK SEARCH</span>
            <span className="search-hint">click result to assign $1 pick to selected slot</span>
          </div>
          <div style={{ position: "relative" }}>
            <input
              className="search-input"
              placeholder="Search available players for $1 taxi pick…"
              value={taxiSearch}
              onChange={(e) => setTaxiSearch(e.target.value)}
            />
            {taxiSearch && (
              <div className="search-dropdown">
                {available.slice(0, 8).map((p) => (
                  <div
                    key={p.id}
                    className="search-result"
                    onClick={() => { onTaxiPick(p, myTeam?.id); setTaxiSearch(""); }}
                  >
                    <PlayerAvatar name={p.name} size={26} />
                    <span className="sr-name">{p.name}</span>
                    <span className="sr-team">{p.team}</span>
                    {p.pos.map((pos) => (
                      <span key={pos} className="pos-badge" style={{ background: posColor(pos) }}>{pos}</span>
                    ))}
                    <span className="sr-value" style={{ color: "#8b5cf6" }}>$1</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right roster panel */}
      <div className="right-panel taxi-right-panel">
        <div className="panel-section-label">MY MAIN ROSTER</div>
        <div className="roster-summary">
          {rosterPositions.map((slot, i) => {
            const entry = myTeam?.roster[i];
            return (
              <div key={i} className="roster-sum-row">
                <span className="roster-sum-pos" style={{ color: posColor(slot) }}>{slot}</span>
                <span className="roster-sum-name">{entry ? entry.name : "–"}</span>
              </div>
            );
          })}
        </div>

        <div className="panel-section-label" style={{ marginTop: 16 }}>MY TAXI SQUAD</div>
        {Array.from({ length: taxiSlots }, (_, i) => {
          const pick = (myTeam?.taxiSquad || [])[i];
          return (
            <div key={i} className="taxi-roster-row">
              <span className="taxi-badge-sm">TAXI</span>
              <span className="roster-sum-name">{pick ? pick.name : "empty"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// API SANDBOX
// ════════════════════════════════════════════════════════════════════
function ApiSandbox({ league, apiStatus }) {
  const defaultPayload = {
    license_key: "DB-2026-DEMO-0001",
    draft_state: {
      total_teams: league?.owners || 12,
      budget_per_team: league?.budget || 260,
      scoring_categories: ["HR", "RBI", "AVG", "SB", "ERA", "SO", "WHIP"],
      teams: [{ id: 1, budget_remaining: 248, roster: ["Garrett Crochet"] }],
      nominated_player: "Gerrit Cole",
      roster_config: { C: 1, "1B": 1, "2B": 1, "3B": 1, SS: 1, OF: 3, SP: 2, RP: 2, UTIL: 1, BN: 2 },
    },
  };

  const [payload, setPayload] = useState(JSON.stringify(defaultPayload, null, 2));
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(null);
  const [error, setError] = useState(null);

  async function sendRequest() {
    setLoading(true);
    setError(null);
    setResponse(null);
    const t0 = Date.now();
    try {
      const parsed = JSON.parse(payload);
      const r = await fetch(`${API_BASE}/v1/valuate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-License-Key": parsed.license_key || DEMO_KEY },
        body: JSON.stringify(parsed),
      });
      const data = await r.json();
      setResponse({ status: r.status, data, ok: r.ok });
      setElapsed(Date.now() - t0);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <div className="sandbox-layout">
      <h2 className="sandbox-title">API TESTING SANDBOX</h2>
      <p className="dict-sub">Paste draft-state JSON and test the Valuation API interactively.</p>

      <div className="sandbox-endpoint-bar">
        <div className="endpoint-left">
          <span className="endpoint-label">ENDPOINT</span>
          <div>
            <span className="endpoint-method">POST</span>
            <span className="endpoint-url">{PROD_DISPLAY_URL}/v1/valuate</span>
          </div>
        </div>
        <div className="endpoint-auth-block">
          <span className="endpoint-label">AUTH</span>
          <span className="endpoint-auth">X-License-Key: DB-2026-XXXX</span>
        </div>
        <div className="endpoint-status">
          <div className={`api-dot ${apiStatus}`} />
          <span className="api-status-label">{apiStatus.toUpperCase()}</span>
        </div>
      </div>

      <div className="sandbox-panels">
        <div className="sandbox-panel">
          <div className="sandbox-panel-label">REQUEST PAYLOAD STATELESS</div>
          <textarea
            className="sandbox-textarea"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            spellCheck={false}
          />
          <button className="init-btn" onClick={sendRequest} disabled={loading}>
            {loading ? "Sending…" : "Send Request"}
          </button>
        </div>

        <div className="sandbox-panel">
          <div className="sandbox-panel-label">API RESPONSE</div>
          <div className="sandbox-response">
            {error && <div className="sandbox-error">{error}</div>}
            {response && <pre className="sandbox-json">{JSON.stringify(response.data, null, 2)}</pre>}
            {!response && !error && !loading && <div className="sandbox-placeholder">Response will appear here…</div>}
            {loading && <div className="sandbox-placeholder">Sending request…</div>}
          </div>
          {response && (
            <div className="sandbox-status-bar">
              <span className={response.ok ? "status-ok" : "status-err"}>
                {response.status} {response.ok ? "OK" : "ERROR"}
              </span>
              {elapsed != null && <span> · {elapsed}ms</span>}
              {response.data?.max_bid_recommendation && (
                <span>
                  {" "}· Max Bid: ${response.data.max_bid_recommendation}
                  {response.data.market_inflation && <> · Inflation: +{((response.data.market_inflation - 1) * 100).toFixed(1)}%</>}
                  {response.data.scarcity_tier && <> · Tier: {response.data.scarcity_tier}</>}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
