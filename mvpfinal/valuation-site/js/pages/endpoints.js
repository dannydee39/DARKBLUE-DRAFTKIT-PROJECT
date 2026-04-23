/**
 * endpoints.js — Endpoints tab renderer.
 *
 * Three endpoint cards + a live Try It panel at the bottom.
 *
 * Each card shows:
 *   - Method badge + path + auth requirement
 *   - What it does
 *   - Request example (cURL)
 *   - Response example (JSON)
 *   - Why it matters to DraftKit
 */

window.DB = window.DB || {};
DB.pages  = DB.pages || {};

DB.pages.endpoints = function (container) {

  var KEY     = DB.DEMO_KEY;
  var BASE    = DB.API_BASE;
  var DISPLAY = DB.API_DISPLAY;

  /* ── Sample responses ────────────────────────────────────────────────────── */

  var HEALTH_RESPONSE = JSON.stringify(
    {
      status: 'online',
      service: 'Dark Blue MLB Valuation API',
      version: '1.0.0',
      timestamp: '2026-04-10T14:30:00.000Z',
      environment: 'production',
    }, null, 2
  );

  var PLAYERS_RESPONSE = JSON.stringify({
    count: 313,
    players: [
      {
        name:      'Shohei Ohtani',
        team:      'LAD',
        league:    'NL',
        pos:       ['DH', '1B'],
        tier:      'Elite',
        fpts:      892.4,
        baseValue: 71,
        drafted:   false,
        overall_rank: 1,
        tier_rank: 1,
        stats: { HR: 44, RBI: 130, SB: 20, AVG: 0.31, ERA: null, SO: null, WHIP: null },
      },
    ],
  }, null, 2);

  var VALUATE_RESPONSE = JSON.stringify({
    player:                 'Shohei Ohtani',
    player_tier:            'Elite',
    base_value:             63.1,
    max_bid_recommendation: 69,
    true_dollar_value:      74.8,
    market_inflation:       1.08,
    market_context:         { label: 'Hot', delta_percent: 8.0 },
    scarcity_tier:          'HIGH',
    position_scarcity:      { DH: 'HIGH', '1B': 'HIGH' },
    draftability_score:     1.0,
    value_delta:            12,
    reasoning:              'DH scarce — high demand in pool. Market inflation +8.0%. Player tier: Elite. Scarcity: HIGH. TDV: $75.',
    stats:                  { tier: 'Elite', positions: ['DH', '1B'], team: 'LAD', league: 'NL' },
  }, null, 2);

  /* ── cURL examples ───────────────────────────────────────────────────────── */

  var CURL_HEALTH = 'curl ' + DISPLAY + '/health';

  var CURL_PLAYERS =
    'curl "' + DISPLAY + '/v1/players?league=NL" \\\n' +
    '  -H "X-License-Key: ' + KEY + '"';

  var CURL_VALUATE =
    'curl -X POST ' + DISPLAY + '/v1/valuate \\\n' +
    '  -H "Content-Type: application/json" \\\n' +
    '  -H "X-License-Key: ' + KEY + '" \\\n' +
    '  -d \'{\n' +
    '    "draft_state": {\n' +
    '      "total_teams": 12,\n' +
    '      "budget_per_team": 260,\n' +
    '      "scoring_categories": ["HR","RBI","AVG","SB","ERA","SO","WHIP"],\n' +
    '      "teams": [\n' +
    '        { "id": 1, "budget_remaining": 248, "roster": ["Freddie Freeman"] },\n' +
    '        { "id": 2, "budget_remaining": 195, "roster": ["Ronald Acuna Jr."] }\n' +
    '      ],\n' +
    '      "nominated_player": "Shohei Ohtani",\n' +
    '      "roster_config": {\n' +
    '        "C":1, "1B":1, "2B":1, "3B":1, "SS":1,\n' +
    '        "OF":3, "SP":2, "RP":2, "UTIL":1, "BN":2\n' +
    '      }\n' +
    '    }\n' +
    '  }\'';

  /* ── Try It default payload ──────────────────────────────────────────────── */

  var TRY_IT_DEFAULT = JSON.stringify({
    draft_state: {
      total_teams:        12,
      budget_per_team:    260,
      scoring_categories: ['HR', 'RBI', 'AVG', 'SB', 'ERA', 'SO', 'WHIP'],
      teams: [
        { id: 1, budget_remaining: 248, roster: ['Freddie Freeman'] },
      ],
      nominated_player: 'Shohei Ohtani',
      roster_config: { C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 3, SP: 2, RP: 2, UTIL: 1, BN: 2 },
    },
  }, null, 2);

  /* ── Page HTML ───────────────────────────────────────────────────────────── */

  container.innerHTML =
    '<div class="page-endpoints">' +
      '<div class="endpoints-container">' +

        /* Header */
        '<header class="endpoints-header">' +
          '<p class="endpoints-kicker">API Reference</p>' +
          '<h1>Three endpoints. Everything a draft product needs.</h1>' +
          '<p class="endpoints-lead">' +
            'Base URL: <code>' + DISPLAY + '</code>' +
          '</p>' +
        '</header>' +

        '<section class="ep-flow-strip">' +
          '<div class="ep-flow-card">' +
            '<div class="ep-flow-label">Quickstart</div>' +
            '<p>Use <code>/v1/players</code> before the draft and <code>/v1/valuate</code> on every nomination.</p>' +
          '</div>' +
          '<div class="ep-flow-card">' +
            '<div class="ep-flow-label">Auth</div>' +
            '<p>Every protected request uses one header: <code>X-License-Key: ' + KEY + '</code>.</p>' +
          '</div>' +
          '<div class="ep-flow-card">' +
            '<div class="ep-flow-label">Draft Kit</div>' +
            '<p>The browser talks to <code>draftkit-api</code>. That backend proxies to this licensed API.</p>' +
          '</div>' +
        '</section>' +

        /* ── GET /health ─────────────────────────────────────────────────── */
        '<article class="ep-card" id="ep-health">' +
          '<div class="ep-card-head">' +
            '<span class="ep-method ep-get">GET</span>' +
            '<code class="ep-path">/health</code>' +
            '<span class="ep-auth ep-auth-none">No auth</span>' +
          '</div>' +
          '<div class="ep-card-body">' +
            '<p class="ep-desc">' +
              'Lightweight ping. Confirm the API is online and responsive before the draft starts.' +
            '</p>' +
            '<div class="ep-why">' +
              '<strong>Why it matters:</strong> Call this once at DraftKit startup. If it fails, ' +
              'show a connection warning before the user enters the draft room.' +
            '</div>' +
            _codeBlock('cURL', CURL_HEALTH) +
            _codeBlock('Response \u2014 200 OK', HEALTH_RESPONSE) +
          '</div>' +
        '</article>' +

        /* ── GET /v1/players ─────────────────────────────────────────────── */
        '<article class="ep-card" id="ep-players">' +
          '<div class="ep-card-head">' +
            '<span class="ep-method ep-get">GET</span>' +
            '<code class="ep-path">/v1/players</code>' +
            '<span class="ep-auth ep-auth-required">Key required</span>' +
          '</div>' +
          '<div class="ep-card-body">' +
            '<p class="ep-desc">' +
              'Returns the full player pool with projected stats, tiers, rankings, and base values. ' +
              'Filter by league with the <code>league</code> query parameter (<code>AL</code>, ' +
              '<code>NL</code>, or <code>ALL</code>).' +
            '</p>' +
            '<div class="ep-why">' +
              '<strong>Why it matters:</strong> This is the data your draft board, player search, ' +
              'and tier views are built from. Load it once before the first nomination.' +
            '</div>' +

            '<div class="ep-params">' +
              '<h4>Query Parameters</h4>' +
              '<table class="ep-table">' +
                '<thead><tr><th>Param</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>' +
                '<tbody>' +
                  '<tr>' +
                    '<td><code>league</code></td>' +
                    '<td>string</td>' +
                    '<td><code>ALL</code></td>' +
                    '<td>Filter to AL, NL, or ALL (combined).</td>' +
                  '</tr>' +
                '</tbody>' +
              '</table>' +
            '</div>' +

            _codeBlock('cURL', CURL_PLAYERS) +
            _codeBlock('Response \u2014 200 OK (truncated)', PLAYERS_RESPONSE) +
          '</div>' +
        '</article>' +

        /* ── POST /v1/valuate ────────────────────────────────────────────── */
        '<article class="ep-card" id="ep-valuate">' +
          '<div class="ep-card-head">' +
            '<span class="ep-method ep-post">POST</span>' +
            '<code class="ep-path">/v1/valuate</code>' +
            '<span class="ep-auth ep-auth-required">Key required</span>' +
          '</div>' +
          '<div class="ep-card-body">' +
            '<p class="ep-desc">' +
              'The core endpoint. Send your full draft state and the nominated player; ' +
              'receive a max bid recommendation backed by live SGP math, position scarcity, ' +
              'and market inflation.' +
            '</p>' +
            '<div class="ep-callout">' +
              'This endpoint is <strong>stateless</strong>. Send the complete, current ' +
              'draft state on every request. Nothing is stored server-side between calls.' +
            '</div>' +
            '<div class="ep-why">' +
              '<strong>Why it matters:</strong> This is what runs during the draft. Every time a ' +
              'player is nominated, your UI calls this endpoint and shows the recommendation in real time.' +
            '</div>' +

            '<div class="ep-params">' +
              '<h4>Request Body \u2014 <code>draft_state</code></h4>' +
              '<table class="ep-table">' +
                '<thead><tr><th>Field</th><th>Type</th><th>Req</th><th>Description</th></tr></thead>' +
                '<tbody>' +
                  '<tr><td><code>total_teams</code></td><td>int</td>' +
                    '<td><span class="ep-req">required</span></td>' +
                    '<td>Number of teams in the league.</td></tr>' +
                  '<tr><td><code>budget_per_team</code></td><td>int</td>' +
                    '<td><span class="ep-req">required</span></td>' +
                    '<td>Starting auction budget per team (standard: 260).</td></tr>' +
                  '<tr><td><code>scoring_categories</code></td><td>string[]</td>' +
                    '<td><span class="ep-req">required</span></td>' +
                    '<td>Active categories. Supported: HR, RBI, AVG, SB, R, H, OBP, BB, TB, XBH, W, SV, ERA, WHIP, SO, HLD, K/9, BB/9, QS.</td></tr>' +
                  '<tr><td><code>teams</code></td><td>object[]</td>' +
                    '<td><span class="ep-req">required</span></td>' +
                    '<td>Each: <code>id</code>, <code>budget_remaining</code>, <code>roster</code> (player names).</td></tr>' +
                  '<tr><td><code>nominated_player</code></td><td>string</td>' +
                    '<td><span class="ep-req">required</span></td>' +
                    '<td>Player name to valuate. Case-insensitive matching.</td></tr>' +
                  '<tr><td><code>roster_config</code></td><td>object</td>' +
                    '<td>optional</td>' +
                    '<td>Slot counts per position. Defaults to standard 12-team layout.</td></tr>' +
                '</tbody>' +
              '</table>' +
            '</div>' +

            _codeBlock('cURL', CURL_VALUATE) +
            _codeBlock('Response \u2014 200 OK', VALUATE_RESPONSE) +

            '<div class="ep-params">' +
              '<h4>Error Codes</h4>' +
              '<table class="ep-table">' +
                '<thead><tr><th>Status</th><th>Cause</th></tr></thead>' +
                '<tbody>' +
                  '<tr><td><code>400</code></td><td>Missing or malformed body fields.</td></tr>' +
                  '<tr><td><code>401</code></td><td>Missing or invalid <code>X-License-Key</code>.</td></tr>' +
                  '<tr><td><code>404</code></td><td>Nominated player not found in pool.</td></tr>' +
                  '<tr><td><code>429</code></td><td>Rate limit exceeded. Check <code>Retry-After</code> header.</td></tr>' +
                  '<tr><td><code>500</code></td><td>Internal error. Retry with backoff.</td></tr>' +
                '</tbody>' +
              '</table>' +
            '</div>' +
          '</div>' +
        '</article>' +

        /* ── Try It ──────────────────────────────────────────────────────── */
        '<section class="ep-tryit" id="ep-tryit">' +
          '<div class="ep-tryit-head">' +
            '<h2>Try It</h2>' +
            '<p>Send a live <code>POST /v1/valuate</code> request using the live test key.</p>' +
          '</div>' +
          '<div class="ep-tryit-note">' +
            'The API must be running at <code>' + BASE + '</code>. ' +
            'In development: <code>cd mvpfinal/valuation-api && node server.js</code>' +
          '</div>' +
          '<label class="ep-tryit-label" for="tryit-body">Request Body (JSON)</label>' +
          '<textarea id="tryit-body" class="ep-tryit-textarea">' + _esc(TRY_IT_DEFAULT) + '</textarea>' +
          '<div class="ep-tryit-actions">' +
            '<button class="btn btn-primary" id="tryit-send">Send Request</button>' +
            '<button class="btn btn-secondary" id="tryit-reset">Reset</button>' +
          '</div>' +
          '<div id="tryit-status" class="ep-tryit-status"></div>' +
          '<div id="tryit-response"></div>' +
        '</section>' +

      '</div>' +
    '</div>';

  /* ══════════════════════════════════════════════════════════════════════════
     Event handlers
     ══════════════════════════════════════════════════════════════════════════ */

  /* Copy buttons on code blocks */
  container.querySelectorAll('.ep-copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      if (!text || !navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(function () {
        var orig = btn.textContent;
        btn.textContent = 'Copied';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.textContent = orig;
          btn.classList.remove('copied');
        }, 2000);
      }).catch(function () {});
    });
  });

  /* Try It: Send */
  var sendBtn = document.getElementById('tryit-send');
  if (sendBtn) {
    sendBtn.addEventListener('click', async function () {
      var bodyEl     = document.getElementById('tryit-body');
      var statusEl   = document.getElementById('tryit-status');
      var responseEl = document.getElementById('tryit-response');

      var payload;
      try {
        payload = JSON.parse(bodyEl.value);
      } catch (e) {
        statusEl.className   = 'ep-tryit-status ep-tryit-error';
        statusEl.textContent = 'Invalid JSON \u2014 ' + e.message;
        return;
      }

      sendBtn.textContent = 'Sending\u2026';
      sendBtn.disabled    = true;
      statusEl.className  = 'ep-tryit-status';
      statusEl.textContent = '';
      responseEl.innerHTML = '';

      var t0 = performance.now();
      try {
        var res     = await fetch(BASE + '/v1/valuate', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-License-Key': KEY },
          body:    JSON.stringify(payload),
        });
        var latency = Math.round(performance.now() - t0);
        var json    = await res.json();

        statusEl.className = 'ep-tryit-status ' + (res.ok ? 'ep-tryit-ok' : 'ep-tryit-error');
        statusEl.textContent = (res.ok ? '\u2713 ' : '\u2715 ') +
          res.status + ' ' + res.statusText + ' \u00b7 ' + latency + 'ms';

        responseEl.innerHTML =
          '<div class="code-block" style="margin-top:0.75rem;">' +
            '<div class="code-block-header">' +
              '<span class="code-block-lang">Response \u00b7 ' + latency + 'ms</span>' +
            '</div>' +
            '<pre class="code-pre" style="max-height:360px;overflow:auto;">' +
              _esc(JSON.stringify(json, null, 2)) +
            '</pre>' +
          '</div>';

      } catch (err) {
        var ms = Math.round(performance.now() - t0);
        statusEl.className   = 'ep-tryit-status ep-tryit-error';
        statusEl.textContent = 'Network error (' + ms + 'ms) \u2014 is the API running at ' + BASE + '?';
      }

      sendBtn.textContent = 'Send Request';
      sendBtn.disabled    = false;
    });
  }

  /* Try It: Reset */
  var resetBtn = document.getElementById('tryit-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      var bodyEl = document.getElementById('tryit-body');
      if (bodyEl) bodyEl.value = TRY_IT_DEFAULT;
      var statusEl = document.getElementById('tryit-status');
      if (statusEl) { statusEl.textContent = ''; statusEl.className = 'ep-tryit-status'; }
      var respEl = document.getElementById('tryit-response');
      if (respEl) respEl.innerHTML = '';
    });
  }

  /* ── Helpers ─────────────────────────────────────────────────────────────── */

  function _codeBlock(lang, code) {
    return (
      '<div class="code-block">' +
        '<div class="code-block-header">' +
          '<span class="code-block-lang">' + lang + '</span>' +
          '<button class="ep-copy-btn" data-copy="' + _attr(code) + '">Copy</button>' +
        '</div>' +
        '<pre class="code-pre">' + _esc(code) + '</pre>' +
      '</div>'
    );
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _attr(str) {
    return _esc(str).replace(/'/g, '&#39;');
  }
};
