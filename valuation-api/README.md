# valuation-api

Licensed MLB valuation API. This service is intentionally separate from Draft Kit state.

## Start Here

- `server.js` creates the Express app, health endpoint, rate limiter, and API route mounts.
- `middleware/auth.js` enforces the `X-License-Key` header.
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
npm run test:api
node scripts/test-mlb-depth-charts.js
```

Regenerate the tracked player pool:

```powershell
node scripts/generate-players.js
```
