# Dark Blue Draft Kit — API & Website Architecture

> **Audience:** Non-technical stakeholders, product managers, and developers new to the codebase.
> This document explains the full system in plain English with technical depth where it matters.
> Analogies are labeled clearly so they can be skipped by readers who want raw technical detail.

---

## The 30-Second Pitch

**What it does:**
Dark Blue Draft Kit is a real-time auction draft assistant for fantasy baseball. During a live auction draft, a user nominates a player, and the app instantly calculates the maximum price that user should pay — accounting for budget, roster needs, remaining player supply, and what other teams are spending.

**What problem it solves:**
Auction fantasy drafts move fast. Bidding on the wrong player, or overpaying because you lost track of league-wide spending, can ruin a season in the first hour. This tool does the math live, so the user can focus on strategy rather than spreadsheets.

**Who uses it:**
Fantasy baseball players running auction drafts — typically leagues of 10–12 owners, each with a fixed budget (e.g., $260) to fill a 23-player roster. The tool is used in the minutes before and during a 3–4 hour live draft session.

---

## The Restaurant Analogy — How the API and Website Work Together

> **Analogy: A Restaurant**

Imagine a restaurant. The parts map directly to the parts of this system.

| Restaurant Component | System Component | What It Does |
|---|---|---|
| The dining room and menu | **React Frontend** | What users see and click. Renders the player list, draft board, budget tracker, and bid recommendations. |
| The kitchen | **Express API (backend)** | Where the actual calculation work happens. Users never see it directly. |
| The waiters | **HTTP requests (fetch)** | Carry the user's "order" (draft state) from the dining room to the kitchen and bring back the result (valuation). |
| The pantry | **players.json** | Pre-stocked with all 313 players and their stats before the draft starts. The kitchen reads from it on every order. |
| The head chef | **valuation.js** | Takes in a full picture of the draft situation and produces a single recommended bid. |
| Reservations-only policy | **CORS** | Only browsers from pre-approved origins are allowed to place orders. Random external requests are turned away at the door. |
| The restaurant's address | **draftapi.anythingavenue.com** | The public URL where the kitchen accepts orders in production. |

The key insight: **the dining room and the kitchen are completely separate buildings.** The frontend (React) does not contain the valuation math. It only knows how to display results. This means the kitchen can be upgraded, moved, or used by a completely different dining room (e.g., a mobile app) without changing the menus.

---

## System Diagram

```
+-----------------------------------------------------------------------------+
|                            USER'S BROWSER                                   |
|                                                                             |
|   +---------------------------------------------------------------------+  |
|   |                     REACT FRONTEND (Vite)                           |  |
|   |                                                                     |  |
|   |   App.jsx ---- DraftBoard.jsx ---- PlayerCard.jsx                  |  |
|   |      |               |                   |                         |  |
|   |      +------- league{} state             +-- valuation{}           |  |
|   |             (teams, rosters, budgets)         (max bid, reasoning)  |  |
|   |                                                                     |  |
|   |   Dev:  http://localhost:5173                                       |  |
|   |   Prod: static files served from build output                      |  |
|   +------------------------+--------------------------------------------+  |
|                            |                                                |
+----------------------------+-------------------------------------------------+
                             |
                             |  HTTP POST /v1/valuate
                             |  Headers: X-License-Key: DB-2026-DEMO-0001
                             |  Body: { nominated_player, teams[], budgets, ... }
                             |
                             v  (HTTP GET /v1/players on startup)
                             |
+----------------------------+-------------------------------------------------+
|                       EXPRESS API (Node.js)                                 |
|                                                                             |
|   Dev:  http://localhost:3001                                               |
|   Prod: https://draftapi.anythingavenue.com                                |
|                                                                             |
|          +------------------+                                               |
|          |   server.js      |  <- Entry point. Registers all middleware.    |
|          +--------+---------+                                               |
|                   |                                                         |
|          +--------v------------------+                                      |
|          |  Middleware Stack          |                                     |
|          |  1. CORS check            |  <- Approved origin?                |
|          |  2. Rate limiter          |  <- Max 120 req/min per IP          |
|          |  3. Auth (license key)    |  <- Valid X-License-Key header?     |
|          +--------+------------------+                                      |
|                   |                                                         |
|          +--------v------------------------+                                |
|          |  routes/valuate.js              |  <- POST /v1/valuate          |
|          |  routes/players.js              |  <- GET /v1/players           |
|          +--------+------------------------+                                |
|                   |                                                         |
|          +--------v--------------------------------------------+           |
|          |  services/valuation.js  (The Head Chef)              |           |
|          |                                                      |           |
|          |  1. Load players.json (the pantry)                   |           |
|          |  2. Find nominated player (fuzzy name match)         |           |
|          |  3. Compute pool statistics (mean/std per stat)      |           |
|          |  4. Run SGP scoring (stats → dollar value)           |           |
|          |  5. Apply scarcity multiplier (supply vs. demand)    |           |
|          |  6. Apply inflation factor (budget concentration)    |           |
|          |  7. Return max bid + reasoning text                  |           |
|          +--------+--------------------------------------------+           |
|                   |                                                         |
|          +--------v--------+                                                |
|          |  players.json   |  <- 313 NL players, pre-computed stats        |
|          |  (The Pantry)   |     generated from season CSV pipeline        |
|          +-----------------+                                                |
|                                                                             |
+-----------------------------------------------------------------------------+

  Response JSON:
  {
    "max_bid_recommendation": 38,
    "true_dollar_value": 41.2,
    "reasoning": "Elite power hitter. SS scarcity (1.18x). Mild inflation (1.06x).",
    "position_scarcity": { "position": "SS", "multiplier": 1.18 }
  }
```

---

## The Full Request/Response Journey

> **Analogy: Placing a restaurant order.**
> Every step below is one step in the journey from a user clicking a player to seeing a bid recommendation on screen.

**Scenario:** The user clicks on a shortstop in the player search list to see how much they should bid.

### Step 1 — User clicks a player in the search list (Frontend)

The user's mouse click fires an `onClick` handler. `setSelectedPlayer(player)` is called, storing the selected player in React state in `App.jsx`.

### Step 2 — `useEffect` detects `selectedPlayer?.id` change

A `useEffect` hook watches `[selectedPlayer?.id, apiStatus, draftStateKey]`. When any of these changes, it triggers the API call. Watching the `.id` (not the entire object) prevents unnecessary re-triggers when unrelated parts of the player object update.

### Step 3 — Frontend POSTs to `/v1/valuate`

```js
fetch(`${API_BASE}/v1/valuate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-License-Key': 'DB-2026-DEMO-0001'
  },
  body: JSON.stringify({
    license_key: 'DB-2026-DEMO-0001',
    draft_state: {
      nominated_player: selectedPlayer.name,
      total_teams: league.owners,
      budget_per_team: league.budget,
      teams: league.teams,        // all teams with current rosters + budgets
      scoring_categories: [...],  // which stats are active (e.g. HR, RBI, AVG)
      roster_config: { C:1, "1B":1, OF:3, ... }
    }
  })
})
```

### Step 4 — `server.js` passes through the middleware stack

Three gates in sequence:
1. **CORS** — checks `Origin` header against `ALLOWED_ORIGINS`. Not on the list → 403.
2. **Rate limiter** — this IP in the last 60 seconds > 120 requests → 429.
3. **Auth** — `X-License-Key` not in `API_KEYS` env var → 401.

### Step 5 — `routes/valuate.js` calls `calculateValuation(draftState)`

The route handler validates the request body shape, then calls the core service. Routing and calculation are kept separate by design.

### Step 6 — `services/valuation.js` runs the algorithm

The head chef fires. In order: load `players.json`, find the nominated player (fuzzy name match), compute pool stats for the undrafted pool, run SGP scoring, analyze scarcity, compute inflation, combine all factors into a recommended max bid, build a human-readable reasoning string.

### Step 7 — Frontend receives the response

```js
setValuation(data);
// -> PlayerCard re-renders with new max_bid_recommendation
// -> reasoning text updates
// -> position_scarcity badge updates
```

### Step 8 — draftStateKey also auto-triggers re-valuation

When any team drafts a player (`onSale` callback fires in `App.jsx`), roster counts per team change. The `draftStateKey` string changes. This causes the same `useEffect` to re-fire for the currently selected player — fetching a fresh valuation with updated league state. Max bid adjusts in real time as the draft progresses.

---

## The Data Flow Diagram

```
                            APP.jsx
                    (The single source of truth)
              ─────────────────────────────────────────
              State owned here:
              |  league{}           → teams[], each with:
              |                        budget_remaining
              |                        roster[] (slotIndex + player)
              |  players[]          → 313-player pool (drafed flag)
              |  notes{}            → keyed by player ID
              |  currentOwnerIdx    → whose turn it is
              |  apiStatus          → 'online' | 'offline'
              |
              |  DATA FLOWS DOWN AS PROPS ↓
              |  EVENTS FLOW UP AS CALLBACKS ↑
              |
     ┌────────┴────────┬──────────────────┬───────────────┐
     │                 │                  │               │
┌────▼─────┐   ┌───────▼──────┐   ┌──────▼─────┐  ┌──────▼──────┐
│DraftBoard│   │  PlayerCard  │   │PlayerDictio│  │LeagueSettings│
│          │   │              │   │  nary      │  │              │
│reads:    │   │reads:        │   │reads:      │  │reads:        │
│  league  │   │  player      │   │  players[] │  │  league      │
│  players │   │  valuation   │   │  notes{}   │  │              │
│          │   │  notes{}     │   │            │  │fires UP:     │
│fires UP: │   │              │   │fires UP:   │  │  setLeague   │
│  onSale  │   │fires UP:     │   │  saveNote  │  └─────────────┘
│  onUndo  │   │  saveNote    │   └────────────┘
└──────────┘   └─────────────┘

CALLBACKS FLOW UP (child → parent):
  onSale(player, price, teamId, slotIndex, draftedPos) → updates league roster + budget
  onUndo()                                             → reverses last sale
  saveNote(playerId, text)                             → updates notes{}
  setSelectedPlayer(player)                            → triggers API valuation call
```

**The one-way data flow rule:** Data always moves down (props). Instructions to change data always move up (callbacks). Components never modify shared state directly. If a bid shows up wrong, there is exactly one place to look: `App.jsx`.

---

## Three Key Engineering Decisions and Why

### 1. Slot-Indexed Roster Storage

**What it is:**
Each drafted player stores an explicit `slotIndex` — which column they belong to in the draft grid (`0` = C, `1` = 1B, `5` = first OF, etc.).

**Why not just use array position?**
If array index determines slot, then the 3rd player added to any team always appears in column 3 — regardless of their position. Undo a pick or add players out of order and everything shifts. Silent, hard-to-debug data corruption.

**The fix:**
```js
// OLD (buggy): uses array index as slot identity
const entry = team.roster[si];

// NEW (correct): looks up by stored slotIndex
const entry = team.roster.find((r) => r.slotIndex === si);
```

> **Analogy:** Think of assigned seating at a wedding vs. open seating. Open seating means people sit wherever there's a chair — if someone leaves, everyone shifts. Assigned seating means Guest 7 sits at Table 2, Seat 3 regardless of who arrived first or who left.

---

### 2. API-Frontend Separation

**What it is:** Valuation logic lives in an independent Node.js service, not bundled into the React app.

**Why it matters:**
- The API can be updated (new formula, new season data) without touching or redeploying the frontend.
- A future mobile app or third-party integration can call the same API without duplicating the math.
- If the API goes down, the frontend still loads and functions with offline fallback values.
- Authentication and rate limiting live on the API side — the frontend has no secrets in it.

**The cost:** More deployment complexity. Two services to run locally (`npm run dev` + `node server.js`).

> **Analogy:** The difference between a food truck (everything in one vehicle, easy to park, hard to scale) and a restaurant with a dedicated kitchen. The food truck is simpler until you need to serve 200 people, or open a second location.

---

### 3. The `draftStateKey` Pattern for Reactive Valuations

**The problem:** The `useEffect` should re-run whenever the draft state changes. Adding the entire `league` object to deps causes excessive API calls — every keystroke in any input field triggers a refetch.

**The solution:**
```js
// Compact fingerprint: "4,3,2,4,3,..." — roster count per team
// Changes only when a player is drafted or removed
const draftStateKey = league.teams
  .map((t) => t.roster.length)
  .join(",");

useEffect(() => {
  if (selectedPlayer && apiStatus === "online") fetchValuation(selectedPlayer);
}, [selectedPlayer?.id, apiStatus, draftStateKey]);  // ← draftStateKey added
```

React compares strings cheaply (O(n) character comparison). The effect only fires when roster counts actually change — not on any other league state change.

> **Analogy:** Instead of re-reading a 300-page report to check if anything changed, check the page count written on the cover. If the number's the same, nothing material changed. If it's different, read the new pages.

---

## What "Offline Mode" Looks Like

When the API is unreachable, the frontend degrades gracefully rather than crashing.

**What the user sees:**
- A **red dot** in the navigation bar (vs. the normal green "API Connected" indicator)
- `PlayerCard` shows `player.baseValue` (pre-computed offline estimate) instead of a live API recommendation
- All draft functionality continues to work fully

**What still works offline:**
- Draft grid — logging picks, tracking budgets, managing roster slots
- Undo functionality
- Position eligibility enforcement
- Notes on players

**What requires the API:**
- Live max bid calculations accounting for current draft state (inflation, scarcity, actual remaining pool)

> **Analogy:** GPS with no data signal. Falls back to the last downloaded map. You can still navigate — you just don't get live traffic or re-routing. The roads are still there; you just might miss the accident on I-95.

---

## Security Model

Four layers, applied in order on every request:

| Layer | Mechanism | What It Blocks |
|---|---|---|
| 1. CORS | Origin header check vs. `ALLOWED_ORIGINS` env var | Requests from unauthorized websites |
| 2. Rate limiting | 120 req/min per IP (express-rate-limit) | Abuse, infinite loops, scraping |
| 3. Auth | `X-License-Key` header vs. `API_KEYS` env var | Unauthorized API consumers |
| 4. HTTPS | TLS certificate (prod only) | Network interception of key + data |

**Environment variables that control security:**

| Variable | Purpose | Example |
|---|---|---|
| `API_KEYS` | Valid license keys (comma-separated) | `DB-2026-DEMO-0001,key-prod-xyz` |
| `ALLOWED_ORIGINS` | CORS allow list | `https://draftkit.anythingavenue.com` |
| `PORT` | Server port | `3001` |
| `VITE_API_BASE` | API URL baked into frontend at build time | `https://draftapi.anythingavenue.com` |

> **Analogy for the license key:** A VIP wristband at a concert. No wristband = no entry, even if you know the venue address. Rate limiting stops one person from trying to buy out the entire bar.

---

## The Player Valuation Formula (Plain English)

The core question: **"How many real dollars should this player cost in an auction draft with a $260 budget?"**

### Step 1 — SGP Scoring: Stats → Points → Dollars

**SGP (Standings Gain Points)** measures how much one player moves the needle in a roto league.

For each scoring category (HR, RBI, SB, R, AVG for hitters; ERA, WHIP, K, W, SV for pitchers):

1. Calculate the average contribution across all *remaining undrafted* players.
2. This player's contribution above that average = their SGP score in that category.
3. Sum across all scoring categories → one total SGP score.
4. Divide by total pool SGP → this player's share of total pool value.
5. Multiply by total spendable budget → dollar value.

**Example:** If total auction money left is $2,400 and this player represents 1.8% of total pool value → `$2,400 × 0.018 = $43.20` base value.

### Step 2 — Scarcity Multiplier: Supply vs. Demand

```
eligible_remaining  = undrafted players eligible at this position
slots_remaining     = open roster spots for this position across all teams

if eligible_remaining < slots_remaining:
    multiplier = slots_remaining / eligible_remaining  (e.g. 1.35x)
else:
    multiplier = 1.0  (no scarcity, no adjustment)
```

**Example:** 8 SS slots remain unfilled. Only 6 SS-eligible players remain undrafted. Multiplier = `8/6 = 1.33`. Every SS's value increases by 33%.

> **Analogy:** Umbrellas cost $5 on a sunny day and $20 in a rainstorm. The umbrella didn't get better — supply got scarce relative to demand.

### Step 3 — Inflation Factor: Late-Draft Budget Concentration

When teams overspend on stars early, remaining budget concentrates. Players who would normally cost $30 start going for $40+ because fewer teams have budget left.

```
remaining_budget  = sum of all teams' remaining budgets
expected_budget   = what you'd expect this deep into a normal draft
inflation_factor  = remaining_budget / expected_budget (clamped 0.85–1.45)
```

### Step 4 — Max Bid = 92% of True Value

```
true_dollar_value = sgp_base × scarcity_multiplier × inflation_factor
max_bid           = round(true_dollar_value × 0.92)
```

The 8% discount gives a margin so you never go all-in on any single player.

> **Analogy:** Like eBay's "max bid" feature — the algorithm calculates what the player is truly worth, then bids a little under to leave room to outbid competitors while keeping something in reserve.

---

## Production vs. Development Differences

| Setting | Development | Production |
|---|---|---|
| API URL | `http://localhost:3001` | `https://draftapi.anythingavenue.com` |
| Frontend URL | `http://localhost:5173` (Vite dev server) | Static HTML/JS/CSS bundle |
| How API URL is set | `.env` fallback constant in `constants.js` | `VITE_API_BASE` env var at build time |
| CORS origins | `localhost:5173` allowed | Production domain only |
| HTTPS | No | Yes (required) |
| `players.json` | Local file | Same file, deployed with API |

**How `VITE_API_BASE` works:**

Vite bakes environment variables into the JS bundle at **build time** — not runtime. This means:
- Running `VITE_API_BASE=https://draftapi.anythingavenue.com npm run build` produces a bundle permanently pointing to production.
- There is no runtime config file to misconfigure.
- Changing targets requires a rebuild — this is deliberate; there's no accidental production traffic from a dev machine.

---

## Technology Choices with Reasoning

### React + Vite

The draft board is a highly interactive, stateful UI — many components update simultaneously when a player is drafted (budget panel, roster grid, valuation card, player list). React's component model handles this naturally. Vite's dev server starts in under a second and hot-reloads instantly, which matters during rapid debugging sessions.

### Express.js

Two routes, minimal logic. Express handles this without the overhead of larger frameworks. The entire server setup is under 80 lines of code. Any Node.js developer can read it immediately.

### No Database

1. **Players are static within a season.** `players.json` is read-only at runtime.
2. **Draft state lives in the browser session.** A draft is a single session event. Persisting to a DB adds write operations, connection management, and deployment complexity with no benefit for this use case.
3. **Deployment is a single `node server.js`.** Zero external service dependencies.

> **Analogy:** A whiteboard in a meeting room. You don't need a filing cabinet to write on a whiteboard during a meeting. When the meeting ends, the whiteboard gets erased. If you needed permanent records, you'd take a photo — but this system doesn't need permanent records (yet).

### File-Based Player Data

`players.json` is committed to source control. You can see exactly what changed between the 2025 and 2026 player pools with a standard `git diff`. The update workflow is a single script run and a deployment:

```
Download new CSVs → node generate-players.js → players.json regenerated → deploy
```

---

## File Map (Quick Reference)

```
mvpfinal/
├── api/
│   ├── server.js                   Entry point. Middleware + route registration.
│   ├── routes/
│   │   ├── valuate.js              POST /v1/valuate handler
│   │   └── players.js              GET /v1/players handler
│   ├── services/
│   │   └── valuation.js            SGP scoring + scarcity + inflation algorithm
│   ├── middleware/
│   │   └── auth.js                 X-License-Key authentication
│   ├── data/
│   │   └── players.json            313 NL players (generated by script)
│   └── scripts/
│       └── generate-players.js     CSV → players.json pipeline
│
└── draftkit/
    └── src/
        ├── App.jsx                 Root component. All shared state lives here.
        ├── constants.js            API_BASE, DEMO_KEY, DEFAULT_ROSTER, colors, etc.
        ├── styles.css              Global dark theme CSS
        ├── utils/
        │   └── helpers.js          posColor, calcMaxBid, getValueClass, formatStat
        └── components/
            ├── DraftBoard.jsx      Main draft grid, inline search, sale modal
            ├── PlayerCard.jsx      Player detail panel (stats, valuation, notes)
            ├── PlayerAvatar.jsx    Photo/initials avatar component
            ├── PlayerDictionary.jsx Full searchable player browser tab
            ├── SetupScreen.jsx     League configuration form
            ├── LeagueSettings.jsx  Scoring categories + roster slot editor
            ├── KeeperSetup.jsx     Keeper entry form (pre-draft)
            ├── TaxiSquad.jsx       Minor league reserve management
            └── ApiSandbox.jsx      Live API testing panel in the UI
```

---

## Glossary

| Term | Plain English Definition |
|---|---|
| **API** | A service that other programs call to get data or trigger actions. Here: the valuation engine. |
| **REST** | A style of API where each URL is a resource and HTTP methods (GET, POST) are actions on it. |
| **CORS** | A browser security rule that prevents websites from silently calling APIs on other domains unless that API allows it. |
| **SGP** | Standings Gain Points. Measures how much a player improves a fantasy team's standings position. |
| **Inflation** | In auction drafts: remaining player prices rise above true value because teams overspent early. |
| **Scarcity multiplier** | A factor applied to a player's value when their position has fewer available players than open roster slots. |
| **useEffect** | A React hook that runs a function when specified values change. Used here to trigger API calls. |
| **Props** | In React, data passed from a parent component down to a child. Read-only from the child's perspective. |
| **draftStateKey** | A compact string like `"4,3,2,4,3"` (roster count per team) used as a React dependency to detect draft state changes efficiently. |
| **Vite** | The frontend build tool. Takes React/JSX source files and produces optimized HTML/CSS/JS for deployment. |
| **baseValue** | Pre-computed offline player value stored in `players.json`. Used as fallback when the API is offline. |
| **slotIndex** | The column number in the draft grid where a player was placed. Stored on every roster entry to prevent silent slot assignment bugs. |

---

*Document version: MVP Final — Spring 2026*
