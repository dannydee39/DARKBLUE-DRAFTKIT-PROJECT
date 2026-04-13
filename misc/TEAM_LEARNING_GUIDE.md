# Dark Blue Auction Draft Kit — Team Learning Guide
### Internal Reference for Q&A Prep | University Class Presentation

> This document is for the development team. It covers every major system in the codebase with both plain-language explanations and technical depth. Read it before the presentation so you can answer tough professor questions without hesitation.

---

## Table of Contents

1. [What the Project Does (Big Picture)](#1-what-the-project-does-big-picture)
2. [System Architecture](#2-system-architecture)
3. [The Player Data Pipeline](#3-the-player-data-pipeline)
4. [The Valuation Algorithm (The Smartest Part)](#4-the-valuation-algorithm-the-smartest-part)
5. [The Draft Board Grid](#5-the-draft-board-grid)
6. [Valuation Refresh Bug (Just Fixed)](#6-valuation-refresh-bug-just-fixed)
7. [State Management](#7-state-management)
8. [API Authentication and Security](#8-api-authentication-and-security)
9. [Common Q&A You Will Likely Get Asked](#9-common-qa-you-will-likely-get-asked)
10. [File Map (Quick Reference)](#10-file-map-quick-reference)

---

## 1. What the Project Does (Big Picture)

### The Plain-Language Version

> **Analogy:** Think of this like a live ESPN broadcast table for your fantasy baseball auction. The API is the stats engine in the back office; the draft kit is the screen your commissioner sees at the table.

Fantasy baseball auction drafts are chaotic. Twelve managers sit around a table, each with a $260 budget. One by one, players are nominated. Everyone bids. The winning bidder puts that player on their roster and the price comes off their budget. It moves fast, and the question every manager asks on every player is: *"What is this guy actually worth right now, given who is already gone?"*

**That is the problem this project solves.** It is a real-time auction draft coordinator that:

- Tracks every team's roster and remaining budget live
- Sends the current draft state to a valuation engine that calculates what each nominated player is worth *right now*, not just pre-draft
- Shows the commissioner a grid of all 12 teams' rosters as they fill in
- Prevents double-drafting, handles keeper contracts, and supports taxi squads

### The Technical Summary

The system is a two-process web application:

| Layer | Technology | What It Does |
|---|---|---|
| API Server | Node.js + Express | Stateless valuation engine, serves player data |
| Frontend | React 18 + Vite | The UI the commissioner operates during the draft |

They communicate over HTTP. In development the frontend runs at `localhost:5173` and talks to the API at `localhost:3001`. In production the frontend is a static build and the API lives at `https://draftapi.anythingavenue.com`.

---

## 2. System Architecture

### The Analogy

> **Analogy:** The API is like a restaurant kitchen. The frontend is the menu and the waiter. Users interact with the menu; the kitchen does the hard work out of sight. You can replace the menu with a different one — a mobile app, a command-line tool, a different website — and the kitchen keeps working the same way.

### Two-Process System

```
┌─────────────────────────────────────────────┐
│              FRONTEND (React/Vite)           │
│  localhost:5173 (dev)                        │
│                                              │
│  App.jsx                                     │
│  └── DraftBoard.jsx       (main grid)        │
│  └── PlayerDictionary.jsx (browse players)   │
│  └── LeagueSettings.jsx   (scoring/roster)   │
│  └── KeeperSetup.jsx      (pre-draft)        │
│  └── ApiSandbox.jsx       (raw API tester)   │
│  └── TaxiSquad.jsx        ($1 reserve picks) │
│  └── PlayerCard.jsx       (player detail)    │
│  └── PlayerAvatar.jsx     (photo/initials)   │
│  └── SetupScreen.jsx      (league setup)     │
└──────────────┬──────────────────────────────┘
               │  HTTP POST /v1/valuate
               │  HTTP GET  /v1/players
               │  HTTP GET  /health
               ▼
┌─────────────────────────────────────────────┐
│              API SERVER (Node/Express)       │
│  localhost:3001 (dev)                        │
│  draftapi.anythingavenue.com (prod)          │
│                                              │
│  server.js                                  │
│  └── routes/valuate.js  (POST /v1/valuate)  │
│  └── routes/players.js  (GET  /v1/players)  │
│  └── services/valuation.js (algorithm)      │
│  └── middleware/auth.js (license key check) │
│  └── data/players.json  (313 NL players)    │
└─────────────────────────────────────────────┘
```

### How They Talk

**Frontend to API: POST /v1/valuate**

The frontend sends the complete current draft state as a JSON body. No session, no server-side state — every request is fully self-contained.

```json
{
  "license_key": "DB-2026-DEMO-0001",
  "draft_state": {
    "total_teams": 12,
    "budget_per_team": 260,
    "scoring_categories": ["HR", "RBI", "AVG", "SB", "ERA", "SO", "WHIP"],
    "teams": [{ "id": 1, "budget_remaining": 200, "roster": ["Juan Soto"] }],
    "nominated_player": "Freddie Freeman",
    "roster_config": { "C": 1, "1B": 1, "2B": 1, "3B": 1, "SS": 1,
                       "OF": 3, "SP": 2, "RP": 2, "UTIL": 1, "BN": 2 }
  }
}
```

**API response:**

```json
{
  "player": "Freddie Freeman",
  "true_dollar_value": 28,
  "max_bid_recommendation": 26,
  "market_inflation": 1.032,
  "position_scarcity": { "1B": "LOW" },
  "reasoning": "Market inflation +3.2%. Tier: Starter. TDV: $28."
}
```

**Frontend to API: GET /health**

No authentication required. Returns `{ "status": "online" }`. The frontend polls this on mount to show the green/red dot in the nav bar.

### Environment Config

The frontend reads `VITE_API_BASE` at **build time** (Vite bakes it into the JS bundle). The API reads `.env` at **runtime**.

```
# api/.env
PORT=3001
API_KEYS=DB-2026-DEMO-0001
ALLOWED_ORIGINS=https://draftapi.anythingavenue.com

# draftkit (build time)
VITE_API_BASE=https://draftapi.anythingavenue.com
```

---

## 3. The Player Data Pipeline

### The Analogy

> **Analogy:** It is like a scouts' report card. We take the best available info for each player from three different sources and combine them into one definitive report. If the most recent scout has a number, use that. If not, fall back to the next scout.

### How It Works: `api/scripts/generate-players.js`

**Three CSV sources with priority:**

```
sample/data/projections-NL.csv          <- PRIMARY (most forward-looking)
sample/data/2025-player-NL-stats.csv    <- FALLBACK #1
sample/data/3Year-average-NL-stats.csv  <- FALLBACK #2
```

**Merge logic — last write wins:**

```javascript
const playerMap = new Map();
processRows(avg3Rows,       "avg3", playerMap);  // written first (lowest priority)
processRows(stats2025Rows,  "2025", playerMap);  // overwrites avg3
processRows(projRows,       "proj", playerMap);  // overwrites everything (highest priority)
```

If Freddie Freeman appears in all three files, only the projections row survives as the final record.

**Tier assignment by FPTS rank:**

```javascript
sorted.forEach((p, i) => {
  if (i < 20)       p.tier = "Elite";    // top 20
  else if (i < 75)  p.tier = "Starter";  // rank 21-75
  else              p.tier = "Bench";    // rank 76+
});
```

**Dollar values using Points Above Replacement (PAR):**

```javascript
const replacementFPTS = sorted[110 - 1].fpts;       // last draftable slot
const PAR             = player.fpts - replacementFPTS;
player.baseValue      = (PAR / totalPAR) * TOTAL_HITTER_BUDGET;
```

This gives Shohei Ohtani **$75** and a bench-borderline player **$1** — realistic and proportional.

### Output

313 NL players → `api/data/players.json`. Tier breakdown: **20 Elite, 55 Starter, 238 Bench**.

```json
{
  "id": 1, "name": "Shohei Ohtani", "team": "LAD", "league": "NL",
  "pos": ["DH", "SP"], "tier": "Elite", "baseValue": 75,
  "hr": 42, "rbi": 98, "r": 123, "sb": 27, "avg": "0.297",
  "era": null, "so": null, "whip": null, "fpts": 842, "photoUrl": null
}
```

---

## 4. The Valuation Algorithm (The Smartest Part)

### The Analogy

> **Analogy:** Think of Uber surge pricing. The base fare is the player's raw stats value. Scarcity and demand then multiply the price dynamically. 2am on New Year's Eve with 3 cars left downtown — 3x surge. Same driver, same route, different market conditions.

The algorithm lives in `api/services/valuation.js`. It is **stateless** — the client sends the full draft state every time; the server calculates fresh every time.

### Step 1: SGP-Style Scoring

```javascript
function scorePlayer(player, categories, poolStats) {
  let total = 0, count = 0;
  categories.forEach((cat) => {
    const val = getStatForCat(player, cat);
    if (val === null) return;                      // skip categories with no data
    const { min, max } = poolStats[cat];           // range across undrafted pool
    const normalized = (val - min) / (max - min); // 0.0 to 1.0
    total += normalized;
    count++;
  });
  return total / count; // average score across all active categories
}
```

ERA and WHIP are negated because lower is better:

```javascript
case "ERA":  return player.era  ? -parseFloat(player.era)  : null;
case "WHIP": return player.whip ? -parseFloat(player.whip) : null;
```

Dollar translation:

```javascript
// Player's proportional share of remaining spendable budget
const baseTDV = (nominatedScore / totalPoolScore) * spendableBudget;
```

### Step 2: Position Scarcity

```javascript
const ratio = remainingSlots / undraftedAtPos;
// > 1.0 = more demand than supply

if (ratio >= 1.5) return { multiplier: 1.35, tier: "CRITICAL" };
if (ratio >= 1.0) return { multiplier: 1.20, tier: "HIGH" };
if (ratio >= 0.7) return { multiplier: 1.08, tier: "MEDIUM" };
return              { multiplier: 1.00, tier: "LOW" };
```

12 teams wanting 1 catcher each, only 8 catchers left undrafted: ratio = 1.5 → CRITICAL → +35%.

### Step 3: Market Inflation

```javascript
const inflationFactor = totalRemainingBudget / expectedRemaining;
// Clamped [0.85, 1.45] — prevents extreme swings
```

Teams collectively overspend on stars early → remaining budget concentrates → `inflationFactor > 1.0` → later players cost more in real bidding.

### Step 4: Max Bid = 92% of True Value

```javascript
const trueDollarValue      = Math.round(baseTDV * scarcityMultiplier * inflationFactor);
const clamped              = Math.min(Math.max(trueDollarValue, 1), 80); // $1–$80
const maxBidRecommendation = Math.max(Math.round(clamped * 0.92), 1);
```

The 8% discount means you never go all-in; you keep a small margin for uncertainty.

---

## 5. The Draft Board Grid

### The Analogy

> **Analogy:** Think of the grid like a stadium seating chart. Each seat has a number. When you assign someone to seat 5, they stay in seat 5 — they do not pile up in seat 1 just because they arrived first. Players are stored *by seat number*, not by arrival order.

### The Roster Slot System

```javascript
// buildRosterPositions() transforms { C:1, "1B":1, OF:3, SP:2, ... } to:
// ["C","1B","2B","3B","SS","OF","OF","OF","SP","SP","RP","RP","UTIL","BN","BN"]
//   0    1    2    3    4    5    6    7    8    9   10   11    12   13   14
```

Each pick stores an explicit `slotIndex`:

```javascript
{ name: "Juan Soto", price: 72, pos: ["OF"], slotIndex: 5, draftedPos: "OF" }
```

### The Core Fix

```javascript
// OLD (broken): array index = slot — player always went to slot 0 (C)
const entry = team.roster[si];

// NEW (correct): look up by stored slotIndex
const entry = team.roster.find((r) => r.slotIndex === si);
```

### Position Eligibility Rules

- `BN` — any player, no restrictions
- `UTIL` — any hitter (has at least one non-SP/RP position)
- Standard slots — player's `pos` array must include the slot's position

### Inline Cell Search

Clicking an empty cell opens a mini search box *inside that cell — no navigation away from the draft board*:

```javascript
<InlineCellSearch
  pos={slotPos}        // used for filtering eligible players
  players={players}    // full undrafted pool
  onSelect={(player) => openSaleModal(player, si, slotPos)}
/>
```

---

## 6. Valuation Refresh Bug (Just Fixed)

### The Problem

Select a player in the player card. Another player gets drafted. The displayed valuation does not update — it shows stale numbers until you click away and back.

### The Analogy

> **Analogy:** Before the fix it was like a stock ticker that only updated when you clicked the symbol again. After the fix it auto-refreshes every time a trade happens anywhere in the market.

### Root Cause

```javascript
// OLD — broken
useEffect(() => {
  if (selectedPlayer && apiStatus === "online") fetchValuation(selectedPlayer);
}, [selectedPlayer?.id, apiStatus]);
// Making a pick changes neither selectedPlayer?.id nor apiStatus
// → effect never re-runs → valuation goes stale
```

### The Fix

```javascript
// Compact string: "3,1,0,2,..." — roster count per team
// Changes on every pick or undo, stays stable on all other state changes
const draftStateKey = league.teams.map(t => t.roster.length).join(",");

useEffect(() => {
  if (selectedPlayer && apiStatus === "online") fetchValuation(selectedPlayer);
}, [selectedPlayer?.id, apiStatus, draftStateKey]);
//                                  ^^^^^^^^^^^^
// React string comparison is cheap — only fires when roster counts actually change
```

---

## 7. State Management

### The Analogy

> **Analogy:** `App.jsx` is mission control. Each component is an astronaut with a specific job. They receive mission parameters as props (flowing down) and radio back results as callbacks (bubbling up). No astronaut makes their own calls to Houston.

### Where State Lives

```
App.jsx — the single source of truth
├── league          (teams, budgets, rosters, league config, scoring)
├── players         (313-player pool with drafted flags)
├── notes           ({ [playerId]: "scouting note text" })
├── currentOwnerIdx (index into league.teams — active drafter)
├── apiStatus       ("checking" | "online" | "offline")
└── screen          ("setup" | "main")
```

### Data Down, Events Up

```
App.jsx
├─→ DraftBoard   (league, players, onSale, onUndo, notes, saveNote)
│       sale confirmed → onSale() → App.recordSale() → updates league + players
├─→ PlayerDictionary (players, notes, saveNote)
├─→ LeagueSettings   (league, setLeague)
├─→ KeeperSetup      (league, setLeague, players)
├─→ TaxiSquad        (league, players, onTaxiPick)
└─→ ApiSandbox       (league, apiStatus)
```

### Immutable Updates — Why They Matter

```javascript
// CORRECT — new reference at every changed level
setLeague(prev => ({
  ...prev,
  teams: prev.teams.map(t => {
    if (t.id !== teamId) return t;       // unchanged: same reference, cheap
    return { ...t, budget_remaining: t.budget_remaining - price,
                   roster: [...t.roster, newEntry] };
  }),
}));

// WRONG — React will not detect this change → no re-render
league.teams[0].budget_remaining -= price;   // mutates in place
setLeague(league);                           // same reference → React skips
```

---

## 8. API Authentication and Security

### The Analogy

> **Analogy:** The license key is like a VIP wristband at a concert. No wristband, no entry. Rate limiting is the bartender cutting you off — 120 per minute is generous for normal use, but 500 at once and you are done until the next minute.

### License Key Check

```javascript
// middleware/auth.js
const VALID_KEYS = new Set((process.env.API_KEYS || "DB-2026-DEMO-0001").split(",").map(k => k.trim()));

function requireApiKey(req, res, next) {
  const key = req.headers["x-license-key"];
  if (!key)                 return res.status(401).json({ error: "Unauthorized", code: "NO_KEY" });
  if (!VALID_KEYS.has(key)) return res.status(401).json({ error: "Unauthorized", code: "INVALID_KEY" });
  next();
}
```

`GET /health` is intentionally unauthenticated — the frontend status indicator needs no key.

### Rate Limiting

```javascript
const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use(limiter); // applied globally before all routes
```

### CORS

Development: all origins allowed. Production: only `ALLOWED_ORIGINS` env var gets through — prevents third-party sites from exploiting the demo key.

---

## 9. Common Q&A You Will Likely Get Asked

---

**Q: Why not use a database?**

MVP scope decision. `players.json` is read-only — generated once per season, never written at runtime. Draft picks live in browser state because a draft is a single session event. No persistence, multi-user sync, or concurrent access is needed. A database adds connection management, schema migrations, and deployment complexity with zero benefit here. If this became a multi-league SaaS product, a database is the obvious next step.

---

**Q: Why separate the API from the frontend?**

Three reasons: **reusability** (mobile app or Discord bot could call the same endpoint), **independent deployment** (API can restart without touching the frontend), and **separation of concerns** (valuation math is business logic, not UI logic). The API does not know or care what the UI looks like.

---

**Q: How does the valuation algorithm handle two-way players like Ohtani?**

Ohtani has `"pos": ["DH", "SP"]` and `"era": null, "so": null`. The scoring function skips null stats: `if (val === null) return`. His score is computed entirely from batting — elite HR/RBI/SB/AVG lands him around $75. His pitching contribution is uncaptured in the current MVP; a future sprint would add pitcher-specific CSV data and sum both sides.

---

**Q: What happens if the API is offline?**

`apiStatus` flips to `"offline"` when the health check fails. `fetchValuation` is wrapped in try/catch — a network error does not crash the app. The player card falls back to `player.baseValue` from `players.json`. All pick recording, undo, budget tracking, and roster display work entirely in browser state with zero API dependency.

---

**Q: How do you prevent a player from being double-drafted?**

`recordSale()` sets `drafted: true` on the player atomically in the same state update as the roster change:

```javascript
setPlayers(prev => prev.map(p =>
  p.id === player.id ? { ...p, drafted: true, draftedBy: teamId } : p
));
```

Every search path — main search, inline cell search, Player Dictionary — filters out `drafted: true` players.

---

**Q: What is UTIL?**

Utility slot — accepts any non-pitcher. Catchers, infielders, outfielders, and DH are eligible; pure SP and RP are not. Gives managers flexibility when no good player is available for a specific position. Rules come from Yahoo Fantasy Sports and ESPN Fantasy's standard 5x5 format.

---

**Q: Why auction format instead of snake draft?**

Engineering: auction requires real-time valuation, multi-factor pricing, budget constraint math, and scarcity analysis — far more technically interesting. Game design: every manager gets an equal shot at every player. Snake draft gives permanent structural advantage to pick #1.

---

**Q: Why is the valuation stateless? Would not caching be faster?**

Statelessness is correct here. Draft state changes on every pick — undrafted pool shrinks, scarcity ratios shift, budgets change. Even 30-second cache means stale bids in a real-time auction. The algorithm reads `players.json` once on startup and runs in milliseconds — no meaningful performance gain from caching, and freshness is non-negotiable.

---

**Q: Why React useState and not Redux?**

One screen, one user. State complexity does not justify Redux boilerplate (actions, reducers, middleware, DevTools). React's built-in `useState` with immutable updates handles a dozen state variables cleanly. If the app grew to multi-user with complex shared state, Redux or Zustand would be the right upgrade.

---

**Q: Could this scale to AL players or mixed leagues?**

Yes. `generate-players.js` needs AL CSV files in the same format. The API already accepts `?league=AL` and `?league=ALL` on `GET /v1/players`. The valuation algorithm is completely pool-agnostic — it normalizes against whatever players are in the undrafted pool.

---

## 10. File Map (Quick Reference)

### API Server — `mvpfinal/api/`

| File | What It Does |
|---|---|
| `server.js` | Express entry point. CORS, rate limiting (120 req/min), body parsing, route registration. Interactive HTML testing sandbox at `GET /`. |
| `routes/valuate.js` | Handler for `POST /v1/valuate`. Validates inputs, calls `calculateValuation()`. |
| `routes/players.js` | Handler for `GET /v1/players`. Accepts league/pos/tier query params, calls `getPlayers()`. |
| `services/valuation.js` | The entire valuation engine: SGP scoring, scarcity analysis, inflation factor, reasoning builder. |
| `middleware/auth.js` | `requireApiKey`. Checks `X-License-Key` header against `API_KEYS` env var (Set for O(1) lookup). |
| `scripts/generate-players.js` | One-time data pipeline. Reads 3 NL CSVs, merges by player name, assigns tiers, computes PAR values, writes `players.json`. |
| `data/players.json` | 313 NL players. Loaded into memory on startup. Never written at runtime. |

### Frontend — `mvpfinal/draftkit/src/`

| File | What It Does |
|---|---|
| `App.jsx` | Root component, sole state owner. All draft action handlers: `recordSale`, `undoLast`, `undoSale`, `addTaxiPick`, `fetchPlayers`, `saveNote`. Tab routing. |
| `constants.js` | `API_BASE`, `DEMO_KEY`, `DEFAULT_ROSTER`, `DEFAULT_SCORING`, `POSITIONS`, `TIERS`, `POSITION_COLORS`, `VALUE_STEAL_THRESHOLD`, `VALUE_FAIR_THRESHOLD`. |
| `styles.css` | All CSS. Dark theme via custom properties. No CSS modules. |
| `utils/helpers.js` | Pure functions: `posColor()`, `buildRosterPositions()`, `buildDraftState()`, `calcMaxBid()`, `getValueClass()`, `formatStat()`. |
| `components/DraftBoard.jsx` | Main draft screen. 12-team grid, inline cell search, sale modal with slot picker, position eligibility, `draftStateKey` refresh fix, `InlineCellSearch` sub-component. |
| `components/PlayerCard.jsx` | Player detail panel. Tier badge, max bid (API or base value), stats, FPTS, API reasoning, scarcity label, editable notes. |
| `components/PlayerAvatar.jsx` | Circular avatar. Real photo if `photoUrl` set (with `onError` fallback); initials circle otherwise (deterministic color from name hash). |
| `components/PlayerDictionary.jsx` | Searchable player browser. Text, position, tier, and drafted filters. |
| `components/SetupScreen.jsx` | League configuration form. Fires `onInit(formValues)` on submit. |
| `components/LeagueSettings.jsx` | Toggle scoring categories, adjust roster slot counts. |
| `components/KeeperSetup.jsx` | Pre-draft keeper entry: owner, player name, contract cost. |
| `components/TaxiSquad.jsx` | $1 reserve picks after main auction; does not affect main budget. |
| `components/ApiSandbox.jsx` | Live API testing panel. Editable JSON payload, Send button, response display with status + latency. |

---

## Quick Cheat Sheet for the Day Of

```
What the app is:    Fantasy baseball auction draft coordinator with live valuation
Two processes:      API (Node/Express) + Frontend (React/Vite)
How they connect:   HTTP — POST /v1/valuate, GET /v1/players, GET /health
Player data:        313 NL players in data/players.json, built from 3 CSV sources
Merge priority:     projections > 2025 actuals > 3yr average (last write wins)
Valuation formula:  SGP score × position scarcity × market inflation × 0.92 = max bid
Grid fix:           slotIndex lookup (not array index) → players stay in correct columns
Refresh fix:        draftStateKey in useEffect deps → re-fetch after every pick/undo
State ownership:    All in App.jsx — flows down as props, events bubble up as callbacks
Auth:               X-License-Key header + 120 req/min rate limit + CORS whitelist
Offline fallback:   baseValue from players.json — full draft works without the API
No database:        Deliberate MVP scope cut — read-only data, single-session event
```

---

*Prepared for team review — March 2026*
