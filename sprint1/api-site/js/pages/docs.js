/**
 * docs.js
 * ─────────────────────────────────────────────────────────────────────────────
 * API Documentation page renderer.
 *
 * Layout:
 *   Two-column sticky layout:
 *     Left  — sidebar nav (scrolls user to sections)
 *     Right — content with endpoint specs, parameter tables, code examples
 *
 * Sections:
 *   1. Authentication    — X-License-Key header, demo key
 *   2. Rate Limits       — per-tier table
 *   3. GET /health       — no-auth ping
 *   4. GET /v1/players   — player pool endpoint
 *   5. POST /v1/valuate  — core valuation endpoint (full schema)
 *   6. Response Schema   — field-by-field reference
 *   7. Error Codes       — HTTP status table + error response shape
 *   8. Valuation Formula — algorithm explanation with code
 *   9. Try It            — interactive live request panel
 *
 * The "Try It" panel sends a real POST to DB.API_BASE. Uses the logged-in
 * user's license key if available, otherwise falls back to the demo key.
 *
 * CSS dependencies:
 *   css/pages/docs.css — .docs-layout, .docs-sidebar, .docs-sidebar-title,
 *                         .docs-nav-link, .docs-content, .docs-section,
 *                         .endpoint-display, .endpoint-badge, .badge-get,
 *                         .badge-post, .params-table, .callout, .callout-info,
 *                         .callout-warning, .required-badge
 *   css/components.css — .code-block, .code-block-header, .code-block-lang,
 *                         .code-pre, .code-copy-btn, .btn, .form-input,
 *                         .form-label, .badge
 * ─────────────────────────────────────────────────────────────────────────────
 */

window.DB = window.DB || {};
DB.pages  = DB.pages || {};

DB.pages.docs = function (container) {

  /* ── Active license key ───────────────────────────────────────────────────
     Use the logged-in user's key so the generated examples are immediately
     runnable. Fall back to the shared demo key for unauthenticated visitors.
  ─────────────────────────────────────────────────────────────────────────── */
  var KEY      = DB.state.licenseKey || DB.DEMO_KEY;
  var BASE     = DB.API_BASE;
  var isLoggedIn = !!DB.state.user;

  /* ── Sample responses (pre-formatted JSON strings) ───────────────────────── */
  var SAMPLE_VALUATE_RESPONSE = JSON.stringify({
    nominated_player:       'Shohei Ohtani',
    max_bid_recommendation: 69,
    true_dollar_value:      74.8,
    reasoning:              'Two-way elite. DH eligible. Position scarcity 1.12×. Market inflation 1.08×.',
    position_scarcity: {
      position:   'DH',
      multiplier: 1.12,
      tier:       'HIGH',
      open_slots: 11,
      eligible:   4,
    },
    inflation_factor: 1.08,
    base_value:       63.1,
  }, null, 2);

  var SAMPLE_PLAYERS_RESPONSE = JSON.stringify({
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
        stats: { HR: 44, RBI: 130, SB: 20, AVG: 0.31, ERA: null, SO: null, WHIP: null },
      },
    ],
  }, null, 2);

  /* ── Code examples ────────────────────────────────────────────────────────── */
  var CURL_HEALTH   = 'curl ' + BASE + '/health';

  var CURL_PLAYERS  = (
    'curl "' + BASE + '/v1/players?league=NL" \\\n' +
    '  -H "X-License-Key: ' + KEY + '"'
  );

  var CURL_VALUATE  = (
    'curl -X POST ' + BASE + '/v1/valuate \\\n' +
    '  -H "Content-Type: application/json" \\\n' +
    '  -H "X-License-Key: ' + KEY + '" \\\n' +
    '  -d \'{\n' +
    '    "draft_state": {\n' +
    '      "total_teams": 12,\n' +
    '      "budget_per_team": 260,\n' +
    '      "scoring_categories": ["HR","RBI","AVG","SB","ERA","SO","WHIP"],\n' +
    '      "teams": [\n' +
    '        { "id": 1, "budget_remaining": 248, "roster": ["Freddie Freeman"] },\n' +
    '        { "id": 2, "budget_remaining": 195, "roster": ["Ronald Acuna Jr.","Mookie Betts"] }\n' +
    '      ],\n' +
    '      "nominated_player": "Shohei Ohtani",\n' +
    '      "roster_config": {\n' +
    '        "C":1, "1B":1, "2B":1, "3B":1, "SS":1,\n' +
    '        "OF":3, "SP":2, "RP":2, "UTIL":1, "BN":2\n' +
    '      }\n' +
    '    }\n' +
    '  }\''
  );

  var JS_VALUATE = (
    'const response = await fetch(\'' + BASE + '/v1/valuate\', {\n' +
    '  method:  \'POST\',\n' +
    '  headers: {\n' +
    '    \'Content-Type\':  \'application/json\',\n' +
    '    \'X-License-Key\': \'' + KEY + '\',\n' +
    '  },\n' +
    '  body: JSON.stringify({\n' +
    '    draft_state: {\n' +
    '      total_teams:        12,\n' +
    '      budget_per_team:    260,\n' +
    '      scoring_categories: [\'HR\', \'RBI\', \'AVG\', \'SB\', \'ERA\', \'SO\', \'WHIP\'],\n' +
    '      teams: [\n' +
    '        { id: 1, budget_remaining: 248, roster: [\'Freddie Freeman\'] },\n' +
    '      ],\n' +
    '      nominated_player: \'Shohei Ohtani\',\n' +
    '      roster_config: { C:1, \'1B\':1, \'2B\':1, \'3B\':1, SS:1, OF:3, SP:2, RP:2, UTIL:1, BN:2 },\n' +
    '    },\n' +
    '  }),\n' +
    '});\n\n' +
    'const data = await response.json();\n' +
    'console.log(data.max_bid_recommendation); // e.g. 69'
  );

  /* ── Default Try It payload ───────────────────────────────────────────────── */
  var TRY_IT_DEFAULT = JSON.stringify({
    draft_state: {
      total_teams:        12,
      budget_per_team:    260,
      scoring_categories: ['HR', 'RBI', 'AVG', 'SB', 'ERA', 'SO', 'WHIP'],
      teams: [
        { id: 1, budget_remaining: 248, roster: ['Freddie Freeman'] },
      ],
      nominated_player: 'Shohei Ohtani',
      roster_config:    { C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 3, SP: 2, RP: 2, UTIL: 1, BN: 2 },
    },
  }, null, 2);

  /* ── Sidebar section definitions ─────────────────────────────────────────── */
  var SECTIONS = [
    ['auth',       'Authentication'],
    ['rate-limits','Rate Limits'],
    ['health',     'GET /health'],
    ['players',    'GET /v1/players'],
    ['valuate',    'POST /v1/valuate'],
    ['schema',     'Response Schema'],
    ['errors',     'Error Codes'],
    ['formula',    'Valuation Formula'],
    ['tryit',      'Try It ↗'],
  ];

  /* ── Sidebar nav items HTML ───────────────────────────────────────────────── */
  var sidebarLinks = SECTIONS.map(function (s) {
    return (
      '<li>' +
        '<a href="#doc-' + s[0] + '" class="docs-nav-link" ' +
          'onclick="DB.pages._docScrollTo(\'' + s[0] + '\');return false;">' +
          s[1] +
        '</a>' +
      '</li>'
    );
  }).join('');

  /* ── Key display in sidebar ───────────────────────────────────────────────── */
  var sidebarKeyHtml = isLoggedIn
    ? (
      '<div class="sidebar-key-box">' +
        '<div class="license-key-label" style="margin-bottom:0.5rem;">Your Key</div>' +
        '<code class="sidebar-key-val">' + KEY + '</code>' +
      '</div>'
    )
    : (
      '<div class="sidebar-key-box">' +
        '<p class="sidebar-demo-note">Using demo key.</p>' +
        '<a href="#signup" class="btn btn-sm btn-primary btn-full">Get a license key →</a>' +
      '</div>'
    );

  /* ── Helper: build a code block with copy button ──────────────────────────── */
  function _codeBlock(lang, code, copyText) {
    var ct = copyText || code;
    return (
      '<div class="code-block">' +
        '<div class="code-block-header">' +
          '<span class="code-block-lang">' + lang + '</span>' +
          '<button class="code-copy-btn" ' +
            'onclick="DB.pages._docCopy(this,' + JSON.stringify(ct) + ')"' +
          '>Copy</button>' +
        '</div>' +
        '<pre class="code-pre">' + _esc(code) + '</pre>' +
      '</div>'
    );
  }

  /* ── Render page ──────────────────────────────────────────────────────────── */
  container.innerHTML = (
    '<div class="docs-layout container">' +

      /* Sidebar */
      '<nav class="docs-sidebar" aria-label="API documentation sections">' +
        '<div class="docs-sidebar-title">API Reference</div>' +
        '<ul role="list">' + sidebarLinks + '</ul>' +
        sidebarKeyHtml +
      '</nav>' +

      /* Content */
      '<div class="docs-content">' +

        /* ① Authentication */
        '<section class="docs-section" id="doc-auth">' +
          '<h2>Authentication</h2>' +
          '<p>Every request to the Dark Blue API — except <code>/health</code> — must include ' +
          'an <code>X-License-Key</code> header containing a valid license key.</p>' +
          '<div class="callout callout-info">' +
            '<strong>Demo key:</strong> Use <code>' + DB.DEMO_KEY + '</code> for evaluation. ' +
            'Rate-limited to 20 requests per 15-minute window (shared across all demo users).' +
          '</div>' +
          _codeBlock('Required Header', 'X-License-Key: ' + KEY) +
        '</section>' +

        /* ② Rate Limits */
        '<section class="docs-section" id="doc-rate-limits">' +
          '<h2>Rate Limits</h2>' +
          '<table class="params-table">' +
            '<thead><tr><th>Tier</th><th>Request Limit</th><th>Window</th></tr></thead>' +
            '<tbody>' +
              '<tr><td>Demo (shared key)</td><td>20 requests</td><td>15 minutes</td></tr>' +
              '<tr><td>Pro (dedicated key)</td><td>Unlimited *</td><td>—</td></tr>' +
              '<tr><td>Enterprise</td><td>Unlimited + burst</td><td>—</td></tr>' +
            '</tbody>' +
          '</table>' +
          '<p class="table-note">* Burst protection activates above 1 req/sec sustained. ' +
          'Returns 429 with a <code>Retry-After</code> header.</p>' +
        '</section>' +

        /* ③ GET /health */
        '<section class="docs-section" id="doc-health">' +
          '<h2>GET /health</h2>' +
          '<p>Lightweight ping endpoint. No auth required. Use this to confirm the server ' +
          'is reachable before making auction requests.</p>' +
          '<div class="endpoint-display">' +
            '<span class="endpoint-badge badge-get">GET</span>' +
            '<code>' + BASE + '/health</code>' +
          '</div>' +
          _codeBlock('cURL', CURL_HEALTH) +
          _codeBlock('Response — 200 OK', '{ "status": "ok", "version": "1.0.0" }') +
        '</section>' +

        /* ④ GET /v1/players */
        '<section class="docs-section" id="doc-players">' +
          '<h2>GET /v1/players</h2>' +
          '<p>Returns the full pre-loaded player pool with projected stats, tiers, and base values. ' +
          'Filter by league using the <code>league</code> query parameter.</p>' +
          '<div class="endpoint-display">' +
            '<span class="endpoint-badge badge-get">GET</span>' +
            '<code>' + BASE + '/v1/players</code>' +
          '</div>' +
          '<h3>Query Parameters</h3>' +
          '<table class="params-table">' +
            '<thead><tr><th>Parameter</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>' +
            '<tbody>' +
              '<tr>' +
                '<td><code>league</code></td><td>string</td><td><code>ALL</code></td>' +
                '<td>Filter to <code>AL</code>, <code>NL</code>, or <code>ALL</code> (combined).</td>' +
              '</tr>' +
            '</tbody>' +
          '</table>' +
          '<h3>cURL Example</h3>' +
          _codeBlock('cURL — NL Player Pool', CURL_PLAYERS) +
          '<h3>Response</h3>' +
          _codeBlock('JSON — 200 OK (truncated)', SAMPLE_PLAYERS_RESPONSE) +
        '</section>' +

        /* ⑤ POST /v1/valuate */
        '<section class="docs-section" id="doc-valuate">' +
          '<h2>POST /v1/valuate</h2>' +
          '<p>The core endpoint. Send your full draft state and the player being nominated; ' +
          'receive a precise max bid recommendation backed by live math.</p>' +
          '<div class="endpoint-display">' +
            '<span class="endpoint-badge badge-post">POST</span>' +
            '<code>' + BASE + '/v1/valuate</code>' +
          '</div>' +
          '<div class="callout callout-info">' +
            'This endpoint is <strong>stateless</strong>. You must send the complete, current ' +
            'draft state on every request. No state is stored server-side between calls.' +
          '</div>' +
          '<h3>Request Body — <code>draft_state</code> fields</h3>' +
          '<table class="params-table">' +
            '<thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>' +
            '<tbody>' +
              '<tr><td><code>total_teams</code></td><td>integer</td>' +
                '<td><span class="required-badge">required</span></td>' +
                '<td>Number of teams in the league (e.g. 12).</td></tr>' +
              '<tr><td><code>budget_per_team</code></td><td>integer</td>' +
                '<td><span class="required-badge">required</span></td>' +
                '<td>Starting auction budget per team. Standard is $260.</td></tr>' +
              '<tr><td><code>scoring_categories</code></td><td>string[]</td>' +
                '<td><span class="required-badge">required</span></td>' +
                '<td>Active scoring categories. Supported: HR, RBI, AVG, SB, R, H, OBP, BB, TB, XBH, W, SV, ERA, WHIP, SO, HLD, K/9, BB/9, QS.</td></tr>' +
              '<tr><td><code>teams</code></td><td>object[]</td>' +
                '<td><span class="required-badge">required</span></td>' +
                '<td>Each team object must have <code>id</code>, <code>budget_remaining</code> (integer), ' +
                'and <code>roster</code> (string array of player names already drafted).</td></tr>' +
              '<tr><td><code>nominated_player</code></td><td>string</td>' +
                '<td><span class="required-badge">required</span></td>' +
                '<td>Player name to valuate. Case-insensitive and accent-tolerant matching against the pool.</td></tr>' +
              '<tr><td><code>roster_config</code></td><td>object</td>' +
                '<td>optional</td>' +
                '<td>Slot counts per position key. Defaults to: C:1, 1B:1, 2B:1, 3B:1, SS:1, OF:3, SP:2, RP:2, UTIL:1, BN:2.</td></tr>' +
            '</tbody>' +
          '</table>' +
          '<h3>cURL Example</h3>' +
          _codeBlock('cURL', CURL_VALUATE) +
          '<h3>JavaScript (fetch) Example</h3>' +
          _codeBlock('JavaScript', JS_VALUATE) +
        '</section>' +

        /* ⑥ Response Schema */
        '<section class="docs-section" id="doc-schema">' +
          '<h2>Response Schema</h2>' +
          '<table class="params-table">' +
            '<thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>' +
            '<tbody>' +
              '<tr><td><code>nominated_player</code></td><td>string</td><td>Player name as matched in the pool.</td></tr>' +
              '<tr><td><code>max_bid_recommendation</code></td><td>integer</td><td><strong>The number to bid.</strong> Never go above this.</td></tr>' +
              '<tr><td><code>true_dollar_value</code></td><td>float</td><td>Raw calculated value before the 8% safety margin.</td></tr>' +
              '<tr><td><code>reasoning</code></td><td>string</td><td>Human-readable explanation combining player tier, scarcity, and inflation factors.</td></tr>' +
              '<tr><td><code>position_scarcity.position</code></td><td>string</td><td>Primary position used for scarcity calculation.</td></tr>' +
              '<tr><td><code>position_scarcity.multiplier</code></td><td>float</td><td>Scarcity multiplier applied (1.00 – 1.45).</td></tr>' +
              '<tr><td><code>position_scarcity.tier</code></td><td>string</td><td>CRITICAL / HIGH / MEDIUM / LOW</td></tr>' +
              '<tr><td><code>position_scarcity.open_slots</code></td><td>integer</td><td>Total unfilled slots at this position across all teams.</td></tr>' +
              '<tr><td><code>position_scarcity.eligible</code></td><td>integer</td><td>Remaining undrafted players eligible at this position.</td></tr>' +
              '<tr><td><code>inflation_factor</code></td><td>float</td><td>Market inflation factor (0.85 – 1.45). &gt; 1.0 means the market is running hot.</td></tr>' +
              '<tr><td><code>base_value</code></td><td>float</td><td>SGP base value before scarcity and inflation adjustments.</td></tr>' +
            '</tbody>' +
          '</table>' +
          '<h3>Example Response</h3>' +
          _codeBlock('JSON — 200 OK', SAMPLE_VALUATE_RESPONSE) +
        '</section>' +

        /* ⑦ Error Codes */
        '<section class="docs-section" id="doc-errors">' +
          '<h2>Error Codes</h2>' +
          '<table class="params-table">' +
            '<thead><tr><th>HTTP Status</th><th>Cause</th><th>Fix</th></tr></thead>' +
            '<tbody>' +
              '<tr><td><code>400 Bad Request</code></td><td>Missing or malformed body fields.</td><td>Check required fields in the request body.</td></tr>' +
              '<tr><td><code>401 Unauthorized</code></td><td>Missing or invalid <code>X-License-Key</code> header.</td><td>Include a valid license key header.</td></tr>' +
              '<tr><td><code>404 Not Found</code></td><td><code>nominated_player</code> not matched in pool.</td><td>Verify spelling; try the /v1/players endpoint to confirm the name.</td></tr>' +
              '<tr><td><code>429 Too Many Requests</code></td><td>Rate limit exceeded.</td><td>Wait for the <code>Retry-After</code> header duration, then retry.</td></tr>' +
              '<tr><td><code>500 Server Error</code></td><td>Unexpected internal error.</td><td>Retry with exponential backoff. Contact support if persistent.</td></tr>' +
            '</tbody>' +
          '</table>' +
          '<h3>Error Response Shape</h3>' +
          _codeBlock('JSON — 401', '{ "error": "Invalid or missing license key" }') +
          _codeBlock('JSON — 404', '{ "error": "Player not found: \'Mike Trout\'" }') +
        '</section>' +

        /* ⑧ Valuation Formula */
        '<section class="docs-section" id="doc-formula">' +
          '<h2>Valuation Formula</h2>' +
          '<p>The API does not use static lookup tables or pre-computed rankings. Every request ' +
          'runs a fresh calculation against the current undrafted player pool — so values shift ' +
          'automatically as players are taken.</p>' +
          '<div class="callout callout-info">' +
            'The algorithm uses <strong>Standings Gain Points (SGP)</strong> scoring combined ' +
            'with live position scarcity and market inflation adjustments.' +
          '</div>' +
          _codeBlock('Algorithm',
            '// Step 1 — SGP base value\n' +
            '// Player\'s share of total remaining pool SGP × remaining league budget\n' +
            'sgp_base = (player_sgp / total_pool_sgp) × total_remaining_budget\n\n' +
            '// Step 2 — Position scarcity multiplier\n' +
            '// Ratio of open roster slots to eligible undrafted players at this position\n' +
            'ratio    = open_slots / eligible_remaining\n' +
            'scarcity = clamp(ratio, 1.00, 1.45)\n\n' +
            '// Step 3 — Market inflation\n' +
            '// Compares actual remaining league budget to what\'s expected at this draft depth\n' +
            'inflation = clamp(actual_remaining / expected_remaining, 0.85, 1.45)\n\n' +
            '// Step 4 — Combine and apply 8% safety margin\n' +
            'true_value = sgp_base × scarcity × inflation\n' +
            'max_bid    = floor(true_value × 0.92)   // 8% under TDV = smart bid buffer'
          ) +
          '<h3>Scarcity Tier Thresholds</h3>' +
          '<table class="params-table">' +
            '<thead><tr><th>Tier</th><th>Slot/Eligible Ratio</th><th>Multiplier</th></tr></thead>' +
            '<tbody>' +
              '<tr><td><span class="badge" style="background:#fee2e2;color:#991b1b;">CRITICAL</span></td><td>≥ 1.5</td><td>1.35×</td></tr>' +
              '<tr><td><span class="badge" style="background:#fef3c7;color:#92400e;">HIGH</span></td><td>1.1 – 1.49</td><td>1.20×</td></tr>' +
              '<tr><td><span class="badge" style="background:#dbeafe;color:#1e40af;">MEDIUM</span></td><td>0.8 – 1.09</td><td>1.08×</td></tr>' +
              '<tr><td><span class="badge" style="background:#f0fdf4;color:#166534;">LOW</span></td><td>&lt; 0.8</td><td>1.00×</td></tr>' +
            '</tbody>' +
          '</table>' +
        '</section>' +

        /* ⑨ Try It */
        '<section class="docs-section" id="doc-tryit">' +
          '<h2>Try It</h2>' +
          '<p>Send a live request to the API from this page. ' +
          (isLoggedIn
            ? 'Your license key is pre-injected into every request.'
            : 'Using the demo key. <a href="#signup">Get a dedicated key →</a>'
          ) + '</p>' +
          '<div class="callout callout-warning">' +
            'The API must be running at <code>' + BASE + '</code> for this panel to work. ' +
            'In development, start the Express server with <code>cd mvpfinal/api && node server.js</code>.' +
          '</div>' +

          /* Request body textarea */
          '<label class="form-label" style="display:block;margin-bottom:0.5rem;">Request Body (JSON)</label>' +
          '<textarea id="tryit-body" class="form-input tryit-textarea">' + _esc(TRY_IT_DEFAULT) + '</textarea>' +

          /* Action buttons */
          '<div class="tryit-actions">' +
            '<button class="btn btn-primary" id="tryit-send-btn" onclick="DB.pages._tryItSend()">Send Request →</button>' +
            '<button class="btn btn-ghost" onclick="DB.pages._tryItReset()">Reset</button>' +
          '</div>' +

          /* Response area */
          '<div id="tryit-status" class="tryit-status"></div>' +
          '<div id="tryit-response"></div>' +
        '</section>' +

      '</div>' + /* /docs-content */
    '</div>'    /* /docs-layout */
  );

  /* ══════════════════════════════════════════════════════════════════════════
     Handlers — attached to DB.pages for inline onclick access
     ══════════════════════════════════════════════════════════════════════════ */

  /** Smooth-scroll to a documentation section by its id suffix. */
  DB.pages._docScrollTo = function (sectionId) {
    var el = document.getElementById('doc-' + sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /**
   * Copy a string to the clipboard, then flash the button text.
   * @param {HTMLElement} btn  - The copy button element
   * @param {string}      text - The text to copy
   */
  DB.pages._docCopy = function (btn, text) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(function () {
      var orig = btn.textContent;
      btn.textContent = '✓ Copied';
      btn.classList.add('copied');
      setTimeout(function () {
        btn.textContent = orig;
        btn.classList.remove('copied');
      }, 2000);
    }).catch(function () {});
  };

  /** Reset the Try It panel to defaults. */
  DB.pages._tryItReset = function () {
    var bodyEl = document.getElementById('tryit-body');
    if (bodyEl) bodyEl.value = TRY_IT_DEFAULT;
    var statusEl = document.getElementById('tryit-status');
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'tryit-status'; }
    var respEl = document.getElementById('tryit-response');
    if (respEl) respEl.innerHTML = '';
  };

  /** Send a live POST request to /v1/valuate and display the response. */
  DB.pages._tryItSend = async function () {
    var bodyEl    = document.getElementById('tryit-body');
    var statusEl  = document.getElementById('tryit-status');
    var responseEl= document.getElementById('tryit-response');
    var btn       = document.getElementById('tryit-send-btn');

    // Validate JSON before sending
    var payload;
    try {
      payload = JSON.parse(bodyEl.value);
    } catch (e) {
      statusEl.className   = 'tryit-status tryit-error';
      statusEl.textContent = '✕ Invalid JSON — ' + e.message;
      return;
    }

    // Always inject the active license key so the user doesn't have to
    payload.license_key = KEY;

    // Update UI to loading state
    btn.textContent = 'Sending…';
    btn.disabled    = true;
    statusEl.className   = 'tryit-status';
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

      statusEl.className   = 'tryit-status ' + (res.ok ? 'tryit-ok' : 'tryit-error');
      statusEl.textContent = (res.ok ? '✓ ' : '✕ ') + res.status + ' ' + res.statusText + ' · ' + latency + 'ms';

      responseEl.innerHTML = (
        '<div class="code-block" style="margin-top:0.75rem;">' +
          '<div class="code-block-header">' +
            '<span class="code-block-lang">Response · ' + latency + 'ms</span>' +
            '<button class="code-copy-btn" ' +
              'onclick="DB.pages._docCopy(this,' + JSON.stringify(JSON.stringify(json, null, 2)) + ')"' +
            '>Copy</button>' +
          '</div>' +
          '<pre class="code-pre" style="max-height:360px;overflow:auto;">' + _esc(JSON.stringify(json, null, 2)) + '</pre>' +
        '</div>'
      );

    } catch (err) {
      var latency2 = Math.round(performance.now() - t0);
      statusEl.className   = 'tryit-status tryit-error';
      statusEl.textContent = '✕ Network error (' + latency2 + 'ms) — is the API server running at ' + BASE + '?';
    }

    btn.textContent = 'Send Request →';
    btn.disabled    = false;
  };

  /* ── Internal helper: HTML-escape dynamic content ───────────────────────── */
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

};
