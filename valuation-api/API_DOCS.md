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
- Custom one-year or three-year stat windows
- Predictive playing-time and production inputs
- Age, injury/news risk, and depth-chart role context

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

`valuation-api/data/players.json`

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
    "valuation_options": {
      "stat_window": "THREE_YEAR"
    },
    "player_stat_overrides": {
      "3": {
        "player_id": 3,
        "one_year": { "fpts": 720, "hr": 33, "rbi": 91, "r": 105, "sb": 12, "avg": 0.275 },
        "three_year": { "fpts": 790, "hr": 37, "rbi": 97, "r": 113, "sb": 23, "avg": 0.281 },
        "predictive": { "fpts": 820, "projected_games": 155, "projected_plate_appearances": 690 }
      }
    },
    "depth_chart_context": {
      "3": {
        "player_id": 3,
        "depth_position": "OF",
        "depth_rank": 1,
        "depth_role": "Everyday hitter",
        "status": "Active",
        "is_starter": true,
        "mlb_team": "NYY",
        "active_roster": true,
        "role_confidence": "HIGH",
        "volume_score": 92
      }
    },
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
| `draft_state.valuation_options.stat_window` | string | No | `ONE_YEAR`, `THREE_YEAR`, or `BLEND`. Defaults to `THREE_YEAR` runtime weighted stats. |
| `draft_state.player_stat_overrides` | object | No | Optional per-player one-year, three-year, and predictive stat overrides keyed by player id. |
| `draft_state.depth_chart_context` | object | No | Optional per-player MLB team, depth position, rank, role, active-roster status, role confidence, and workload score keyed by player id. |

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
  "stat_window": "THREE_YEAR",
  "rubric_coverage": {
    "valuation_variation_test_cases": 5,
    "custom_one_or_three_year_stats": "Supported through draft_state.player_stat_overrides and runtime weighted stats_window.",
    "predictive_stats": "Projected playing time and FPTS feed predictive_adjustment.",
    "age": "Player age feeds age_adjustment.",
    "injury_status": "Valuation API player updates feed risk_adjustment and player-card news.",
    "scarcity": "Roster config and undrafted pool feed position scarcity.",
    "depth_chart_position": "draft_state.depth_chart_context feeds depth_chart_adjustment when Draft Kit sends real MLB team, position, rank, status, role confidence, and volume context.",
    "draftkit_refresh": "Draft Kit posts the full draft_state after draft-state cache invalidation.",
    "active_stat_window": "THREE_YEAR"
  },
  "valuations": {
    "Juan Soto": {
      "player": "Juan Soto",
      "player_id": 3,
      "player_tier": "Elite",
      "base_value": 56,
      "stat_baseline_value": 56,
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
      "predictive_adjustment": {
        "multiplier": 1.03,
        "source": "predictive playing-time and production inputs",
        "fpts_delta_percent": 0,
        "volume_score": 82
      },
      "age_adjustment": {
        "multiplier": 1.03,
        "age": 27,
        "band": "PRIME"
      },
      "depth_chart_adjustment": {
        "multiplier": 1.05,
        "depth": "Everyday hitter",
        "depth_position": "OF",
        "depth_rank": 1,
        "status": "Active",
        "mlb_team": "NYY",
        "active_roster": true,
        "role_confidence": "HIGH",
        "volume_score": 82,
        "role": "Everyday volume"
      },
      "stat_profile": {
        "window": "THREE_YEAR",
        "selected_source": "runtime weighted player stats",
        "custom_one_year_available": false,
        "custom_three_year_available": false,
        "predictive_available": true,
        "runtime_stats_window": "2023-2025 weighted"
      },
      "valuation_breakdown": {
        "formula": "stat_baseline_value * scoring * scarcity * predictive * age * depth_chart * market_inflation * injury_risk",
        "stat_baseline_value": 56,
        "scoring_multiplier": 1,
        "scarcity_multiplier": 1.2,
        "predictive_multiplier": 1.03,
        "age_multiplier": 1.03,
        "depth_chart_multiplier": 1.05,
        "market_inflation_multiplier": 1.045,
        "injury_risk_multiplier": 1,
        "true_dollar_value": 58,
        "max_bid_recommendation": 53
      },
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
| `valuations[<name>].stat_profile` | object | Selected stat window/source and whether custom/predictive stats were available |
| `valuations[<name>].predictive_adjustment` | object | Predictive FPTS and playing-time factor |
| `valuations[<name>].age_adjustment` | object | Age curve factor |
| `valuations[<name>].depth_chart_adjustment` | object | Depth rank/role/status and projected volume factor |
| `valuations[<name>].risk_adjustment` | object | Injury/news risk factor |
| `valuations[<name>].valuation_breakdown` | object | Numeric factor-by-factor formula used to produce the value |
| `valuations[<name>].rubric_checks` | object | Boolean evidence that the rubric factors were evaluated for this player |
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
| `tier` | `Elite`, `Core`, `Depth` | `ALL` | Filter by tier |
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
      "source": "Dark Blue Valuation API demo",
      "source_type": "MANUAL_DEMO",
      "origin": "VALUATION_API",
      "notification_worthy": true,
      "created_by": "Dark Blue API website",
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

Publishes a persisted Valuation API player news/injury/role update and broadcasts it to every connected `/v1/player-updates/stream` subscriber. Draft Kit does not create these updates; it reads and streams them through the Draft Kit API proxy.

**Request body:**

```json
{
  "player_id": 2,
  "type": "INJURY",
  "severity": "HIGH",
  "headline": "Aaron Judge moved to high injury risk",
  "body": "Aaron Judge has a high-risk injury flag for draft review.",
  "injury_status": "Questionable",
  "impact_summary": "Consider lowering the max bid or waiting for roster clarity.",
  "source": "Dark Blue live news feed",
  "source_type": "LIVE_FEED",
  "created_by": "Valuation API ingestion"
}
```

**Request fields:**

| Field | Type | Required | Description |
|---|---|---:|---|
| `player_id` | number | Yes* | Player identifier from `/v1/players` |
| `player_name` | string | Yes* | Alternative lookup when `player_id` is unavailable |
| `type` | `INJURY`, `TRANSACTION`, `CONTRACT`, `NEWS`, `LINEUP`, `ROLE` | Yes | Update class used by Draft Kit player-card surfaces |
| `severity` | `LOW`, `MEDIUM`, `HIGH` | Yes | Drives `risk_level` |
| `headline` | string | Yes | Notification headline supplied by the Valuation API news source |
| `body` | string | Yes | Full update body supplied by the Valuation API news source |
| `injury_status` | string | No | Injury-specific player status |
| `transaction_status` | string | No | Transaction, lineup, or role status text |
| `contract_status` | string | No | Contract-specific status text |
| `depth_chart_note` | string | No | Depth-chart impact note |
| `impact_summary` | string | No | Draft/valuation impact summary |
| `source` | string | No | Human-readable source label |
| `source_type` | `LIVE_FEED`, `MANUAL_DEMO` | Yes | Distinguishes production ingestion from operator demo pushes |
| `created_by` | string | No | Ingestion actor label |

*Provide either `player_id` or `player_name`.

**Response:** HTTP `201` with the created `update` and the latest `updates` array.

Player updates are persisted in `data/player-updates.json` by default. Set `PLAYER_UPDATES_FILE` to override that path in test or production deployments.

### POST /v1/player-updates/demo

**Auth required** (`X-License-Key` header)

Creates an operator-triggered demo update through the same persisted player-update service used by live ingestion. The response shape matches `POST /v1/player-updates`, and the created update is marked with `source_type: "MANUAL_DEMO"` so Draft Kit can explain that the alert was demo-triggered.

```http
POST /v1/player-updates/demo
X-License-Key: DB-2026-DEMO-0001
```

Use this endpoint from the valuation product site when demonstrating the push-notification workflow with Draft Kit open.

---

## Valuation Algorithm

The valuation engine uses an **explainable heuristic model**:

### Step 1 — Resolve Drafted Players
Resolve drafted players from the supplied `[player_name, mlb_team]` tuples. The backend uses both strings to identify the matching player record.

### Step 2 — Build the Undrafted Pool
Filter out all players whose `(name, team)` pair appears in `draft_state.teams[].roster`.

### Step 3 — Select The Stat Window
The runtime player pool contains a weighted `2023-2025` baseline. Clients can optionally send `player_stat_overrides` with one-year, three-year, or blended stat inputs. The API uses `valuation_options.stat_window` to select the requested window without mutating the licensed player pool.

### Step 4 — Build The Stat Baseline
The live calculation starts from `baseValue` unless custom stats are supplied. Custom `baseValue`, custom `fpts`, or category stats can move the `stat_baseline_value`, and the response exposes this in `stat_profile` and `valuation_breakdown`.

### Step 5 — Scoring Format Multiplier
The enabled scoring categories determine whether a player's active category profile is stronger or weaker than the default role profile.

### Step 6 — Position Scarcity Multiplier
Counts how many teams still need this position vs. how many undrafted players fill it.

| Demand/Supply Ratio | Scarcity Level | Multiplier |
|---|---|---|
| ≥ 1.5 | CRITICAL | ×1.35 |
| ≥ 1.0 | HIGH | ×1.20 |
| ≥ 0.7 | MEDIUM | ×1.08 |
| < 0.7 | LOW | ×1.00 |

### Step 7 — Predictive Stats, Age, Depth, And Injury
Predictive projected games, plate appearances, innings, or FPTS influence `predictive_adjustment`. Player age influences `age_adjustment`. `depth_chart_context` and projected volume influence `depth_chart_adjustment`. Persisted Valuation API player updates influence `risk_adjustment`.

### Step 8 — Market Inflation Factor
Tracks how much of the draft budget has been spent vs. how much was expected at this point. Clamped between 0.85 and 1.45.

### Step 9 — Final Value
```
pre_injury = round(stat_baseline_value × scoring × scarcity × predictive × age × depth_chart × inflation)
TDV = round(pre_injury × injury_risk)
TDV = clamp(TDV, $1, $120)
max_bid_recommendation = round(TDV × 0.92)
```

### Step 10 — Explain The Result
The API returns:

- `player_tier` from the precomputed player dataset
- `market_context` with a human-readable inflation label such as `Hot`, `Neutral`, or `Cold`
- `valuation_breakdown`, the exact factor-by-factor math
- `rubric_checks`, per-player evidence that stat window, predictive stats, age, injury, scarcity, and depth context were evaluated
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
  tier: string,         // "Elite" | "Core" | "Depth"
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
node valuation-api/scripts/generate-players.js
```

The generator fetches and blends official MLB data, normalizes player identity and eligibility, computes fantasy-oriented scoring fields, and outputs one runtime `players.json` file for the service.

---

## Error Reference

| HTTP Code | Error | Description |
|---|---|---|
| 400 | Bad Request | `draft_state` missing |
| 401 | Unauthorized | Missing or invalid `X-License-Key` header |
| 403 | Forbidden | Valid license key used from an IP outside its configured allowlist |
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

## API Key IP Allowlists

Set `API_IP_WHITELIST` for one global allowlist or `API_KEY_IP_WHITELIST` for
per-key allowlists:

```env
API_IP_WHITELIST=127.0.0.1,198.51.100.0/24
API_KEY_IP_WHITELIST=DB-2026-DEMO-0001=127.0.0.1|198.51.100.0/24;DB-2026-DEMO-0002=*
```

Rules support exact IPs, IPv4 CIDR ranges, and `*`. When both variables are
empty, valid API keys are not IP-restricted. Set `TRUST_PROXY_HOPS` to the
known proxy hop count for the deployment so proxy headers are trusted without
weakening rate-limit behavior.

---

*Dark Blue Software Solutions · darkbluevalue.anythingavenue.com*
