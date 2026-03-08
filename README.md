# DARKBLUE AUCTION DRAFT KIT

Fantasy Baseball Dynamic Auction Draft Kit — built by Dark Blue Software Solutions.

---

## Project Overview

A full-stack fantasy baseball auction draft tool with a live valuation engine. Two deployable products:

1. **Draft Kit Web App** (`mvpfinal/draftkit/`) — React 18 + Vite frontend for running a live auction draft
2. **Valuation API** (`mvpfinal/api/`) — Standalone Node.js/Express REST service for real-time player dollar-value calculation

## Live URLs

- Draft Kit Frontend: `https://dbdraftkit.onrender.com/`
- Valuation API Health: `https://draftapi.anythingavenue.com/health`

---

## What's Complete

| Feature | Status |
|---|---|
| Setup screen (league config) | ✅ Complete |
| Interactive draft board with teams table | ✅ Complete |
| Grid: click filled cell → remove confirmation modal | ✅ Complete |
| Grid: click empty cell → inline player search | ✅ Complete |
| Grid: hover filled cell → name/price/value/FPTS tooltip | ✅ Complete |
| Grid: hover empty cell → best available player tooltip | ✅ Complete |
| Grid: position scarcity counts in column headers | ✅ Complete |
| Grid: roster progress bar per team row (X/Y slots) | ✅ Complete |
| Grid: empty cell red tint when position pool is exhausted | ✅ Complete |
| Grid: summary footer row (picks/spend per slot column) | ✅ Complete |
| Grid: value indicator borders (steal / fair / overpaid) | ✅ Complete |
| Grid: position header click toggles search filter | ✅ Complete |
| Player search with autocomplete + position filter | ✅ Complete |
| Live valuation from API on player selection | ✅ Complete |
| Sale modal with API recommendation pre-fill | ✅ Complete |
| Sale modal: position slot picker for multi-eligible players | ✅ Complete |
| Sale modal: custom position eligibility override | ✅ Complete |
| Remove player confirmation modal (with budget refund info) | ✅ Complete |
| Undo last sale + targeted cell undo | ✅ Complete |
| Player Dictionary (browse, filter, notes) | ✅ Complete |
| League Settings (scoring categories + roster config) | ✅ Complete |
| Keeper Setup (pre-draft keeper contracts) | ✅ Complete |
| Taxi Squad ($1 reserve picks) | ✅ Complete |
| API Sandbox (raw JSON request tester) | ✅ Complete |
| Valuation API with SGP/PAR heuristic engine | ✅ Complete |
| API key authentication (X-License-Key header) | ✅ Complete |
| Rate limiting (120 req/min per IP) | ✅ Complete |
| NL sample data pipeline (3 CSV → players.json) | ✅ Complete |
| Modular React component architecture | ✅ Complete |
| Thorough code comments + JSDoc throughout | ✅ Complete |

---

## Repository Structure

```
DARKBLUE-DRAFTKIT-PROJECT/
├── .gitignore                          ← Root gitignore
├── README.md                           ← This file
│
├── docs/client-input/                  ← Client contract + scope docs
│   ├── README.md
│   ├── client_scope_notes_2026-02-20.txt
│   ├── master_requirements_2026-02-20.txt
│   └── Design Sketch.pdf
│
├── sample/
│   ├── MASTER_MVP.md                   ← MVP specification document
│   └── data/
│       ├── projections-NL.csv          ← 2025 NL projections (primary data source)
│       ├── 3Year-average-NL-stats.csv  ← 3-year historical averages
│       └── 2025-player-NL-stats.csv    ← 2025 actuals
│
├── mvpfinal/                           ← CURRENT MVP — production-ready code
│   ├── api/                            ← Valuation API (standalone Express server)
│   │   ├── server.js                   ← Entry point (port 3001)
│   │   ├── package.json
│   │   ├── .env.example                ← Copy to .env before running
│   │   ├── middleware/
│   │   │   └── auth.js                 ← X-License-Key authentication
│   │   ├── routes/
│   │   │   ├── valuate.js              ← POST /v1/valuate
│   │   │   └── players.js              ← GET /v1/players
│   │   ├── services/
│   │   │   └── valuation.js            ← SGP heuristic valuation engine
│   │   ├── data/
│   │   │   └── players.json            ← Generated player database (313 NL players)
│   │   └── scripts/
│   │       └── generate-players.js     ← CSV → players.json pipeline
│   │
│   └── draftkit/                       ← Draft Kit frontend (React 18 + Vite)
│       ├── index.html
│       ├── package.json
│       ├── vite.config.js
│       └── src/
│           ├── App.jsx                 ← Root: routing + state management
│           ├── main.jsx                ← React entry point
│           ├── styles.css              ← Global dark-theme styles
│           ├── constants.js            ← Shared constants (positions, defaults)
│           ├── utils/
│           │   └── helpers.js          ← Pure utility functions
│           └── components/
│               ├── PlayerAvatar.jsx    ← Avatar (photo or initials)
│               ├── PlayerCard.jsx      ← Detailed player stats card
│               ├── SetupScreen.jsx     ← League creation form
│               ├── DraftBoard.jsx      ← Main draft board + enhanced grid
│               ├── PlayerDictionary.jsx← Browsable player list
│               ├── LeagueSettings.jsx  ← Scoring + roster config
│               ├── KeeperSetup.jsx     ← Pre-draft keeper contracts
│               ├── TaxiSquad.jsx       ← $1 reserve picks screen
│               └── ApiSandbox.jsx      ← Raw API JSON tester
│
├── example/                            ← Earlier TypeScript/Next.js prototype (reference only)
└── figma/                              ← Design prototype with screenshots
```

---

## Quick Start

### 1. Start the Valuation API

```bash
cd mvpfinal/api
npm install
cp .env.example .env        # configure environment variables
npm run dev                 # starts on http://localhost:3001
```

Verify it's running:
```bash
curl http://localhost:3001/health
```

### 2. Start the Draft Kit Frontend

```bash
cd mvpfinal/draftkit
npm install
npm run dev                 # starts on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

### 3. Regenerate Player Data (optional)

If you modify the CSV files in `sample/data/`, regenerate the player database:

```bash
node mvpfinal/api/scripts/generate-players.js
```

This re-reads all three NL CSV files and writes a fresh `mvpfinal/api/data/players.json`.

---

## API Reference

See [`docs/API.md`](./docs/API.md) for the full API reference with request/response schemas and examples.

**Quick endpoints:**

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | None | Health check |
| GET | `/` | None | API info |
| POST | `/v1/valuate` | X-License-Key | Player valuation |
| GET | `/v1/players` | X-License-Key | Player pool with filters |

**Demo API key:** `DB-2026-DEMO-0001`

---

## Draft Board — Grid Interaction Guide

### Cell Interactions

| Action | Result |
|---|---|
| Click a **filled cell** | Opens "Remove Player" confirmation modal. Shows team, slot, price paid, and budget refund amount. Confirms removal and returns player to available pool. |
| Click an **empty cell** | Opens an inline search box inside the cell. Shows players eligible for that position slot. Selecting a player opens the full Sale modal pre-filled for that team and slot. |
| **Hover a filled cell** | Shows tooltip: name, slot position (color-coded), price paid, base value, FPTS, and "click to remove" hint. |
| **Hover an empty cell** | Shows tooltip: position label, number of available players, best available player name and value. |
| Click a **column header** (position badge) | Toggles the position filter in the bottom search bar. Re-click to clear filter. |
| Click a **team row** | Sets that team as the active "drafting owner" (highlights row in green). |
| Click **Undo Last** | Removes the most recently recorded sale (any team) and refunds budget. |
| Press **Escape** | Closes any open modal or inline cell search. |
| Press **Enter** (in bid input) | Confirms the sale. |

### Grid Visual Indicators

| Indicator | Meaning |
|---|---|
| **Green left border** on filled cell | Steal — paid less than 80% of base value |
| **Red left border** on filled cell | Overpaid — paid more than 120% of base value |
| **No left border** on filled cell | Fair value (80–120% of base value) |
| **▲ arrow** on cell | Steal indicator |
| **▼ arrow** on cell | Overpaid indicator |
| **Number below position header** | Count of undrafted players still eligible at that position. Green = plenty, yellow = few (< 3), red = none |
| **Mini progress bar** under team name | Roster completion: green = normal, amber = >80% full |
| **X/Y label** under team name | Slots filled / total slots |
| **Subtle red tint** on empty cell | No players left in pool for that position |
| **Summary footer row** | Picks-per-slot across all teams (green = 100% filled) and total league spend |

---

## Adding Real Player Photos

Player photos are not included in the default build. To add headshots:

1. Set `photoUrl` on player entries in `mvpfinal/api/data/players.json`:
   ```json
   { "name": "Shohei Ohtani", "photoUrl": "https://your-cdn.com/ohtani.jpg", ... }
   ```

2. The `PlayerAvatar` component (`src/components/PlayerAvatar.jsx`) reads this field automatically and displays the image, falling back to initials if the image fails to load.

3. MLB official headshot URLs follow this format:
   ```
   https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{MLB_PLAYER_ID}/headshot/67/current
   ```

See `PlayerAvatar.jsx` for full implementation notes.

---

## Environment Variables

**API (`mvpfinal/api/.env`):**

```env
PORT=3001
API_KEYS=DB-2026-DEMO-0001,DB-2026-PROD-XXXX
ALLOWED_ORIGINS=http://localhost:5173,https://dbdraftkit.onrender.com
NODE_ENV=development
```

---

## Deployment

- **Valuation API** → Deployed at `https://draftapi.anythingavenue.com` (health at `/health`)
- **Draft Kit Frontend** → Deployed on Render at `https://dbdraftkit.onrender.com/`
- Ensure API CORS `ALLOWED_ORIGINS` includes `https://dbdraftkit.onrender.com`

---

## Data Sources

All player data sourced from NL-only CSV files in `sample/data/`:

| File | Description | Rows |
|---|---|---|
| `projections-NL.csv` | Projected 2025 stats (primary) | 2,220 |
| `3Year-average-NL-stats.csv` | 3-year historical averages | 2,220 |
| `2025-player-NL-stats.csv` | 2025 actuals/estimates | 2,220 |

The pipeline (`generate-players.js`) merges them by player name, filters to FPTS ≥ 100, assigns tiers and auction values using a PAR/SGP formula, producing **313 draftable players**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5 |
| Backend API | Node.js, Express 4 |
| Data pipeline | Node.js (no external dependencies) |
| Auth | API key via `X-License-Key` header |
| Styling | Custom CSS (dark theme, CSS custom properties) |
| Player data | JSON file (no database required) |

---

*Dark Blue Software Solutions — Client: Richard McKenna — Season 2025/2026*
