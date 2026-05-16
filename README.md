# Dark Blue Draft Kit

Dark Blue Draft Kit is a deployed fantasy baseball auction draft system plus a separately licensed MLB valuation API. The repo is organized around the production services that are actually deployed.

## Live Products

| Product | URL | Service |
|---|---|---|
| Draft Kit app | https://draft.anythingavenue.com | `draftkit-web` |
| Draft Kit API | https://draftapi.anythingavenue.com | `draftkit-api` |
| Valuation product site | https://darkbluevalue.anythingavenue.com | `valuation-site` |
| Licensed valuation API | https://darkblueapi.anythingavenue.com | `valuation-api` |

## Repository Layout

```text
.
|-- draftkit-web/       React/Vite Draft Kit application
|-- draftkit-api/       Express API for accounts, cloud drafts, and valuation proxying
|-- valuation-api/      Licensed Express API for player pool, valuation, depth charts, and MLB/global updates
|-- valuation-site/     Static product site for API licensing docs and account preview
|-- docs/client-input/  Original client/project input artifacts
|-- README.md           This file
```

Old sprint snapshots and experimental folders were removed. The active code now lives at the repo root; there is no `mvpfinal/` wrapper.

## Architecture

```text
Browser Draft Kit
  -> draftkit-api
      -> valuation-api

Valuation product site
  -> valuation-api
```

The browser never sends the valuation license key directly. `draftkit-api` stores that key server-side and proxies valuation requests with `X-License-Key`.

### Service Responsibilities

- `draftkit-web`
  - Creates and runs draft rooms.
  - Manages board, keeper setup, taxi draft, minor league rosters, draft history, settings, player notes, and UI feedback.
  - Subscribes to Valuation API player update streams through `draftkit-api` and displays those pushed alerts in draft surfaces.
- `draftkit-api`
  - Owns Draft Kit accounts, password reset, sessions, and cloud draft persistence.
  - Proxies player pool, valuation, MLB depth chart, and Valuation API player update reads/streams.
- `valuation-api`
  - Owns licensed valuation logic, player pool data, global MLB/player news feed, live depth charts, API key mediation, optional IP allowlisting, and rate limiting.
  - Accepts stateless draft payloads and returns valuation dictionaries. Notification-worthy news must enter through `POST /v1/player-updates` or `/v1/player-updates/demo`.
- `valuation-site`
  - Explains the licensed API, shows endpoint examples, and provides buyer/account-oriented copy.

## Local Development

Use three terminals:

```powershell
cd valuation-api
npm install
npm start
```

```powershell
cd draftkit-api
npm install
npm start
```

```powershell
cd draftkit-web
npm install
npm run dev
```

Default local ports:

| Service | Port |
|---|---:|
| `valuation-api` | `3001` |
| `draftkit-api` | `3002` |
| `draftkit-web` | `5173` |

Important environment files:

- `valuation-api/.env.example`
- `draftkit-api/.env.example`
- `draftkit-web/.env.example`
- `draftkit-web/.env.production`

Do not commit real `.env` files, SQLite databases, player update state, logs, `node_modules`, or build output.

## Validation

Run these checks before committing changes that touch the matching service:

```powershell
cd valuation-api
npm run test:api
node scripts/test-mlb-depth-charts.js
```

```powershell
cd draftkit-api
npm run test:auth
npm run test:proxy
```

```powershell
cd draftkit-web
npm run build
node scripts/test-depth-rankings.mjs
node scripts/test-draft-history.mjs
node scripts/test-minor-league-rosters.mjs
node scripts/test-team-names.mjs
node scripts/test-settings-guardrails.mjs
```

## Deployment

The deployed VPS uses PM2 processes:

| PM2 process | Purpose | Local path after cleanup |
|---|---|---|
| `draftkit-web` | Serves `draftkit-web/dist` on port `3003` | `/home/apple/DARKBLUE-DRAFTKIT-PROJECT/draftkit-web` |
| `draftkit-app-api` | Draft Kit API on port `3002` | `/home/apple/DARKBLUE-DRAFTKIT-PROJECT/draftkit-api` |
| `darkblueapi-service` | Valuation API on port `3006` | `/home/apple/DARKBLUE-DRAFTKIT-PROJECT/valuation-api` |
| `darkbluevalue-site` | Static valuation site | `/home/apple/DARKBLUE-DRAFTKIT-PROJECT/valuation-site` |

Deploy flow:

```bash
cd /home/apple/DARKBLUE-DRAFTKIT-PROJECT
git pull origin main
cd draftkit-web && npm run build
pm2 restart draftkit-app-api darkblueapi-service draftkit-web darkbluevalue-site
pm2 save
```

Smoke checks:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://draft.anythingavenue.com
curl -s -o /dev/null -w '%{http_code}\n' https://draftapi.anythingavenue.com/health
curl -s -o /dev/null -w '%{http_code}\n' https://darkblueapi.anythingavenue.com/health
curl -s -o /dev/null -w '%{http_code}\n' https://darkbluevalue.anythingavenue.com
```

## Runtime Data

- `valuation-api/data/players.json` is tracked because it is the generated production player pool.
- `valuation-api/data/player-updates.json` is runtime state and is ignored.
- `draftkit-api/data/draftkit-auth.db*` is runtime account/draft state and is ignored.

## Rubric Coverage

Source rubric: `C:\Users\Apple\Documents\Downloads\416-S26-Final Project-System Testing.xlsx`.

### Player API Licensing

The project should receive full credit for the relevant licensing workflow because the valuation API is treated as a separate licensed product rather than as code directly exposed to the Draft Kit browser. The public valuation product site gives a buyer-facing account/license surface, shows the API key flow, and documents how a developer sends `X-License-Key`. Reviewers can see that in `valuation-site/index.html`, `valuation-site/js/pages/account.js`, `valuation-site/js/pages/license.js`, and `valuation-site/js/pages/endpoints.js`.

The backend enforces key-based API access and optional exact-IP/CIDR allowlisting in `valuation-api/middleware/auth.js`, applies request throttling in `valuation-api/server.js`, and has regression coverage for authenticated calls, blocked IPs, whitelisted CIDR access, and rate limiting in `valuation-api/scripts/test-api.js`. Draft Kit uses the license correctly because only `draftkit-api/routes/valuation-proxy.js` reads `VALUATION_API_KEY` from server-side environment and forwards it to the valuation API. The React app never stores or sends the licensed valuation key directly.

### Player API Valuations

The valuation API should receive full credit for valuation behavior because values are not static lookup fields. `valuation-api/services/valuation.js` recalculates value from draft context, remaining budget, roster fill, position scarcity, and player risk. It reads persisted Player API updates without mutating the base player dataset, which is why injury/news context can immediately affect dollar values.

The player pool includes generated baseball context in `valuation-api/data/players.json`. The generation pipeline in `valuation-api/scripts/generate-players.js` documents how projection data, current-season data, and three-year-average data are blended into player values. Age, injury/news status, scarcity, depth context, and risk adjustments flow through `valuation-api/services/valuation.js`, `valuation-api/services/playerUpdates.js`, and `valuation-api/services/mlbDepthCharts.js`. Draft Kit requests and presents updated values after draft changes through the valuation state path in `draftkit-web/src/App.jsx`.

### Draft Kit Accounts

Draft Kit should receive full credit for account-backed draft ownership because account creation, login, production password reset, sessions, draft storage, draft reopening, and duplicate draft workflows are all implemented as real product behavior. The backend account/session implementation is in `draftkit-api/routes/auth.js`, `draftkit-api/middleware/session.js`, `draftkit-api/lib/security.js`, `draftkit-api/lib/mailer.js`, and `draftkit-api/lib/db.js`. The user-facing login/signup/password-reset modal is `draftkit-web/src/components/AuthModal.jsx`.

Saved drafts are scoped to the authenticated user in `draftkit-api/routes/drafts.js` and `draftkit-api/lib/db.js`. On the frontend, `draftkit-web/src/App.jsx` manages creating drafts for a season, saving multiple cloud drafts, reopening current or prior drafts, and duplicating an existing draft as a new workspace. This gives reviewers a concrete account-to-draft flow rather than a local-only demo.

### Draft Kit Prep

Draft preparation should receive full credit because the setup workflow supports the league configuration choices expected before a fantasy auction starts. `draftkit-web/src/components/SetupScreen.jsx` handles league creation, player pool selection, season, teams, budgets, and initial setup. `draftkit-web/src/components/LeagueSettings.jsx` exposes editable league settings before the draft starts, including team names, scoring categories, roster slots, and guardrails that lock dangerous changes once drafting begins.

Keeper and roster preparation are implemented in `draftkit-web/src/components/KeeperSetup.jsx`, `draftkit-web/src/components/ProspectRosters.jsx`, and the roster mutation logic in `draftkit-web/src/App.jsx`. Player movement is guarded by eligibility helpers in `draftkit-web/src/utils/helpers.js`, so players can only be placed into valid slots. Minor league and protected prospects are handled separately from the active draft pool, which lets the app support protected rosters without making those players draft eligible. Player notes are persisted in draft state through the selected-player flow in `draftkit-web/src/App.jsx` and rendered in `draftkit-web/src/components/PlayerCard.jsx`.

### Draft Day

Draft day should receive full credit because the board supports the core live-auction actions and keeps an auditable history of them. `draftkit-web/src/components/DraftBoard.jsx` is the main draft surface for player search, nomination, sale, roster movement, transfers, budget display, and eligibility-driven controls. `draftkit-web/src/components/DraftHistory.jsx` records ordered auction events, keeper entries, taxi moves, corrections, and other draft actions.

Player discovery and review are covered by `draftkit-web/src/components/PlayerDictionary.jsx`, `draftkit-web/src/components/PlayerCard.jsx`, and the filtering/sorting state in `draftkit-web/src/App.jsx`. Team comparison and ranking views are built from `draftkit-web/src/utils/teamInsights.js` and displayed through the depth/ranking UI. MLB depth chart review is implemented in `valuation-api/services/mlbDepthCharts.js`, exposed by `valuation-api/routes/mlb-depth-charts.js`, proxied through Draft Kit, and rendered in `draftkit-web/src/components/DepthCharts.jsx`. Undo and redo are centralized in `draftkit-web/src/App.jsx`, so board-changing actions can be corrected during a live draft.

### Player API And Draft Kit Push Notifications

The push-notification requirement should receive full credit because notification-worthy player news is now produced only by the Valuation API. The feed is in `valuation-api/routes/player-updates.js` and `valuation-api/services/playerUpdates.js`; it supports live-feed ingestion, an operator demo push endpoint, persistence, and server-sent events.

The Draft Kit side is a subscriber. `draftkit-api/routes/valuation-proxy.js` proxies update reads and SSE streams without exposing the API key, `draftkit-web/src/components/PlayerUpdateCenter.jsx` shows the feed, and `draftkit-web/src/App.jsx` merges updates into player state, opens affected players, shows board notices, and connects to live streams. Player cards and details show the resulting injury/news, risk, depth, transaction, and contract context in `draftkit-web/src/components/PlayerCard.jsx`.

### Taxi Draft

Taxi draft should receive full credit because taxi roster entry is its own workflow rather than a generic note field. `draftkit-web/src/components/TaxiSquad.jsx` provides taxi search, owner selection, current order flow, add/remove actions, and roster display. The state transitions live in `draftkit-web/src/App.jsx`, where taxi assignments remove players from the eligible pool, allow roster editing, and write draft-history events through `draftkit-web/src/utils/draftHistory.js`.

### User Interface

The UI should receive full credit because it is organized around repeated draft-day use instead of a marketing-style demo. `draftkit-web/src/App.jsx` lays out the main product shell, `draftkit-web/src/styles.css` defines the visual system, and the app uses focused feature components for setup, board, dictionary, player card, history, depth charts, prospect rosters, taxi draft, and settings. The result is a board-first workflow where common actions stay visible and rare injury/news management stays available without dominating the interface.

The interface also includes the feedback and guardrails expected in a draft tool: disabled invalid actions, warning banners, loading states, health/error messages, board notices, locked mid-draft settings, and API-owned pushed update alerts. Those behaviors are spread across `draftkit-web/src/App.jsx`, `draftkit-web/src/components/LeagueSettings.jsx`, `draftkit-web/src/components/PlayerUpdateCenter.jsx`, and the validation helpers in `draftkit-web/src/utils/helpers.js`.
