# PRESENTATION SLIDES PROMPT
## Dark Blue Auction Draft Kit — University Software Engineering Class Presentation

---

> **HOW TO USE THIS FILE:**
> Copy everything from the horizontal rule below through the end of this document and paste it into a new Claude conversation. Claude will generate a complete, formatted slide deck. Before presenting, search for every instance of `[TEAM MEMBER` and fill in real names.

---

---

## PASTE BELOW THIS LINE INTO CLAUDE

---

Please generate a complete, professional presentation slide deck based on the project details and structure I provide below. For every slide, output the following clearly labeled sections:

- **SLIDE [N]: [TITLE]**
- **CONTENT:** (bullet points, code block, table, or structured text — whichever fits best)
- **SPEAKER NOTES:** (a paragraph of natural spoken-word notes, 4–8 sentences, written as if you are the presenter speaking aloud)

**Visual/Aesthetic Guidelines (describe to whoever builds the deck in PowerPoint/Google Slides/Figma):**
- Theme: Dark navy/charcoal background (#0d1b2a or similar), white and ice-blue text, gold/amber accent color for highlights
- Typography: A bold sans-serif for slide titles (e.g. Barlow Condensed or similar), clean body font (Inter or similar)
- Baseball/sports motif: subtle diamond pattern or field lines as a background texture suggestion; do not make it garish — keep it professional
- Code snippets: use a dark code block (monospace, syntax-highlighted style) on a slightly lighter dark card
- Diagrams: describe them in square-bracket notation like `[DIAGRAM: ...]` with enough detail that a designer can reproduce them in any tool
- Each slide should feel like it belongs to a polished product pitch, not a homework assignment

**Presentation Context:**
- Course: University Software Engineering class
- Audience: Professor and classmates with software engineering background
- Total time: approximately 25 minutes
- Tone: Confident, technically rigorous, shows engineering process (not just the product)

---

## SLIDE STRUCTURE AND CONTENT TO GENERATE

---

### SLIDE 1 — Title Slide

Generate a title slide for:

- **Product name:** Dark Blue Auction Draft Kit
- **Subtitle:** Real-Time Fantasy Baseball Auction Draft Management
- **Course context line:** Software Engineering — Final Project Presentation
- **Date:** Spring 2026

Make the title large and impactful. Include a tagline suggestion that is short and punchy (something like "Every dollar. Every pick. Every edge.").

---

### SLIDE 2 — Team Members

Generate a team slide. Use these exact placeholder strings — **do not replace them**. Add a small italic note on the slide itself saying "(fill in names before presenting)".

Team members:
- [TEAM MEMBER 1] — [ROLE 1]
- [TEAM MEMBER 2] — [ROLE 2]
- [TEAM MEMBER 3] — [ROLE 3]
- [TEAM MEMBER 4] — [ROLE 4]

Each team member entry should have a placeholder for their name and their self-selected role (e.g. "Backend Lead", "Frontend Lead", "Data Pipeline", "QA & Documentation").

Speaker notes should remind the presenter to briefly introduce each person and their primary contribution before moving on.

---

### SLIDES 3–12 — Architecture and Engineering Decisions (~10 minutes)

This section maps directly to the phases of a software engineering lifecycle: Requirements → Architecture → Design → Implementation. Each decision slide should explicitly call out WHAT we decided, WHY we decided it, and WHAT TRADEOFF we accepted.

---

#### SLIDE 3 — Problem Statement / What We Built

Content to cover:
- Fantasy baseball auction drafts are chaotic: 12 teams, 260+ players, a fixed budget ($260 per team), and real-time bidding pressure
- Existing tools are either too complex (expensive SaaS) or too simple (paper/spreadsheet)
- We built a two-part system: a REST API (valuation engine) and a React frontend (draft board)
- The system supports one league manager (commissioner role) tracking the full draft live

Include a one-line system overview:

```
Express.js API  <->  React/Vite Frontend
(valuation engine)   (live draft board)
```

Speaker notes should contextualize the problem domain briefly for an audience that may not follow fantasy sports.

---

#### SLIDE 4 — Requirements Phase: User Stories → Data Model

**Tie to class activity: Requirements elicitation and user story writing**

Content to cover:
- We wrote user stories following the format: "As a [role], I need to [action] so that [value]"
- Key user story that drove the entire data model:
  - **"As a commissioner, I need to record which player was drafted by which team at what price so that I can track budget usage and roster completeness."**
- This single story forced us to define: the `pick` object (player, team name, price paid, slot index), and the `rosterSlot` concept (C, 1B, 2B, 3B, SS, OF×3, UTIL, BN×4)
- Additional user stories:
  - "As a commissioner, I need to see each player's recommended max bid so I do not overpay during bidding"
  - "As a commissioner, I need the system to enforce position eligibility so my roster stays legal"
  - "As a commissioner, I need to search for any player inline while the draft is live without navigating away"

Include a small table:

| User Story | Artifact It Created |
|---|---|
| Track player, team, price | `pick` object data model |
| See recommended max bid | Valuation panel + POST /v1/valuate |
| Enforce position eligibility | RosterSlot eligibility rules |
| Inline player search | InlineCellSearch component |

Speaker notes should explain how user stories directly drove technical decisions, not just feature lists.

---

#### SLIDE 5 — Architecture Decision: Why Two Tiers?

**Tie to class activity: Architectural design and decision records**

Content to cover:
- **Decision:** Separate valuation logic into a standalone REST API rather than embedding it in the frontend
- **Why:** Valuation is mathematically complex (SGP scoring, scarcity, inflation) and may be consumed by multiple clients (web, mobile, CLI scripts) in the future
- **Why REST, not GraphQL or gRPC:** Team familiarity, stateless model fits our use case, easy to test with curl
- **Tradeoff accepted:** Added network latency per valuation refresh, added CORS configuration overhead
- **Alternative considered:** Pure client-side calculation — rejected because it would ship the full projection dataset to every browser and would be harder to update independently

Include the architecture diagram description:

```
[DIAGRAM: Two boxes side by side.
 Left box: "React/Vite Frontend (port 5173)"
   - Draft Board UI
   - 9 Components
   - useState (no DB)
 Right box: "Express.js API (port 3001)"
   - GET /v1/players
   - POST /v1/valuate
   - players.json (file-based)
 Arrow between them labeled: "HTTP REST (JSON)"
 Below right box: "players.json / CSV pipeline" feeding up into the API box]
```

Speaker notes should reference the Architecture Decision Record (ADR) format discussed in class.

---

#### SLIDE 6 — Data Pipeline Decision: Player Projections

**Tie to class activity: Data modeling and system design**

Content to cover:
- Player data is the foundation of the entire valuation engine
- **Decision:** Merge three CSV data sources with a clear priority hierarchy:
  1. Current-season projections (most predictive)
  2. 2025 actual statistics (fallback if no projection exists)
  3. 3-year historical average (fallback for new/fringe players)
- **Why file-based, not a database:** MVP scope; player data is read-only at runtime; eliminates DB setup/ops overhead; `players.json` is committed to source control — zero external dependencies
- **Tradeoff accepted:** No runtime updates to player pool; requires a re-pipeline step to refresh stats
- **Result:** 313 NL-only players, each carrying: name, positions, projected stats across all SGP scoring categories, pre-computed baseValue

Include a code snippet showing the shape of a player object:

```json
{
  "id": "mookie-betts",
  "name": "Mookie Betts",
  "pos": ["OF", "SS"],
  "team": "LAD",
  "tier": "Elite",
  "hr": 24, "rbi": 82, "sb": 14, "avg": 0.289,
  "fpts": 312.4,
  "baseValue": 38
}
```

Speaker notes should explain what SGP means (Standings Gain Points) at a high level for the audience.

---

#### SLIDE 7 — API Design Decisions: RESTful Conventions + Security

**Tie to class activity: Interface design and API contracts**

Content to cover:
- **Two endpoints, deliberately minimal:**
  - `GET /v1/players` — returns full player roster; cacheable
  - `POST /v1/valuate` — accepts current draft state, returns per-player recommended max bid; requires `X-License-Key` header
- **Versioning:** `/v1/` prefix allows future breaking changes without breaking existing clients
- **Auth decision:** License key via custom header — appropriate for a B2B tool; simple to implement and test
- **Rate limiting:** 120 requests per minute; prevents abuse
- **CORS:** Controlled via `ALLOWED_ORIGINS` environment variable — same binary works in dev, staging, prod

Include a code snippet:

```bash
# Example: valuate call
curl -X POST https://draftapi.anythingavenue.com/v1/valuate \
  -H "Content-Type: application/json" \
  -H "X-License-Key: DB-2026-DEMO-0001" \
  -d '{"draft_state": {"nominated_player": "Mookie Betts", ...}}'
```

Speaker notes should connect this to the "Design for Change" principle — the versioned, env-configured API can be extended without redeployment of the frontend.

---

#### SLIDE 8 — Valuation Algorithm: SGP + Scarcity + Inflation

**Tie to class activity: Algorithm design and computational complexity**

Content to cover:
- **SGP = Standings Gain Points** — converts raw stats into a common dollar currency
- **Pipeline for each player:**
  1. Compute raw SGP score across active scoring categories (R, HR, RBI, SB, AVG / W, SV, ERA, WHIP, SO)
  2. Apply **position scarcity multiplier** — catchers are rare, so a C worth 15 SGP costs more than a 1B worth 15 SGP
  3. Apply **market inflation factor** — as budget concentrates on fewer players, prices rise
  4. Map to a **recommended max bid** (= true dollar value × 0.92)

Include a pseudocode block:

```
function valuate(player, draftState):
  sgpScore     = sum(projStat[cat] * sgpRate[cat] for cat in CATEGORIES)
  scarcity     = positionScarcityMultiplier(player.positions, draftState)
  inflation    = computeInflation(draftState.budgets, draftState.picks)
  trueDV       = clamp(sgpScore * scarcity * inflation, 1, 80)
  return round(trueDV * 0.92)  // max bid = 92% of true value
```

Speaker notes should acknowledge this is a simplified description; the real implementation handles edge cases like negative SGP, multi-position eligibility, and zero remaining budget.

---

#### SLIDE 9 — Frontend Architecture: 9 Components

**Tie to class activity: Component-based design and separation of concerns**

Content to cover:
- The UI is a React/Vite SPA with 9 purpose-built components
- Props flow **down**; callbacks fire **up** — no global state store needed
- No Redux/Zustand/MobX — React useState is sufficient for MVP one-screen, one-user scope

```
[DIAGRAM: Component hierarchy tree]
App.jsx (all shared state)
├── SetupScreen       (league configuration)
├── DraftBoard        (main draft grid + search)
│   └── InlineCellSearch (in-cell player search)
├── PlayerCard        (detailed player panel)
├── PlayerAvatar      (photo/initials component)
├── PlayerDictionary  (full player browse tab)
├── LeagueSettings    (scoring/roster config)
├── KeeperSetup       (keeper entry form)
├── TaxiSquad         (minor league reserves)
└── ApiSandbox        (live API testing panel)
```

Speaker notes should explain the component design philosophy and reference the Single Responsibility Principle from class.

---

#### SLIDE 10 — Implementation Decision: Slot-Indexed Roster Storage

**Tie to class activity: Data structure selection and correctness**

Content to cover:
- **The bug (discovered in testing):** Any drafted player always appeared in the Catcher (C) column — regardless of their position
- **Root cause:** `team.roster[si]` used array index as slot identity. Index 0 = always C.
- **The fix:** Each roster entry stores an explicit `slotIndex`. Grid renders via `team.roster.find(r => r.slotIndex === si)`.

Include a code snippet:

```js
// WRONG — old code (bug): uses array index as slot
const entry = team.roster[si];  // si=0 always = C slot

// CORRECT — fixed code: look up by stored slotIndex
const entry = team.roster.find((r) => r.slotIndex === si);
// A player drafted into slot 5 (OF) lives at slotIndex 5, always
```

- Position eligibility rules:
  - `C`, `1B`, `2B`, `3B`, `SS`, `OF`, `SP`, `RP` — exact position match required
  - `UTIL` — any hitter (player has at least one non-SP/RP position)
  - `BN` — any player, no restriction

Speaker notes should explain why this was a non-obvious but critical decision — the bug it prevents is silent data corruption where every player silently ends up in the Catcher slot.

---

#### SLIDE 11 — Reactive Valuations: The draftStateKey Pattern

**Tie to class activity: State management and side effects**

Content to cover:
- **The bug (post-demo testing):** Valuations in the sidebar only refreshed when the user clicked a different player — not when someone else got drafted
- **Root cause:** `useEffect` dependency list was `[selectedPlayer?.id, apiStatus]` — league state was not a dependency
- **Wrong fix:** Adding `league` to deps causes excessive re-renders (fires on every keystroke)
- **Correct fix:** Compute a compact fingerprint string that only changes when roster counts change:

```js
// Compact string: "2,3,1,0,4,..." — one number per team = players drafted
const draftStateKey = league.teams
  .map((t) => t.roster.length)
  .join(",");

// Add to useEffect deps — efficient, stable, correct
useEffect(() => {
  if (selectedPlayer && apiStatus === "online") fetchValuation(selectedPlayer);
}, [selectedPlayer?.id, apiStatus, draftStateKey]);
```

Speaker notes should connect to the broader "minimal dependencies" principle — only make effects depend on the exact signals that should trigger them, nothing broader.

---

#### SLIDE 12 — Architecture Summary: Decisions Matrix

**Tie to class activity: Architecture review and tradeoff analysis**

Content: A summary table of all key decisions and tradeoffs.

| Decision Area | What We Chose | Tradeoff Accepted |
|---|---|---|
| System architecture | 2-tier REST (API + SPA) | Network latency on valuation refresh |
| Data storage | File-based JSON, no DB | No runtime player pool updates |
| Auth model | License key (X-License-Key header) | No per-user access control |
| State management | React useState | Page refresh clears draft session |
| Valuation algorithm | SGP + scarcity + inflation | More complex than dollar-per-point |
| Roster storage | Slot-indexed picks | Slightly more complex data model |
| Scope cut (MVP) | No localStorage persistence | Known backlog item for Sprint 2 |

Speaker notes should briefly reflect on which decision the team found most impactful in hindsight and acknowledge tradeoffs honestly — this demonstrates engineering maturity.

---

### SLIDES 13–16 — Demo Guide (~10 minutes)

These slides are cue cards for the live demo. Generate them with clear action instructions and talking points.

---

#### SLIDE 13 — Demo Overview

Content:
- "We will walk through a live auction draft from pick 1 to a partially complete roster"
- What the audience will see:
  1. Draft board at startup — empty grid, all teams, all slots
  2. Searching for a player by name using inline cell search
  3. Assigning a player to a position slot with position picker + price entry
  4. Valuation panel auto-updating after the pick (the draftStateKey fix in action)
  5. Attempting an illegal position assignment — eligibility enforcement in action
  6. Budget tracker decrementing with each pick

**Before presenting:** Have both terminals running (`npm run dev` in both `/api` and `/draftkit`). Have the browser open at `http://localhost:5173`. Green dot must be visible. Rehearse the demo at least twice on the presentation machine.

---

#### SLIDE 14 — Demo Step 1: Empty Board + First Pick

**What to show on screen:**
- Open draft board — 12 team columns, all slots empty, $260 budget shown per team
- Click a player name in the player search (e.g. "Mookie Betts") — show the PlayerCard appear in the right panel with max bid populated from the API
- Click an empty OF cell in Team 1's row — InlineCellSearch appears inline
- Type part of the player's name — results filter live
- Select the player — position slot picker modal opens
- Enter $50, confirm — player appears in the OF column, budget drops to $210

**Talking points:**
- The valuation hit the live API: `POST /v1/valuate` fired automatically on player click
- Inline search stays within the draft board — no navigation away
- The slot picker only offers valid positions for this player

---

#### SLIDE 15 — Demo Step 2: Position Eligibility Enforcement

**What to show on screen:**
- Attempt to assign a pitcher (e.g. Logan Webb) to the 1B slot — show that 1B does not appear in the slot picker (only SP/BN are offered)
- Assign a multi-position player (eligible at both SS and 2B) — show both slots highlighted in the picker
- Assign any hitter to UTIL — show UTIL available for any non-pitcher
- Assign any player to BN — show BN always available

**Talking points:**
- Eligibility enforced at assignment time, not post-hoc
- Rules directly trace back to user stories written during requirements phase
- A spreadsheet gets this wrong silently — we enforce it explicitly at the UI layer

---

#### SLIDE 16 — Demo Step 3: Mid-Draft Valuation Refresh + Budget Tracking

**What to show on screen:**
- Draft 5–8 more players across multiple teams using the Sample Draft button (amber button in nav) or manually
- **Point out:** After each pick, the valuation for the currently selected player refreshes — show the max bid number change
- **Point out:** Budget column decrements for each team
- Optional: Open browser DevTools Network tab — show `POST /v1/valuate` firing live after each pick

**Talking points:**
- `draftStateKey` triggers a fresh API call on every pick — this is the bug we fixed
- Inflation is real math — late-draft stars cost more because budget concentrates
- DevTools shows the two-tier architecture in action: real HTTP call with real JSON response

---

### SLIDES 17–19 — Sprint/Iteration Plan (~3 minutes)

---

#### SLIDE 17 — Sprint 1 (Current MVP): What We Delivered

Content:
- **Sprint 1 is what you just saw in the demo**
- Delivered features:
  - Full draft board UI: 12 team columns, all standard roster slots (C, 1B, 2B, 3B, SS, OF×3, UTIL, BN×4)
  - Express.js REST API: `GET /v1/players` + `POST /v1/valuate`
  - SGP-based valuation with position scarcity and market inflation
  - Position eligibility enforcement at assignment time
  - Inline cell search — live filtering, no navigation required
  - Real-time budget tracking per team
  - Reactive valuations (draftStateKey fix — auto-refresh on every pick)
  - Sample draft button for demo and testing
  - Interactive API testing sandbox at `GET /`
- **Deliberate MVP scope cuts (planned backlog items, not gaps):**
  - No localStorage persistence
  - No user authentication (single commissioner session)
  - NL-only player pool (313 players)
  - No real player headshot photos

---

#### SLIDE 18 — Sprints 2 & 3: Near-Term Roadmap

| Sprint | Theme | Key Deliverable |
|---|---|---|
| 1 ✓ done | Core MVP | Working draft board + valuation API |
| 2 | Persistence + UX polish | localStorage, player photos, auction clock |
| 3 | Collaboration + Export | WebSocket multi-user, CSV/PDF export, mobile |
| 4 | Intelligence | ML valuation model, historical auction data |

**Sprint 2 highlights:**
- `localStorage` persistence — draft state survives page refresh
- Real player headshots via MLB player ID lookup
- Pick order enforcement: serpentine / auction countdown timer

**Sprint 3 highlights:**
- WebSocket live sync — all league members see board update in real time
- Export to CSV and PDF — post-draft roster summaries
- Mobile-responsive layout for tablet use during live drafts

---

#### SLIDE 19 — Vision + Closing

Content:

**Sprint 4 (stretch goals):**
- ML valuation model trained on historical auction price data
- Historical draft comparison: how did your picks compare to last season?
- Full AL/NL/Mixed league support (600+ players)

> **Vision:**
> Dark Blue Auction Draft Kit is built for the commissioner who wants a mathematical edge — the tool that tells you what a player is actually worth *before* the bidding starts, and recalculates it as the draft unfolds in real time.

**Links:**
- Live API: `https://draftapi.anythingavenue.com`
- GitHub: `[INSERT REPO URL]`

**Tagline (bottom of slide, small caps):**
*"Every dollar. Every pick. Every edge."*

---

## END OF SLIDE CONTENT

---

**Final instruction to Claude:** Please generate all 19 slides in the format described at the top (SLIDE N: TITLE → CONTENT → SPEAKER NOTES). Make every slide substantive. Code snippets should be syntactically accurate. Speaker notes should be natural, spoken-word, approximately 5–7 sentences each. Diagrams in `[DIAGRAM: ...]` blocks should be detailed enough for a designer to reproduce without follow-up questions.

When all 19 slides are done, append:

---

## DESIGN NOTES FOR SLIDE BUILDER

Provide 8–10 bullet points for the person assembling the deck in PowerPoint, Google Slides, or Figma. Cover: color palette hex values, font pairing, code block treatment, how to represent the diagrams, animation/transition recommendations, and slide-specific layout advice (which slides benefit from two-column vs. full-width layout).
