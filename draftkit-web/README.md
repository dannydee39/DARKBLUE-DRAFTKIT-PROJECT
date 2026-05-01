# draftkit-web

React/Vite frontend for the Draft Kit product.

## Start Here

- `src/App.jsx` owns app-level state, routing, cloud sync, valuation requests, and draft actions.
- `src/components/DraftBoard.jsx` renders the auction board and board editing controls.
- `src/components/PlayerCard.jsx` renders selected player details, notes, valuation, risk, and update context.
- `src/components/PlayerUpdateCenter.jsx` renders the collapsed player update/league note manager.
- `src/components/SetupScreen.jsx` renders draft creation and saved draft library entry points.
- `src/utils/helpers.js` contains shared roster, value, and eligibility helpers.
- `src/utils/draftSessions.js` serializes/hydrates draft workspaces.

## Runtime Flow

1. The user creates or resumes a draft.
2. `App.jsx` loads players through `draftkit-api`.
3. Board changes update local state and invalidate the valuation cache.
4. `requestValuation()` sends the full draft state to `draftkit-api`, which proxies to `valuation-api`.
5. The app merges global MLB/player updates and cloud draft league notes into player state.

## Commands

```powershell
npm install
npm run dev
npm run build
```

Focused validation scripts:

```powershell
node scripts/test-depth-rankings.mjs
node scripts/test-draft-history.mjs
node scripts/test-minor-league-rosters.mjs
node scripts/test-team-names.mjs
node scripts/test-settings-guardrails.mjs
```
