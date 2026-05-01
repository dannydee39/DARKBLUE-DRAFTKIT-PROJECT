# Dark Blue Valuation API — Documentation

> Deprecated mirror: this file reflects an older pre-Sprint-4 contract and is no longer the source of truth.
> Use `mvpfinal/valuation-api/API_DOCS.md` for the active API contract and `mvpfinal/valuation-site/` for the buyer-facing endpoint copy.

**Version:** 1.0.0
**Base URL (local dev):** `http://localhost:3001`
**Base URL (production):** `https://darkblueapi.anythingavenue.com`
**Demo Key:** `DB-2026-DEMO-0001`

---

## Overview

The Dark Blue Valuation API is a stateless REST service for fantasy baseball auction draft valuation. It accepts a complete snapshot of the current draft state and returns real-time bid recommendations for nominated players.

### Key Design Principles

- **Stateless** — every request includes the full draft state. No session or database.
- **Replacement-level anchoring** — player dollar values are anchored to pre-computed PAR (Points Above Replacement) values. Real-time inflation and scarcity adjustments are layered on top.
- **Market inflation** — compares remaining league budget to expected spend curve to detect market deflation/inflation.
- **Position scarcity** — detects supply/demand imbalance at a position (remaining slots vs. undrafted eligible players).

---

## Authentication

All endpoints except `/health` and `/` require an API key passed as an HTTP header:

```
X-License-Key: DB-2026-DEMO-0001
```

You may also pass the key in the JSON body as `license_key` for the valuate endpoint:
```json
{ "license_key": "DB-2026-DEMO-0001", "draft_state": { ... } }
```

**Response on invalid key:**
```json
HTTP 401
{ "error": "Unauthorized", "message": "Invalid or missing API key." }
```

---

## Rate Limiting

- **120 requests per minute per IP address**
- Rate limit headers are included in all responses (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`)
- **429 Too Many Requests** is returned when the limit is exceeded:

```json
HTTP 429
{ "error": "Too Many Requests", "message": "Rate limit exceeded. Please wait 60 seconds." }
```

---

## Endpoints

### 1. Health Check

```
GET /health
```

Returns service status. **No authentication required.**

**Response:**
```json
{
  "status": "online",
  "service": "Dark Blue Valuation API",
  "version": "1.0.0",
  "timestamp": "2025-03-06T12:00:00.000Z",
  "environment": "production"
}
```

---

### 2. Player Pool

```
GET /v1/players
```

Returns the ranked player database with optional filters. Used by the Draft Kit frontend to populate its search and recommendation panels.

**Authentication:** `X-License-Key` header required.

#### Query Parameters

| Parameter | Type   | Default | Description |
|-----------|--------|---------|-------------|
| `league`  | string | `ALL`   | Filter by league pool: `NL`, `AL`, or `ALL` |
| `pos`     | string | `ALL`   | Filter by position: `C`, `1B`, `2B`, `3B`, `SS`, `OF`, `SP`, `RP` |
| `tier`    | string | `ALL`   | Filter by tier: `Elite`, `Starter`, `Bench` |
| `drafted` | string | —       | Comma-separated list of already-drafted player names to exclude |

#### Example Request

```bash
curl -H "X-License-Key: DB-2026-DEMO-0001" \
  "http://localhost:3001/v1/players?league=NL&tier=Elite"
```

#### Response Schema

```json
{
  "count": 20,
  "players": [
    {
      "id": 1,
      "name": "Shohei Ohtani",
      "team": "LAD",
      "league": "NL",
      "pos": ["DH", "SP"],
      "tier": "Elite",
      "baseValue": 75,

      // Batting stats (projected)
      "hr": 48,
      "rbi": 112,
      "r": 102,
      "sb": 22,
      "avg": "0.288",
      "obp": "0.381",
      "slg": "0.574",

      // Pitching stats (null for hitters, populated for pitchers/two-way)
      "era": null,
      "so": null,
      "whip": null,
      "w": null,
      "sv": null,

      // Metadata
      "fpts": 842,
      "depth": "Elite",
      "injury": null,
      "note": null,

      // Photo integration hook — set to a URL to display player headshot.
      // See PlayerAvatar.jsx for instructions.
      "photoUrl": null
    }
  ]
}
```

#### Player Object Fields

| Field       | Type           | Description |
|-------------|----------------|-------------|
| `id`        | integer        | Sequential ID (1-based, sorted by FPTS descending) |
| `name`      | string         | Player full name |
| `team`      | string         | MLB team abbreviation (e.g. `"LAD"`) |
| `league`    | string         | `"NL"` or `"AL"` |
| `pos`       | string[]       | Position eligibility array (e.g. `["SS", "2B"]`) |
| `tier`      | string         | `"Elite"` (top 20) / `"Starter"` (21–75) / `"Bench"` (76+) |
| `baseValue` | integer        | Pre-computed auction dollar value ($1–$80) using PAR formula |
| `hr`        | integer        | Home runs (projected) |
| `rbi`       | integer        | RBI (projected) |
| `r`         | integer        | Runs (projected) |
| `sb`        | integer        | Stolen bases (projected) |
| `avg`       | string         | Batting average (3-decimal string, e.g. `"0.297"`) |
| `obp`       | string         | On-base percentage |
| `slg`       | string         | Slugging percentage |
| `era`       | string\|null   | ERA (pitchers only; `null` for hitters) |
| `so`        | integer\|null  | Strikeouts (pitchers only) |
| `whip`      | string\|null   | WHIP (pitchers only) |
| `w`         | integer\|null  | Wins (pitchers only) |
| `sv`        | integer\|null  | Saves (pitchers only) |
| `fpts`      | integer        | Raw projected fantasy points (used for sorting) |
| `depth`     | string         | Mirrors `tier` — depth chart label |
| `injury`    | string\|null   | Injury note string or `null` |
| `note`      | string\|null   | Scout/analyst note or `null` |
| `photoUrl`  | string\|null   | Player headshot URL or `null` (see `PlayerAvatar.jsx` for integration) |

---

### 3. Player Valuation

```
POST /v1/valuate
```

The core endpoint. Accepts a full draft state snapshot and returns a real-time valuation for the nominated player.

**Authentication:** `X-License-Key` header required.
**Content-Type:** `application/json`

#### Request Body Schema

```json
{
  "license_key": "DB-2026-DEMO-0001",
  "draft_state": {
    "nominated_player": "string (required)",
    "total_teams": 12,
    "budget_per_team": 260,
    "scoring_categories": ["R", "HR", "RBI", "SB", "AVG", "W", "SV", "ERA", "WHIP", "SO"],
    "teams": [
      {
        "id": 1,
        "budget_remaining": 220,
        "roster": ["Juan Soto", "Freddie Freeman"]
      }
    ],
    "roster_config": {
      "C": 1, "1B": 1, "2B": 1, "3B": 1, "SS": 1,
      "OF": 3, "SP": 2, "RP": 2, "UTIL": 1, "BN": 2
    }
  }
}
```

#### Request Body Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `draft_state.nominated_player` | string | **Yes** | — | Name of the player being nominated (case-insensitive, partial match supported) |
| `draft_state.total_teams` | integer | No | `12` | Number of teams in the league |
| `draft_state.budget_per_team` | integer | No | `260` | Starting budget per team in dollars |
| `draft_state.scoring_categories` | string[] | No | `["HR","RBI","AVG","SB","ERA","SO","WHIP"]` | Active scoring categories (used for normalized scoring calc) |
| `draft_state.teams` | object[] | No | `[]` | Array of team state objects. Missing teams default to full budget, empty roster. |
| `draft_state.teams[].id` | integer | Yes (if provided) | — | Team ID |
| `draft_state.teams[].budget_remaining` | integer | Yes (if provided) | `budget_per_team` | Team's current remaining budget |
| `draft_state.teams[].roster` | string[] | Yes (if provided) | `[]` | Array of drafted player **names** (not objects) |
| `draft_state.roster_config` | object | No | Standard 15-slot | Slot counts per position (e.g. `{ "OF": 3, "BN": 2 }`) |

#### Scoring Categories

Recognized values for `scoring_categories`:

| Category | Type | Description |
|----------|------|-------------|
| `HR`     | Hitting | Home runs |
| `RBI`    | Hitting | Runs batted in |
| `R`      | Hitting | Runs scored |
| `SB`     | Hitting | Stolen bases |
| `AVG`    | Hitting | Batting average |
| `OBP`    | Hitting | On-base percentage |
| `SLG`    | Hitting | Slugging percentage |
| `ERA`    | Pitching | Earned run average (lower is better — inverted for scoring) |
| `WHIP`   | Pitching | Walks + Hits per inning pitched (inverted) |
| `SO`     | Pitching | Strikeouts |
| `W`      | Pitching | Wins |
| `SV`     | Pitching | Saves |

#### Example Requests

**Early draft — Juan Soto nomination:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-License-Key: DB-2026-DEMO-0001" \
  -d '{
    "license_key": "DB-2026-DEMO-0001",
    "draft_state": {
      "total_teams": 12,
      "budget_per_team": 260,
      "scoring_categories": ["R","HR","RBI","SB","AVG","W","SV","ERA","WHIP","SO"],
      "teams": [
        { "id": 1, "budget_remaining": 255, "roster": [] }
      ],
      "nominated_player": "Juan Soto",
      "roster_config": { "C":1, "1B":1, "2B":1, "3B":1, "SS":1, "OF":3, "SP":2, "RP":2, "UTIL":1, "BN":2 }
    }
  }' \
  http://localhost:3001/v1/valuate
```

**Late draft — scarce position (catcher exhausted):**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-License-Key: DB-2026-DEMO-0001" \
  -d '{
    "license_key": "DB-2026-DEMO-0001",
    "draft_state": {
      "total_teams": 12,
      "budget_per_team": 260,
      "scoring_categories": ["R","HR","RBI","SB","AVG","W","SV","ERA","WHIP","SO"],
      "teams": [
        { "id": 1, "budget_remaining": 45, "roster": ["Juan Soto","Kyle Tucker","Francisco Lindor","Logan Webb"] },
        { "id": 2, "budget_remaining": 30, "roster": ["Freddie Freeman","Elly De La Cruz","Sandy Alcantara"] }
      ],
      "nominated_player": "William Contreras",
      "roster_config": { "C":1, "1B":1, "2B":1, "3B":1, "SS":1, "OF":3, "SP":2, "RP":2, "UTIL":1, "BN":2 }
    }
  }' \
  http://localhost:3001/v1/valuate
```

---

#### Response Schema (Success)

```json
HTTP 200 OK
{
  "player": "Juan Soto",
  "true_dollar_value": 72,
  "max_bid_recommendation": 66,
  "market_inflation": 1.023,
  "scarcity_tier": "MEDIUM",
  "position_scarcity": {
    "OF": "MEDIUM"
  },
  "draftability_score": 1.0,
  "reasoning": "Market inflation +2.3%. Tier: MEDIUM. TDV: $72.",
  "stats": {
    "tier": "Elite",
    "positions": ["OF"],
    "team": "NYM",
    "league": "NL"
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `player` | string | Player name as matched in the database |
| `true_dollar_value` | integer | Calculated live auction value in dollars ($1–$120) |
| `max_bid_recommendation` | integer | Suggested maximum bid = `true_dollar_value × 0.92` (leaves margin) |
| `market_inflation` | float | Current market inflation factor (1.0 = neutral; >1.0 = inflated budget, <1.0 = deflated) |
| `scarcity_tier` | string | Position scarcity level: `"CRITICAL"`, `"HIGH"`, `"MEDIUM"`, or `"LOW"` |
| `position_scarcity` | object | Map of position → scarcity level for each of the player's eligible positions |
| `draftability_score` | float | `true_dollar_value / baseValue` ratio, capped at 1.0 (1.0 = great value right now) |
| `reasoning` | string | Human-readable explanation of the valuation drivers |
| `stats.tier` | string | Player tier: `"Elite"`, `"Starter"`, or `"Bench"` |
| `stats.positions` | string[] | Player's position eligibility array |
| `stats.team` | string | MLB team abbreviation |
| `stats.league` | string | League: `"NL"` or `"AL"` |

#### Scarcity Tiers

| Tier | Multiplier | Meaning |
|------|------------|---------|
| `CRITICAL` | 1.35× | Slots needed significantly exceed undrafted supply (ratio ≥ 1.5) |
| `HIGH`     | 1.20× | Demand exceeds supply (ratio ≥ 1.0) |
| `MEDIUM`   | 1.08× | Slight demand pressure (ratio ≥ 0.7) |
| `LOW`      | 1.00× | Plenty of eligible players remain |

#### Error Responses

**Player not found (404):**
```json
{
  "error": "Player not found",
  "player": "John Doesnt Exist",
  "message": "Could not find player \"John Doesnt Exist\" in database."
}
```

**Missing required field (400):**
```json
{
  "error": "Bad Request",
  "message": "draft_state.nominated_player is required."
}
```

**Missing request body (400):**
```json
{
  "error": "Bad Request",
  "message": "Missing draft_state in request body."
}
```

---

## Valuation Algorithm

The valuation engine (`services/valuation.js`) applies three factors:

### 1. Base True Dollar Value (TDV)
Anchored to the pre-computed `baseValue` from `players.json`.

```
baseTDV = player.baseValue
```

The `baseValue` is calculated by `generate-players.js` using a replacement-level PAR (Points Above Replacement) formula:

```
replacementFPTS = FPTS of the player at rank 110
PAR             = player.FPTS - replacementFPTS
baseValue       = max(1, round(PAR / totalPAR × totalHitterBudget))

where totalHitterBudget = 12 × $260 × 0.70 = $2,184
```

This concentrates budget on the ~110 truly draftable players, producing realistic Elite values ($50–$80).

### 2. Position Scarcity Multiplier

```
ratio             = remainingSlots[pos] / undraftedPlayersAtPos
scarcityMultiplier = 1.35 (CRITICAL) | 1.20 (HIGH) | 1.08 (MEDIUM) | 1.0 (LOW)
```

### 3. Market Inflation Factor

Compares remaining league-wide budget to expected remaining spend based on draft progress:

```
elapsedFraction   = filledSlots / (totalTeams × totalRosterSlots)
expectedRemaining = totalInitialBudget × (1 - elapsedFraction × 0.9)
inflationFactor   = clamp(totalRemainingBudget / expectedRemaining, 0.85, 1.45)
```

### Final Value

```
trueDollarValue         = round(baseTDV × scarcityMultiplier × inflationFactor)
trueDollarValueClamped  = clamp(trueDollarValue, $1, $120)
maxBidRecommendation    = max(round(trueDollarValueClamped × 0.92), $1)
```

---

## Player Name Matching

The API performs case-insensitive, partial-name matching:

1. Exact match (case-insensitive)
2. Substring match (case-insensitive)

Example: `"soto"` matches `"Juan Soto"`.

---

## Player Database

The `data/players.json` database is generated from three NL-only CSV files:

| Source File | Priority | Description |
|-------------|----------|-------------|
| `projections-NL.csv` | **Highest** | Projected 2025 stats |
| `2025-player-NL-stats.csv` | Medium | 2025 actuals/estimates |
| `3Year-average-NL-stats.csv` | Lowest | 3-year historical averages |

**Current database stats:**
- 313 total players (FPTS ≥ 100 filter applied)
- 20 Elite players
- 55 Starter players
- 238 Bench players

**Regenerate from CSVs:**
```bash
node mvpfinal/api/scripts/generate-players.js
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `API_KEYS` | `DB-2026-DEMO-0001` | Comma-separated list of valid API keys |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated CORS allowed origins |
| `NODE_ENV` | `development` | Environment (affects error message verbosity) |

Example `.env`:
```env
PORT=3001
API_KEYS=DB-2026-DEMO-0001,DB-2026-PROD-XXXX
ALLOWED_ORIGINS=http://localhost:5173,https://dbdraftkit.onrender.com
NODE_ENV=production
```

---

## Adding Real Player Photos

Each player object has a `photoUrl` field (default `null`). To show real headshots:

1. Set `photoUrl` in `data/players.json`:
   ```json
   { "name": "Shohei Ohtani", "photoUrl": "https://your-cdn.com/ohtani.jpg" }
   ```

2. MLB official headshot URL format (requires MLB Player ID):
   ```
   https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{MLB_PLAYER_ID}/headshot/67/current
   ```

3. For bulk updates, modify `generate-players.js` to read a photo mapping file and set `photoUrl` during generation.

The `PlayerAvatar` component in the frontend handles display automatically — it falls back to initials if the URL is `null` or returns an error.

---

## Interactive API Tester

The API root (`GET /`) serves a built-in HTML testing sandbox with:
- Live endpoint testing for `/v1/players` and `/v1/valuate`
- Example payload presets (early/mid/late draft, Ohtani nomination)
- JSON syntax highlighting
- Copy curl command buttons

Access it at: `http://localhost:3001/`

---

*Dark Blue Software Solutions — Season 2025/2026*
