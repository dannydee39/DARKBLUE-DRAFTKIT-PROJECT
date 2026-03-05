# Dark Blue Draft Kit - Master MVP (MVP Only)

Date: 2026-03-05  
Source: `docs/client-input/master_requirements_2026-02-20.txt`

## 1) MVP Goal
Deliver a **deployed**, working demonstration of two separate products:
1. Draft Kit Web App (frontend + its own backend)
2. Valuation API Service (independent licensed API)

This MVP is intentionally focused on proving architecture, integration, and live workflow viability.  
It is **not** the full product.

## 2) MVP In-Scope (What We Build Now)
1. Separate deployment for Draft Kit and Valuation API (different servers/domains)
2. API key authentication for Valuation API requests
3. One primary Draft/Auction dashboard with fast table + player search panel
4. Core draft state CRUD:
   - Create league/draft instance
   - Configure baseline league rules (budget, team count, roster slots, pool type)
   - Record auction result (player, winning team, bid)
   - Edit/undo mistake (return player to pool + budget correction)
5. Stateless valuation request flow:
   - Draft Kit sends current draft state payload
   - API returns computed valuation (MVP heuristic formula)
6. Player dictionary view with filtering/search
7. Player notes (save + display in player panel)
8. API landing/docs + simple testing sandbox (manual JSON input/output)
9. Opponent roster gaps table with slot-level counts per team
10. Taxi squad mode (MVP-lite): post-main-roster toggle and $1 reserve picks
11. Auction choice recommendation (MVP-lite): top-N candidates by simple scoring heuristic
12. Live MLB updates (MVP-lite): transaction/news feed with periodic refresh
13. Team depth chart view (MVP-lite): starter/backup labels from available data

## 3) MVP Out of Scope (Deferred to Post-MVP)
1. Advanced valuation model quality (ML/statistical sophistication)
2. True real-time websocket transaction push with guaranteed delivery
3. Multi-account production auth hardening (SSO, billing, tenant admin)
4. Production-grade observability/SRE stack
5. Recommendation explainability tuning and model validation suite

## 4) MVP Architecture (Master Plan)
## Services
1. `draftkit-web` (React/Vite or Next.js UI)
2. `draftkit-app-api` (Draft state CRUD, user notes, league config)
3. `valuation-api` (licensed service; takes state payload + returns values)
4. `mongo` (player + league + draft state data)

## Deployment Targets
1. `valuation-api`: deployed on a VPS (private server; licensed API host)
2. `draftkit-web`: deployed on Render (public frontend)
3. `draftkit-app-api`: deployed as a Render web service
4. `mongo`: managed database accessible by app services

## Critical Interface
`draftkit-web -> draftkit-app-api -> valuation-api`

- `draftkit-app-api` owns league/draft CRUD
- `valuation-api` does not own fantasy draft state; it computes from request payload (stateless valuation contract)
- `valuation-api` requires `x-api-key`

## 5) MVP Data Contract (Minimum)
### Draft State Payload (sent to valuation API)
```json
{
  "leagueId": "lg_2026_nl_01",
  "budgetPerTeam": 260,
  "teams": [
    { "id": "T1", "remainingBudget": 147, "openSlots": { "C": 1, "1B": 0, "P": 4 } }
  ],
  "nominatedPlayer": {
    "playerId": "mlb_12345",
    "positions": ["OF"],
    "projectedStats": { "HR": 24, "RBI": 83, "SB": 11 }
  },
  "scoringCategories": ["HR", "RBI", "SB", "AVG"],
  "poolType": "NL_ONLY"
}
```

### Valuation API Response (MVP)
```json
{
  "playerId": "mlb_12345",
  "maxBid": 19,
  "confidence": "MVP_SIMPLIFIED",
  "explain": [
    "budget_pressure:+3",
    "positional_scarcity:+2",
    "replacement_level:-1"
  ]
}
```

## 6) MVP Communication Protocol (Low-Latency, Event-Driven)
### Trigger Rule
Only **draft state changing actions** trigger valuation recalculation requests:
1. Player drafted/assigned
2. Player moved between teams
3. Player returned to pool
4. Keeper set/edited

Non-state-changing bid chatter does not trigger recomputation.

### Request Pattern
1. Frontend sends one update request per state change
2. Request includes full current state snapshot + `baseVersion` + `clientEventId`
3. Backend validates, persists event, computes valuations against current snapshot
4. Response returns compact draft updates immediately
5. Full player valuation table is fetched on demand by page/view

### Endpoint Contract (MVP)
1. `POST /v1/drafts/{id}/events`
   - Write state change event (`DRAFTED`, `MOVED`, `RETURNED_TO_POOL`, `KEEPER_SET`)
   - Returns `{newVersion, affectedTeams, nominatedPlayerValue}`
2. `GET /v1/drafts/{id}/board?sinceVersion=...`
   - Returns roster/budget deltas for dashboard
3. `GET /v1/drafts/{id}/valuations?nominatedPlayerId=...`
   - Returns fast single-player valuation
4. `GET /v1/drafts/{id}/recommendations?limit=20`
   - Returns top-N candidate recommendations
5. `GET /v1/drafts/{id}/players?page=1&pageSize=50&sort=fpts`
   - Paginated dictionary (on demand)
6. `GET /v1/drafts/{id}/players/{playerId}`
   - Player card/details + notes + depth label

### Consistency Controls
1. Idempotency via `clientEventId`
2. Monotonic `stateVersion` on every write/read response
3. Frontend discards stale responses (`response.version < local.version`)
4. Retry with exponential backoff for transient API failures

## 7) MVP Dataset Baseline (From Provided Google Drive Files)
MVP valuation and dictionary are based on these imported CSV files:
1. [projections-NL.csv](/home/apple/DARKBLUE-DRAFTKIT-PROJECT/sample/data/projections-NL.csv)
2. [3Year-average-NL-stats.csv](/home/apple/DARKBLUE-DRAFTKIT-PROJECT/sample/data/3Year-average-NL-stats.csv)
3. [2025-player-NL-stats.csv](/home/apple/DARKBLUE-DRAFTKIT-PROJECT/sample/data/2025-player-NL-stats.csv)

Source links provided by client/team:
1. `https://drive.google.com/open?id=19uGNJ_7TsWfYn1SaXA-NVcGoy0kq0xT7&usp=drive_copy`
2. `https://drive.google.com/open?id=1be5uM7N2kU0nmUk6lVaNbgaGRZgGy8jN&usp=drive_copy`
3. `https://drive.google.com/open?id=11myG8qTlK5EXqxERuVe5h4Xf04Pw7dVu&usp=drive_copy`

Current dataset shape:
1. Each file has `2,221` rows including header (`2,220` players)
2. Shared columns: `Player, AB, R, H, 1B, 2B, 3B, HR, RBI, BB, K, SB, CS, AVG, OBP, SLG, FPTS`
3. MVP pool scope defaults to NL dataset rows from these files

MVP valuation baseline (eligible for MVP scope):
1. Parse player identity and position/team from `Player` field
2. Join by normalized player name across all three files
3. Build weighted fantasy baseline score:
   - `Projection FPTS` (primary)
   - `2025 FPTS` (recent performance)
   - `3-Year Average FPTS` (stability)
4. Apply live draft-state adjustments (budget pressure, scarcity, open slots)

## 8) MVP UI Views
1. API Landing + License Docs
2. API Sandbox (paste payload -> receive value)
3. League Setup (rules + pool type + roster counts)
4. Keeper Init (minimal table import/manual add)
5. Draft Dashboard (single-screen war room)
6. Player Dictionary + Notes
7. Taxi Squad Panel ($1 pick flow)
8. Recommendation Panel (top-N suggested nominations)
9. MLB News/Transactions Feed
10. Depth Chart Panel in player cursor/details

## 9) MVP Acceptance Checklist
1. Both products are deployed to non-localhost URLs
2. Draft Kit can call Valuation API with valid key
3. Invalid/missing key returns 401 from Valuation API
4. User can record player purchase and see updated budgets/rosters
5. User can undo/edit purchase and state recalculates
6. User can request valuation for nominated player from live state
7. User can search player list and save note
8. User can switch to taxi squad mode and add $1 reserve picks
9. Recommendation panel returns top-N candidates from current state
10. MLB updates feed refreshes and displays latest transaction items
11. Player detail view shows depth chart role label (starter/backup)
12. State-changing events are idempotent and versioned
13. Player dictionary and valuations are paginated/on-demand
14. MVP seed data loads from the three NL CSV files in `sample/data/`
15. Team can demo end-to-end flow in < 8 minutes without manual DB edits

## 10) Story Coverage Matrix (MVP-Only)
Legend: `FULL`, `PARTIAL`

| Story ID | Title | MVP Coverage | Notes |
|---|---|---|---|
| SCRUM-27 | Create Draft Instance | FULL | Required to start any flow |
| SCRUM-28 | Configure League Settings | FULL | Budget/roster/team/pool minimum set included |
| SCRUM-41 | Keeper Initialization | FULL | Manual and CSV-lite keeper preload supported |
| SCRUM-42 | Real-Time Bid Entry & Sync | FULL | Manual entry + immediate state update |
| SCRUM-43 | Dynamic Player Valuation | PARTIAL | Dynamic and state-aware, but heuristic model only |
| SCRUM-44 | Opponent Roster Gaps Matrix | FULL | Team-by-position gap table included |
| SCRUM-45 | Taxi Squad Management | FULL | MVP-lite toggle with $1 picks |
| SCRUM-46 | Custom Scoring Config | FULL | Category toggles persisted and sent to valuation API |
| SCRUM-47 | Auction Choice Recommendation | PARTIAL | Top-N heuristic recommendations only |
| SCRUM-48 | Player Dictionary | FULL | Search/filter + notes |
| Additional: League Pool Selection | League Rule | FULL | AL/NL/Both filter |
| Additional: Commissioner Manual Override | Draft Correction | FULL | Return-to-pool/edit flow included |
| Additional: Custom Player Notes | Notes | FULL | Included in dictionary/dashboard panel |
| Additional: Player Cursor UI | Fast panel | FULL | Dedicated right-side player card panel |
| Additional: Separate Server Deployment | Architecture | FULL | Required |
| Additional: API Licensing Auth | Security | FULL | API key required |
| Additional: Stateless State Sync | API design | FULL | Payload-driven valuation |
| Additional: API Testing Sandbox | API UX | FULL | Included |
| Additional: Live MLB Transactions | Realtime feed | PARTIAL | Polling-based feed in MVP, websocket later |
| Additional: Team Depth Charts | MLB context | PARTIAL | Starter/backup labeling only in MVP |

## 11) Self-Grade (MVP Requirement Retention)
Scoring method:
1. `FULL = 1.0`
2. `PARTIAL = 0.5`
3. Weight all 20 listed requirements equally for MVP readiness

Calculated score:
- FULL: 16 -> `16.0`
- PARTIAL: 4 -> `2.0`
- Total: `18.0 / 20 = 90.0%`

### Interpreting 90.0%
This MVP retains the large majority of documented requirements while staying minimal:
1. Core architecture and licensing constraints are fully covered.
2. All major user-facing flows are demonstrated in lightweight form.
3. Remaining gaps are implementation depth/quality improvements, not missing capabilities.

## 12) Immediate Build Order (Execution Plan)
1. Deploy `valuation-api` to VPS and verify public HTTPS endpoint
2. Deploy `draftkit-web` to Render and `draftkit-app-api` to Render web service
3. Implement API key middleware on valuation API
4. Implement league + draft state schema and CRUD
5. Import three NL datasets into player seed pipeline
6. Build event-based API writes (`events`) and versioned read endpoints
7. Build draft dashboard table + player search panel + opponent gap matrix
8. Integrate valuation request from nominated player workflow
9. Add edit/undo transaction flow and keeper preload
10. Add player notes, dictionary view, and player cursor panel
11. Add taxi squad mode and recommendation panel (heuristic)
12. Add MLB transaction polling feed + starter/backup depth labels
13. Ship API docs + sandbox page
14. Prepare MVP demo script and verify from clean browser session
