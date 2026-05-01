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
  - Subscribes to player update streams and sends league-scoped commissioner notes for signed-in cloud drafts.
- `draftkit-api`
  - Owns Draft Kit accounts, sessions, cloud draft persistence, and per-draft commissioner notes.
  - Proxies player pool, valuation, MLB depth chart, and global player update calls to `valuation-api`.
- `valuation-api`
  - Owns licensed valuation logic, player pool data, global MLB/player news feed, live depth charts, API key mediation, and rate limiting.
  - Accepts stateless draft payloads, including local `commissioner_notes`, and returns valuation dictionaries.
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

### Player API Licensing, 10 points

| Rubric item | Points | Coverage |
|---|---:|---|
| Front-End UI mechanisms for developer to create/manage account | 2 | `valuation-site` has an account/dashboard preview for buyer profile, license display, usage, and integration details. |
| Front-End UI for key generation | 2 | `valuation-site` presents the demo key and copyable `X-License-Key` integration flow; production key generation is represented as a buyer/license workflow. |
| Account tied to key generation and use | 2 | The account page ties a buyer profile to the displayed key and usage copy. Runtime API enforcement is key-based in `valuation-api/middleware/auth.js`. |
| IP address whitelisting | 2 | Not fully enforced in backend code today. The product documentation describes server-side key usage; true persisted whitelist rules remain a hardening gap. |
| Request throttling | 2 | `valuation-api` and `draftkit-api` use `express-rate-limit`; tests cover `429` behavior in `valuation-api/scripts/test-api.js`. |
| License used properly by Draft Kit server | 4 | `draftkit-api/routes/valuation-proxy.js` reads the valuation key from server environment and sends `X-License-Key`; the browser never owns the key. |

### Player API Valuations, 10 points

| Rubric item | Points | Coverage |
|---|---:|---|
| Test cases 1-5 variation values quality | 5 | `valuation-api/scripts/test-api.js` exercises authenticated player queries, valuation batches, update effects, rate limits, and pitcher/hitter scenarios. |
| Custom 1 or 3 year stats used | 1 | `valuation-api/scripts/generate-players.js` blends projection, 2025, and 3-year-average CSV statistics into player values. |
| Predictive stats used | 1 | Projection data is weighted in generated player scores and base values. |
| Age used | 1 | Player records include `age`; player cards and depth chart views display age. |
| Injury status used | 1 | Global updates and league notes set `injury_status`/`risk_level`; valuation applies high and medium risk penalties. |
| Scarcity used | 1 | `valuation-api/services/valuation.js` calculates position scarcity from open roster slots and undrafted supply. |
| Depth chart position used | 1 | `valuation-api/services/mlbDepthCharts.js` and `draftkit-web/src/components/DepthCharts.jsx` expose team depth context. |
| New values requested/presented by Draft Kit after every edit | 2 | `draftkit-web/src/App.jsx` invalidates valuation cache on draft state changes, update changes, undo/redo, and roster edits. |

### Draft Kit Accounts, 10 points

| Rubric item | Points | Coverage |
|---|---:|---|
| Account creation and login mechanisms | 2 | `draftkit-api/routes/auth.js` plus `draftkit-web/src/components/AuthModal.jsx`. |
| Account password/login reset/retrieval | 2 | Not implemented; signup/login/logout exist, but password reset is a remaining gap. |
| User can create draft for given year | 2 | Setup captures `season`; cloud draft summary stores season. |
| User can create multiple drafts | 2 | Draft library supports multiple saved draft records. |
| User can access multiple drafts | 2 | Setup/library screen and account modal expose saved draft access. |
| User can access drafts from current and past years | 2 | Saved drafts preserve season/year and can be reopened. |
| Can create new draft using completed draft from previous year | 2 | Duplicate draft flow copies a saved draft workspace for reuse. |

### Draft Kit Prep, 20 points

| Rubric item | Points | Coverage |
|---|---:|---|
| Setup AL-only, NL-only, all MLB | 2 | Setup screen offers MLB/AL/NL pools and fetches matching player data. |
| Custom number of fantasy teams | 2 | Setup/settings support custom owner count before draft start. |
| Custom fantasy team names | 2 | Setup/settings include team name fields and board rename support. |
| Custom stats selection for league | 2 | Setup/settings expose scoring category toggles. |
| Custom hitter and pitcher positions | 2 | Setup/settings expose roster slot counts. |
| Enter pre-draft rosters with contract and dollar values | 2 | Keeper setup records keeper owner, player, slot, and cost. |
| Move player to another position within team | 2 | Board move controls allow eligible slot moves. |
| Only eligible player movement | 2 | `slotAcceptsPlayer` validation gates sale, move, transfer, and keeper placement. |
| Enter minor league player rosters | 2 | `ProspectRosters` supports protected minor league entries. |
| Minor league player not eligible for draft | 2 | Prospects are marked unavailable and removed from active draft pool. |
| Minor league players can move between teams | 2 | Prospect transfer controls move minor league entries between teams. |
| Enter player notes before/during draft | 1 | Player card note field saves notes in draft state. |
| Edit player notes before/during draft | 1 | Player notes can be edited in the card and persist with the draft. |

### Draft Day, 20 points

| Rubric item | Points | Coverage |
|---|---:|---|
| Ordered draft history with full detail | 2 | `DraftHistory` records ordered auction, keeper, taxi, move, transfer, and correction events. |
| Filter players by position | 2 | Board search, dictionary, and depth views include position filters. |
| Filter/search players by name | 2 | Board search and dictionary search by name. |
| Sort players by dollars | 2 | Dictionary and recommendations sort by value/max bid. |
| Sort players by stats | 2 | Dictionary supports stat-oriented display and sorting. |
| Move player to new position | 2 | Board move controls. |
| Any players can move from one team to another | 2 | Transfer controls move active roster entries between teams with budget and eligibility checks. |
| Player details: stats, age, injury status, depth chart, transactions | 2 | Player card shows stats, age, injury/news risk, depth badge, valuation reasoning, and update context. |
| Fantasy team tabular comparison | 2 | Depth/rankings view compares teams. |
| Team comparison sortable by rankings/money/etc. | 2 | Rankings table supports sortable strength, value, budget, roster fill, and risk metrics. |
| View MLB team depth charts | 2 | Depth Charts tab groups MLB teams and positions. |
| Undo/redo for all draft editing | 2 | Global undo/redo supports board-changing actions and keyboard shortcuts. |

### Player API - Draft Kit Push Notification, 10 points

| Rubric item | Points | Coverage |
|---|---:|---|
| Mechanism to force notification-worthy info via Player API | 5 | Global `/v1/player-updates` supports POST and SSE; Draft Kit can publish updates for demo flow. |
| Draft Kit shows updated pushed state | 2 | Player update center, player cards, dictionary, and depth charts merge pushed update state. |
| Draft Kit employs notification system | 2 | Board notices and feed status communicate pushed changes. |
| Player Details - Depth Chart | 1 | Player cards/depth views show depth labels and depth chart context. |
| Player Details - Transactions/Contract Status | 1 | Player details include contract/assignment context from draft state and update feed context. |
| Player Details - Injury/News | 1 | Injury/news notes display in player card and affect valuation risk. |

### Taxi Draft, 10 points

| Rubric item | Points | Coverage |
|---|---:|---|
| Taxi draft order can be specified | 1 | Taxi tab follows selectable/current owner flow. |
| Taxi draft order can be changed | 1 | Current owner can be changed during taxi entry. |
| Players can be entered into taxi rosters in any order | 4 | Taxi picks can be made for any active owner slot. |
| Players can easily be found for taxi entry | 2 | Taxi search uses the shared player pool search. |
| Taxi players removed from eligible list | 4 | Taxi assignment marks players unavailable. |
| Taxi draft rosters can be edited | 2 | Taxi entries can be removed, restored, and tracked in history. |

### User Interface, 10 points

| Rubric item | Coverage |
|---|---|
| Layout quality | Board-first layout keeps draft table, right-side player card, settings, history, depth, and taxi flows accessible. |
| Particular UI problems | Recent cleanup hides uncommon player update controls behind `Manage` and removes bloated persistent injury UI. |
| Color combinations | Dark operational palette with green, blue, red, and amber accents. |
| Conceptual integrity | Draft Kit and licensed valuation API are separate products with separate surfaces. |
| Foolproof design | Disabled/hidden actions, validation banners, locked mid-draft settings, and eligibility checks prevent invalid operations. |
| Quality feedback | Board notices, modal errors, auth errors, API health, loading states, and warning banners are used throughout. |
| Branding | Draft Kit and Dark Blue valuation product names are consistent across app, API site, and docs. |

## Known Gaps

- Valuation API buyer account and key management are product-site/demo level, not a full production billing portal.
- Password reset is not implemented for Draft Kit accounts.
- IP whitelist persistence/enforcement is not implemented.
- The valuation model is intentionally MVP-level; the focus is architecture, integration, and live workflow behavior.
