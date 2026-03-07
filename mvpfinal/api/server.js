// server.js — Dark Blue Valuation API
// Standalone headless REST service. Deploy to VPS separately from Draft Kit.
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const valuateRouter = require("./routes/valuate");
const playersRouter = require("./routes/players");

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || NODE_ENV === "development") {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS policy"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-License-Key"],
  })
);

// ── RATE LIMITING ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too Many Requests", message: "Rate limit exceeded. Please wait 60 seconds." },
});
app.use(limiter);

// ── BODY PARSING ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.use("/v1/valuate", valuateRouter);
app.use("/v1/players", playersRouter);

// Health check (no auth required)
app.get("/health", (req, res) => {
  res.json({
    status: "online",
    service: "Dark Blue Valuation API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

// API info / landing — rich HTML testing sandbox
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dark Blue Valuation API</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:      #0d0d0d;
      --bg2:     #141414;
      --bg3:     #1a1a1a;
      --bg4:     #212121;
      --border:  #2a2a2a;
      --border2: #333;
      --green:   #22c55e;
      --green-d: #16a34a;
      --white:   #f1f5f9;
      --muted:   #6b7280;
      --muted2:  #9ca3af;
      --red:     #ef4444;
      --yellow:  #f59e0b;
      --blue:    #3b82f6;
      --mono:    'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      --font:    'Alexandria', 'Inter', -apple-system, sans-serif;
      --radius:  6px;
    }
    html, body { min-height: 100vh; background: var(--bg); color: var(--white); font-family: var(--font); font-size: 14px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
    a { color: var(--green); text-decoration: none; }
    a:hover { text-decoration: underline; }
    button { cursor: pointer; font-family: var(--font); }
    pre, code { font-family: var(--mono); }

    /* ── Layout ── */
    .page { max-width: 900px; margin: 0 auto; padding: 40px 24px 80px; }

    /* ── Top header ── */
    .site-header { margin-bottom: 48px; }
    .site-badge {
      display: inline-block;
      font-size: 10px; font-weight: 700; letter-spacing: 0.2em;
      color: var(--green);
      background: rgba(34,197,94,0.08);
      border: 1px solid rgba(34,197,94,0.25);
      padding: 3px 12px; border-radius: 20px;
      margin-bottom: 16px;
    }
    .site-title { font-size: 42px; font-weight: 900; letter-spacing: -0.02em; line-height: 1; margin-bottom: 12px; }
    .site-title span { color: var(--green); }
    .site-sub { font-size: 14px; color: var(--muted2); max-width: 540px; }
    .status-row { display: flex; align-items: center; gap: 12px; margin-top: 18px; flex-wrap: wrap; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 6px rgba(34,197,94,0.6); flex-shrink: 0; }
    .status-text { font-size: 11px; color: var(--muted2); }
    .version-badge { font-size: 10px; color: var(--muted); background: var(--bg3); border: 1px solid var(--border2); padding: 2px 8px; border-radius: 20px; }

    /* ── Section ── */
    .section { margin-bottom: 40px; }
    .section-title {
      font-size: 11px; font-weight: 800; letter-spacing: 0.12em;
      color: var(--muted2); margin-bottom: 16px;
      padding-bottom: 8px; border-bottom: 1px solid var(--border);
      text-transform: uppercase;
    }

    /* ── Overview cards ── */
    .overview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
    .overview-card {
      background: var(--bg2); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 16px;
    }
    .oc-method { font-size: 10px; font-weight: 800; color: var(--green); letter-spacing: 0.06em; margin-bottom: 4px; }
    .oc-path { font-size: 13px; font-family: var(--mono); color: var(--white); margin-bottom: 6px; }
    .oc-desc { font-size: 12px; color: var(--muted2); }
    .oc-auth { font-size: 10px; color: var(--yellow); margin-top: 8px; }

    /* ── Tester card ── */
    .tester-card {
      background: var(--bg2); border: 1px solid var(--border2);
      border-radius: var(--radius); overflow: hidden;
    }
    .tester-header {
      background: var(--bg3); padding: 12px 16px;
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap; gap: 8px;
    }
    .tester-method { font-size: 11px; font-weight: 800; color: var(--green); letter-spacing: 0.06em; margin-right: 8px; }
    .tester-path { font-size: 12px; font-family: var(--mono); color: var(--white); }
    .tester-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }

    /* ── curl block ── */
    .curl-block {
      background: var(--bg3); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 10px 14px;
      position: relative;
    }
    .curl-label { font-size: 9px; color: var(--muted); font-weight: 700; letter-spacing: 0.1em; margin-bottom: 6px; }
    .curl-code { font-size: 11px; font-family: var(--mono); color: #86efac; white-space: pre-wrap; word-break: break-all; }
    .copy-btn {
      position: absolute; top: 8px; right: 8px;
      background: var(--bg4); border: 1px solid var(--border2);
      color: var(--muted2); font-size: 9px; font-weight: 700;
      padding: 2px 8px; border-radius: 3px;
      transition: all 0.15s;
    }
    .copy-btn:hover { background: var(--border2); color: var(--white); }

    /* ── Controls row ── */
    .controls-row { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
    .ctrl-group { display: flex; flex-direction: column; gap: 4px; }
    .ctrl-label { font-size: 9px; color: var(--muted); font-weight: 700; letter-spacing: 0.08em; }
    .ctrl-select, .ctrl-input {
      background: var(--bg3); border: 1px solid var(--border2);
      color: var(--white); padding: 6px 10px; border-radius: var(--radius);
      font-size: 12px; outline: none; font-family: var(--font);
      transition: border-color 0.15s;
    }
    .ctrl-select:focus, .ctrl-input:focus { border-color: var(--green); }
    .ctrl-select option { background: var(--bg3); }

    /* ── Try It button ── */
    .try-btn {
      background: var(--green); border: none; color: #000;
      padding: 7px 20px; border-radius: var(--radius);
      font-size: 12px; font-weight: 800; letter-spacing: 0.04em;
      transition: background 0.15s; align-self: flex-end;
      white-space: nowrap;
    }
    .try-btn:hover { background: var(--green-d); }
    .try-btn:disabled { background: var(--muted); cursor: not-allowed; }

    /* ── Textarea for payload ── */
    .payload-textarea {
      width: 100%; min-height: 220px;
      background: var(--bg3); border: 1px solid var(--border2);
      color: #86efac; font-family: var(--mono); font-size: 11px;
      padding: 12px; border-radius: var(--radius); resize: vertical;
      outline: none; line-height: 1.6;
      transition: border-color 0.15s;
    }
    .payload-textarea:focus { border-color: var(--green); }

    /* ── Response area ── */
    .response-area {
      background: var(--bg3); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 12px;
      min-height: 80px; max-height: 400px; overflow-y: auto;
    }
    .response-json { font-family: var(--mono); font-size: 11px; color: #93c5fd; white-space: pre; line-height: 1.6; }
    .response-placeholder { font-size: 11px; color: var(--muted); font-style: italic; }
    .response-error { font-size: 11px; color: var(--red); }

    /* ── Status bar ── */
    .response-status {
      display: flex; align-items: center; gap: 10px;
      font-size: 10px; color: var(--muted2);
      font-family: var(--mono); margin-top: 6px;
      padding: 5px 10px; background: var(--bg3);
      border: 1px solid var(--border); border-radius: var(--radius);
    }
    .status-ok  { color: var(--green); font-weight: 700; }
    .status-err { color: var(--red);   font-weight: 700; }
    .status-lat { color: var(--muted2); }

    /* ── Payload examples selector ── */
    .example-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .example-label { font-size: 10px; color: var(--muted); font-weight: 700; letter-spacing: 0.06em; }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }

    /* ── Footer ── */
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 11px; color: var(--muted); }
  </style>
</head>
<body>
<div class="page">

  <!-- ── Top Header ───────────────────────────────────────────────────────── -->
  <header class="site-header">
    <div class="site-badge">DARK BLUE</div>
    <h1 class="site-title">Valuation <span>API</span></h1>
    <p class="site-sub">
      Dynamic player valuation engine for fantasy baseball auction drafts.
      Returns real-time bid recommendations and scarcity analysis based on live draft state.
    </p>
    <div class="status-row">
      <span class="dot" id="health-dot"></span>
      <span class="status-text" id="health-text">Checking status…</span>
      <span class="version-badge">v1.0.0</span>
      <span class="version-badge">Demo Key Active</span>
    </div>
  </header>

  <!-- ── Overview ─────────────────────────────────────────────────────────── -->
  <section class="section">
    <div class="section-title">Endpoints</div>
    <div class="overview-grid">
      <div class="overview-card">
        <div class="oc-method">GET</div>
        <div class="oc-path">/health</div>
        <div class="oc-desc">Service health check. Returns status, version, and timestamp. No auth required.</div>
      </div>
      <div class="overview-card">
        <div class="oc-method">GET</div>
        <div class="oc-path">/v1/players</div>
        <div class="oc-desc">Fetch ranked player pool. Filter by league (AL/NL/ALL), position, and tier.</div>
        <div class="oc-auth">Requires X-License-Key header</div>
      </div>
      <div class="overview-card">
        <div class="oc-method">POST</div>
        <div class="oc-path">/v1/valuate</div>
        <div class="oc-desc">Submit current draft state + nominated player. Returns max bid, true dollar value, and scarcity tier.</div>
        <div class="oc-auth">Requires X-License-Key header</div>
      </div>
    </div>
  </section>

  <!-- ── GET /v1/players Tester ────────────────────────────────────────────── -->
  <section class="section">
    <div class="section-title">GET /v1/players — Live Tester</div>
    <div class="tester-card">
      <div class="tester-header">
        <div>
          <span class="tester-method">GET</span>
          <span class="tester-path">/v1/players</span>
        </div>
      </div>
      <div class="tester-body">

        <!-- curl example -->
        <div class="curl-block">
          <div class="curl-label">CURL EXAMPLE</div>
          <pre class="curl-code" id="players-curl">curl -H "X-License-Key: DB-2026-DEMO-0001" \\
  "${window.location.origin}/v1/players?league=NL&tier=Elite"</pre>
          <button class="copy-btn" onclick="copyText('players-curl', this)">Copy</button>
        </div>

        <!-- Controls -->
        <div class="controls-row">
          <div class="ctrl-group">
            <div class="ctrl-label">LEAGUE POOL</div>
            <select class="ctrl-select" id="players-league" onchange="updatePlayersCurl()">
              <option value="ALL">ALL</option>
              <option value="NL" selected>NL</option>
              <option value="AL">AL</option>
            </select>
          </div>
          <div class="ctrl-group">
            <div class="ctrl-label">POSITION</div>
            <select class="ctrl-select" id="players-pos" onchange="updatePlayersCurl()">
              <option value="">ALL</option>
              <option value="C">C</option>
              <option value="1B">1B</option>
              <option value="2B">2B</option>
              <option value="3B">3B</option>
              <option value="SS">SS</option>
              <option value="OF">OF</option>
              <option value="SP">SP</option>
              <option value="RP">RP</option>
            </select>
          </div>
          <div class="ctrl-group">
            <div class="ctrl-label">TIER</div>
            <select class="ctrl-select" id="players-tier" onchange="updatePlayersCurl()">
              <option value="">ALL</option>
              <option value="Elite">Elite</option>
              <option value="Starter">Starter</option>
              <option value="Bench">Bench</option>
            </select>
          </div>
          <button class="try-btn" id="players-btn" onclick="runPlayersRequest()">Try It</button>
        </div>

        <!-- Response status -->
        <div class="response-status" id="players-status" style="display:none;">
          <span id="players-status-code"></span>
          <span id="players-latency"></span>
        </div>

        <!-- Response -->
        <div class="response-area" id="players-response">
          <div class="response-placeholder">Click "Try It" to send the request and see the response here.</div>
        </div>

      </div>
    </div>
  </section>

  <!-- ── POST /v1/valuate Tester ───────────────────────────────────────────── -->
  <section class="section">
    <div class="section-title">POST /v1/valuate — Live Tester</div>
    <div class="tester-card">
      <div class="tester-header">
        <div>
          <span class="tester-method">POST</span>
          <span class="tester-path">/v1/valuate</span>
        </div>
      </div>
      <div class="tester-body">

        <!-- curl example -->
        <div class="curl-block">
          <div class="curl-label">CURL EXAMPLE</div>
          <pre class="curl-code">curl -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-License-Key: DB-2026-DEMO-0001" \\
  -d '{"license_key":"DB-2026-DEMO-0001","draft_state":{...}}' \\
  ${window.location.origin}/v1/valuate</pre>
        </div>

        <!-- Example selector -->
        <div class="example-row">
          <span class="example-label">EXAMPLE PAYLOADS:</span>
          <select class="ctrl-select" id="example-picker" onchange="loadExample(this.value)">
            <option value="early">Early draft (Juan Soto nom.)</option>
            <option value="mid">Mid draft (balanced budgets)</option>
            <option value="late">Late draft — scarce C</option>
            <option value="ohtani">Ohtani nomination</option>
          </select>
        </div>

        <!-- Payload textarea -->
        <div>
          <div class="ctrl-label" style="margin-bottom:6px;">REQUEST BODY (JSON)</div>
          <textarea class="payload-textarea" id="valuate-payload" spellcheck="false"></textarea>
        </div>

        <!-- Send button -->
        <div>
          <button class="try-btn" id="valuate-btn" onclick="runValuateRequest()">Send Request</button>
        </div>

        <!-- Response status -->
        <div class="response-status" id="valuate-status" style="display:none;">
          <span id="valuate-status-code"></span>
          <span id="valuate-latency"></span>
        </div>

        <!-- Response -->
        <div class="response-area" id="valuate-response">
          <div class="response-placeholder">Fill the payload above and click "Send Request" to see the valuation response.</div>
        </div>

      </div>
    </div>
  </section>

  <!-- ── Footer ────────────────────────────────────────────────────────────── -->
  <footer class="footer">
    <div>Dark Blue Valuation API &nbsp;·&nbsp; v1.0.0 &nbsp;·&nbsp; Fantasy Baseball Auction Draft Engine</div>
    <div style="margin-top:4px;">Demo key: <code>DB-2026-DEMO-0001</code> &nbsp;·&nbsp; Rate limit: 120 req/min per IP</div>
  </footer>

</div>

<script>
// ── Demo license key ──────────────────────────────────────────────────────────
const DEMO_KEY = "DB-2026-DEMO-0001";
const BASE = window.location.origin;

// ── Check health on load ──────────────────────────────────────────────────────
(async function checkHealth() {
  try {
    const r = await fetch(BASE + "/health");
    const dot  = document.getElementById("health-dot");
    const text = document.getElementById("health-text");
    if (r.ok) {
      const data = await r.json();
      dot.style.background  = "#22c55e";
      dot.style.boxShadow   = "0 0 6px rgba(34,197,94,0.6)";
      text.textContent      = "API online — " + data.timestamp;
      text.style.color      = "#9ca3af";
    } else {
      dot.style.background  = "#ef4444";
      text.textContent      = "API returned error " + r.status;
    }
  } catch(e) {
    const dot  = document.getElementById("health-dot");
    const text = document.getElementById("health-text");
    dot.style.background  = "#ef4444";
    dot.style.boxShadow   = "0 0 6px rgba(239,68,68,0.6)";
    text.textContent      = "API offline — " + e.message;
    text.style.color      = "#ef4444";
  }
})();

// ── Players curl updater ──────────────────────────────────────────────────────
function updatePlayersCurl() {
  const league = document.getElementById("players-league").value;
  const pos    = document.getElementById("players-pos").value;
  const tier   = document.getElementById("players-tier").value;
  let url = BASE + "/v1/players?league=" + league;
  if (pos)  url += "&pos=" + encodeURIComponent(pos);
  if (tier) url += "&tier=" + encodeURIComponent(tier);
  document.getElementById("players-curl").textContent =
    'curl -H "X-License-Key: ' + DEMO_KEY + '" \\\\\n  "' + url + '"';
}

// ── Run GET /v1/players ───────────────────────────────────────────────────────
async function runPlayersRequest() {
  const btn    = document.getElementById("players-btn");
  const resp   = document.getElementById("players-response");
  const status = document.getElementById("players-status");
  const league = document.getElementById("players-league").value;
  const pos    = document.getElementById("players-pos").value;
  const tier   = document.getElementById("players-tier").value;

  let url = BASE + "/v1/players?league=" + league;
  if (pos)  url += "&pos=" + encodeURIComponent(pos);
  if (tier) url += "&tier=" + encodeURIComponent(tier);

  btn.disabled    = true;
  btn.textContent = "Loading…";
  resp.innerHTML  = '<div class="response-placeholder">Sending request…</div>';
  status.style.display = "none";

  const t0 = Date.now();
  try {
    const r    = await fetch(url, { headers: { "X-License-Key": DEMO_KEY } });
    const ms   = Date.now() - t0;
    const data = await r.json();

    status.style.display = "flex";
    document.getElementById("players-status-code").innerHTML =
      '<span class="' + (r.ok ? "status-ok" : "status-err") + '">' + r.status + ' ' + r.statusText + '</span>';
    document.getElementById("players-latency").innerHTML =
      '<span class="status-lat">' + ms + 'ms</span>';

    resp.innerHTML = '<pre class="response-json">' + syntaxHighlight(JSON.stringify(data, null, 2)) + '</pre>';
  } catch(e) {
    const ms = Date.now() - t0;
    status.style.display = "flex";
    document.getElementById("players-status-code").innerHTML = '<span class="status-err">Network Error</span>';
    document.getElementById("players-latency").innerHTML = '<span class="status-lat">' + ms + 'ms</span>';
    resp.innerHTML = '<div class="response-error">' + e.message + '</div>';
  }

  btn.disabled    = false;
  btn.textContent = "Try It";
}

// ── Example payloads for /v1/valuate ─────────────────────────────────────────
const EXAMPLES = {
  early: {
    license_key: "DB-2026-DEMO-0001",
    draft_state: {
      total_teams: 12,
      budget_per_team: 260,
      scoring_categories: ["R","HR","RBI","SB","AVG","W","SV","ERA","WHIP","SO"],
      teams: [
        { id: 1, budget_remaining: 255, roster: [] },
        { id: 2, budget_remaining: 260, roster: [] },
        { id: 3, budget_remaining: 260, roster: [] },
        { id: 4, budget_remaining: 260, roster: [] },
        { id: 5, budget_remaining: 260, roster: [] },
        { id: 6, budget_remaining: 260, roster: [] },
        { id: 7, budget_remaining: 260, roster: [] },
        { id: 8, budget_remaining: 260, roster: [] },
        { id: 9, budget_remaining: 260, roster: [] },
        { id: 10, budget_remaining: 260, roster: [] },
        { id: 11, budget_remaining: 260, roster: [] },
        { id: 12, budget_remaining: 260, roster: [] }
      ],
      nominated_player: "Juan Soto",
      roster_config: { C:1, "1B":1, "2B":1, "3B":1, SS:1, OF:3, SP:2, RP:2, UTIL:1, BN:2 }
    }
  },
  mid: {
    license_key: "DB-2026-DEMO-0001",
    draft_state: {
      total_teams: 12,
      budget_per_team: 260,
      scoring_categories: ["R","HR","RBI","SB","AVG","W","SV","ERA","WHIP","SO"],
      teams: [
        { id: 1, budget_remaining: 180, roster: ["Juan Soto","Corbin Carroll"] },
        { id: 2, budget_remaining: 165, roster: ["Freddie Freeman","Kyle Tucker"] },
        { id: 3, budget_remaining: 210, roster: ["Francisco Lindor"] },
        { id: 4, budget_remaining: 195, roster: ["Nolan Arenado"] },
        { id: 5, budget_remaining: 230, roster: [] },
        { id: 6, budget_remaining: 220, roster: ["Logan Webb"] },
        { id: 7, budget_remaining: 175, roster: ["Elly De La Cruz"] },
        { id: 8, budget_remaining: 200, roster: [] },
        { id: 9, budget_remaining: 215, roster: [] },
        { id: 10, budget_remaining: 190, roster: [] },
        { id: 11, budget_remaining: 205, roster: [] },
        { id: 12, budget_remaining: 240, roster: [] }
      ],
      nominated_player: "William Contreras",
      roster_config: { C:1, "1B":1, "2B":1, "3B":1, SS:1, OF:3, SP:2, RP:2, UTIL:1, BN:2 }
    }
  },
  late: {
    license_key: "DB-2026-DEMO-0001",
    draft_state: {
      total_teams: 12,
      budget_per_team: 260,
      scoring_categories: ["R","HR","RBI","SB","AVG","W","SV","ERA","WHIP","SO"],
      teams: [
        { id: 1,  budget_remaining: 45,  roster: ["Juan Soto","Corbin Carroll","Freddie Freeman","Logan Webb","Francisco Lindor","Kyle Tucker"] },
        { id: 2,  budget_remaining: 30,  roster: ["Nolan Arenado","Elly De La Cruz","Paul Goldschmidt","Ryan McMahon"] },
        { id: 3,  budget_remaining: 60,  roster: ["Spencer Strider","Sandy Alcantara","Blake Snell"] },
        { id: 4,  budget_remaining: 20,  roster: ["Christian Yelich","Jake Cronenworth","Trea Turner"] },
        { id: 5,  budget_remaining: 15,  roster: ["Ozzie Albies","Jeff McNeil","Ketel Marte"] },
        { id: 6,  budget_remaining: 80,  roster: ["Julio Rodriguez","Riley Greene"] },
        { id: 7,  budget_remaining: 25,  roster: ["Pete Alonso","CJ Abrams","Xander Bogaerts"] },
        { id: 8,  budget_remaining: 35,  roster: ["Jose Ramirez","Manny Machado"] },
        { id: 9,  budget_remaining: 55,  roster: ["Michael Harris II","Bryan Reynolds"] },
        { id: 10, budget_remaining: 40,  roster: ["Marcus Stroman","Kevin Gausman"] },
        { id: 11, budget_remaining: 70,  roster: ["Starling Marte"] },
        { id: 12, budget_remaining: 10,  roster: ["Max Muncy","Tommy Edman","Cody Bellinger","Dansby Swanson","MJ Melendez"] }
      ],
      nominated_player: "William Contreras",
      roster_config: { C:1, "1B":1, "2B":1, "3B":1, SS:1, OF:3, SP:2, RP:2, UTIL:1, BN:2 }
    }
  },
  ohtani: {
    license_key: "DB-2026-DEMO-0001",
    draft_state: {
      total_teams: 12,
      budget_per_team: 260,
      scoring_categories: ["R","HR","RBI","SB","AVG","W","SV","ERA","WHIP","SO"],
      teams: [
        { id: 1,  budget_remaining: 200, roster: ["Juan Soto"] },
        { id: 2,  budget_remaining: 220, roster: [] },
        { id: 3,  budget_remaining: 235, roster: [] },
        { id: 4,  budget_remaining: 250, roster: [] },
        { id: 5,  budget_remaining: 240, roster: [] },
        { id: 6,  budget_remaining: 215, roster: ["Logan Webb"] },
        { id: 7,  budget_remaining: 260, roster: [] },
        { id: 8,  budget_remaining: 255, roster: [] },
        { id: 9,  budget_remaining: 245, roster: [] },
        { id: 10, budget_remaining: 260, roster: [] },
        { id: 11, budget_remaining: 260, roster: [] },
        { id: 12, budget_remaining: 250, roster: [] }
      ],
      nominated_player: "Shohei Ohtani",
      roster_config: { C:1, "1B":1, "2B":1, "3B":1, SS:1, OF:3, SP:2, RP:2, UTIL:1, BN:2 }
    }
  }
};

// ── Load example payload into textarea ───────────────────────────────────────
function loadExample(key) {
  const payload = EXAMPLES[key] || EXAMPLES.early;
  document.getElementById("valuate-payload").value = JSON.stringify(payload, null, 2);
}

// Load default on page ready
loadExample("early");

// ── Run POST /v1/valuate ──────────────────────────────────────────────────────
async function runValuateRequest() {
  const btn     = document.getElementById("valuate-btn");
  const resp    = document.getElementById("valuate-response");
  const status  = document.getElementById("valuate-status");
  const rawBody = document.getElementById("valuate-payload").value;

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch(e) {
    resp.innerHTML = '<div class="response-error">JSON parse error: ' + e.message + '</div>';
    return;
  }

  btn.disabled    = true;
  btn.textContent = "Sending…";
  resp.innerHTML  = '<div class="response-placeholder">Sending request…</div>';
  status.style.display = "none";

  const t0 = Date.now();
  try {
    const r   = await fetch(BASE + "/v1/valuate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-License-Key": DEMO_KEY
      },
      body: JSON.stringify(body)
    });
    const ms   = Date.now() - t0;
    const data = await r.json();

    status.style.display = "flex";
    document.getElementById("valuate-status-code").innerHTML =
      '<span class="' + (r.ok ? "status-ok" : "status-err") + '">' + r.status + ' ' + r.statusText + '</span>';
    document.getElementById("valuate-latency").innerHTML =
      '<span class="status-lat">' + ms + 'ms</span>';

    resp.innerHTML = '<pre class="response-json">' + syntaxHighlight(JSON.stringify(data, null, 2)) + '</pre>';
  } catch(e) {
    const ms = Date.now() - t0;
    status.style.display = "flex";
    document.getElementById("valuate-status-code").innerHTML = '<span class="status-err">Network Error</span>';
    document.getElementById("valuate-latency").innerHTML = '<span class="status-lat">' + ms + 'ms</span>';
    resp.innerHTML = '<div class="response-error">' + e.message + '</div>';
  }

  btn.disabled    = false;
  btn.textContent = "Send Request";
}

// ── Copy text helper ──────────────────────────────────────────────────────────
function copyText(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    btn.style.color = "#22c55e";
    setTimeout(() => { btn.textContent = orig; btn.style.color = ""; }, 1500);
  });
}

// ── JSON syntax highlighter ───────────────────────────────────────────────────
function syntaxHighlight(json) {
  return json
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      function(match) {
        if (/^"/.test(match)) {
          if (/:$/.test(match)) return '<span style="color:#93c5fd">' + match + '</span>';
          return '<span style="color:#86efac">' + match + '</span>';
        }
        if (/true|false/.test(match)) return '<span style="color:#f59e0b">' + match + '</span>';
        if (/null/.test(match))       return '<span style="color:#6b7280">' + match + '</span>';
        return '<span style="color:#c4b5fd">' + match + '</span>';
      }
    );
}

// ── Init curl text ────────────────────────────────────────────────────────────
updatePlayersCurl();
</script>
</body>
</html>`);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found.`,
  });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message: NODE_ENV === "development" ? err.message : "An unexpected error occurred.",
  });
});

// ── START ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🟢 Dark Blue Valuation API`);
  console.log(`   Port:        ${PORT}`);
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`   Health:      http://localhost:${PORT}/health`);
  console.log(`   Valuate:     POST http://localhost:${PORT}/v1/valuate`);
  console.log(`   Players:     GET  http://localhost:${PORT}/v1/players`);
  console.log(
    `\n   API Keys:    ${(process.env.API_KEYS || "DB-2026-DEMO-0001").split(",").length} key(s) active`
  );
  console.log(`\n   Deploy to VPS: set PORT, API_KEYS, ALLOWED_ORIGINS in .env\n`);
});

module.exports = app;
