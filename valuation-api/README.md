# valuation-api

Licensed MLB valuation API. This service is intentionally separate from Draft Kit state.

## Start Here

- `server.js` creates the Express app, health endpoint, rate limiter, and API route mounts.
- `middleware/auth.js` enforces the `X-License-Key` header and optional IP allowlists.
- `routes/auth.js` owns buyer signup, login, logout, password reset, and account session checks.
- `lib/db.js` stores buyer accounts, sessions, password reset tokens, and per-account license keys in SQLite.
- `routes/players.js` returns filtered player-pool data.
- `routes/valuate.js` accepts stateless draft payloads and returns valuation dictionaries.
- `routes/player-updates.js` owns global MLB/player update CRUD and SSE.
- `routes/mlb-depth-charts.js` exposes live/fallback MLB roster depth data.
- `services/valuation.js` contains the valuation math, scarcity logic, risk adjustment, and commissioner-note overlay.
- `services/playerUpdates.js` owns global player update persistence.
- `services/mlbDepthCharts.js` owns MLB Stats API depth data and fallback behavior.

## Valuation Inputs

`POST /v1/valuate` expects:

- team count and budget
- scoring categories
- current team rosters
- roster configuration
- optional `commissioner_notes` from Draft Kit

Commissioner notes are read from the request only. They affect that response but are not persisted by the valuation API.

## Commands

```powershell
npm install
npm start
npm run test:auth
npm run test:api
node scripts/test-mlb-depth-charts.js
```

## Buyer Accounts And License Keys

The valuation site uses `POST /v1/auth/signup`, `POST /v1/auth/login`,
`GET /v1/auth/me`, and `POST /v1/auth/logout` for real buyer sessions. Signup
creates a unique active license key for that account and returns it in the
sanitized user payload. The same key can immediately authorize protected
valuation endpoints through `X-License-Key`.

Password reset uses hashed single-use reset tokens in SQLite. Production reset
emails require SMTP settings. In local/test environments, set
`MAIL_TRANSPORT=json` and `PASSWORD_RESET_EXPOSE_TOKEN=true` to validate the
flow without sending real email.

Regenerate the tracked player pool:

```powershell
node scripts/generate-players.js
```

## API Key IP Allowlists

Leave both allowlist variables empty to allow any client with a valid key. Set
`API_IP_WHITELIST` to apply one global allowlist to every key, or set
`API_KEY_IP_WHITELIST` for per-key rules:

```text
API_IP_WHITELIST=127.0.0.1,198.51.100.0/24
API_KEY_IP_WHITELIST=DB-2026-DEMO-0001=127.0.0.1|198.51.100.0/24;DB-2026-DEMO-0002=*
```

Rules support exact IPs, IPv4 CIDR ranges, and `*`. The middleware reads
`CF-Connecting-IP` and `X-Forwarded-For` before falling back to the socket IP so
the deployed service works correctly behind Cloudflare and reverse proxies. Keep
`TRUST_PROXY_HOPS` set to the known proxy hop count for the deployment instead
of using unrestricted proxy trust.
