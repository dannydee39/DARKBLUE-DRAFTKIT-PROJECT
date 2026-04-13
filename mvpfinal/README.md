# Dark Blue Draft Kit Architecture

## Overview

- `mvpfinal` contains 3 connected products:
  - `draftkit`: the main fantasy auction draft application
  - `api`: the valuation engine and player-data service
  - `api-site`: the separate licensing, docs, and account-facing website for the API
- High-level relationship:
  - `draftkit` is the app the commissioner uses during the draft
  - `api` supplies player pool data and live bid recommendations
  - `api-site` explains how the API works and how a licensed user would integrate it

## Folder Structure

- `mvpfinal/draftkit`
  - React + Vite frontend
  - owns the live draft state, saved drafts, notes, favorites, keeper flow, taxi flow, and board UI
- `mvpfinal/api`
  - Express API
  - owns valuation logic, player-pool filtering, license-key auth, and data generation scripts
- `mvpfinal/api-site`
  - static site for API licensing and documentation
  - separate from the Draft Kit app

## draftkit

- Purpose:
  - run the live auction draft
  - let the user create and resume drafts
  - manage teams, budgets, roster slots, keepers, taxi squad, and player notes
  - request live values from the API during the draft

### Main Files

- `src/App.jsx`
  - top-level application coordinator
  - controls setup vs main-screen flow
  - owns shared app state:
    - league config
    - teams
    - player pool
    - notes
    - favorites
    - selected player
    - valuation cache
    - saved draft library
  - handles major draft actions such as recording sales, undo, taxi additions, and draft persistence
- `src/components/SetupScreen.jsx`
  - create new draft flow
  - resume existing draft flow
  - saved draft library UI
  - setup-time pool selection and draft validation
- `src/components/DraftBoard.jsx`
  - main live draft board
  - team grid and roster cells
  - scouting/search rail
  - hover/pin player interactions
  - sale modal and nomination flow
- `src/components/PlayerDictionary.jsx`
  - broader player browser outside the board context
  - useful for scouting, searching, and note/favorite workflows
- `src/components/LeagueSettings.jsx`
  - league configuration editing after setup
  - commissioner-facing controls and safeguards
- `src/components/KeeperSetup.jsx`
  - keeper assignment and review flow
- `src/components/TaxiSquad.jsx`
  - taxi squad and reserve-pick workflow
- `src/components/ApiSandbox.jsx`
  - internal testing/debugging surface for API behavior
- `src/utils/helpers.js`
  - stateless helper functions
  - roster expansion
  - max-bid math
  - API payload shaping
  - value-display formatting
- `src/utils/draftSessions.js`
  - saved-draft serialization and cloning helpers
  - local storage key
  - draft record creation
  - setup validation
- `src/constants.js`
  - default roster and scoring definitions
  - API base URL and demo key
  - shared display constants

### draftkit State Design

- The frontend is local-first.
- The app keeps the current league state in React state and browser storage.
- The API is not the source of truth for draft progress.
- This means:
  - the UI remains responsive even if the API is temporarily unavailable
  - the API can stay stateless
  - outside customers can theoretically wire their own frontend to the same API contract

### Saved Drafts

- Saved drafts are stored locally through `draftSessions.js`.
- Each saved draft contains:
  - league config
  - teams
  - current player pool snapshot
  - notes
  - favorites
  - current owner turn
  - timestamps
- The draft library is meant to support multiple seasons and multiple league instances on the same machine.

## api

- Purpose:
  - provide the Draft Kit with player pool data
  - return contextual player valuations during the draft
  - enforce API key authentication
  - expose a stable contract that a customer could integrate against

### Main Files

- `server.js`
  - creates the Express app
  - sets up CORS
  - applies rate limiting
  - mounts the API routes
  - exposes `/health`
- `routes/players.js`
  - serves the player pool
  - supports filters like league, position, tier, and drafted exclusions
- `routes/valuate.js`
  - accepts a full `draft_state`
  - validates required input
  - calls the valuation service
- `middleware/auth.js`
  - checks `X-License-Key`
  - blocks unauthorized access to protected endpoints
- `services/valuation.js`
  - main valuation engine
  - finds the nominated player
  - analyzes drafted supply vs remaining supply
  - calculates scarcity and inflation
  - returns live value guidance
- `data/players.json`
  - normalized runtime player dataset
  - consumed by both `/v1/players` and the valuation engine
- `scripts/generate-players.js`
  - ETL pipeline that rebuilds `players.json`
  - currently uses real MLB data
- `scripts/validate-player-pool.js`
  - sanity check for generated player data
- `scripts/test-api.js`
  - automated API regression test suite
- `API_DOCS.md`
  - API contract explanation and integration notes

### API Endpoints

- `/health`
  - service health/status endpoint
  - used to verify the API is online
- `/v1/players`
  - returns the player pool
  - supports filtering
  - used by the Draft Kit to populate its searchable draft data
- `/v1/valuate`
  - accepts the current draft state plus a nominated player
  - returns live valuation information

### Valuation Composition

- The valuation engine is heuristic and stateless.
- The API expects the client to send the full draft context.
- The valuation output is based on:
  - a precomputed player `baseValue`
  - positional scarcity
  - draft-room inflation
  - remaining budgets and roster slots
- Important output fields include:
  - `true_dollar_value`
  - `max_bid_recommendation`
  - `market_inflation`
  - `market_context`
  - `scarcity_tier`
  - `position_scarcity`
  - `reasoning`

### Why the API Is Stateless

- The backend does not persist a live league.
- Instead, the Draft Kit sends the current draft state on demand.
- Benefits:
  - easier testing
  - easier deployment
  - simpler licensing story
  - easier adaptation for third-party customers who want to map their own CSV or app state into the same request format

## Player Data Pipeline

- Runtime data is stored in `api/data/players.json`.
- That file is generated, not hand-maintained.
- Current source data comes from real MLB sources through `generate-players.js`.
- The pipeline:
  - fetches player metadata and season statistics
  - blends multiple recent seasons
  - normalizes player identity and position eligibility
  - computes fantasy-oriented scoring values
  - computes `baseValue`
  - assigns tiers and ranks
  - outputs one consistent player schema for runtime use

### Important Data Characteristics

- The player pool is normalized so the frontend does not need to care where the original stats came from.
- Common runtime fields include:
  - player identity
  - MLB id
  - team
  - league
  - eligible positions
  - tier
  - rank
  - base value
  - projected stats
  - headshot/photo URL

## api-site

- Purpose:
  - present the API as a product
  - explain licensing and authentication
  - show what the API returns
  - provide docs/quickstart information
- This is intentionally separate from `draftkit`.

### Main Files

- `index.html`
  - entry point for the site
- `js/router.js`
  - lightweight hash router for the site pages
- `js/state.js`
  - global site state
  - API base/display URL
  - demo key
- `js/pages/license.js`
  - licensing and authentication explanation
  - quickstart content
  - plan comparison
- `js/pages/endpoints.js`
  - endpoint-oriented docs/tester surface
- `css/`
  - page styling, shared theme variables, navigation styling, and page-specific layout rules

### Role in the System

- `api-site` is not the valuation engine.
- It is the wrapper product around the valuation engine.
- Think of it as:
  - storefront
  - onboarding surface
  - quick reference for buyers and reviewers

## How Everything Ties Together

- `draftkit` calls `api` to:
  - load players
  - get live valuations
- `api-site` points to the same `api` and explains how to use it
- Shared ideas across all 3 products:
  - license key
  - player pool contract
  - valuation response contract

## Testing and Validation

- Backend
  - `npm run test:api`
  - validates health, auth, player filters, valuation success/failure paths, and rate limiting
- Data pipeline
  - `npm run validate:players`
  - checks the generated player pool
- Frontend
  - `npm run build` in `mvpfinal/draftkit`
  - catches integration/build issues
  - manual testing is also done through the live board and setup flows
- API integration
  - `ApiSandbox.jsx` provides an internal place to inspect API behavior from within the Draft Kit

## Local Development

### API

- Start from `mvpfinal/api`
- install dependencies
- create `.env` from `.env.example`
- run the dev server

### Draft Kit

- Start from `mvpfinal/draftkit`
- install dependencies
- run the Vite dev server

### Expected Local Flow

- API runs locally
- Draft Kit points to the API
- green/online indicators confirm API connectivity

## Practical Review Notes

- If someone asks where the main logic lives:
  - Draft app logic is mainly in `draftkit/src/App.jsx`
  - valuation logic is mainly in `api/services/valuation.js`
  - data generation logic is mainly in `api/scripts/generate-players.js`
- If someone asks how a customer would use the API:
  - they would map their own draft state into the same request contract used by the Draft Kit
- If someone asks what the system is optimized for:
  - fast local draft interaction
  - clear API contract
  - realistic value suggestions rather than perfect predictive modeling
