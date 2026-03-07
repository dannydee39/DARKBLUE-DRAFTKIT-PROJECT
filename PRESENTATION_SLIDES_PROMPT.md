# PRESENTATION SLIDES PROMPT
## Dark Blue Auction Draft Kit — MVP Presentation (Updated)
### Incorporates Professor Guidance: Story Arc · 20–30 Min · Equal Participation · UML · Licensing · Deployed Servers

---

> **HOW TO USE THIS FILE:**
> Copy everything from the horizontal rule below through the end of this document and paste it into a new Claude conversation. Claude will generate a complete, formatted slide deck.
>
> Before presenting, search for every `[TEAM MEMBER` placeholder and fill in real names and roles.
> Before presenting, confirm ALL demo URLs point to the deployed servers, NOT localhost.

---

> **TIMING RULES (from professor):**
> - 45-minute slot: ~10 min Q&A + ~5 min changeover = **20 min minimum, 30 min hard cap**
> - Target **~25 minutes** of spoken content
> - All team members must participate **approximately equally** (~6 min per person for 4-person team)
> - Never read from a script — speaker notes are talking points, not a script
> - Never disparage the project or teammates
> - Story arc required: **a beginning, a middle, and an end**
> - Visuals and bullet points over walls of text
> - 1–2 simple UML class diagrams where they genuinely help explain structure

---

---

## PASTE BELOW THIS LINE INTO CLAUDE

---

Please generate a complete, professional presentation slide deck for a university Software Engineering MVP presentation. For every slide, output the following clearly labeled sections:

- **SLIDE [N]: [TITLE]**
- **PRESENTER:** [suggest which team member — numbered 1-4 — should deliver this slide based on equal participation]
- **CONTENT:** (concise bullet points, code block, table, or diagram — choose the most visual format, not text walls)
- **SPEAKER NOTES:** (natural spoken talking points, 4–6 sentences — written as if actually saying them out loud, NOT a script)

**Visual/Aesthetic Guidelines:**
- Theme: Dark navy/charcoal background (#0d1b2a), white + ice-blue text, gold/amber accent for highlights
- Bold sans-serif for titles (Barlow Condensed or similar), clean body font (Inter)
- Subtle baseball diamond or field-line texture suggestion — professional, not garish
- Code snippets: dark code block, monospace, syntax-highlighted style on a slightly lighter card
- Diagrams: described in `[DIAGRAM: ...]` blocks with enough detail to reproduce in any tool
- UML class diagrams: hand-sketch style is fine — drawn on a whiteboard in the slide, or a clean box-and-arrow format
- Every slide should feel like a polished product pitch deck

**Presentation Context:**
- Course: University Software Engineering class — MVP milestone
- Audience: Professor + classmates with SE background
- Total speaking time: 20–30 minutes hard (professor cuts at 30)
- Story arc required: **Beginning → Middle → End**
- Goal: Convince the customer (professor/evaluator) to keep funding this product
- Two products must be acknowledged as deployed to real servers (not localhost)
- Professor will specifically ask about the **licensing mechanism**

---

## STORY ARC STRUCTURE

**BEGINNING (~5 min, slides 1–4):** The hook — who we are, what we built, why it matters, what makes it special
**MIDDLE — Architecture (~10–12 min, slides 5–12):** How we built it — map to class activities in order (requirements, architecture, design, implementation, key decisions)
**MIDDLE — Demo (~8–10 min, slides 13–16):** See it live — running on deployed servers
**END (~3–4 min, slides 17–19):** What's next — sprints, roadmap, and the ask

---

## SLIDE STRUCTURE AND CONTENT TO GENERATE

---

### SLIDE 1 — Title Slide
**Part of story arc:** BEGINNING

Content to include:
- Product name: **Dark Blue Auction Draft Kit**
- Tagline: **"Every dollar. Every pick. Every edge."**
- Subtitle: Real-Time Fantasy Baseball Auction Draft Management
- Lines: "Software Engineering — MVP Presentation · Spring 2026"
- Live API URL: `draftapi.anythingavenue.com` (show it — proves deployment)

Make the title large, impactful, and immediately communicates this is a real deployed product.

Speaker notes: Presenter welcomes audience, states the product name and one-sentence pitch. Mentions both products are live right now at the URL on the screen — not running on localhost.

---

### SLIDE 2 — Team
**Part of story arc:** BEGINNING

Generate a team slide with placeholder strings — **do not replace them**. Add italic note "(fill in names before presenting)".

Team members:
- [TEAM MEMBER 1] — [ROLE 1]
- [TEAM MEMBER 2] — [ROLE 2]
- [TEAM MEMBER 3] — [ROLE 3]
- [TEAM MEMBER 4] — [ROLE 4]

Each entry has a placeholder name and a self-selected role (e.g. "Backend / API Lead", "Frontend Lead", "Data Pipeline & Valuation", "QA & DevOps").

Also include one line: **"We actually used it — each of us drafted our own fantasy team with this tool."** (this shows the team dog-fooded their own product before the presentation)

Speaker notes: brief intro of each person, one sentence on their primary contribution, and the genuine product experience point.

---

### SLIDE 3 — The Problem / What We're Solving
**Part of story arc:** BEGINNING

This is the HOOK. Make it visceral and concrete, not abstract.

Content:
- Fantasy baseball auction draft: 12 teams, 260+ players, $260 per team, real-time bidding in a room
- Stakes: get it wrong and your season is dead before Opening Day
- Current options: expensive SaaS (overkill for a casual league) or spreadsheets (no math, no enforcement)
- The gap: a lightweight, mathematically rigorous tool that tells you what a player is **actually worth** before the bidding starts — and re-prices them as the draft happens

Visual suggestion: a split card showing LEFT = "spreadsheet chaos" vs RIGHT = "our live board" — contrast of complexity vs cleanliness.

Speaker notes: set the scene for the audience, including those who don't follow baseball. Emphasize the real-time constraint — every second counts during a live auction. Make the audience feel the problem before the solution.

---

### SLIDE 4 — What Makes Us Special (Product Vision)
**Part of story arc:** BEGINNING

Content — emphasis on differentiation, not feature list:
- **Two deployed products, not one:** a licensed REST API (the valuation engine) that any client can consume, and a React frontend (the draft board) that consumes it
- **Real math, not gut instinct:** SGP-based valuation with live scarcity and inflation adjustments — the number changes as your leaguemates spend money
- **Licensing-first design:** the API issues license keys — built to be monetized from day one, not bolted on later
- **We actually used it:** we ran our own auction draft with this tool before the presentation

Include one large, compelling screenshot suggestion: the live draft board mid-draft with valuations showing in the right panel.

Speaker notes: articulate the product vision clearly — this is a tool for serious commissioners who want an edge. Distinguish from a class project by pointing to the deployed URL and the literal dollars it could charge.

---

### SLIDE 5 — Requirements Phase: User Stories → Data Model
**Part of story arc:** MIDDLE (Architecture)
**Tie to class activity: Requirements elicitation and user story writing**

Content:
- User stories drove every structural decision — not the other way around
- Key story that shaped the entire data model:
  > *"As a commissioner, I need to record which player went to which team at what price, so I can track budget and roster completeness."*
- That one story forced us to define: the `pick` object, the `rosterSlot` concept, and slot-indexed storage

Include a table (keep it tight):

| User Story | Technical Artifact Created |
|---|---|
| Track player + team + price | `pick` object: `{ name, price, slotIndex, draftedPos }` |
| See recommended max bid | Valuation panel + `POST /v1/valuate` |
| Enforce position eligibility | Slot eligibility rules (C/1B/UTIL/BN logic) |
| Search player inline | `InlineCellSearch` component |
| License the API | `X-License-Key` header + key validation middleware |

Speaker notes: connect user stories to concrete technical artifacts — show this was a disciplined requirements process, not ad hoc coding. The licensing row is important — point it out.

---

### SLIDE 6 — Architecture Decision: Two Deployed Products
**Part of story arc:** MIDDLE (Architecture)
**Tie to class activity: Architectural design, ADRs, deployment**

Content:
- **Decision:** Separate valuation logic into a standalone licensed REST API
- **Why not embed it in the frontend?** Valuation math is complex, independently updatable, and designed to be licensed to multiple clients
- **Tradeoff accepted:** Network latency per valuation request; CORS configuration

**This is live right now:**

```
React/Vite Frontend               Express.js API
(Deployed: [INSERT FRONTEND URL]) (Deployed: draftapi.anythingavenue.com)
        │                                  │
        └──────── HTTP REST (JSON) ─────────┘
                  POST /v1/valuate
                  GET /v1/players
```

Include:
```
[DIAGRAM: Two deployment boxes.
  Left: "React/Vite SPA — [frontend URL]"
    - Draft Board, 9 Components, React useState
  Right: "Express.js API — draftapi.anythingavenue.com"
    - GET /v1/players (licensed)
    - POST /v1/valuate (licensed)
    - players.json (file-based data)
  Arrow between them labeled: "HTTPS REST / JSON"
  Both boxes have a cloud icon above them to signal real deployment]
```

Speaker notes: stress that BOTH products are on real servers — not localhost. This is the two-product requirement from day one. The API is independently deployable, versioned, and licensable.

---

### SLIDE 7 — Licensing Mechanism (Professor Will Ask)
**Part of story arc:** MIDDLE (Architecture)
**Tie to class activity: Security design, B2B API monetization**

> **NOTE TO PRESENTERS:** The professor will specifically ask about how licensing works. Know this slide cold.

Content — explain the full flow:

1. **API issues a license key** at registration: `DB-2026-DEMO-0001`
2. Every request must include the key in a custom header: `X-License-Key: <key>`
3. Server-side middleware validates the key on **every request** before any business logic runs
4. Invalid or missing key → `401 Unauthorized` immediately
5. Future: keys can carry metadata — rate limits, seat counts, expiry dates, plan tiers

```js
// Middleware: runs before every route handler
function validateLicenseKey(req, res, next) {
  const key = req.headers["x-license-key"];
  if (!key || !isValidKey(key)) {
    return res.status(401).json({ error: "Invalid or missing license key" });
  }
  next(); // key is valid — proceed
}
```

Business model implication:
- Basic plan: `GET /v1/players` only — see data, no valuation
- Pro plan: `POST /v1/valuate` unlocked — live AI-adjusted max bids
- Enterprise: white-label API + custom league configurations

Speaker notes: explain the licensing mechanism step by step. The key flows: client sends it in headers → middleware intercepts → validates → either blocks or proceeds. Make the business model point — this is how the API earns money.

---

### SLIDE 8 — Data Pipeline + Player Data Model
**Part of story arc:** MIDDLE (Architecture)
**Tie to class activity: Data modeling**

Content:
- Player data is the foundation — without accurate projections, the math means nothing
- **Decision:** Merge three CSV sources with a priority hierarchy:
  1. Current-season projections (most predictive)
  2. 2025 actuals (fallback if no projection)
  3. 3-year historical average (fallback for new/fringe players)
- **Why file-based, not a DB?** MVP scope; player data is read-only at runtime; zero external dependencies; committed to source control

**UML Class Diagram — Player Data Model:**

```
[DIAGRAM: UML class box style (hand-sketch is fine)

┌─────────────────────────────────┐
│           <<entity>>            │
│              Player             │
├─────────────────────────────────┤
│ id: string                      │
│ name: string                    │
│ pos: string[]                   │
│ team: string                    │
│ tier: "Elite"|"Starter"|"Bench" │
│ league: "NL"|"AL"               │
│ hr: number                      │
│ rbi: number                     │
│ sb: number                      │
│ avg: number                     │
│ era: number | null (pitchers)   │
│ so: number                      │
│ whip: number                    │
│ fpts: number                    │
│ baseValue: number               │
│ note?: string                   │
│ injury?: string                 │
└─────────────────────────────────┘
         used by
            ↓
┌─────────────────────────────────┐
│       ValuationRequest          │
├─────────────────────────────────┤
│ nominated_player: string        │
│ total_teams: number             │
│ budget_per_team: number         │
│ scoring_categories: string[]    │
│ teams: TeamSnapshot[]           │
│ roster_config: RosterConfig     │
└─────────────────────────────────┘
            ↓ returns
┌─────────────────────────────────┐
│       ValuationResult           │
├─────────────────────────────────┤
│ max_bid_recommendation: number  │
│ true_dollar_value: number       │
│ reasoning: string               │
│ position_scarcity: object       │
│ scarcity_tier: string           │
└─────────────────────────────────┘
]
```

Result: 313 NL-only players in the MVP player pool.

Speaker notes: walk through the diagram — left box is the raw player entity (lives in players.json), middle is what gets sent to the API, right is what comes back. This is a real data contract, not a toy.

---

### SLIDE 9 — Valuation Algorithm: SGP + Scarcity + Inflation
**Part of story arc:** MIDDLE (Architecture)
**Tie to class activity: Algorithm design**

Content:
- **SGP = Standings Gain Points** — the industry-standard currency for converting raw stats into auction value
- Pipeline steps:

```
┌──────────────────────────────────────────────────────────┐
│  1. SGP Score   — sum of (projected stat × standings     │
│                    gain rate) for each scoring category   │
│  2. Scarcity    — multiply by position scarcity factor   │
│                   (catchers are rarer → cost more)       │
│  3. Inflation   — adjust for how concentrated the        │
│                   remaining budget is in the pool        │
│  4. Max Bid     — True Dollar Value × 0.92               │
│                   (leave 8% cushion to avoid overpaying) │
└──────────────────────────────────────────────────────────┘
```

```
valuate(player, draftState):
  sgpScore  = Σ(projStat[cat] × sgpRate[cat]) for cat in CATEGORIES
  scarcity  = positionScarcityMultiplier(player.pos, draftState)
  inflation = computeInflation(draftState.budgets, draftState.picks)
  trueDV    = clamp(sgpScore × scarcity × inflation, 1, 80)
  return round(trueDV × 0.92)   // max bid = 92% of true dollar value
```

Speaker notes: briefly explain what SGP means — converting batting average points or home runs into a currency everyone can compare. The scarcity and inflation factors are what make this live — they update as the draft happens.

---

### SLIDE 10 — Frontend Architecture + Component UML
**Part of story arc:** MIDDLE (Architecture)
**Tie to class activity: Component-based design, SRP**

Content:
- React/Vite SPA, 9 purpose-built components
- All state lives in `App.jsx` — flows **down** via props, events bubble **up** via callbacks
- No Redux/Zustand needed at MVP scale — React useState is sufficient

**UML Component Diagram:**

```
[DIAGRAM: UML component tree — hand sketch style

App.jsx
  State: league, players, notes, valuationCache
  ├── SetupScreen         (league config form — shown before draft)
  ├── DraftBoard          (main screen: grid + search + right panel)
  │   ├── PlayerCard      (shared: the detailed player info panel)
  │   ├── PlayerAvatar    (shared: photo or initials fallback)
  │   └── InlineCellSearch (in-cell mini search — appears inside grid cell)
  ├── PlayerDictionary    (browse/filter all players — second tab)
  │   ├── PlayerCard      (same component, reused here)
  │   └── PlayerAvatar
  ├── LeagueSettings      (scoring categories + roster config)
  ├── KeeperSetup         (keeper contracts for keeper leagues)
  ├── ApiSandbox          (live API tester)
  └── TaxiSquad           (minor league $1 reserve picks)

Key design principles shown on diagram:
  → Props always flow DOWN (arrow pointing down)
  → Callbacks always fire UP (arrow pointing up, labeled "onSale, saveNote, etc.")
  → valuationCache lives in App, passed down to DraftBoard + PlayerDictionary
]
```

Speaker notes: walk through the tree. Point out that PlayerCard is reused in both DraftBoard and PlayerDictionary — same component, different data. The `valuationCache` in App is the shared state pattern we implemented to ensure both panels show live API values.

---

### SLIDE 11 — Implementation Decision: Key Bugs We Fixed
**Part of story arc:** MIDDLE (Architecture)
**Tie to class activity: Implementation decisions, correctness**

Content — show two real bugs found during implementation:

**Bug 1: Slot-Indexed Roster Storage**
```
// BEFORE (bug): array index 0 = Catcher slot always
const entry = team.roster[si];   // every player appeared in C column

// AFTER (fix): explicit slotIndex stored on every pick
const entry = team.roster.find((r) => r.slotIndex === si);
// Now a player drafted into OF slot 5 stays in column 5, always
```

**Bug 2: Stale Valuations After Picks**
```
// BEFORE (bug): effect never re-ran when a different player got drafted
useEffect(() => { fetchValuation(player); }, [player.id, apiStatus]);

// AFTER (fix): compact fingerprint string changes on every pick/undo
const draftStateKey = league.teams.map(t => t.roster.length).join(",");
useEffect(() => { requestValuation(player); }, [player.id, draftStateKey]);
```

Both bugs were silent — the app didn't crash, it just showed wrong data. Finding them required careful testing against real draft scenarios.

Speaker notes: frame these as examples of the testing discipline that matters. The slot bug caused every player to silently appear in the Catcher column — data corruption, no error message. The valuation bug caused stale prices after every pick. Both found through real use.

---

### SLIDE 12 — Architecture Summary: Decisions + Tradeoffs
**Part of story arc:** MIDDLE (Architecture)
**Tie to class activity: Architecture review and tradeoff analysis**

Content — tight summary table:

| Decision | What We Chose | Tradeoff Accepted |
|---|---|---|
| System structure | 2-tier REST (licensed API + React SPA) | Network hop per valuation |
| Storage | File-based JSON, no database | No runtime player pool updates |
| Licensing | `X-License-Key` custom header + middleware | No per-user auth in MVP |
| State management | React useState in App.jsx | Page refresh clears draft session |
| Valuation | SGP + scarcity + inflation | More complex than flat $/pt |
| Roster storage | Slot-indexed picks | Slightly more complex model |
| Deployment | Both products on real servers | More ops setup upfront |
| Scope cut (MVP) | No localStorage persistence | Known Sprint 2 backlog item |

Speaker notes: ask the audience which tradeoff they'd have made differently. Acknowledge the "no localStorage" cut honestly — the draft session disappears on refresh, and that's the most visible MVP limitation.

---

### SLIDE 13 — Demo Overview
**Part of story arc:** MIDDLE (Demo)

> **BEFORE PRESENTING:** Confirm both products respond at deployed URLs — NOT localhost. Open the draft board in a fresh browser tab. Verify the green API dot is visible. Rehearse the demo at least twice on the presentation machine.

Content:
- "What you're about to see is running live on our deployed servers"
- **Live URL:** `[INSERT DEPLOYED FRONTEND URL]`
- **API URL:** `draftapi.anythingavenue.com`

What the demo will show:
1. Empty board — 12 teams, all slots, $260 budget each
2. Player search + PlayerCard with live valuation from API
3. Record a sale: position slot picker → bid entry → grid updates
4. Position eligibility enforcement in action
5. Valuations auto-refreshing after each pick (the draftStateKey fix live)
6. Player Dictionary — browse the full pool with live values

Speaker notes: signal to the audience this is a real product running on a real server. This isn't a localhost demo. Open DevTools Network tab during demo to prove the API calls are happening.

---

### SLIDE 14 — Demo Step 1: First Pick
**Part of story arc:** MIDDLE (Demo)
**PRESENTER: [TEAM MEMBER 1 or designated demo presenter]**

What to show:
- Search for "Mookie Betts" — PlayerCard appears in right panel
- Point out: the `$XX MAX BID` shown in the card came from a live `POST /v1/valuate` call
- Click an empty OF cell in Team 1's row — InlineCellSearch drops in inline
- Type name, select player — Sale Modal opens with slot picker showing valid positions
- Enter bid price → Confirm → Player appears in OF column, budget decrements

Talking points:
- Valuation hit the API automatically — no button press required
- Inline search lives inside the grid cell — no page navigation
- Position picker only shows slots this player is eligible for

---

### SLIDE 15 — Demo Step 2: Position Eligibility
**Part of story arc:** MIDDLE (Demo)

What to show:
- Try to assign Logan Webb (SP) to a 1B slot — 1B **does not appear** in the slot picker
- Assign a multi-position player (SS + 2B eligible) — show both slots available
- Assign any hitter to UTIL — it appears; assign Webb to UTIL — it does not
- Assign any player to BN — always available, no restriction

Talking points:
- Eligibility enforced at assignment time, not post-hoc
- Rules trace directly to the user stories written in the requirements phase
- A spreadsheet gets this wrong silently — we block the illegal assignment explicitly

---

### SLIDE 16 — Demo Step 3: Live Valuation Refresh + Budget
**Part of story arc:** MIDDLE (Demo)

What to show:
- Use the Sample Draft button (amber button in nav) to fill 10 picks at once
- Point out: the selected player's max bid **changes** after each pick fires
- Open browser DevTools → Network tab → show `POST /v1/valuate` firing live
- Point out: budget column for each team decrements with each pick
- Optionally: show the Player Dictionary tab — same live values, same cache

Talking points:
- `draftStateKey` triggers a fresh API valuation on every pick — live inflation math
- Late-round stars cost more because budget concentrates — this is real economics
- DevTools proves the two-tier architecture: HTTP call → JSON response → UI update

---

### SLIDE 17 — Sprint 1 (Current MVP): What We Delivered
**Part of story arc:** END

Content — this is what was just shown:

**Delivered:**
- Full draft board: 12 teams, 15 roster slots (C/1B/2B/3B/SS/OF×3/SP×2/RP×2/UTIL/BN×2)
- Licensed REST API: `GET /v1/players` + `POST /v1/valuate`
- SGP valuation with position scarcity + market inflation
- Position eligibility enforcement at assignment
- Inline cell search — no navigation required
- Real-time budget tracking per team
- Reactive valuations — auto-refresh on every pick/undo
- Player Dictionary with live API values
- Both products deployed to real servers

**Deliberate MVP scope cuts (documented backlog, not gaps):**
- No localStorage persistence (page refresh resets draft session)
- Single commissioner view (no multi-user sync)
- NL-only pool (313 players) — AL and mixed in Sprint 2
- No real player headshots

Speaker notes: be direct about the scope cuts — they were deliberate choices made to ship a working product, not failures. Each one is already a ticket in the Sprint 2 backlog.

---

### SLIDE 18 — Sprints 2–4: Roadmap + Development Process
**Part of story arc:** END

Content:

**Sprint roadmap:**

| Sprint | Theme | Key Deliverables |
|---|---|---|
| 1 ✓ | Core MVP | Working draft board + licensed valuation API, deployed |
| 2 | Persistence + Polish | localStorage, player photos, full AL/NL/Mixed pool |
| 3 | Collaboration + Export | WebSocket multi-user sync, CSV/PDF export, mobile layout |
| 4 | Intelligence + Scale | Historical auction data, improved valuation model |

**Development process we're establishing:**
- Feature branches → PR review before merge to main
- Naming: `feature/`, `fix/`, `chore/` prefixes on all branches
- CI/CD: automated build + lint check on every PR (pipeline in Sprint 2)
- Architecture is now set — new features follow existing patterns, no late restructuring

Speaker notes: connect sprints to the agile loop the professor described — plan → tasks → assign → test → implement → review → repeat. The development process rules exist so any team member can pick up any ticket without asking for context.

---

### SLIDE 19 — Vision + The Ask
**Part of story arc:** END (Closing)

Content — this is the close:

**Product vision (1 sentence):**
> *Dark Blue Auction Draft Kit is built for the commissioner who wants a mathematical edge — the tool that tells you what a player is actually worth before the bidding starts, and recalculates it in real time as the draft unfolds.*

**What makes this fundable:**
- Two licensed products — the API earns money independently of the frontend
- Real math (SGP/scarcity/inflation) that competitors don't offer at this price point
- Deployed today, real users, already dog-fooded by our own team

**Licensing model (quick summary):**
- Free tier: `GET /v1/players` — see the data
- Pro tier: `POST /v1/valuate` unlocked — live max-bid recommendations
- Enterprise: white-label API, custom configurations

**Live links:**
- API: `https://draftapi.anythingavenue.com`
- Frontend: `[INSERT DEPLOYED URL]`
- GitHub: `[INSERT REPO URL]`

**Tagline (bottom of slide, small caps):**
*"Every dollar. Every pick. Every edge."*

Speaker notes: end with conviction, not hedging. Point to the deployed URL one more time. Invite questions. The team has answers — especially on licensing.

---

## END OF SLIDE CONTENT

---

**Final instruction to Claude:** Please generate all 19 slides in the format described at the top (SLIDE N: TITLE → PRESENTER → CONTENT → SPEAKER NOTES). Assign presenters 1–4 across slides so each person delivers approximately 4–5 slides. Make every slide substantive but visual — bullet points and diagrams, not paragraphs. Code snippets must be syntactically accurate. Speaker notes should be natural spoken language, 4–6 sentences, not a script. Diagrams in `[DIAGRAM: ...]` blocks must be detailed enough to reproduce without follow-up questions.

When all 19 slides are done, append:

---

## DESIGN NOTES FOR SLIDE BUILDER

Provide 8–10 bullet points for the person assembling this deck in PowerPoint, Google Slides, or Figma. Cover:
1. Color palette hex values
2. Font pairing recommendations
3. Code block visual treatment
4. How to render the UML class diagrams (keep them hand-sketch or clean box style)
5. Which slides benefit from two-column layout vs full-width
6. Animation / transition recommendations (keep them minimal)
7. How to label each slide with the presenter's name (corner chip or speaker note only)
8. The baseball motif — where to use it and where to leave it out
9. How to display the live deployment URLs visually (make them readable from the back of the room)
10. One specific suggestion per demo slide (13–16) for how to frame the screenshot or live view

---

## EQUAL PARTICIPATION GUIDE (for presenters — not to be shown in slides)

Suggested assignment for a 4-person team:

| Presenter | Slides | Section |
|---|---|---|
| Team Member 1 | 1, 2, 3, 4 | Opening: Title, Team, Problem, Vision |
| Team Member 2 | 5, 6, 7, 8 | Architecture Part 1: Requirements, Two Products, Licensing, Data |
| Team Member 3 | 9, 10, 11, 12 | Architecture Part 2: Algorithm, Components, Bug Fixes, Summary |
| Team Member 4 | 13–16 | Demo presenter (live) |
| Everyone | 17, 18, 19 | Each person takes one closing slide |

Adjust based on actual team size. The point is roughly equal air time — not equal slide count.

---

## ANTICIPATED Q&A FROM PROFESSOR

Be ready to answer (without notes):

1. **"How does your licensing mechanism work?"**
   Middleware checks `X-License-Key` header on every request. Invalid key = 401. Future: keys carry plan metadata (rate limits, expiry, seat count).

2. **"What happens if the API goes down mid-draft?"**
   The frontend degrades gracefully — it shows `baseValue` (pre-computed) instead of live valuations, with an "API offline" badge. The draft can continue.

3. **"Why file-based storage instead of a database?"**
   Player data is read-only at runtime. A database adds complexity, ops overhead, and zero benefit for MVP. Sprint 2 adds a real DB for user accounts and league persistence.

4. **"How are multiple users handled?"**
   MVP is single-commissioner. Sprint 3's WebSocket implementation adds multi-user live sync. Deliberate decision — launch with one use case done well.

5. **"What's your test coverage?"**
   MVP has manual integration tests (we ran full drafts with it). Sprint 2 establishes the CI/CD baseline with automated unit tests, and all subsequent features must include tests.

6. **"How is deployment set up?"**
   The API runs on [describe hosting]. The frontend is [describe hosting]. Both use environment variables so the same codebase works in dev, staging, and prod.

7. **"What did building this teach you about the tools you chose?"**
   Be honest. Could mention: React `useEffect` dependency management is tricky, API versioning is easier than retrofitting it later, file-based storage creates a hard limit on some features.
