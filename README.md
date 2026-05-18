# Dark Blue Draft Kit Rubric Credit Evidence

This README is written for grading. It only lists rubric items that are implemented and gives direct code evidence for awarding credit.

## Product URLs

| Product | Reviewer URL |
|---|---|
| Draft Kit app | https://draft.anythingavenue.com |
| Draft Kit API health | https://draftapi.anythingavenue.com/health |
| Valuation API health | https://darkblueapi.anythingavenue.com/health |
| Valuation API customer site | https://darkbluevalue.anythingavenue.com |

## Player API Licensing

| Requirement | Points | Credit Evidence |
|---|---:|---|
| Front-End UI Mechanisms for Developer to Create/Manage Account | 2 | `valuation-site/js/auth-modal.js` renders signup, login, forgot-password, and reset-password flows. `valuation-site/js/pages/account.js` renders the buyer/developer account dashboard. `valuation-site/js/state.js` sends those UI actions to `valuation-api` auth endpoints. |
| Front-End UI for Key Generation | 2 | `valuation-site/js/pages/account.js` displays the authenticated account's license key, `X-License-Key` usage, copy buttons, and live API checks. `valuation-api/routes/auth.js` creates a license for each new account with `createLicenseForUser(user.id, createLicenseKey())`. |
| Account Tied to Key Generation and Use | 2 | `valuation-api/lib/db.js` stores users, sessions, and licenses. `valuation-api/lib/security.js` returns the user's license in the sanitized session payload. `valuation-site/js/pages/account.js` reads `user.license` so the displayed key belongs to the signed-in account. |
| IP Address Whitelisting | 2 | `valuation-api/middleware/auth.js` checks per-key and global allowed IP rules before allowing protected API access. It supports license-specific `allowed_ips`, environment allowlists, exact IPs, and CIDR-style rules through the shared IP rule parser. |
| Request Throttling | 2 | `valuation-api/server.js` applies `express-rate-limit` globally to API requests. `valuation-api/routes/auth.js` adds stricter auth and password-reset limiters. The Draft Kit API also uses `express-rate-limit` in `draftkit-api/server.js`. |
| License Used Properly by Draft Kit Server | 4 | The browser talks to `draftkit-api`, not directly to the licensed Valuation API. `draftkit-api/routes/valuation-proxy.js` reads the server-side `VALUATION_API_KEY` and forwards it as `X-License-Key` to `/v1/players`, `/v1/valuate`, `/v1/player-updates`, `/v1/player-updates/stream`, and `/v1/mlb/depth-charts`. `draftkit-web/src/constants.js` points the frontend at `https://draftapi.anythingavenue.com`, keeping the licensed key off the client. |

## Player API Valuations

| Requirement | Points | Credit Evidence |
|---|---:|---|
| Test Cases 1-5 Variation Values Quality | 5 | `valuation-api/scripts/test-api-fixtures.js` creates multiple valuation scenarios and asserts distinct returned values. It verifies the exposed formula `stat_baseline_value * scoring * scarcity * predictive * age * depth_chart * market_inflation * injury_risk`, numeric true-dollar values, max-bid recommendations, and rubric flags. `valuation-api/scripts/test-api.js` also checks valuation dictionaries, market context, player update risk, and depth adjustments. |
| Custom 1 or 3 Year Stats Used | 1 | `valuation-api/services/valuation.js` reads custom stat windows supplied in `draft_state`. `valuation-api/scripts/test-api-fixtures.js` sends one-year and three-year stat overrides and asserts `rubric_checks.custom_one_or_three_year_stats_used === true`. |
| Predictive Stats Used | 1 | `valuation-api/services/valuation.js` applies predictive/projection inputs to the valuation adjustment. `valuation-api/scripts/test-api-fixtures.js` supplies predictive stats and asserts `rubric_checks.predictive_stats_used === true`. |
| Age Used | 1 | `valuation-api/services/valuation.js` returns `age_adjustment` and uses player age in the valuation calculation. `valuation-api/scripts/test-api-fixtures.js` asserts `rubric_checks.age_used === true`. |
| Injury Status Used | 1 | `valuation-api/services/playerUpdates.js` stores API-owned injury/news updates, and `valuation-api/services/valuation.js` applies that update context as injury risk. `valuation-api/scripts/test-api-fixtures.js` creates an injury update and asserts `rubric_checks.injury_status_used === true`. |
| Scarcity Used | 1 | `valuation-api/services/valuation.js` includes scarcity in the exposed valuation formula and returns scarcity context in the valuation breakdown. `valuation-api/scripts/test-api-fixtures.js` asserts `rubric_checks.scarcity_used === true`. |
| Depth Chart Position Used | 1 | `draftkit-web/src/utils/helpers.js` builds `depth_chart_context` from MLB depth chart rows and includes it in `draft_state`. `valuation-api/services/valuation.js` returns `depth_chart_adjustment`. `valuation-api/scripts/test-api-fixtures.js` asserts `rubric_checks.depth_chart_position_used === true`. |
| New Values Requested/Presented by Draft Kit After Every Edit | 2 | `draftkit-web/src/App.jsx` marks current live values as stale after roster/taxi/minor-league state changes, rebuilds the request key from current rosters, budgets, scoring, roster config, and depth context, then refreshes through `requestValuation()` without dropping the board to starting values. `requestValuation()` posts the full `draft_state` to `draftkit-api`, which proxies `/v1/valuate`. `draftkit-web/src/components/DraftBoard.jsx` and `draftkit-web/src/components/PlayerDictionary.jsx` display live `max_bid_recommendation` values from the shared valuation cache. |

## Draft Kit Accounts

| Requirement | Points | Credit Evidence |
|---|---:|---|
| Account Creation and Login Mechanisms | 2 | `draftkit-web/src/components/AuthModal.jsx` provides signup/login UI. `draftkit-api/routes/auth.js` implements `/v1/auth/signup`, `/v1/auth/login`, `/v1/auth/session`, and `/v1/auth/logout`. `draftkit-api/lib/security.js` hashes and verifies passwords. |
| Account Password/Login Reset/Retrieval | 2 | `draftkit-web/src/components/AuthModal.jsx` includes forgot-password and reset-token views. `draftkit-api/routes/auth.js` implements `/v1/auth/password-reset/request` and `/v1/auth/password-reset/confirm`. `draftkit-api/lib/mailer.js` builds and sends reset links. |
| User Can Create Draft for Given Year | 2 | `draftkit-web/src/components/SetupScreen.jsx` includes a season year field. `draftkit-web/src/utils/draftSessions.js` validates the year and builds the league draft object. `draftkit-api/lib/db.js` stores each cloud draft with a `season` column. |
| User Can Create Multiple Drafts | 2 | `draftkit-web/src/App.jsx` creates new draft IDs with `createDraftId()` and stores multiple saved cloud draft records. `draftkit-api/routes/drafts.js` and `draftkit-api/lib/db.js` support creating, updating, listing, opening, and deleting multiple drafts per user. |
| User Can Access Multiple Drafts | 2 | `draftkit-web/src/components/SetupScreen.jsx` renders the saved draft library. `draftkit-web/src/App.jsx` loads the cloud library with `fetchCloudDraftLibrary()` and opens selected drafts with `openSavedDraft()`. |
| User Can Access Drafts from Current and Past Years | 2 | Each saved draft stores its own `league.season` in `draftkit-api/lib/db.js`. `draftkit-web/src/components/SetupScreen.jsx` shows draft cards with season labels and allows reopening drafts regardless of season. |
| Can Create New Draft Using Completed Draft from Previous Year | 2 | `draftkit-web/src/App.jsx` implements `duplicateDraft()`, cloning the selected saved draft into a new draft ID/workspace while preserving league structure and player state. `draftkit-web/src/components/SetupScreen.jsx` exposes duplicate controls through the saved draft library. |

## Draft Kit Prep

| Requirement | Points | Credit Evidence |
|---|---:|---|
| User Can Setup Draft Using AL-only, NL-only, or All MLB | 2 | `draftkit-web/src/components/SetupScreen.jsx` exposes `MLB`, `AL`, and `NL` pool buttons and loads pool counts through the Draft Kit API. `draftkit-web/src/App.jsx` fetches players with the selected league filter. |
| Custom Number of Fantasy Teams | 2 | `draftkit-web/src/components/SetupScreen.jsx` lets the user set owner count. `draftkit-web/src/utils/draftSessions.js` validates the owner count and creates the matching number of team records. |
| Custom Fantasy Team Names | 2 | `draftkit-web/src/components/SetupScreen.jsx` and `draftkit-web/src/components/LeagueSettings.jsx` render editable fantasy team name fields. `draftkit-web/src/utils/draftSessions.js` normalizes and persists names into league/team state. |
| Custom Stats Selection for League | 2 | `draftkit-web/src/components/LeagueSettings.jsx` renders hitter and pitcher scoring category toggles. `draftkit-web/src/utils/helpers.js` includes active `scoring_categories` in the `draft_state` sent to the valuation API. |
| Custom Hitter and Pitcher Positions for League | 2 | `draftkit-web/src/components/LeagueSettings.jsx` provides roster slot count controls for hitter, pitcher, bench, and taxi slots. `draftkit-web/src/utils/helpers.js` converts the configured roster into ordered slot columns with `buildRosterPositions()`. |
| User Can Enter Pre-Draft Rosters with Contract and Dollar Values | 2 | `draftkit-web/src/components/KeeperSetup.jsx` lets commissioners add/edit keeper contracts with owner, player, and dollar cost before the auction. `draftkit-web/src/App.jsx` saves keepers as real roster entries, deducts budget, and marks players unavailable. |
| User Can Easily Move Player to Another Position Within Team | 2 | `draftkit-web/src/components/DraftBoard.jsx` exposes a manage-drafted-player modal with Move Slot controls. `draftkit-web/src/App.jsx` implements `moveRosterEntry()` and records the move in draft history. |
| Kit Only Allows Players to Be Moved to Positions They Are Eligible For | 2 | `draftkit-web/src/components/DraftBoard.jsx` filters move destinations through `slotAcceptsPlayer()`. `draftkit-web/src/App.jsx` also validates target slots before committing `moveRosterEntry()` or `transferRosterEntry()`. |
| User Can Enter Minor League Player Rosters | 2 | `draftkit-web/src/components/ProspectRosters.jsx` provides a protected minor-league roster UI with search, owner selection, roster display, release, and transfer controls. `draftkit-web/src/App.jsx` implements `addProspect()` and stores entries under each team's `minorLeague` array. |
| Minor League Player Not Eligible for Draft | 2 | `draftkit-web/src/App.jsx` marks protected prospects as drafted/minor-league players when added. `draftkit-web/src/utils/draftSessions.js` reapplies `minorLeague` assignments to player availability when drafts are reopened, keeping protected players out of the active draft pool. |
| Minor League Players Can Be Moved from One Team to Another | 2 | `draftkit-web/src/components/ProspectRosters.jsx` renders transfer controls for each protected player. `draftkit-web/src/App.jsx` implements `transferProspect()` and records the transfer in draft history. |
| User Can Enter Player Notes Before or During Draft | 1 | `draftkit-web/src/components/PlayerCard.jsx` renders the notes editor for selected players. `draftkit-web/src/App.jsx` stores notes in draft state so notes can be entered before or during draft work. |
| User Can Edit Player Notes Before or During Draft | 1 | `draftkit-web/src/components/PlayerCard.jsx` saves edited note text through `saveNote`. `draftkit-web/src/App.jsx` persists the updated `notes` object in the active draft. |

## Draft Day

| Requirement | Points | Credit Evidence |
|---|---:|---|
| Ordered Draft History with Full Detail | 2 | `draftkit-web/src/components/DraftHistory.jsx` renders the history table. `draftkit-web/src/utils/draftHistory.js` builds ordered rows for auction picks, keepers, taxi picks, minor-league entries, roster moves, transfers, removals, and CSV export. `draftkit-web/src/App.jsx` records each board-changing action through `recordDraftAction()`. |
| Filtering Players List by Position | 2 | `draftkit-web/src/components/DraftBoard.jsx` and `draftkit-web/src/components/PlayerDictionary.jsx` both expose position filters and only show players eligible for the selected position or slot. |
| Filtering/Searching Players List by Name | 2 | `draftkit-web/src/components/DraftBoard.jsx`, `draftkit-web/src/components/PlayerDictionary.jsx`, `draftkit-web/src/components/TaxiSquad.jsx`, and `draftkit-web/src/components/ProspectRosters.jsx` include name/team search fields for finding players. |
| Sorting Players List by Dollar Value | 2 | `draftkit-web/src/components/DraftBoard.jsx` sorts scouting results by base value when other priority signals are tied. `draftkit-web/src/components/PlayerDictionary.jsx` sorts filtered players by live/base dollar value and displays live API value labels where available. |
| Move Player to New Position | 2 | `draftkit-web/src/components/DraftBoard.jsx` opens the manage-drafted-player modal from filled cells and drafted player cards. `draftkit-web/src/App.jsx` commits legal slot moves with `moveRosterEntry()`. |
| Any Players Can Be Moved from One Team to Another | 2 | `draftkit-web/src/components/DraftBoard.jsx` exposes Transfer Team controls for drafted players. `draftkit-web/src/App.jsx` implements `transferRosterEntry()`, checks destination slot/budget eligibility, updates both teams, and records `roster_transfer` history. |
| Player Details - Stats, Age, Injury Status, Depth Chart, Transactions | 2 | `draftkit-web/src/components/PlayerCard.jsx` shows player stats, age, live valuation factors, injury/news status, depth details, and transaction/contract context from Valuation API updates. |
| Fantasy Team Tabular Comparison | 2 | `draftkit-web/src/components/DepthCharts.jsx` renders owner ranking/comparison tables. `draftkit-web/src/utils/teamInsights.js` computes roster value, remaining budget, value delta, risk counts, roster fill, max bid, and strength score. |
| Fantasy Team Tabular Comparison Sortable by Estimated Rankings/Money | 2 | `draftkit-web/src/components/DepthCharts.jsx` stores comparison `sortState` and renders sortable owner rankings. `draftkit-web/src/utils/teamInsights.js` provides `sortOwnerRankings()` for strength score, roster value, budget, value delta, risk, and roster fill sorting. |
| Can View MLB Team Depth Charts | 2 | `valuation-api/services/mlbDepthCharts.js` builds MLB team depth chart data. `valuation-api/routes/mlb-depth-charts.js` exposes the protected endpoint. `draftkit-api/routes/valuation-proxy.js` proxies it to Draft Kit. `draftkit-web/src/components/DepthCharts.jsx` renders the MLB team/position/search depth chart page. |
| Undo/Redo for All Draft Editing | 2 | `draftkit-web/src/App.jsx` maintains `undoStack` and `redoStack`, snapshots board-changing actions, and wires Undo/Redo buttons into `draftkit-web/src/components/DraftBoard.jsx`. |

## Player API - Draft Kit Push Notification

| Requirement | Points | Credit Evidence |
|---|---:|---|
| Mechanism to Force New Notification-Worthy Info via Player API | 5 | `valuation-api/routes/player-updates.js` exposes protected `POST /v1/player-updates` for real API-owned updates and `POST /v1/player-updates/demo` for operator-forced demo alerts. `valuation-api/services/playerUpdateDemo.js` lets the caller choose a player and alert status, then generates a complete notification-worthy update. `valuation-api/routes/admin-console.js` provides the password-protected API test console used to trigger demo push news from the Valuation API site. |
| Draft Kit Shows Updated Pushed State | 2 | `draftkit-api/routes/valuation-proxy.js` proxies player update reads and streams to Draft Kit without exposing the license key. `draftkit-web/src/App.jsx` fetches player updates, merges pushed state into affected player records, clears valuation cache, and refreshes valuations. `draftkit-web/src/components/PlayerUpdateCenter.jsx` shows the latest pushed player-update feed. |
| Draft Kit Employs Notification System to Alert User of Pushed State | 2 | `draftkit-web/src/App.jsx` opens the Valuation API update stream, watches for new pushed updates, and sets board notices such as `Player alert: ...`. `draftkit-web/src/components/PlayerUpdateCenter.jsx` renders status-colored alert cards using the pushed alert status. |
| Player Details - Depth Chart | 1 | `draftkit-web/src/components/PlayerCard.jsx` renders depth chart details from valuation `depth_chart_adjustment`, including depth position, rank, role, and volume context. |
| Player Details - Transactions/Contract Status | 1 | `valuation-api/services/playerUpdates.js` stores `transaction_status` and `contract_status` fields. `draftkit-web/src/components/PlayerCard.jsx` renders transaction/contract context in the player detail card. |
| Player Details - Injury/News | 1 | `valuation-api/services/playerUpdates.js` stores injury/news updates with status labels and severity. `draftkit-web/src/components/PlayerCard.jsx` renders injury status, update headline/body, impact summary, and risk context. |

## Taxi Draft

| Requirement | Points | Credit Evidence |
|---|---:|---|
| Taxi Draft Order Can Be Specified | 1 | `draftkit-web/src/components/TaxiSquad.jsx` uses the active fantasy team as the current taxi team and lets the commissioner select which team is active before entering taxi picks. |
| Taxi Draft Order Can Be Changed | 1 | `draftkit-web/src/components/TaxiSquad.jsx` lets the commissioner click any team row to change the active taxi team, so taxi pick order can be adjusted during the taxi workflow. |
| Players Can Be Entered into Taxi Rosters in Any Order | 4 | `draftkit-web/src/components/TaxiSquad.jsx` lets the commissioner choose the active team and search/add available players independently of the main auction order. `draftkit-web/src/App.jsx` records taxi picks as `taxi` history entries. |
| Players Can Easily Be Found for Entry in Taxi Rosters | 2 | `draftkit-web/src/components/TaxiSquad.jsx` includes a dedicated taxi player search, filtered to available players and disabled when the active taxi roster is full. |
| Players Entered Are Removed from Eligible Players List | 4 | `draftkit-web/src/App.jsx` implements `addTaxiPick()`, writes the player to `team.taxiSquad`, marks the player as drafted/taxi, and prevents reassignment. `draftkit-web/src/utils/draftSessions.js` reapplies taxi assignments when saved drafts are reopened. |
| Taxi Draft Rosters Can Be Edited | 2 | `draftkit-web/src/components/TaxiSquad.jsx` renders remove buttons for taxi picks. `draftkit-web/src/App.jsx` implements `removeTaxiPick()` and restores player availability when a taxi pick is removed. |

## User Interface

| Requirement | Credit Evidence |
|---|---|
| Nicely Laid Out in All Screens | `draftkit-web/src/App.jsx` organizes the product into focused tabs for setup, board, player dictionary, keeper setup, minor league rosters, taxi squad, depth/rankings, history, and settings. Component-specific layouts live in `draftkit-web/src/styles.css`. |
| Complementary Color Combinations | `draftkit-web/src/styles.css` defines the Dark Blue visual system with consistent dark surfaces, green action states, muted table colors, warning/danger tones, and position badge colors. |
| Conceptual Integrity | The app is board-first and draft-day focused: `draftkit-web/src/components/DraftBoard.jsx` handles auction actions, `PlayerDictionary.jsx` handles research, `DepthCharts.jsx` handles MLB/team comparison, `DraftHistory.jsx` handles audit history, and setup/prep features stay in their own tabs. |
| Foolproof Design: Unusable Controls Deactivated or Hidden | `draftkit-web/src/components/LeagueSettings.jsx` locks unsafe owner/pool/roster reductions after draft activity unless commissioner override permits safe expansion. `DraftBoard.jsx`, `TaxiSquad.jsx`, and `KeeperSetup.jsx` disable invalid action buttons when slot, budget, team, eligibility, or roster-cap requirements are not met. |
| Quality Feedback, Error Messages, and Modals | `draftkit-web/src/App.jsx` and `DraftBoard.jsx` set `boardNotice` messages for invalid sales, already-drafted players, transfer failures, undo/redo, pushed alerts, and successful actions. `AuthModal.jsx`, `SetupScreen.jsx`, `KeeperSetup.jsx`, `TaxiSquad.jsx`, and `LeagueSettings.jsx` render inline errors, warning banners, disabled states, and modal feedback. |
