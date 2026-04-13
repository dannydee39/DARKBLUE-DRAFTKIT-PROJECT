# mvpfinal Architecture

## Overview

- `mvpfinal` now contains 4 runtime folders split into 2 products:
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

## Folder Structure

- `draftkit-web`
  - React + Vite frontend for the commissioner-facing draft application
  - owns board UI, setup flow, notes, favorites, keeper flow, taxi flow, and account UI
- `draftkit-api`
  - Express backend for Draft Kit auth, cloud draft persistence, and valuation proxying
  - owns user accounts, sessions, draft records, and the backend integration layer used by the frontend
- `valuation-api`
  - Express backend for licensed MLB player data and valuation logic
  - owns player-pool filtering, API-key auth, valuation heuristics, and data-generation scripts
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
  - post-setup configuration editing and safeguards
- `draftkit-web/src/components/KeeperSetup.jsx`
  - keeper workflow
- `draftkit-web/src/components/TaxiSquad.jsx`
  - taxi workflow
- `draftkit-web/src/components/AuthModal.jsx`
  - sign-in / sign-up surface for cloud drafts
- `draftkit-web/src/components/ApiSandbox.jsx`
  - Draft Kit-facing sandbox for testing the valuation flow through the Draft Kit backend
- `draftkit-web/src/utils/cloudApi.js`
  - small client for `draftkit-api` auth and draft routes
- `draftkit-web/src/utils/draftSessions.js`
  - local draft serialization, cloning, validation, and storage helpers
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
  - forwards `/v1/players` and `/v1/valuate` to the licensed valuation API using a server-managed license key
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
- `valuation-api/middleware/auth.js`
  - `X-License-Key` enforcement
- `valuation-api/services/valuation.js`
  - scarcity, inflation, and valuation heuristics
- `valuation-api/data/players.json`
  - normalized runtime MLB player dataset
- `valuation-api/scripts/generate-players.js`
  - rebuilds the player dataset from MLB data sources
- `valuation-api/scripts/validate-player-pool.js`
  - validates the generated player dataset
- `valuation-api/scripts/test-api.js`
  - regression suite for health, auth, player filters, valuation responses, and rate limiting
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
- `draftkit-api`
  - `npm run test:auth`
  - `npm run test:proxy`
- `valuation-api`
  - `npm run test:api`
  - `npm run validate:players`

## Review Notes

- If someone asks where Draft Kit account and draft-save logic lives:
  - `draftkit-api`
- If someone asks where MLB player data and valuation math lives:
  - `valuation-api`
- If someone asks where the buyer-facing API website lives:
  - `valuation-site`
- If someone asks where the commissioner-facing draft app lives:
  - `draftkit-web`
