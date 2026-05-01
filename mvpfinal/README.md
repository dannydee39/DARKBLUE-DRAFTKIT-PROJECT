# mvpfinal Architecture and Final Sprint Handoff

## Overview

- `mvpfinal` contains 4 runtime folders split into 2 products:
  - `DB Draft Kit`
    - `draftkit-web`
    - `draftkit-api`
  - `Dark Blue MLB Valuation API`
    - `valuation-api`
    - `valuation-site`

## Live URLs

- `DB Draft Kit`
  - Frontend: `https://draft.anythingavenue.com`
  - Backend API: `https://draftapi.anythingavenue.com`
- `Dark Blue MLB Valuation API`
  - Product site: `https://darkbluevalue.anythingavenue.com`
  - Licensed API: `https://darkblueapi.anythingavenue.com`

## Current Production Feature Set

### Draft Kit

- Board-first draft setup with saved draft library.
- Keeper league setup with budget-safe keeper contracts.
- Taxi squad setup with configured reserve slots.
- Main auction board with undo/redo, favorites, notes, player cards, and valuation cache.
- True push player news/injury alerts through Server-Sent Events.
- Ordered Draft History tab with filters, sorting, value deltas, remaining budget, and CSV export.
- MLB Depth + Rankings tab:
  - MLB team/position depth chart view.
  - Live MLB active roster enrichment through MLB Stats API.
  - Drafted/keeper/taxi/risk context on depth rows.
  - Owner strength score and sortable team comparison.
- League Settings guardrails:
  - scoring category help,
  - position slot help,
  - roster-impact summary,
  - max-bid impact summary,
  - mid-draft lock and commissioner override context.

### Valuation API

- Licensed player pool endpoint.
- Stateless valuation endpoint for full draft-state snapshots.
- Persisted player news/injury update feed.
- SSE stream for live player update push.
- Live MLB active roster endpoint used by Draft Kit depth charts.
- Buyer-facing documentation site with endpoint examples.

## Folder Structure

- `draftkit-web`
  - React + Vite frontend for the commissioner-facing draft application
  - owns board UI, setup flow, notes, favorites, keeper flow, taxi flow, history/export, depth charts/rankings, settings guardrails, and account UI
- `draftkit-api`
  - Express backend for Draft Kit auth, cloud draft persistence, and valuation proxying
  - owns user accounts, sessions, draft records, player-update proxying, MLB roster proxying, and the backend integration layer used by the frontend
- `valuation-api`
  - Express backend for licensed MLB player data and valuation logic
  - owns player-pool filtering, API-key auth, valuation heuristics, player update persistence, MLB active roster enrichment, and data-generation scripts
- `valuation-site`
  - static product site for the licensed API
  - explains licensing, authentication, endpoints, and buyer-facing usage

## DB Draft Kit

### `draftkit-web`

- Purpose:
  - run the live fantasy auction draft
  - let users create, resume, and manage draft states
  - let signed-in users persist drafts in the cloud through `draftkit-api`
  - consume valuations and player-pool data without exposing license-key logic in the browser

### Main Files

- `draftkit-web/src/App.jsx`
  - top-level application coordinator
  - owns shared league state, player pool, saved-draft state, auth state, valuation cache, and tab routing
- `draftkit-web/src/components/SetupScreen.jsx`
  - create/resume draft flow
  - pool counts and draft-library UI
- `draftkit-web/src/components/DraftBoard.jsx`
  - main draft grid
  - scouting rail
  - sale flow
  - hover/pinned player interactions
- `draftkit-web/src/components/PlayerDictionary.jsx`
  - full player browser outside the board
- `draftkit-web/src/components/LeagueSettings.jsx`
  - post-setup configuration editing, roster-impact summaries, scoring/position help, and safeguards
- `draftkit-web/src/components/KeeperSetup.jsx`
  - keeper workflow
- `draftkit-web/src/components/TaxiSquad.jsx`
  - taxi workflow
- `draftkit-web/src/components/PlayerUpdateCenter.jsx`
  - board-first push news/injury feed and manual publish action
- `draftkit-web/src/components/DraftHistory.jsx`
  - ordered draft history table, filters, sorting, and CSV export
- `draftkit-web/src/components/DepthCharts.jsx`
  - MLB depth chart and owner ranking view
- `draftkit-web/src/components/RankedTeamBanner.jsx`
  - compact team-strength banner on the draft board
- `draftkit-web/src/components/AuthModal.jsx`
  - sign-in / sign-up surface for cloud drafts
- `draftkit-web/src/components/ApiSandbox.jsx`
  - Draft Kit-facing sandbox for testing the valuation flow through the Draft Kit backend
- `draftkit-web/src/utils/cloudApi.js`
  - small client for `draftkit-api` auth and draft routes
- `draftkit-web/src/utils/draftSessions.js`
  - local draft serialization, cloning, validation, and storage helpers
- `draftkit-web/src/utils/draftHistory.js`
  - history event creation, row normalization, and CSV export formatting
- `draftkit-web/src/utils/teamInsights.js`
  - MLB depth chart grouping and owner strength ranking calculations
- `draftkit-web/src/utils/settingsHelp.js`
  - League Settings help metadata and roster-impact calculations
- `draftkit-web/src/constants.js`
  - Draft Kit API base URL and the separate valuation product display URL

### `draftkit-api`

- Purpose:
  - authenticate Draft Kit users
  - persist cloud-saved draft states
  - proxy valuation requests server-side to the licensed valuation product

### Main Files

- `draftkit-api/server.js`
  - Draft Kit API entrypoint
  - CORS, rate limiting, auth routes, draft routes, valuation proxy routes, and health endpoint
- `draftkit-api/routes/auth.js`
  - signup, login, logout, and current-session lookup
- `draftkit-api/routes/drafts.js`
  - CRUD for cloud-saved drafts
- `draftkit-api/routes/valuation-proxy.js`
  - forwards `/v1/players`, `/v1/valuate`, `/v1/player-updates`, `/v1/player-updates/stream`, and `/v1/mlb/depth-charts` to the licensed valuation API using a server-managed license key
- `draftkit-api/lib/db.js`
  - SQLite user/session/draft persistence
- `draftkit-api/lib/security.js`
  - password hashing, token hashing, and user/session helpers
- `draftkit-api/middleware/session.js`
  - cookie parsing, session attachment, and auth guard helpers
- `draftkit-api/scripts/test-auth-drafts.js`
  - auth + cloud-draft regression suite
- `draftkit-api/scripts/test-valuation-proxy.js`
  - valuation proxy regression suite against a live local valuation API instance

## Dark Blue MLB Valuation API

### `valuation-api`

- Purpose:
  - expose a licensed MLB player-data and valuation service
  - let the Draft Kit and outside customers request player pools and dynamic valuations

### Main Files

- `valuation-api/server.js`
  - licensed API entrypoint
  - CORS, rate limiting, API-key auth, route mounting, health, and tester landing page
- `valuation-api/routes/players.js`
  - filtered player-pool endpoint
- `valuation-api/routes/valuate.js`
  - stateless valuation endpoint
- `valuation-api/routes/player-updates.js`
  - persisted player news/injury feed and SSE stream
- `valuation-api/routes/mlb-depth-charts.js`
  - live MLB active roster/depth context endpoint
- `valuation-api/middleware/auth.js`
  - `X-License-Key` enforcement
- `valuation-api/services/valuation.js`
  - scarcity, inflation, and valuation heuristics
- `valuation-api/services/playerUpdates.js`
  - persisted update creation, player decoration, and SSE subscriber broadcast
- `valuation-api/services/mlbDepthCharts.js`
  - MLB Stats API active roster fetch, cache, stale-cache fallback, and local fallback
- `valuation-api/data/players.json`
  - normalized runtime MLB player dataset
- `valuation-api/scripts/generate-players.js`
  - rebuilds the player dataset from MLB data sources
- `valuation-api/scripts/validate-player-pool.js`
  - validates the generated player dataset
- `valuation-api/scripts/test-api.js`
  - regression suite for health, auth, player filters, valuation responses, and rate limiting
- `valuation-api/scripts/test-mlb-depth-charts.js`
  - live roster service cache/normalization test with mocked fetch
- `valuation-api/API_DOCS.md`
  - endpoint contract and integration notes

### `valuation-site`

- Purpose:
  - present the licensed valuation product as its own buyer-facing site
  - show authentication, pricing, and endpoint usage

### Main Files

- `valuation-site/index.html`
  - static entry point
- `valuation-site/js/state.js`
  - valuation API base/display URL and demo key
- `valuation-site/js/pages/license.js`
  - licensing and quickstart UI
- `valuation-site/js/pages/endpoints.js`
  - endpoint explorer and tester UI
- `valuation-site/css/`
  - shared theme and page-specific layout rules

## Product Composition

- `DB Draft Kit` is the full-stack app product.
- `Dark Blue MLB Valuation API` is the separate licensed data + valuation product.
- The Draft Kit frontend does not call the licensed API directly anymore.
- Instead:
  - `draftkit-web` -> `draftkit-api`
  - `draftkit-api` -> `valuation-api`
- This keeps:
  - Draft Kit auth and draft persistence inside the Draft Kit product
  - license-key logic and valuation heuristics inside the valuation product

## Testing

- `draftkit-web`
  - `npm run build`
  - `node scripts/test-depth-rankings.mjs`
  - `node scripts/test-draft-history.mjs`
  - `node scripts/test-settings-guardrails.mjs`
- `draftkit-api`
  - `npm run test:auth`
  - `npm run test:proxy`
- `valuation-api`
  - `npm run test:api`
  - `node scripts/test-mlb-depth-charts.js`
  - `npm run validate:players`

## Runtime Data Notes

- `valuation-api/data/players.json` is source-controlled because it is the generated runtime player pool.
- `valuation-api/data/player-updates.json` is runtime state and is intentionally ignored. The player update service creates it when updates are published.
- Draft Kit auth/cloud draft SQLite files are runtime state and are ignored.

## Deployment Notes

The current VPS process layout is:

- `draftkit-web`: serves `draftkit-web/dist` on port `3003`.
- `draftkit-app-api`: serves Draft Kit API on port `3002`.
- `darkblueapi-service`: serves Valuation API on port `3006`.
- `darkbluevalue-site`: serves the valuation product site.

Typical deploy validation:

```powershell
cd mvpfinal/draftkit-web
node scripts/test-depth-rankings.mjs
node scripts/test-settings-guardrails.mjs
npm run build

cd ../draftkit-api
npm run test:auth
npm run test:proxy

cd ../valuation-api
npm run test:api
node scripts/test-mlb-depth-charts.js
```

## Review Notes

- If someone asks where Draft Kit account and draft-save logic lives:
  - `draftkit-api`
- If someone asks where MLB player data and valuation math lives:
  - `valuation-api`
- If someone asks where the buyer-facing API website lives:
  - `valuation-site`
- If someone asks where the commissioner-facing draft app lives:
  - `draftkit-web`
