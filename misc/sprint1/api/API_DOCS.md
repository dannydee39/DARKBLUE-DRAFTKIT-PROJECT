# Dark Blue Valuation API — Documentation

Version: **1.0.0**
Base URL (local): `http://localhost:3001`
Base URL (production): `https://api.darkblue.io`

---

## Overview

The Dark Blue Valuation API is a **stateless** REST service that calculates real-time auction dollar values for fantasy baseball players during a live draft. It is designed to be called on each player nomination and returns a recommended maximum bid based on:

- The player's projected stats (from NL sample CSV data)
- Current draft state (remaining budgets, already-drafted players)
- Position scarcity
- Market inflation

The API does **not** maintain session state — every request must include the full draft state payload.

---

## Authentication

All protected endpoints require an API key sent in the request header:

```
X-License-Key: DB-2026-DEMO-0001
```

**Demo key (development only):** `DB-2026-DEMO-0001`

If the key is missing or invalid, the API returns:

```json
{
  "error": "Unauthorized",
  "message": "Missing X-License-Key header. Register at api.darkblue.io.",
  "code": "NO_KEY"
}
```

**Configuring API keys:**

Set the `API_KEYS` environment variable to a comma-separated list of valid keys:

```env
API_KEYS=DB-2026-DEMO-0001,DB-2026-PROD-ABCD
```

---

## Rate Limiting

- **120 requests per minute** per IP address
- Exceeding the limit returns HTTP 429 with:
  ```json
  { "error": "Too Many Requests", "message": "Rate limit exceeded. Please wait 60 seconds." }
  ```

---

## Endpoints

### GET /health

Health check — no authentication required.

**Response:**
```json
{
  "status": "online",
  "service": "Dark Blue Valuation API",
  "version": "1.0.0",
  "timestamp": "2025-03-15T14:30:00.000Z",
  "environment": "development"
}
```

---

### GET /

API info page — no authentication required. Returns endpoint listing and docs URL.

---

### POST /v1/valuate

**Auth required** (`X-License-Key` header)

Calculates the true dollar value (TDV) and recommended maximum bid for a nominated player, given the current live draft state.

**Request body:**
```json
{
  "license_key": "DB-2026-DEMO-0001",
  "draft_state": {
    "total_teams": 12,
    "budget_per_team": 260,
    "scoring_categories": ["HR", "RBI", "AVG", "SB", "ERA", "SO", "WHIP"],
    "teams": [
      {
        "id": 1,
        "budget_remaining": 248,
        "roster": ["Garrett Crochet", "Paul Goldschmidt"]
      },
      {
        "id": 2,
        "budget_remaining": 215,
        "roster": ["Freddie Freeman"]
      }
    ],
    "nominated_player": "Juan Soto",
    "roster_config": {
      "C": 1,
      "1B": 1,
      "2B": 1,
      "3B": 1,
      "SS": 1,
      "OF": 3,
      "SP": 2,
      "RP": 2,
      "UTIL": 1,
      "BN": 2
    }
  }
}
```

**Request fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `license_key` | string | No | Same as header key (can be provided in body OR header) |
| `draft_state.total_teams` | number | No | Defaults to 12 |
| `draft_state.budget_per_team` | number | No | Defaults to 260 |
| `draft_state.scoring_categories` | string[] | No | Active scoring cats (defaults to 5x5) |
| `draft_state.teams` | array | No | Team objects with budget and roster. If omitted, assumes no picks made yet. |
| `draft_state.teams[].id` | number | Yes | Team identifier |
| `draft_state.teams[].budget_remaining` | number | Yes | Current remaining budget |
| `draft_state.teams[].roster` | string[] | Yes | Array of **player name strings** already drafted |
| `draft_state.nominated_player` | string | **Yes** | Name of the player being valued (partial match supported) |
| `draft_state.roster_config` | object | No | Slot counts per position |

**Successful response (HTTP 200):**
```json
{
  "player": "Juan Soto",
  "true_dollar_value": 47,
  "max_bid_recommendation": 43,
  "market_inflation": 1.045,
  "scarcity_tier": "Starter",
  "position_scarcity": {
    "OF": "HIGH"
  },
  "draftability_score": 0.94,
  "reasoning": "OF scarce — high demand in pool. Market inflation +4.5%. Tier: Starter. TDV: $47.",
  "stats": {
    "tier": "Starter",
    "positions": ["OF"],
    "team": "NYM",
    "league": "NL"
  }
}
```

**Response fields:**

| Field | Type | Description |
|---|---|---|
| `player` | string | Matched player name from database |
| `true_dollar_value` | number | Calculated auction dollar value ($1–$80) |
| `max_bid_recommendation` | number | Recommended max bid (92% of TDV) |
| `market_inflation` | number | Inflation factor (1.0 = no inflation, >1.0 = inflated market) |
| `scarcity_tier` | string | Player tier: "Elite", "Starter", or "Bench" |
| `position_scarcity` | object | Map of position → scarcity level ("CRITICAL", "HIGH", "MEDIUM", "LOW") |
| `draftability_score` | number | 0.0–1.0 score indicating current market value vs. base value |
| `reasoning` | string | Human-readable explanation of the valuation |
| `stats.tier` | string | Player's pre-assigned tier |
| `stats.positions` | string[] | Player's eligible positions |
| `stats.team` | string | MLB team abbreviation |
| `stats.league` | string | "NL" or "AL" |

**Error responses:**

```json
{ "error": "Player not found", "player": "Joe Nobody", "message": "Could not find player \"Joe Nobody\" in database." }
```
```json
{ "error": "Bad Request", "message": "draft_state.nominated_player is required." }
```

---

### GET /v1/players

**Auth required** (`X-License-Key` header)

Returns the full player pool with optional filters.

**Query parameters:**

| Parameter | Values | Default | Description |
|---|---|---|---|
| `league` | `NL`, `AL`, `ALL` | `ALL` | Filter by conference (NL-only data in current build) |
| `pos` | `C`, `1B`, `2B`, `3B`, `SS`, `OF`, `SP`, `RP` | `ALL` | Filter to players eligible at this position |
| `tier` | `Elite`, `Starter`, `Bench` | `ALL` | Filter by tier |
| `drafted` | comma-separated names | — | Exclude these players from results _(marks them unavailable)_ |

**Example request:**
```
GET /v1/players?league=NL&pos=OF&tier=Elite
X-License-Key: DB-2026-DEMO-0001
```

**Response:**
```json
{
  "count": 8,
  "players": [
    {
      "id": 2,
      "name": "Juan Soto",
      "team": "NYM",
      "league": "NL",
      "pos": ["OF"],
      "tier": "Elite",
      "baseValue": 72,
      "hr": 37,
      "rbi": 97,
      "r": 113,
      "sb": 23,
      "avg": "0.281",
      "obp": "0.399",
      "slg": "0.547",
      "era": null,
      "so": null,
      "whip": null,
      "w": null,
      "sv": null,
      "photoUrl": null,
      "injury": null,
      "note": null,
      "depth": "Elite",
      "fpts": 788
    }
  ]
}
```

---

## Valuation Algorithm

The valuation engine uses a **SGP-based Points Above Replacement (PAR)** model:

### Step 1 — Find the Player
Fuzzy name matching (exact → partial) against the player database.

### Step 2 — Build the Undrafted Pool
Filter out all players already appearing in `draft_state.teams[].roster`.

### Step 3 — Compute Pool Stats
For each active scoring category, compute the min/max range across the undrafted pool. Used to normalize player stats to a 0–1 scale.

### Step 4 — Score the Player (SGP-normalized)
Each active category is normalized: `(playerStat - min) / (max - min)`.
The player's score is the average across all active categories.

**Note:** ERA and WHIP are inverted (lower = better) before normalization.

### Step 5 — Compute Total Pool Value
Sum scores for all undrafted players to get the "total pool score."

### Step 6 — Calculate Base True Dollar Value
```
baseTDV = (playerScore / totalPoolScore) × spendableBudget
```

Where `spendableBudget = totalRemainingBudget - reservedDollars`
(`$1` reserved per remaining unfilled roster slot across all teams).

### Step 7 — Position Scarcity Multiplier
Counts how many teams still need this position vs. how many undrafted players fill it.

| Demand/Supply Ratio | Scarcity Level | Multiplier |
|---|---|---|
| ≥ 1.5 | CRITICAL | ×1.35 |
| ≥ 1.0 | HIGH | ×1.20 |
| ≥ 0.7 | MEDIUM | ×1.08 |
| < 0.7 | LOW | ×1.00 |

### Step 8 — Market Inflation Factor
Tracks how much of the draft budget has been spent vs. how much was expected at this point. Clamped between 0.85 and 1.45.

### Step 9 — Final Value
```
TDV = round(baseTDV × scarcityMultiplier × inflationFactor)
TDV = clamp(TDV, $1, $80)
max_bid_recommendation = round(TDV × 0.92)
```

---

## Player Database Schema

Each player object in `players.json`:

```typescript
{
  id: number,           // Sequential 1-based ID
  name: string,         // Full display name (e.g. "Juan Soto")
  team: string,         // MLB team abbreviation (e.g. "NYM")
  league: string,       // "NL" | "AL"
  pos: string[],        // Position eligibility (e.g. ["OF"] or ["SS", "2B"])
  tier: string,         // "Elite" | "Starter" | "Bench"
  baseValue: number,    // Pre-calculated auction value ($1–$80)

  // Batting stats
  hr: number,
  rbi: number,
  r: number,
  sb: number,
  avg: string,          // e.g. "0.281"
  obp: string,          // e.g. "0.399"
  slg: string,          // e.g. "0.547"

  // Pitching stats (null for hitters)
  era: number | null,
  so: number | null,
  whip: number | null,
  w: number | null,
  sv: number | null,

  // Metadata
  photoUrl: string | null,   // Headshot URL (null = use initials avatar)
  injury: string | null,     // Injury note or null
  note: string | null,       // Scout note or null
  depth: string,             // Mirrors tier
  fpts: number,              // Fantasy points (used for sorting)
}
```

---

## Generating the Player Database

Run the data pipeline whenever you update the CSV source files:

```bash
node mvpfinal/api/scripts/generate-players.js
```

Source files (in `sample/data/`):

| File | Priority | Description |
|---|---|---|
| `projections-NL.csv` | **Highest** | Forward-looking projections |
| `2025-player-NL-stats.csv` | Medium | 2025 actuals |
| `3Year-average-NL-stats.csv` | Lowest | Historical baseline |

When a player appears in multiple files, the higher-priority source wins. Players below FPTS 100 are excluded.

**Current output:** 313 players (20 Elite, 55 Starter, 238 Bench)

---

## Error Reference

| HTTP Code | Error | Description |
|---|---|---|
| 400 | Bad Request | `draft_state` missing or `nominated_player` not provided |
| 401 | Unauthorized | Missing or invalid `X-License-Key` header |
| 404 | Player not found | Player name not found in database |
| 429 | Too Many Requests | Rate limit exceeded (120/min) |
| 500 | Internal Server Error | Unexpected error in valuation calculation |

---

## CORS Configuration

Set `ALLOWED_ORIGINS` in your `.env`:

```env
ALLOWED_ORIGINS=http://localhost:5173,https://draftkit.darkblue.io
```

Requests with no `Origin` header (curl, Postman, server-to-server) are always allowed.
In `NODE_ENV=development`, all origins are permitted.

---

*Dark Blue Software Solutions · api.darkblue.io*
