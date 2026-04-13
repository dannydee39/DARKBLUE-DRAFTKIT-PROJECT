# Dark Blue Auction Draft Kit — Quick Start

Two terminals. Two commands. Done.

---

## Requirements

- [Node.js](https://nodejs.org) v18+
- `npm`

---

## Terminal 1 — API Server

```bash
cd mvpfinal/api
npm install
cp .env.example .env
npm run dev
```

Should print:
```
🟢 Dark Blue Valuation API
   Port:        3001
   Health:      http://localhost:3001/health
```

---

## Terminal 2 — Draft Kit App

```bash
cd mvpfinal/draftkit
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## That's it

The app loads players from the API automatically on startup. The green dot in the top-right corner means the API is connected.

---

## If the API dot is red (offline)

The frontend still works — player search and the draft board function without it. Valuations just show the pre-calculated base value instead of a live recommendation.

To fix: make sure Terminal 1 is running and `http://localhost:3001/health` returns `{"status":"online"}`.

---

## Regenerate player data (optional)

Only needed if you change the CSV files in `sample/data/`:

```bash
node mvpfinal/api/scripts/generate-players.js
```

---

## Demo API key

```
DB-2026-DEMO-0001
```

Pre-configured in the app. No changes needed for local development.
