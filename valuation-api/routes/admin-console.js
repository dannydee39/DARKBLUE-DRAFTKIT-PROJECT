const crypto = require("crypto");
const express = require("express");
const { calculateValuations, getPlayers } = require("../services/valuation");
const { createPlayerUpdate, listPlayerUpdates } = require("../services/playerUpdates");
const { buildDemoUpdatePayload, DEMO_STATUS_TEMPLATES } = require("../services/playerUpdateDemo");

const router = express.Router();
const ADMIN_COOKIE = "db_api_admin";
const CUSTOMER_SITE = "https://darkbluevalue.anythingavenue.com";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

router.get("/", (req, res) => {
  if (!getAdminSession(req)) return sendLoginPage(res);
  return sendConsolePage(res);
});

router.post("/login", (req, res) => {
  const password = String(req.body?.password || "");
  const configuredPassword = getAdminPassword();

  if (!configuredPassword) {
    return res.status(503).json({
      ok: false,
      message: "Admin console password is not configured.",
    });
  }

  if (!constantTimeEquals(password, configuredPassword)) {
    return res.status(401).json({
      ok: false,
      message: "Invalid admin password.",
    });
  }

  res.cookie(ADMIN_COOKIE, createAdminToken(), adminCookieOptions(req));
  res.json({ ok: true });
});

router.post("/logout", (req, res) => {
  res.clearCookie(ADMIN_COOKIE, adminCookieOptions(req));
  res.json({ ok: true });
});

router.get("/customer", (_req, res) => {
  res.redirect(302, CUSTOMER_SITE);
});

router.use("/api", requireAdminSession);

router.get("/api/session", (_req, res) => {
  res.json({ authenticated: true });
});

router.get("/api/health", (_req, res) => {
  res.json({
    status: "online",
    service: "Dark Blue MLB Valuation API",
    timestamp: new Date().toISOString(),
  });
});

router.get("/api/players", (req, res) => {
  const search = normalizeSearch(req.query.search);
  const limit = clamp(Number(req.query.limit || 25), 1, 100);
  const players = getPlayers({
    league: req.query.league || "ALL",
    pos: req.query.pos || "ALL",
    tier: req.query.tier || "ALL",
  })
    .filter((player) => {
      if (!search) return true;
      return normalizeSearch(`${player.name} ${player.team} ${(player.pos || []).join(" ")}`).includes(search);
    })
    .slice(0, limit);

  res.json({ count: players.length, players });
});

router.get("/api/player-updates", (req, res) => {
  const limit = clamp(Number(req.query.limit || 10), 1, 50);
  const updates = listPlayerUpdates({ limit });
  res.json({ count: updates.length, updates });
});

router.post("/api/player-updates/demo", (req, res) => {
  try {
    const update = createPlayerUpdate(buildDemoUpdatePayload(req.body || {}));
    const updates = listPlayerUpdates({ limit: 10 });
    res.status(201).json({ update, updates });
  } catch (error) {
    res.status(error.status || 400).json({
      error: "Bad Request",
      code: error.code || "INVALID_ADMIN_DEMO_ALERT",
      message: error.message || "Could not create player alert.",
    });
  }
});

router.post("/api/valuate", (req, res) => {
  try {
    const draftState = req.body?.draft_state || req.body;
    if (!draftState || typeof draftState !== "object") {
      return res.status(400).json({
        error: "Bad Request",
        message: "A draft_state object is required.",
      });
    }

    res.json(calculateValuations(draftState));
  } catch (error) {
    res.status(500).json({
      error: "Internal Server Error",
      message: "Valuation calculation failed.",
    });
  }
});

function requireAdminSession(req, res, next) {
  if (getAdminSession(req)) return next();
  return res.status(401).json({
    error: "Unauthorized",
    message: "Admin login required.",
  });
}

function getAdminPassword() {
  return process.env.ADMIN_CONSOLE_PASSWORD || process.env.DARKBLUE_ADMIN_PASSWORD || "";
}

function createAdminToken() {
  const payload = Buffer.from(
    JSON.stringify({
      role: "admin",
      exp: Date.now() + SESSION_TTL_MS,
      nonce: crypto.randomBytes(12).toString("hex"),
    }),
  ).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function getAdminSession(req) {
  const token = parseCookies(req.headers.cookie || "")[ADMIN_COOKIE];
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !constantTimeEquals(signature, sign(payload))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed.role !== "admin" || Number(parsed.exp) <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sign(value) {
  const secret =
    process.env.ADMIN_CONSOLE_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.ADMIN_CONSOLE_PASSWORD ||
    "development-admin-console-secret";
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function adminCookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(req),
    maxAge: SESSION_TTL_MS,
    path: "/admin",
  };
}

function isSecureRequest(req) {
  return req.secure || req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
}

function parseCookies(header) {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf("=");
      if (separator <= 0) return cookies;
      cookies[part.slice(0, separator)] = decodeURIComponent(part.slice(separator + 1));
      return cookies;
    }, {});
}

function constantTimeEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

function sendLoginPage(res) {
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dark Blue API Admin</title>
  <style>${baseCss()}</style>
</head>
<body class="login-page">
  <main class="login-shell">
    <section class="login-panel">
      <div class="eyebrow">Dark Blue API</div>
      <h1>Admin Console</h1>
      <p class="muted">Sign in to manually test live API operations, including player alert pushes.</p>
      <form id="login-form" class="login-form">
        <label>Password<input type="password" name="password" autocomplete="current-password" required autofocus /></label>
        <button type="submit">Sign In</button>
      </form>
      <div id="login-error" class="error" hidden></div>
      <a class="customer-link" href="/admin/customer">I need a customer license</a>
    </section>
  </main>
  <script>
    document.getElementById("login-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      const error = document.getElementById("login-error");
      error.hidden = true;
      const password = new FormData(event.currentTarget).get("password");
      const response = await fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (response.ok) {
        window.location.href = "/admin";
        return;
      }
      error.textContent = response.status === 503
        ? "Admin login is not configured on this server."
        : "Invalid admin password.";
      error.hidden = false;
    });
  </script>
</body>
</html>`);
}

function sendConsolePage(res) {
  const statusOptions = Object.keys(DEMO_STATUS_TEMPLATES)
    .map((key) => `<option value="${key}">${statusLabelFromKey(key)}</option>`)
    .join("");

  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dark Blue API Console</title>
  <style>${baseCss()}${consoleCss()}</style>
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <div class="eyebrow">Admin Console</div>
        <h1>Dark Blue API Test Bench</h1>
      </div>
      <nav>
        <a href="${CUSTOMER_SITE}">Customer site</a>
        <button id="logout-btn" type="button">Sign Out</button>
      </nav>
    </header>

    <section class="status-strip">
      <button id="health-btn" type="button">Run Health Check</button>
      <div id="health-output">Ready</div>
    </section>

    <main class="grid">
      <section class="panel">
        <div class="panel-head">
          <h2>Player Search</h2>
          <p>Find players for valuation and alert tests.</p>
        </div>
        <div class="controls">
          <input id="player-search" placeholder="Search name, team, or position" />
          <select id="player-league">
            <option value="ALL">All leagues</option>
            <option value="AL">AL only</option>
            <option value="NL">NL only</option>
          </select>
          <select id="player-pos">
            <option value="ALL">All positions</option>
            <option>C</option><option>1B</option><option>2B</option><option>3B</option>
            <option>SS</option><option>OF</option><option>SP</option><option>RP</option>
          </select>
          <button id="player-search-btn" type="button">Search</button>
        </div>
        <div id="player-results" class="results"></div>
      </section>

      <section class="panel accent">
        <div class="panel-head">
          <h2>Push Player Alert</h2>
          <p>Create a Valuation API-owned alert and broadcast it to Draft Kit.</p>
        </div>
        <div class="form-grid">
          <label>Player<input id="alert-player" list="admin-player-list" value="Aaron Judge" /></label>
          <datalist id="admin-player-list"></datalist>
          <label>Status
            <select id="alert-status">${statusOptions}</select>
          </label>
          <label class="wide">Draft impact note<textarea id="alert-impact" rows="3" placeholder="Optional note shown in Draft Kit"></textarea></label>
          <button id="push-alert-btn" type="button">Push Alert</button>
        </div>
        <pre id="alert-output" class="response"></pre>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Latest Alerts</h2>
          <p>Read the persisted player-update feed.</p>
        </div>
        <button id="load-updates-btn" type="button">Refresh Feed</button>
        <div id="updates-output" class="feed"></div>
      </section>

      <section class="panel wide-panel">
        <div class="panel-head">
          <h2>Valuation Request</h2>
          <p>Send a draft_state directly through the valuation engine.</p>
        </div>
        <textarea id="valuation-body" class="json-box" spellcheck="false"></textarea>
        <div class="actions">
          <button id="load-example-btn" type="button">Load Example</button>
          <button id="send-valuation-btn" type="button">Run Valuation</button>
        </div>
        <pre id="valuation-output" class="response large"></pre>
      </section>
    </main>
  </div>
  <script>
    const exampleDraftState = {
      total_teams: 12,
      budget_per_team: 260,
      scoring_categories: ["R","HR","RBI","SB","AVG","W","SV","ERA","WHIP","SO"],
      teams: [
        { id: 1, budget_remaining: 230, roster: [["Shohei Ohtani","LAD"]] },
        { id: 2, budget_remaining: 260, roster: [] }
      ],
      roster_config: { C:1, "1B":1, "2B":1, "3B":1, SS:1, OF:3, SP:2, RP:2, UTIL:1, BN:2 }
    };

    const state = { players: [] };
    const $ = (id) => document.getElementById(id);

    $("valuation-body").value = JSON.stringify({ draft_state: exampleDraftState }, null, 2);
    $("health-btn").addEventListener("click", runHealth);
    $("player-search-btn").addEventListener("click", searchPlayers);
    $("player-search").addEventListener("keydown", (event) => { if (event.key === "Enter") searchPlayers(); });
    $("push-alert-btn").addEventListener("click", pushAlert);
    $("load-updates-btn").addEventListener("click", loadUpdates);
    $("load-example-btn").addEventListener("click", () => { $("valuation-body").value = JSON.stringify({ draft_state: exampleDraftState }, null, 2); });
    $("send-valuation-btn").addEventListener("click", runValuation);
    $("logout-btn").addEventListener("click", async () => {
      await fetch("/admin/logout", { method: "POST" });
      window.location.href = "/admin";
    });

    async function api(path, options) {
      const response = await fetch(path, {
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...((options && options.headers) || {}) },
        ...(options || {})
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload.message || "Request failed.";
        throw new Error(message);
      }
      return payload;
    }

    async function runHealth() {
      $("health-output").textContent = "Checking...";
      try {
        const result = await api("/admin/api/health");
        $("health-output").textContent = result.status + " · " + result.timestamp;
      } catch (error) {
        $("health-output").textContent = error.message;
      }
    }

    async function searchPlayers() {
      const params = new URLSearchParams({
        search: $("player-search").value,
        league: $("player-league").value,
        pos: $("player-pos").value,
        limit: "50"
      });
      const output = $("player-results");
      output.textContent = "Searching...";
      try {
        const result = await api("/admin/api/players?" + params.toString());
        state.players = result.players || [];
        $("admin-player-list").innerHTML = state.players.map((player) =>
          '<option value="' + escapeAttr(player.name) + '">' + escapeHtml([player.team, (player.pos || []).join("/")].filter(Boolean).join(" · ")) + '</option>'
        ).join("");
        output.innerHTML = state.players.map((player) =>
          '<button type="button" class="player-row" data-name="' + escapeAttr(player.name) + '">' +
            '<strong>' + escapeHtml(player.name) + '</strong><span>' + escapeHtml(player.team || "") + ' · ' + escapeHtml((player.pos || []).join("/")) + ' · $' + escapeHtml(String(player.baseValue || 0)) + '</span>' +
          '</button>'
        ).join("") || '<div class="empty">No matching players.</div>';
        output.querySelectorAll(".player-row").forEach((row) => {
          row.addEventListener("click", () => { $("alert-player").value = row.dataset.name; });
        });
      } catch (error) {
        output.innerHTML = '<div class="error">' + escapeHtml(error.message) + '</div>';
      }
    }

    async function pushAlert() {
      const output = $("alert-output");
      output.textContent = "Pushing alert...";
      try {
        const result = await api("/admin/api/player-updates/demo", {
          method: "POST",
          body: JSON.stringify({
            player_name: $("alert-player").value,
            alert_status: $("alert-status").value,
            impact_summary: $("alert-impact").value.trim() || undefined
          })
        });
        output.textContent = JSON.stringify(result.update, null, 2);
        await loadUpdates();
      } catch (error) {
        output.textContent = error.message;
      }
    }

    async function loadUpdates() {
      const output = $("updates-output");
      output.textContent = "Loading...";
      try {
        const result = await api("/admin/api/player-updates?limit=10");
        output.innerHTML = (result.updates || []).map((update) =>
          '<div class="feed-row ' + escapeAttr(update.tone || "neutral") + '">' +
            '<strong>' + escapeHtml(update.player_name) + '</strong>' +
            '<span>' + escapeHtml(update.status_label || update.risk_level || "Alert") + ' · ' + escapeHtml(update.headline || "") + '</span>' +
          '</div>'
        ).join("") || '<div class="empty">No alerts yet.</div>';
      } catch (error) {
        output.innerHTML = '<div class="error">' + escapeHtml(error.message) + '</div>';
      }
    }

    async function runValuation() {
      const output = $("valuation-output");
      output.textContent = "Running valuation...";
      try {
        const body = JSON.parse($("valuation-body").value);
        const result = await api("/admin/api/valuate", {
          method: "POST",
          body: JSON.stringify(body)
        });
        output.textContent = JSON.stringify(result, null, 2);
      } catch (error) {
        output.textContent = error.message;
      }
    }

    function escapeHtml(value) {
      return String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      }[char]));
    }

    function escapeAttr(value) {
      return escapeHtml(value).replace(new RegExp(String.fromCharCode(96), "g"), "&#96;");
    }

    runHealth();
    searchPlayers();
    loadUpdates();
  </script>
</body>
</html>`);
}

function statusLabelFromKey(key) {
  return key
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function baseCss() {
  return `
    *, *::before, *::after { box-sizing: border-box; }
    :root {
      --bg:#07111f; --panel:#0d1b2e; --panel2:#13243a; --line:#24405f;
      --text:#e5edf7; --muted:#91a4ba; --blue:#60a5fa; --green:#22c55e;
      --red:#ef4444; --amber:#f59e0b; --radius:8px;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); }
    button, input, select, textarea { font:inherit; }
    button { cursor:pointer; }
    .eyebrow { color:var(--blue); font-size:11px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; }
    .muted { color:var(--muted); line-height:1.55; }
    .error { color:#fecaca; background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.35); border-radius:var(--radius); padding:10px; }
    .login-page { display:grid; place-items:center; padding:24px; }
    .login-shell { width:min(460px, 100%); }
    .login-panel { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:28px; box-shadow:0 24px 60px rgba(0,0,0,.35); }
    .login-panel h1 { margin:8px 0 8px; font-size:34px; }
    .login-form { display:grid; gap:14px; margin-top:22px; }
    label { display:grid; gap:7px; color:var(--muted); font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; }
    input, select, textarea { width:100%; color:var(--text); background:var(--panel2); border:1px solid var(--line); border-radius:var(--radius); padding:10px 11px; outline:none; }
    textarea { resize:vertical; }
    input:focus, select:focus, textarea:focus { border-color:rgba(96,165,250,.7); box-shadow:0 0 0 2px rgba(96,165,250,.14); }
    button { color:#06111f; background:var(--blue); border:0; border-radius:var(--radius); padding:10px 12px; font-weight:900; }
    button:hover { filter:brightness(1.08); }
    .customer-link { color:#bfdbfe; display:inline-flex; margin-top:16px; font-size:13px; }
  `;
}

function consoleCss() {
  return `
    .app-shell { width:min(1380px, 100%); margin:0 auto; padding:22px; }
    .topbar { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-bottom:18px; }
    .topbar h1 { margin:4px 0 0; font-size:30px; }
    .topbar nav { display:flex; align-items:center; gap:10px; }
    .topbar a { color:#bfdbfe; font-size:13px; font-weight:800; text-decoration:none; }
    .topbar button { background:var(--panel2); color:var(--text); border:1px solid var(--line); }
    .status-strip { display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--line); border-radius:var(--radius); padding:12px; margin-bottom:14px; }
    .status-strip button { width:auto; }
    #health-output { color:var(--muted); font-size:13px; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .panel { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px; min-width:0; }
    .panel.accent { border-color:rgba(96,165,250,.45); }
    .wide-panel { grid-column:1 / -1; }
    .panel-head { margin-bottom:14px; }
    .panel h2 { margin:0 0 4px; font-size:18px; }
    .panel p { color:var(--muted); margin:0; font-size:13px; line-height:1.45; }
    .controls, .form-grid { display:grid; grid-template-columns:1fr 150px 150px auto; gap:10px; align-items:end; }
    .form-grid { grid-template-columns:1fr 220px; }
    .wide { grid-column:1 / -1; }
    .results, .feed { display:grid; gap:8px; margin-top:12px; max-height:340px; overflow:auto; }
    .player-row, .feed-row { width:100%; color:var(--text); background:var(--panel2); border:1px solid var(--line); border-radius:var(--radius); padding:10px; text-align:left; display:grid; gap:3px; }
    .player-row span, .feed-row span { color:var(--muted); font-size:12px; }
    .feed-row.danger { border-left:4px solid var(--red); }
    .feed-row.warning { border-left:4px solid var(--amber); }
    .feed-row.positive { border-left:4px solid var(--green); }
    .feed-row.info { border-left:4px solid var(--blue); }
    .response, .json-box { width:100%; background:#06101d; border:1px solid var(--line); border-radius:var(--radius); color:#cbd5e1; font-family:"JetBrains Mono", Consolas, monospace; font-size:12px; line-height:1.55; padding:12px; margin-top:12px; overflow:auto; }
    .response { max-height:330px; min-height:90px; white-space:pre-wrap; }
    .response.large { max-height:520px; }
    .json-box { min-height:220px; }
    .actions { display:flex; gap:10px; margin-top:10px; }
    .empty { color:var(--muted); border:1px dashed var(--line); border-radius:var(--radius); padding:14px; }
    @media (max-width:900px) {
      .topbar, .status-strip { align-items:stretch; flex-direction:column; }
      .grid, .controls, .form-grid { grid-template-columns:1fr; }
      .wide-panel { grid-column:auto; }
    }
  `;
}

module.exports = router;
