# Dark Blue MLB Valuation API — Documentation

Version: **1.0.0**
Base URL (local): `http://localhost:3001`
Base URL (production): `https://darkblueapi.anythingavenue.com`

---

## Overview

The Dark Blue MLB Valuation API calculates real-time auction dollar values for fantasy baseball players during a live draft. The valuation calculation is stateless and is designed to be called whenever the live draft state changes. Player news and injury updates are stored separately as a persistent operational feed and can be surfaced in both player-pool and valuation responses.

- A normalized player pool built from real MLB data
- Current draft state (remaining budgets, already-drafted players)
- Position scarcity
- Market inflation

The valuation endpoint does **not** maintain draft session state — every valuation request must include the full draft state payload.

### Customer Integration Contract

The API is primarily designed for the Dark Blue Draft Kit, but it is intentionally stable enough for outside customers if they normalize their own draft data into the same request shape.

That means a customer does **not** need to copy the Draft Kit frontend or our internal file layout. They only need to transform their CSV, spreadsheet, or app state into the `draft_state` payload expected by `/v1/valuate`.

Roster entries in that payload are expressed as JSON tuples: `[player_name, mlb_team]`.

In practice, the contract is:

```text
customer CSV / spreadsheet / app state
-> customer-side normalization
-> Dark Blue draft_state payload
-> /v1/valuate
```

This keeps the API focused on valuation logic instead of trying to parse arbitrary customer spreadsheet formats at runtime.

### Current Player Pool Build

The live player pool is now generated from the official MLB Stats API, not from the old NL sample CSVs.

Build summary:

- seasons blended: `2025`, `2024`, `2023`
- source data:
  - full-league hitting season stats
  - full-league pitching season stats
  - player metadata for age, team, league, and primary position
- preprocessing:
  - weighted 3-year blend
  - hitter/pitcher fantasy-style score calculation
  - `baseValue` derived from points above replacement inside hitter and pitcher buckets
  - headshots derived from `mlbId`

The runtime API still serves one normalized file:

`mvpfinal/valuation-api/data/players.json`

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
  "message": "Missing X-License-Key header. Register at darkbluevalue.anythingavenue.com.",
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
  "service": "Dark Blue MLB Valuation API",
  "version": "1.0.0",
  "timestamp": "2025-03-15T14:30:00.000Z",
  "environment": "development"
}
```

---

### GET /

Interactive API tester — no authentication required. Serves the built-in HTML sandbox for `/v1/players` and `/v1/valuate`.

---

### POST /v1/valuate

**Auth required** (`X-License-Key` header)

Calculates a valuation dictionary for the full player pool, given the current live draft state.

**Request body:**
```json
{
  "draft_state": {
    "total_teams": 12,
    "budget_per_team": 260,
    "scoring_categories": ["HR", "RBI", "AVG", "SB", "ERA", "SO", "WHIP"],
    "teams": [
      {
        "id": 1,
        "budget_remaining": 248,
        "roster": [["Garrett Crochet", "BOS"], ["Paul Goldschmidt", "NYY"]]
      },
      {
        "id": 2,
        "budget_remaining": 215,
        "roster": [["Freddie Freeman", "LAD"]]
      }
    ],
    "roster_config": {
      "C": 2,
      "1B": 1,
      "2B": 1,
      "CI": 1,
      "3B": 1,
      "SS": 1,
      "MI": 1,
      "OF": 5,
      "SP": 0,
      "RP": 0,
      "P": 9,
      "UTIL": 1,
      "BN": 0,
      "TAXI": 0
    }
  }
}
```

**Request fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `draft_state.total_teams` | number | No | Defaults to 12 |
| `draft_state.budget_per_team` | number | No | Defaults to 260 |
| `draft_state.scoring_categories` | string[] | No | Active scoring cats (defaults to 5x5) |
| `draft_state.teams` | array | No | Team objects with budget and roster. If omitted, assumes no picks made yet. |
| `draft_state.teams[].id` | number | Yes | Team identifier |
| `draft_state.teams[].budget_remaining` | number | Yes | Current remaining budget |
| `draft_state.teams[].roster` | string[][] | Yes | Array of `[player_name, mlb_team]` tuples for already drafted players |
| `draft_state.roster_config` | object | No | Slot counts per position |

**Successful response (HTTP 200):**
```json
{
  "count": 1821,
  "drafted_count": 3,
  "undrafted_count": 1818,
  "generated_at": "2026-04-23T19:45:00.000Z",
  "market_inflation": 1.045,
  "market_context": {
    "label": "Neutral",
    "delta_percent": 4.5
  },
  "valuations": {
    "Juan Soto": {
      "player": "Juan Soto",
      "player_id": 3,
      "player_tier": "Elite",
      "base_value": 56,
      "true_dollar_value": 58,
      "max_bid_recommendation": 53,
      "market_inflation": 1.045,
      "market_context": {
        "label": "Neutral",
        "delta_percent": 4.5
      },
      "scarcity_tier": "HIGH",
      "position_scarcity": {
        "OF": "HIGH"
      },
      "draftability_score": 1.04,
      "value_delta": 2,
      "is_drafted": false,
      "reasoning": "OF scarce — high demand in pool. Market inflation +4.5%. Player tier: Elite. Scarcity: HIGH. TDV: $58.",
      "stats": {
        "tier": "Elite",
        "positions": ["OF"],
        "team": "NYM",
        "league": "NL"
      }
    }
  }
}
```

**Response fields:**

| Field | Type | Description |
|---|---|---|
| `count` | number | Total number of players valued in the response |
| `drafted_count` | number | Number of players marked as already drafted from the supplied draft state |
| `undrafted_count` | number | Number of undrafted players remaining in the pool |
| `generated_at` | string | ISO timestamp for when the valuation pass was produced |
| `market_inflation` | number | Shared inflation factor for the current draft state |
| `market_context` | object | Human-readable market label and delta percent |
| `valuations` | object | Dictionary keyed by canonical player name |
| `valuations[<name>].true_dollar_value` | number | Live auction value for that player under the supplied draft state |
| `valuations[<name>].max_bid_recommendation` | number | Recommended max bid (92% of TDV) |
| `valuations[<name>].position_scarcity` | object | Map of position → scarcity level |
| `valuations[<name>].reasoning` | string | Human-readable explanation of the valuation |
| `valuations[<name>].stats` | object | Tier, positions, team, and league metadata for that player |

**Error responses:**

```json
{ "error": "Bad Request", "message": "Missing draft_state in request body." }
```

---

### GET /v1/players

**Auth required** (`X-License-Key` header)

Returns the full player pool with optional filters.

**Query parameters:**

| Parameter | Values | Default | Description |
|---|---|---|---|
| `league` | `NL`, `AL`, `ALL` | `ALL` | Filter by conference |
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

### GET /v1/player-updates

**Auth required** (`X-License-Key` header)

Returns the latest persisted player news, injury, lineup, or role updates.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---:|---:|---|
| `limit` | number | `10` | Maximum updates to return, capped at 50 |
| `since` | ISO timestamp | — | Return updates created after this timestamp |

**Example:**

```http
GET /v1/player-updates?limit=10
```

**Response:**

```json
{
  "count": 1,
  "sort": "created_at desc",
  "updates": [
    {
      "id": "upd-550e8400-e29b-41d4-a716-446655440000",
      "player_id": 2,
      "player_name": "Aaron Judge",
      "team": "NYY",
      "positions": ["OF"],
      "type": "INJURY",
      "severity": "HIGH",
      "risk_level": "HIGH",
      "headline": "Aaron Judge moved to high injury risk",
      "body": "Aaron Judge has a high-risk injury flag for draft review.",
      "injury_status": "Questionable",
      "impact_summary": "Consider lowering the max bid or waiting for roster clarity.",
      "source": "Commissioner update",
      "created_by": "Draft Kit commissioner",
      "created_at": "2026-04-30T18:15:00.000Z"
    }
  ]
}
```

---

### GET /v1/player-updates/stream

**Auth required** (`X-License-Key` header)

Opens a Server-Sent Events stream for true push delivery of player news/injury updates. The stream sends an initial `snapshot` event with the latest updates, then sends a `player-update` event immediately after a new update is created through `POST /v1/player-updates`.

**Query parameters:** same as `GET /v1/player-updates`.

**Example:**

```http
GET /v1/player-updates/stream?limit=10
Accept: text/event-stream
```

**Events:**

```text
event: snapshot
data: {"updates":[...]}

event: player-update
data: {"update":{"player_name":"Aaron Judge","risk_level":"HIGH"}}
```

The Draft Kit API proxies this stream at `/v1/player-updates/stream`, so the browser can receive pushed updates without exposing the valuation API key.

---

### GET /v1/mlb/depth-charts

**Auth required** (`X-License-Key` header)

Returns MLB active roster context from the MLB Stats API. Draft Kit uses this endpoint to enrich its team-position depth chart view with live roster status while still applying Draft Kit fantasy value/rank ordering.

The backend caches successful MLB roster responses for 15 minutes by default. Configure this with:

```env
MLB_DEPTH_CACHE_TTL_MS=900000
MLB_DEPTH_TIMEOUT_MS=6000
```

If the MLB Stats API is unavailable, the endpoint returns a stale cached result when one exists. If no cache exists, it returns a local player-pool fallback with a `warning`.

The Draft Kit API proxies this endpoint at `/v1/mlb/depth-charts`.

**Example:**
```http
GET /v1/mlb/depth-charts
X-License-Key: DB-2026-DEMO-0001
```

**Response fields:**

| Field | Type | Description |
|---|---|---|
| `source` | string | `mlb-stats-api-active-roster`, stale-cache variant, or local fallback |
| `upstream` | string | Upstream MLB Stats API base URL |
| `generated_at` | string | Timestamp for the response payload |
| `cache.hit` | boolean | Whether the response came from cache |
| `teams[]` | array | MLB team roster payloads |
| `teams[].team` | string | Draft Kit team abbreviation, for example `NYY` |
| `teams[].mlbTeamId` | number | MLB Stats API team id |
| `teams[].roster[]` | array | Active roster entries |
| `roster[].mlbId` | number | MLB player id used to match Draft Kit player records |
| `roster[].statusDescription` | string | MLB roster status description, usually `Active` |
| `roster[].positionCode` | string | MLB roster position abbreviation |

---

### POST /v1/player-updates

**Auth required** (`X-License-Key` header)

Publishes a persisted player news/injury update and broadcasts it to every connected `/v1/player-updates/stream` subscriber. The Draft Kit uses this for commissioner-driven player context while preserving the production request path through the Draft Kit API proxy.

**Request body:**

```json
{
  "player_id": 2,
  "type": "INJURY",
  "severity": "HIGH",
  "headline": "Aaron Judge moved to high injury risk",
  "body": "Aaron Judge has a high-risk injury flag for draft review.",
  "source": "Commissioner update",
  "created_by": "Draft Kit commissioner"
}
```

**Request fields:**

| Field | Type | Required | Description |
|---|---|---:|---|
| `player_id` | number | Yes* | Player identifier from `/v1/players` |
| `player_name` | string | Yes* | Alternative lookup when `player_id` is unavailable |
| `type` | `INJURY`, `NEWS`, `LINEUP`, `ROLE` | No | Defaults to `NEWS` |
| `severity` | `LOW`, `MEDIUM`, `HIGH` | No | Defaults to `LOW`; also drives `risk_level` |
| `headline` | string | No | Defaults to a generated player status headline |
| `body` | string | No | Longer internal update body |
| `injury_status` | string | No | Defaults from severity for injury updates |
| `impact_summary` | string | No | Defaults from type/severity |
| `source` | string | No | Defaults to `Manual update` |
| `created_by` | string | No | Defaults to `Draft Kit` |

*Provide either `player_id` or `player_name`.

**Response:** HTTP `201` with the created `update` and the latest `updates` array.

Player updates are persisted in `data/player-updates.json` by default. Set `PLAYER_UPDATES_FILE` to override that path in test or production deployments.

---

## Valuation Algorithm

The valuation engine uses an **explainable heuristic model**:

### Step 1 — Resolve Drafted Players
Resolve drafted players from the supplied `[player_name, mlb_team]` tuples. The backend uses both strings to identify the matching player record.

### Step 2 — Build the Undrafted Pool
Filter out all players whose `(name, team)` pair appears in `draft_state.teams[].roster`.

### Step 3 — Start From Precomputed Base Value
Each player already has a `baseValue` calculated from projected fantasy output and points above replacement during the data-generation step. Live valuation starts from that baseline instead of recomputing the entire player pool from scratch on every request.

### Step 4 — Position Scarcity Multiplier
Counts how many teams still need this position vs. how many undrafted players fill it.

| Demand/Supply Ratio | Scarcity Level | Multiplier |
|---|---|---|
| ≥ 1.5 | CRITICAL | ×1.35 |
| ≥ 1.0 | HIGH | ×1.20 |
| ≥ 0.7 | MEDIUM | ×1.08 |
| < 0.7 | LOW | ×1.00 |

### Step 5 — Market Inflation Factor
Tracks how much of the draft budget has been spent vs. how much was expected at this point. Clamped between 0.85 and 1.45.

### Step 6 — Final Value
```
TDV = round(baseValue × scarcityMultiplier × inflationFactor)
TDV = clamp(TDV, $1, $120)
max_bid_recommendation = round(TDV × 0.92)
```

### Step 7 — Explain The Result
The API returns:

- `player_tier` from the precomputed player dataset
- `market_context` with a human-readable inflation label such as `Hot`, `Neutral`, or `Cold`
- `reasoning`, a short text explanation tying scarcity, inflation, and final value together

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

Run the data pipeline whenever you need to refresh the live MLB-backed player dataset:

```bash
node mvpfinal/valuation-api/scripts/generate-players.js
```

The generator fetches and blends official MLB data, normalizes player identity and eligibility, computes fantasy-oriented scoring fields, and outputs one runtime `players.json` file for the service.

---

## Error Reference

| HTTP Code | Error | Description |
|---|---|---|
| 400 | Bad Request | `draft_state` missing |
| 401 | Unauthorized | Missing or invalid `X-License-Key` header |
| 429 | Too Many Requests | Rate limit exceeded (120/min) |
| 500 | Internal Server Error | Unexpected error in valuation calculation |

---

## CORS Configuration

Set `ALLOWED_ORIGINS` in your `.env`:

```env
ALLOWED_ORIGINS=http://localhost:5173,https://darkbluevalue.anythingavenue.com
```

Requests with no `Origin` header (curl, Postman, server-to-server) are always allowed.
In `NODE_ENV=development`, all origins are permitted.

---

*Dark Blue Software Solutions · darkbluevalue.anythingavenue.com*
