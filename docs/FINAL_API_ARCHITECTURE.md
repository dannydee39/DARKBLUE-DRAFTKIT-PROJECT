# Final API Architecture And Endpoint Input Guide

Last verified: 2026-05-15 18:10 ET

## Production Status

The public Dark Blue value site and API are up.

| Service | URL | Verified result |
|---|---|---|
| Dark Blue value site | `https://darkbluevalue.anythingavenue.com` | HTTP `200` |
| Dark Blue valuation API health | `https://darkblueapi.anythingavenue.com/health` | HTTP `200`, `environment: production` |
| Dark Blue valuation API landing page | `https://darkblueapi.anythingavenue.com/` | HTTP `200` |

## Current Endpoint Shape

The current development code keeps valuation requests stateless and makes player news API-owned. Notification-worthy injury/news/role updates must enter through the Valuation API player-update feed, not through Draft Kit draft state.

Core valuation/data/news endpoints:

- `POST /v1/valuate`
- `GET /v1/players`
- `GET /v1/player-updates`
- `GET /v1/player-updates/stream`
- `POST /v1/player-updates`
- `POST /v1/player-updates/demo`
- `GET /v1/mlb/depth-charts`

## High-Level Architecture

The product is split into two public surfaces:

| Layer | Runtime | Responsibility |
|---|---|---|
| `valuation-site` | Static site served at `darkbluevalue.anythingavenue.com` | Buyer-facing product site, pricing, endpoint docs, account dashboard, login/signup/reset UI |
| `valuation-api` | Express API served at `darkblueapi.anythingavenue.com` | Licensed player pool, valuation math, player updates, MLB depth charts, buyer auth, password reset, license enforcement |

The static site calls the API directly for buyer account actions using cookie-based sessions. API data endpoints require the `X-License-Key` header. Buyer signup creates a unique active license key, and that same key can be used immediately against protected valuation endpoints.

Relevant implementation paths:

- `valuation-api/server.js` mounts API routes and CORS.
- `valuation-api/middleware/auth.js` validates `X-License-Key` and optional IP allowlists.
- `valuation-api/routes/auth.js` handles buyer signup, login, logout, password reset request, and password reset confirmation.
- `valuation-api/lib/db.js` stores users, sessions, reset tokens, and account license keys in SQLite.
- `valuation-api/lib/mailer.js` sends password reset email through SMTP.
- `valuation-api/routes/valuate.js` handles valuation requests.
- `valuation-api/routes/players.js` returns player pool data.
- `valuation-api/routes/player-updates.js` handles player news/injury updates and SSE.
- `valuation-api/routes/mlb-depth-charts.js` returns MLB roster/depth context.
- `valuation-site/js/state.js` calls the auth API and stores current session state.
- `valuation-site/js/auth-modal.js` renders login, signup, forgot-password, and reset-password flows.
- `valuation-site/js/pages/account.js` renders account/license details and live API checks.

## Shared API Rules

Base URL:

```text
https://darkblueapi.anythingavenue.com
```

Protected API endpoints require:

```http
X-License-Key: <active license key>
```

Auth endpoints use browser cookies:

```http
Cookie: darkblue_value_session=<http-only session cookie>
```

The browser does not need to manually set the cookie. The API sets it after signup/login, and `valuation-site` sends it with `credentials: include`.

## Endpoint Input Formats

### GET `/health`

Purpose: service health check.

Auth: none.

Input: no body, no query parameters.

Example:

```http
GET /health
```

### GET `/`

Purpose: API landing page and built-in tester.

Auth: none.

Input: no body, no query parameters.

Example:

```http
GET /
```

### POST `/v1/auth/signup`

Purpose: create a buyer account, create a unique license key, and start a session.

Auth: none.

Headers:

```http
Content-Type: application/json
```

Body:

```json
{
  "email": "buyer@example.com",
  "displayName": "Buyer Name",
  "password": "Password123!"
}
```

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `email` | string | Yes | Must contain `@`; normalized to lowercase |
| `displayName` | string | No | If omitted, derived from email |
| `password` | string | Yes | Minimum 8 characters |

Output includes `user.license.key`, which is the buyer account's unique API key.

### POST `/v1/auth/login`

Purpose: sign into an existing buyer account and start a session.

Auth: none.

Headers:

```http
Content-Type: application/json
```

Body:

```json
{
  "email": "buyer@example.com",
  "password": "Password123!"
}
```

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `email` | string | Yes | Buyer account email |
| `password` | string | Yes | Buyer account password |

### GET `/v1/auth/me`

Purpose: check the current buyer session and return the current user/license.

Auth: session cookie.

Input: no body, no query parameters.

Example:

```http
GET /v1/auth/me
Cookie: darkblue_value_session=<session>
```

### POST `/v1/auth/password-reset/request`

Purpose: request a password reset email.

Auth: none.

Headers:

```http
Content-Type: application/json
```

Body:

```json
{
  "email": "buyer@example.com"
}
```

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `email` | string | Yes | Returns the same accepted message whether the account exists or not |

Production does not expose the reset token in the response.

### POST `/v1/auth/password-reset/confirm`

Purpose: set a new password using a valid single-use reset token.

Auth: none.

Headers:

```http
Content-Type: application/json
```

Body:

```json
{
  "token": "reset-token-from-email",
  "password": "NewPassword123!"
}
```

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `token` | string | Yes | Single-use reset token from email |
| `password` | string | Yes | Minimum 8 characters |

After a successful reset, existing sessions for that account are invalidated.

### POST `/v1/auth/logout`

Purpose: end the current buyer session.

Auth: session cookie.

Input: no required body.

Example:

```http
POST /v1/auth/logout
Cookie: darkblue_value_session=<session>
```

### POST `/v1/valuate`

Purpose: calculate live valuations for the full player pool from the current draft state.

Auth: `X-License-Key` required.

Headers:

```http
Content-Type: application/json
X-License-Key: <active license key>
```

Body:

```json
{
  "draft_state": {
    "total_teams": 12,
    "budget_per_team": 260,
    "scoring_categories": ["R", "HR", "RBI", "SB", "AVG", "W", "SV", "ERA", "WHIP", "SO"],
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

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `draft_state` | object | Yes | Root draft state object |
| `draft_state.total_teams` | number | No | Defaults to `12` |
| `draft_state.budget_per_team` | number | No | Defaults to `260` |
| `draft_state.scoring_categories` | string[] | No | Defaults to standard 5x5 categories |
| `draft_state.teams` | object[] | No | If omitted, assumes no picks have been made |
| `draft_state.teams[].id` | number/string | Recommended | Team identifier |
| `draft_state.teams[].budget_remaining` | number | Recommended | Current budget left |
| `draft_state.teams[].roster` | string[][] | Recommended | Array of `[player_name, mlb_team]` tuples |
| `draft_state.roster_config` | object | No | Slot counts by roster position |

Notification-worthy injury/news/role context is no longer sent inside the valuation payload. It is persisted through the Valuation API player-update feed so Draft Kit receives one auditable pushed-news source.

Important roster format:

```json
["Player Name", "MLB_TEAM_ABBREVIATION"]
```

The API is stateless for valuation. The full current draft state must be sent each time.

### GET `/v1/players`

Purpose: return the player pool with optional filters.

Auth: `X-License-Key` required.

Headers:

```http
X-License-Key: <active license key>
```

Query parameters:

| Parameter | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `league` | `AL`, `NL`, `ALL` | No | `ALL` | Filters by player league |
| `pos` | position string | No | `ALL` | Examples: `C`, `1B`, `2B`, `3B`, `SS`, `OF`, `SP`, `RP` |
| `tier` | `Elite`, `Core`, `Depth` | No | `ALL` | Filters by player tier |
| `drafted` | comma-separated player names | No | none | Excludes/marks drafted players unavailable |
| `group_by` | `tier` | No | none | Returns `groups` grouped by tier when set to `tier` |

Example:

```http
GET /v1/players?league=NL&pos=OF&tier=Elite&group_by=tier
X-License-Key: <active license key>
```

### GET `/v1/player-updates`

Purpose: return persisted player news, injury, lineup, or role updates.

Auth: `X-License-Key` required.

Headers:

```http
X-License-Key: <active license key>
```

Query parameters:

| Parameter | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `limit` | number | No | `10` | Clamped from `1` to `50` |
| `since` | ISO timestamp | No | none | Returns updates created after this timestamp |

Example:

```http
GET /v1/player-updates?limit=10
X-License-Key: <active license key>
```

### GET `/v1/player-updates/stream`

Purpose: open a Server-Sent Events stream for player update push delivery.

Auth: `X-License-Key` required.

Headers:

```http
X-License-Key: <active license key>
Accept: text/event-stream
```

Query parameters: same as `GET /v1/player-updates`.

Example:

```http
GET /v1/player-updates/stream?limit=10
X-License-Key: <active license key>
Accept: text/event-stream
```

Events:

```text
event: snapshot
data: {"updates":[...]}

event: player-update
data: {"update":{...}}
```

### POST `/v1/player-updates`

Purpose: publish a player news/injury/lineup/role update and broadcast it to stream subscribers.

Auth: `X-License-Key` required.

Headers:

```http
Content-Type: application/json
X-License-Key: <active license key>
```

Body:

```json
{
  "player_id": 2,
  "player_name": "Aaron Judge",
  "type": "INJURY",
  "severity": "HIGH",
  "headline": "Aaron Judge moved to high injury risk",
  "body": "Aaron Judge has a high-risk injury flag for draft review.",
  "injury_status": "Questionable",
  "impact_summary": "Consider lowering the max bid or waiting for roster clarity.",
  "source": "Dark Blue live news feed",
  "source_type": "LIVE_FEED",
  "created_by": "Valuation API ingestion",
  "created_at": "2026-05-15T18:10:00.000Z"
}
```

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `player_id` | number | Yes* | Player id from `/v1/players` |
| `player_name` | string | Yes* | Alternative lookup when id is unavailable |
| `type` | `INJURY`, `TRANSACTION`, `CONTRACT`, `NEWS`, `LINEUP`, `ROLE` | Yes | Update class used by Draft Kit cards |
| `severity` | `LOW`, `MEDIUM`, `HIGH` | Yes | Also becomes `risk_level` |
| `headline` | string | Yes | Supplied by the Valuation API news source |
| `body` | string | Yes | Supplied by the Valuation API news source |
| `injury_status` | string | No | Injury-specific status text |
| `transaction_status` | string | No | Transaction, lineup, or role status text |
| `contract_status` | string | No | Contract-specific status text |
| `impact_summary` | string | No | Draft/valuation impact summary |
| `source` | string | No | Human-readable source label |
| `source_type` | `LIVE_FEED`, `MANUAL_DEMO` | Yes | Production ingestion or operator demo push |
| `created_by` | string | No | Ingestion actor label |
| `created_at` | ISO timestamp | No | Defaults to server time |

*Provide either `player_id` or `player_name`. If both are provided, `player_id` is used first.

### POST `/v1/player-updates/demo`

Purpose: create an operator-triggered demo update through the same persisted Valuation API player-update service used by live ingestion. Draft Kit receives this through the proxied player-update SSE stream.

Auth: `X-License-Key` required.

Headers:

```http
Content-Type: application/json
X-License-Key: <active license key>
```

Example:

```http
POST /v1/player-updates/demo
X-License-Key: <active license key>
```

The created update is marked with `source_type: "MANUAL_DEMO"` and `origin: "VALUATION_API"`.

### GET `/v1/mlb/depth-charts`

Purpose: return MLB active roster/depth context used by the Draft Kit depth chart view.

Auth: `X-License-Key` required.

Headers:

```http
X-License-Key: <active license key>
```

Query parameters:

| Parameter | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `refresh` | `1`, `true`, or omitted | No | omitted | Forces a fresh MLB Stats API request when truthy |

Example:

```http
GET /v1/mlb/depth-charts?refresh=1
X-License-Key: <active license key>
```

## Error And Auth Behavior

Missing license key on protected API routes:

```json
{
  "error": "Unauthorized",
  "code": "NO_KEY"
}
```

Invalid license key:

```json
{
  "error": "Unauthorized",
  "code": "INVALID_KEY"
}
```

Valid key from a blocked IP, when allowlists are configured:

```json
{
  "error": "Forbidden",
  "code": "IP_NOT_ALLOWED"
}
```

Missing buyer session on session-only auth routes:

```json
{
  "error": "Unauthorized",
  "code": "AUTH_REQUIRED"
}
```

## Deployment Notes

The production deployment uses:

- Cloudflare Tunnel routing `darkbluevalue.anythingavenue.com` to the static site service.
- Cloudflare Tunnel routing `darkblueapi.anythingavenue.com` to the Express API service.
- PM2 process `darkbluevalue-site` for the static site.
- PM2 process `darkblueapi-service` for the valuation API.
- SQLite for buyer accounts, sessions, password reset tokens, and generated license keys.
- SMTP for production password reset emails.

Do not commit `.env` values or generated SQLite runtime databases. The repo ignores `valuation-api/data/valuation-auth.db*`.
