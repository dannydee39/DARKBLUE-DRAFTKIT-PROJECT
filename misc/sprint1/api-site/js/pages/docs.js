/**
 * docs.js
 * ─────────────────────────────────────────────────────────────────────────────
 * API Documentation page renderer.
 *
 * Layout: Two-column sticky layout.
 *   Left  — sidebar nav (scrolls user to sections)
 *   Right — content with all 5 endpoints fully documented
 *
 * Sections:
 *   1. Authentication
 *   2. Rate Limits
 *   3. GET /health
 *   4. GET /v1/players
 *   5. POST /v1/valuate
 *   6. POST /v1/valuate/batch
 *   7. GET /v1/valuate/all
 *   8. Response Schema
 *   9. Error Codes
 *  10. Valuation Formula
 *  11. Try It (live sandbox)
 * ─────────────────────────────────────────────────────────────────────────────
 */

window.DB = window.DB || {};
DB.pages  = DB.pages || {};

DB.pages.docs = function (container) {

  var KEY        = DB.state.licenseKey || DB.DEMO_KEY;
  var BASE       = DB.API_BASE;
  var DISPLAY    = DB.API_DISPLAY;
  var isLoggedIn = !!DB.state.user;

  /* ══════════════════════════════════════════════════════════════════════════
     SIDEBAR SECTION DEFINITIONS
     ══════════════════════════════════════════════════════════════════════════ */

  var SECTIONS = [
    ['auth',        'Authentication'],
    ['rate-limits', 'Rate Limits'],
    ['health',      'GET /health'],
    ['players',     'GET /v1/players'],
    ['valuate',     'POST /v1/valuate'],
    ['batch',       'POST /v1/valuate/batch'],
    ['all',         'GET /v1/valuate/all'],
    ['schema',      'Response Schema'],
    ['errors',      'Error Codes'],
    ['formula',     'Valuation Formula'],
    ['tryit',       'Try It ↗'],
  ];

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

  var sidebarKeyHtml = isLoggedIn
    ? (
      '<div class="sidebar-key-box">' +
        '<div class="license-key-label" style="margin-bottom:0.5rem;">Your Key</div>' +
        '<code class="sidebar-key-val">' + KEY + '</code>' +
      '</div>'
    )
    : (
      '<div class="sidebar-key-box">' +
        '<p class="sidebar-demo-note">Using the shared demo key. Rate limited to 20 req / 15 min.</p>' +
        '<a href="#signup" class="btn btn-sm btn-primary btn-full">Get a dedicated key &rarr;</a>' +
      '</div>'
    );

  /* ══════════════════════════════════════════════════════════════════════════
     HELPERS
     ══════════════════════════════════════════════════════════════════════════ */

  /** HTML-escape a raw string for safe embedding in pre/code tags. */
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Build a single-lang code block with a copy button.
   * @param {string} lang      - Label shown in the header (e.g. "cURL")
   * @param {string} code      - Raw code string (will be HTML-escaped)
   * @param {string} [copyText] - Override text for clipboard (default = code)
   */
  function _codeBlock(lang, code, copyText) {
    var ct = copyText || code;
    return (
      '<div class="code-block" style="margin-bottom:var(--space-4);">' +
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

  /**
   * Build a tabbed multi-language code block.
   * @param {string}   blockId  - Unique id suffix for this block
   * @param {Array}    tabs     - [{label, code, copyText}]
   */
  function _tabbedCode(blockId, tabs) {
    var tabBtns = tabs.map(function (t, i) {
      return (
        '<button class="code-tab-btn' + (i === 0 ? ' active' : '') + '" ' +
          'onclick="DB.pages._switchTab(\'' + blockId + '\',' + i + ',this)">' +
          t.label +
        '</button>'
      );
    }).join('');

    var panels = tabs.map(function (t, i) {
      var ct = t.copyText || t.code;
      return (
        '<div class="code-tab-panel" id="' + blockId + '-panel-' + i + '"' +
          (i !== 0 ? ' style="display:none;"' : '') + '>' +
          '<div class="code-block-header" style="padding-left:0;border-top:none;">' +
            '<span></span>' +
            '<button class="code-copy-btn" ' +
              'onclick="DB.pages._docCopy(this,' + JSON.stringify(ct) + ')"' +
            '>Copy</button>' +
          '</div>' +
          '<pre class="code-pre">' + _esc(t.code) + '</pre>' +
        '</div>'
      );
    }).join('');

    return (
      '<div class="code-block" style="margin-bottom:var(--space-4);">' +
        '<div class="code-block-header">' +
          '<div class="code-tabs">' + tabBtns + '</div>' +
        '</div>' +
        panels +
      '</div>'
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     EXAMPLE CODE STRINGS
     Each endpoint gets curl / JavaScript / Python examples
     ══════════════════════════════════════════════════════════════════════════ */

  /* ── GET /health ─────────────────────────────────────────────────────────── */
  var HEALTH_CURL = 'curl ' + DISPLAY + '/health';

  var HEALTH_JS = (
    'const res  = await fetch(\'' + DISPLAY + '/health\');\n' +
    'const data = await res.json();\n' +
    'console.log(data.status); // "online"'
  );

  var HEALTH_PY = (
    'import requests\n\n' +
    'r = requests.get("' + DISPLAY + '/health")\n' +
    'print(r.json()["status"])  # "online"'
  );

  var HEALTH_RESPONSE = JSON.stringify({
    status:      'online',
    service:     'Dark Blue Valuation API',
    version:     '1.0.0',
    timestamp:   '2026-03-26T17:17:38.627Z',
    environment: 'production',
  }, null, 2);

  /* ── GET /v1/players ─────────────────────────────────────────────────────── */
  var PLAYERS_CURL = (
    'curl "' + DISPLAY + '/v1/players?league=NL&tier=Elite" \\\n' +
    '  -H "X-License-Key: ' + KEY + '"'
  );

  var PLAYERS_JS = (
    'const res = await fetch(\n' +
    '  \'' + DISPLAY + '/v1/players?league=NL&tier=Elite\',\n' +
    '  { headers: { \'X-License-Key\': \'' + KEY + '\' } }\n' +
    ');\n' +
    'const { count, players } = await res.json();\n' +
    'console.log(count, players[0].name);'
  );

  var PLAYERS_PY = (
    'import requests\n\n' +
    'headers = {"X-License-Key": "' + KEY + '"}\n' +
    'params  = {"league": "NL", "tier": "Elite"}\n\n' +
    'r = requests.get("' + DISPLAY + '/v1/players", headers=headers, params=params)\n' +
    'data = r.json()\n' +
    'print(data["count"], data["players"][0]["name"])'
  );

  var PLAYERS_RESPONSE = JSON.stringify({
    count:   20,
    players: [
      {
        id: 1, name: 'Shohei Ohtani', team: 'LAD', league: 'NL',
        pos: ['DH','SP'], tier: 'Elite', baseValue: 75,
        hr: 42, rbi: 98, r: 123, sb: 27, avg: '0.297',
        obp: '0.398', slg: '0.613', era: null, so: null,
        whip: null, w: null, sv: null,
        injury: null, note: null, depth: 'Elite', fpts: 842,
      },
      {
        id: 2, name: 'Juan Soto', team: 'NYM', league: 'NL',
        pos: ['OF'], tier: 'Elite', baseValue: 66,
        hr: 38, rbi: 88, r: 110, sb: 12, avg: '0.285',
        obp: '0.410', slg: '0.545', era: null, so: null,
        whip: null, w: null, sv: null,
        injury: null, note: null, depth: 'Elite', fpts: 756,
      },
    ],
  }, null, 2);

  /* ── POST /v1/valuate ────────────────────────────────────────────────────── */
  var VALUATE_BODY = JSON.stringify({
    draft_state: {
      total_teams:        12,
      budget_per_team:    260,
      scoring_categories: ['HR','RBI','AVG','SB','ERA','SO','WHIP'],
      nominated_player:   'Shohei Ohtani',
      teams: [
        { id: 1, budget_remaining: 248, roster: ['Freddie Freeman'] },
        { id: 2, budget_remaining: 195, roster: ['Ronald Acuna Jr.','Mookie Betts'] },
      ],
      roster_config: { C:1,'1B':1,'2B':1,'3B':1,SS:1,OF:3,SP:2,RP:2,UTIL:1,BN:2 },
    },
  }, null, 2);

  var VALUATE_CURL = (
    'curl -X POST ' + DISPLAY + '/v1/valuate \\\n' +
    '  -H "X-License-Key: ' + KEY + '" \\\n' +
    '  -H "Content-Type: application/json" \\\n' +
    '  -d \'' + VALUATE_BODY + '\''
  );

  var VALUATE_JS = (
    'const res = await fetch(\'' + DISPLAY + '/v1/valuate\', {\n' +
    '  method:  \'POST\',\n' +
    '  headers: {\n' +
    '    \'Content-Type\':  \'application/json\',\n' +
    '    \'X-License-Key\': \'' + KEY + '\',\n' +
    '  },\n' +
    '  body: JSON.stringify({\n' +
    '    draft_state: {\n' +
    '      total_teams:        12,\n' +
    '      budget_per_team:    260,\n' +
    '      scoring_categories: [\'HR\',\'RBI\',\'AVG\',\'SB\',\'ERA\',\'SO\',\'WHIP\'],\n' +
    '      nominated_player:   \'Shohei Ohtani\',\n' +
    '      teams: [\n' +
    '        { id: 1, budget_remaining: 248, roster: [\'Freddie Freeman\'] },\n' +
    '      ],\n' +
    '      roster_config: { C:1,\'1B\':1,\'2B\':1,\'3B\':1,SS:1,OF:3,SP:2,RP:2,UTIL:1,BN:2 },\n' +
    '    },\n' +
    '  }),\n' +
    '});\n\n' +
    'const data = await res.json();\n' +
    'console.log(data.max_bid_recommendation); // 69'
  );

  var VALUATE_PY = (
    'import requests\n\n' +
    'headers = {\n' +
    '    "X-License-Key": "' + KEY + '",\n' +
    '    "Content-Type": "application/json",\n' +
    '}\n\n' +
    'payload = {\n' +
    '    "draft_state": {\n' +
    '        "total_teams": 12,\n' +
    '        "budget_per_team": 260,\n' +
    '        "scoring_categories": ["HR","RBI","AVG","SB","ERA","SO","WHIP"],\n' +
    '        "nominated_player": "Shohei Ohtani",\n' +
    '        "teams": [\n' +
    '            {"id": 1, "budget_remaining": 248, "roster": ["Freddie Freeman"]},\n' +
    '        ],\n' +
    '        "roster_config": {"C":1,"1B":1,"2B":1,"3B":1,"SS":1,"OF":3,"SP":2,"RP":2,"UTIL":1,"BN":2},\n' +
    '    },\n' +
    '}\n\n' +
    'r = requests.post("' + DISPLAY + '/v1/valuate", json=payload, headers=headers)\n' +
    'data = r.json()\n' +
    'print(data["max_bid_recommendation"])  # 69'
  );

  var VALUATE_RESPONSE = JSON.stringify({
    player:                 'Shohei Ohtani',
    true_dollar_value:      75,
    max_bid_recommendation: 69,
    market_inflation:       1,
    scarcity_tier:          'LOW',
    position_scarcity:      { DH: 'LOW', SP: 'LOW' },
    draftability_score:     1,
    reasoning:              'Tier: LOW. TDV: $75.',
    stats: {
      tier:      'Elite',
      positions: ['DH','SP'],
      team:      'LAD',
      league:    'NL',
    },
  }, null, 2);

  /* ── POST /v1/valuate/batch ──────────────────────────────────────────────── */
  var BATCH_BODY = JSON.stringify({
    players: ['Shohei Ohtani', 'Juan Soto', 'Kyle Tucker'],
    draft_state: {
      total_teams:        12,
      budget_per_team:    260,
      scoring_categories: ['HR','RBI','AVG','SB','ERA','SO','WHIP'],
      teams: [
        { id: 1, budget_remaining: 248, roster: ['Freddie Freeman'] },
      ],
      roster_config: { C:1,'1B':1,'2B':1,'3B':1,SS:1,OF:3,SP:2,RP:2,UTIL:1,BN:2 },
    },
  }, null, 2);

  var BATCH_CURL = (
    'curl -X POST ' + DISPLAY + '/v1/valuate/batch \\\n' +
    '  -H "X-License-Key: ' + KEY + '" \\\n' +
    '  -H "Content-Type: application/json" \\\n' +
    '  -d \'' + BATCH_BODY + '\''
  );

  var BATCH_JS = (
    'const res = await fetch(\'' + DISPLAY + '/v1/valuate/batch\', {\n' +
    '  method:  \'POST\',\n' +
    '  headers: {\n' +
    '    \'Content-Type\':  \'application/json\',\n' +
    '    \'X-License-Key\': \'' + KEY + '\',\n' +
    '  },\n' +
    '  body: JSON.stringify({\n' +
    '    players: [\'Shohei Ohtani\', \'Juan Soto\', \'Kyle Tucker\'],\n' +
    '    draft_state: {\n' +
    '      total_teams: 12, budget_per_team: 260,\n' +
    '      scoring_categories: [\'HR\',\'RBI\',\'AVG\',\'SB\',\'ERA\',\'SO\',\'WHIP\'],\n' +
    '      teams: [{ id: 1, budget_remaining: 248, roster: [] }],\n' +
    '      roster_config: { C:1,\'1B\':1,\'2B\':1,\'3B\':1,SS:1,OF:3,SP:2,RP:2,UTIL:1,BN:2 },\n' +
    '    },\n' +
    '  }),\n' +
    '});\n' +
    'const { count, valuations } = await res.json();\n' +
    'valuations.forEach(v => console.log(v.player, v.max_bid_recommendation));'
  );

  var BATCH_PY = (
    'import requests\n\n' +
    'headers = {"X-License-Key": "' + KEY + '", "Content-Type": "application/json"}\n\n' +
    'payload = {\n' +
    '    "players": ["Shohei Ohtani", "Juan Soto", "Kyle Tucker"],\n' +
    '    "draft_state": {\n' +
    '        "total_teams": 12, "budget_per_team": 260,\n' +
    '        "scoring_categories": ["HR","RBI","AVG","SB","ERA","SO","WHIP"],\n' +
    '        "teams": [{"id": 1, "budget_remaining": 248, "roster": []}],\n' +
    '        "roster_config": {"C":1,"1B":1,"2B":1,"3B":1,"SS":1,"OF":3,"SP":2,"RP":2,"UTIL":1,"BN":2},\n' +
    '    },\n' +
    '}\n\n' +
    'r = requests.post("' + DISPLAY + '/v1/valuate/batch", json=payload, headers=headers)\n' +
    'for v in r.json()["valuations"]:\n' +
    '    print(v["player"], v["max_bid_recommendation"])'
  );

  var BATCH_RESPONSE = JSON.stringify({
    count:      3,
    valuations: [
      { player: 'Shohei Ohtani', true_dollar_value: 75, max_bid_recommendation: 69, scarcity_tier: 'LOW',    draftability_score: 1 },
      { player: 'Juan Soto',     true_dollar_value: 66, max_bid_recommendation: 61, scarcity_tier: 'LOW',    draftability_score: 1 },
      { player: 'Kyle Tucker',   true_dollar_value: 57, max_bid_recommendation: 52, scarcity_tier: 'MEDIUM', draftability_score: 1 },
    ],
    errors: [],
  }, null, 2);

  /* ── GET /v1/valuate/all ─────────────────────────────────────────────────── */
  var ALL_CURL = (
    'curl "' + DISPLAY + '/v1/valuate/all' +
    '?total_teams=12&budget_per_team=260' +
    '&scoring_categories=HR,RBI,AVG,SB,ERA,SO,WHIP' +
    '&drafted=Freddie%20Freeman,Ronald%20Acuna%20Jr." \\\n' +
    '  -H "X-License-Key: ' + KEY + '"'
  );

  var ALL_JS = (
    'const params = new URLSearchParams({\n' +
    '  total_teams:         12,\n' +
    '  budget_per_team:     260,\n' +
    '  scoring_categories:  \'HR,RBI,AVG,SB,ERA,SO,WHIP\',\n' +
    '  drafted:             \'Freddie Freeman,Ronald Acuna Jr.\',\n' +
    '});\n\n' +
    'const res = await fetch(\n' +
    '  \'' + DISPLAY + '/v1/valuate/all?\' + params,\n' +
    '  { headers: { \'X-License-Key\': \'' + KEY + '\' } }\n' +
    ');\n' +
    'const { count, players } = await res.json();\n' +
    'console.log(`${count} players priced. Top pick: ${players[0].player} ($${players[0].true_dollar_value})`);'
  );

  var ALL_PY = (
    'import requests\n\n' +
    'headers = {"X-License-Key": "' + KEY + '"}\n' +
    'params  = {\n' +
    '    "total_teams":        12,\n' +
    '    "budget_per_team":    260,\n' +
    '    "scoring_categories": "HR,RBI,AVG,SB,ERA,SO,WHIP",\n' +
    '    "drafted":            "Freddie Freeman,Ronald Acuna Jr.",\n' +
    '}\n\n' +
    'r    = requests.get("' + DISPLAY + '/v1/valuate/all", headers=headers, params=params)\n' +
    'data = r.json()\n' +
    'top  = data["players"][0]\n' +
    'print(f\'{top["player"]} — TDV: ${top["true_dollar_value"]}\')'
  );

  var ALL_RESPONSE = JSON.stringify({
    count: 311,
    draft_state_summary: {
      total_teams:    12,
      budget_per_team: 260,
      drafted_count:   2,
    },
    players: [
      { player: 'Shohei Ohtani', true_dollar_value: 75, max_bid_recommendation: 69, scarcity_tier: 'LOW' },
      { player: 'Juan Soto',     true_dollar_value: 66, max_bid_recommendation: 61, scarcity_tier: 'LOW' },
      { player: 'Kyle Tucker',   true_dollar_value: 57, max_bid_recommendation: 52, scarcity_tier: 'MEDIUM' },
      // ...308 more, sorted by true_dollar_value desc
    ],
  }, null, 2);

  /* ── Default Try It payload ──────────────────────────────────────────────── */
  var TRY_IT_ENDPOINTS = [
    { label: 'GET /health',          method: 'GET',  path: '/health',         body: null },
    { label: 'GET /v1/players',      method: 'GET',  path: '/v1/players?league=NL&tier=Elite', body: null },
    { label: 'POST /v1/valuate',     method: 'POST', path: '/v1/valuate',     body: JSON.stringify({
        draft_state: {
          total_teams: 12, budget_per_team: 260,
          scoring_categories: ['HR','RBI','AVG','SB','ERA','SO','WHIP'],
          nominated_player: 'Shohei Ohtani',
          teams: [{ id: 1, budget_remaining: 248, roster: ['Freddie Freeman'] }],
          roster_config: { C:1,'1B':1,'2B':1,'3B':1,SS:1,OF:3,SP:2,RP:2,UTIL:1,BN:2 },
        },
      }, null, 2) },
    { label: 'POST /v1/valuate/batch', method: 'POST', path: '/v1/valuate/batch', body: JSON.stringify({
        players: ['Shohei Ohtani','Juan Soto','Kyle Tucker'],
        draft_state: {
          total_teams: 12, budget_per_team: 260,
          scoring_categories: ['HR','RBI','AVG','SB','ERA','SO','WHIP'],
          teams: [{ id: 1, budget_remaining: 248, roster: [] }],
          roster_config: { C:1,'1B':1,'2B':1,'3B':1,SS:1,OF:3,SP:2,RP:2,UTIL:1,BN:2 },
        },
      }, null, 2) },
    { label: 'GET /v1/valuate/all',  method: 'GET',  path: '/v1/valuate/all?total_teams=12&budget_per_team=260&scoring_categories=HR,RBI,AVG,SB,ERA,SO,WHIP', body: null },
  ];

  /* Store endpoints for use in event handlers */
  DB.pages._tryItEndpoints = TRY_IT_ENDPOINTS;

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER PAGE HTML
     ══════════════════════════════════════════════════════════════════════════ */

  container.innerHTML = (
    '<div class="docs-layout container">' +

      /* Sidebar */
      '<nav class="docs-sidebar" aria-label="API documentation sections">' +
        '<div class="docs-sidebar-title">API Reference</div>' +
        '<ul class="docs-nav" role="list">' + sidebarLinks + '</ul>' +
        sidebarKeyHtml +
      '</nav>' +

      /* Content */
      '<div class="docs-content">' +

        /* ① Authentication */
        '<section class="docs-section" id="doc-auth">' +
          '<h2>Authentication</h2>' +
          '<p>Every request to the Dark Blue API — except <code>/health</code> — must include ' +
          'an <code>X-License-Key</code> header with a valid license key. Keys are issued ' +
          'per-account and tied to your plan tier.</p>' +
          '<div class="callout callout-info">' +
            '<strong>Demo key:</strong> Use <code>' + DB.DEMO_KEY + '</code> for evaluation. ' +
            'Rate-limited to 20 requests per 15-minute window, shared across all demo users.' +
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
              '<tr><td>Starter</td><td>500 requests</td><td>15 minutes</td></tr>' +
              '<tr><td>Pro (dedicated key)</td><td>Unlimited *</td><td>—</td></tr>' +
              '<tr><td>Enterprise</td><td>Unlimited + burst priority</td><td>—</td></tr>' +
            '</tbody>' +
          '</table>' +
          '<p class="table-note">* Burst protection activates above 1 req/sec sustained. ' +
          'Returns <code>429</code> with a <code>Retry-After</code> header.</p>' +
        '</section>' +

        /* ③ GET /health */
        '<section class="docs-section" id="doc-health">' +
          '<h2>GET /health</h2>' +
          '<p>Lightweight ping endpoint. No authentication required. ' +
          'Confirm the server is reachable before making auction requests.</p>' +
          '<div class="endpoint-display">' +
            '<span class="endpoint-badge badge-get">GET</span>' +
            '<code>' + DISPLAY + '/health</code>' +
          '</div>' +
          _tabbedCode('health', [
            { label: 'cURL',       code: HEALTH_CURL },
            { label: 'JavaScript', code: HEALTH_JS   },
            { label: 'Python',     code: HEALTH_PY   },
          ]) +
          '<h3>Response</h3>' +
          _codeBlock('JSON — 200 OK', HEALTH_RESPONSE) +
        '</section>' +

        /* ④ GET /v1/players */
        '<section class="docs-section" id="doc-players">' +
          '<h2>GET /v1/players</h2>' +
          '<p>Returns the pre-loaded player pool with projected stats, tier assignments, ' +
          'and base auction values. Supports filtering by league, position, tier, and ' +
          'excluding already-drafted players.</p>' +
          '<div class="endpoint-display">' +
            '<span class="endpoint-badge badge-get">GET</span>' +
            '<code>' + DISPLAY + '/v1/players</code>' +
          '</div>' +
          '<h3>Query Parameters</h3>' +
          '<table class="params-table">' +
            '<thead><tr><th>Parameter</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>' +
            '<tbody>' +
              '<tr>' +
                '<td><code>league</code></td><td>string</td><td><code>ALL</code></td>' +
                '<td>Filter by league: <code>AL</code>, <code>NL</code>, or <code>ALL</code>.</td>' +
              '</tr>' +
              '<tr>' +
                '<td><code>pos</code></td><td>string</td><td>—</td>' +
                '<td>Position filter: <code>C</code>, <code>1B</code>, <code>2B</code>, <code>3B</code>, <code>SS</code>, <code>OF</code>, <code>SP</code>, <code>RP</code>, <code>UTIL</code>, <code>DH</code>.</td>' +
              '</tr>' +
              '<tr>' +
                '<td><code>tier</code></td><td>string</td><td>—</td>' +
                '<td>Tier filter: <code>Elite</code>, <code>Starter</code>, or <code>Bench</code>.</td>' +
              '</tr>' +
              '<tr>' +
                '<td><code>drafted</code></td><td>string</td><td>—</td>' +
                '<td>Comma-separated player names to exclude from results (already drafted).</td>' +
              '</tr>' +
            '</tbody>' +
          '</table>' +
          _tabbedCode('players', [
            { label: 'cURL',       code: PLAYERS_CURL },
            { label: 'JavaScript', code: PLAYERS_JS   },
            { label: 'Python',     code: PLAYERS_PY   },
          ]) +
          '<h3>Response</h3>' +
          _codeBlock('JSON — 200 OK (truncated to 2 players)', PLAYERS_RESPONSE) +
        '</section>' +

        /* ⑤ POST /v1/valuate */
        '<section class="docs-section" id="doc-valuate">' +
          '<h2>POST /v1/valuate</h2>' +
          '<p>The core endpoint. Send your complete draft state and the nominated player — ' +
          'receive a precise, statistically-grounded max bid recommendation backed by live math.</p>' +
          '<div class="endpoint-display">' +
            '<span class="endpoint-badge badge-post">POST</span>' +
            '<code>' + DISPLAY + '/v1/valuate</code>' +
          '</div>' +
          '<div class="callout callout-info">' +
            'This endpoint is <strong>stateless</strong>. You must send the full, current ' +
            'draft state on every request. No session state is stored server-side between calls.' +
          '</div>' +
          '<h3>Request Headers</h3>' +
          '<table class="params-table">' +
            '<thead><tr><th>Header</th><th>Required</th><th>Value</th></tr></thead>' +
            '<tbody>' +
              '<tr><td><code>X-License-Key</code></td><td><span class="required-badge">required</span></td><td>Your license key</td></tr>' +
              '<tr><td><code>Content-Type</code></td><td><span class="required-badge">required</span></td><td><code>application/json</code></td></tr>' +
            '</tbody>' +
          '</table>' +
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
                '<td>Active scoring categories. Supported: <code>HR</code>, <code>RBI</code>, <code>AVG</code>, <code>SB</code>, <code>R</code>, <code>H</code>, <code>OBP</code>, <code>BB</code>, <code>TB</code>, <code>XBH</code>, <code>W</code>, <code>SV</code>, <code>ERA</code>, <code>WHIP</code>, <code>SO</code>, <code>HLD</code>, <code>K/9</code>, <code>BB/9</code>, <code>QS</code>.</td></tr>' +
              '<tr><td><code>nominated_player</code></td><td>string</td>' +
                '<td><span class="required-badge">required</span></td>' +
                '<td>Name of the player currently up for auction. Case-insensitive and accent-tolerant matching.</td></tr>' +
              '<tr><td><code>teams</code></td><td>object[]</td>' +
                '<td><span class="required-badge">required</span></td>' +
                '<td>Each team object requires: <code>id</code> (integer), <code>budget_remaining</code> (integer), <code>roster</code> (string[] of drafted player names).</td></tr>' +
              '<tr><td><code>roster_config</code></td><td>object</td>' +
                '<td>optional</td>' +
                '<td>Slot counts per position. Keys: <code>C</code>, <code>1B</code>, <code>2B</code>, <code>3B</code>, <code>SS</code>, <code>OF</code>, <code>SP</code>, <code>RP</code>, <code>UTIL</code>, <code>BN</code>. Defaults: C:1, 1B:1, 2B:1, 3B:1, SS:1, OF:3, SP:2, RP:2, UTIL:1, BN:2.</td></tr>' +
            '</tbody>' +
          '</table>' +
          _tabbedCode('valuate', [
            { label: 'cURL',       code: VALUATE_CURL },
            { label: 'JavaScript', code: VALUATE_JS   },
            { label: 'Python',     code: VALUATE_PY   },
          ]) +
          '<h3>Response</h3>' +
          _codeBlock('JSON — 200 OK', VALUATE_RESPONSE) +
        '</section>' +

        /* ⑥ POST /v1/valuate/batch */
        '<section class="docs-section" id="doc-batch">' +
          '<h2>POST /v1/valuate/batch</h2>' +
          '<p>Price a custom list of players in a single request. Pass up to 300 player names ' +
          'alongside the current draft state — get back valuations sorted by true dollar value ' +
          'descending, plus an <code>errors</code> array for any unmatched names.</p>' +
          '<div class="endpoint-display">' +
            '<span class="endpoint-badge badge-post">POST</span>' +
            '<code>' + DISPLAY + '/v1/valuate/batch</code>' +
          '</div>' +
          '<h3>Request Body Fields</h3>' +
          '<table class="params-table">' +
            '<thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>' +
            '<tbody>' +
              '<tr><td><code>players</code></td><td>string[]</td>' +
                '<td><span class="required-badge">required</span></td>' +
                '<td>Array of player names to valuate. Maximum 300 names.</td></tr>' +
              '<tr><td><code>draft_state</code></td><td>object</td>' +
                '<td><span class="required-badge">required</span></td>' +
                '<td>Same structure as <code>POST /v1/valuate</code> except <code>nominated_player</code> is not needed — it is derived from the <code>players</code> array.</td></tr>' +
            '</tbody>' +
          '</table>' +
          _tabbedCode('batch', [
            { label: 'cURL',       code: BATCH_CURL },
            { label: 'JavaScript', code: BATCH_JS   },
            { label: 'Python',     code: BATCH_PY   },
          ]) +
          '<h3>Response</h3>' +
          _codeBlock('JSON — 200 OK', BATCH_RESPONSE) +
        '</section>' +

        /* ⑦ GET /v1/valuate/all */
        '<section class="docs-section" id="doc-all">' +
          '<h2>GET /v1/valuate/all</h2>' +
          '<p>Price <strong>every eligible undrafted player</strong> in the pool against the ' +
          'current draft state in a single call. Ideal for building draft boards or refreshing ' +
          'a full player rankings view after each pick.</p>' +
          '<div class="endpoint-display">' +
            '<span class="endpoint-badge badge-get">GET</span>' +
            '<code>' + DISPLAY + '/v1/valuate/all</code>' +
          '</div>' +
          '<h3>Query Parameters</h3>' +
          '<table class="params-table">' +
            '<thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>' +
            '<tbody>' +
              '<tr><td><code>total_teams</code></td><td>integer</td>' +
                '<td><span class="required-badge">required</span></td>' +
                '<td>Number of teams in the league.</td></tr>' +
              '<tr><td><code>budget_per_team</code></td><td>integer</td>' +
                '<td><span class="required-badge">required</span></td>' +
                '<td>Starting budget per team (e.g. 260).</td></tr>' +
              '<tr><td><code>scoring_categories</code></td><td>string</td>' +
                '<td><span class="required-badge">required</span></td>' +
                '<td>Comma-separated scoring categories, e.g. <code>HR,RBI,AVG,SB,ERA,SO,WHIP</code>.</td></tr>' +
              '<tr><td><code>drafted</code></td><td>string</td><td>optional</td>' +
                '<td>Comma-separated player names already drafted. These are excluded from results and from the pool used in scarcity calculations.</td></tr>' +
              '<tr><td><code>pos</code></td><td>string</td><td>optional</td>' +
                '<td>Filter results to a single position (same values as <code>/v1/players</code>).</td></tr>' +
              '<tr><td><code>tier</code></td><td>string</td><td>optional</td>' +
                '<td>Filter to <code>Elite</code>, <code>Starter</code>, or <code>Bench</code>.</td></tr>' +
              '<tr><td><code>league</code></td><td>string</td><td>optional</td>' +
                '<td><code>AL</code>, <code>NL</code>, or <code>ALL</code> (default).</td></tr>' +
            '</tbody>' +
          '</table>' +
          _tabbedCode('all', [
            { label: 'cURL',       code: ALL_CURL },
            { label: 'JavaScript', code: ALL_JS   },
            { label: 'Python',     code: ALL_PY   },
          ]) +
          '<h3>Response</h3>' +
          _codeBlock('JSON — 200 OK (truncated)', ALL_RESPONSE) +
        '</section>' +

        /* ⑧ Response Schema */
        '<section class="docs-section" id="doc-schema">' +
          '<h2>Response Schema</h2>' +
          '<p>Fields returned by <code>POST /v1/valuate</code> and present in each item ' +
          'of the <code>valuations</code> array from <code>/batch</code> and <code>/all</code>.</p>' +
          '<table class="params-table">' +
            '<thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>' +
            '<tbody>' +
              '<tr><td><code>player</code></td><td>string</td><td>Player name as matched in the pool.</td></tr>' +
              '<tr><td><code>true_dollar_value</code></td><td>integer</td><td>Raw calculated value before the 8% safety margin.</td></tr>' +
              '<tr><td><code>max_bid_recommendation</code></td><td>integer</td><td><strong>The number to bid.</strong> <code>floor(true_dollar_value × 0.92)</code>. Never exceed this.</td></tr>' +
              '<tr><td><code>market_inflation</code></td><td>float</td><td>Market inflation factor applied (0.85–1.45). Values &gt; 1.0 indicate a hot market.</td></tr>' +
              '<tr><td><code>scarcity_tier</code></td><td>string</td><td><code>CRITICAL</code> / <code>HIGH</code> / <code>MEDIUM</code> / <code>LOW</code> — overall scarcity rating for this player\'s positions.</td></tr>' +
              '<tr><td><code>position_scarcity</code></td><td>object</td><td>Map of position → scarcity tier string for each of the player\'s eligible positions.</td></tr>' +
              '<tr><td><code>draftability_score</code></td><td>float</td><td>0–1 composite score. 1.0 = fully draftable right now, values below 0.5 suggest waiting or passing.</td></tr>' +
              '<tr><td><code>reasoning</code></td><td>string</td><td>Human-readable explanation: tier, TDV, scarcity, and inflation summary.</td></tr>' +
              '<tr><td><code>stats.tier</code></td><td>string</td><td>Player\'s tier classification: Elite, Starter, or Bench.</td></tr>' +
              '<tr><td><code>stats.positions</code></td><td>string[]</td><td>All eligible position slots for this player.</td></tr>' +
              '<tr><td><code>stats.team</code></td><td>string</td><td>MLB team abbreviation (e.g. LAD, NYM).</td></tr>' +
              '<tr><td><code>stats.league</code></td><td>string</td><td><code>AL</code> or <code>NL</code>.</td></tr>' +
            '</tbody>' +
          '</table>' +
          '<h3>Full Example Response</h3>' +
          _codeBlock('JSON — POST /v1/valuate', VALUATE_RESPONSE) +
        '</section>' +

        /* ⑨ Error Codes */
        '<section class="docs-section" id="doc-errors">' +
          '<h2>Error Codes</h2>' +
          '<table class="params-table">' +
            '<thead><tr><th>HTTP Status</th><th>Cause</th><th>Fix</th></tr></thead>' +
            '<tbody>' +
              '<tr><td><code>400 Bad Request</code></td><td>Missing or malformed body fields.</td><td>Check all required fields in the request body.</td></tr>' +
              '<tr><td><code>401 Unauthorized</code></td><td>Missing or invalid <code>X-License-Key</code> header.</td><td>Include a valid license key in the header.</td></tr>' +
              '<tr><td><code>404 Not Found</code></td><td>Player name not matched in pool.</td><td>Verify spelling; use <code>/v1/players</code> to confirm the exact name string.</td></tr>' +
              '<tr><td><code>429 Too Many Requests</code></td><td>Rate limit exceeded.</td><td>Wait for the <code>Retry-After</code> header duration, then retry.</td></tr>' +
              '<tr><td><code>500 Server Error</code></td><td>Unexpected internal error.</td><td>Retry with exponential backoff. Contact support if it persists.</td></tr>' +
            '</tbody>' +
          '</table>' +
          '<h3>Error Response Shape</h3>' +
          _codeBlock('JSON — 401', '{ "error": "Invalid or missing license key" }') +
          _codeBlock('JSON — 404', '{ "error": "Player not found: \'Mike Trout\'" }') +
          _codeBlock('JSON — 400', '{ "error": "Missing required field: nominated_player" }') +
        '</section>' +

        /* ⑩ Valuation Formula */
        '<section class="docs-section" id="doc-formula">' +
          '<h2>Valuation Formula</h2>' +
          '<p>The API does not use static lookup tables or pre-computed rankings. Every request ' +
          'runs a fresh calculation against the current undrafted player pool — values shift ' +
          'automatically as players are taken.</p>' +
          '<div class="callout callout-info">' +
            'The algorithm uses <strong>Standings Gain Points (SGP)</strong> scoring combined ' +
            'with live position scarcity and market inflation adjustments.' +
          '</div>' +
          _codeBlock('Pseudocode',
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
            '<thead><tr><th>Tier</th><th>Slot / Eligible Ratio</th><th>Effect</th></tr></thead>' +
            '<tbody>' +
              '<tr><td><span class="badge" style="background:rgba(239,68,68,0.12);color:#f87171;">CRITICAL</span></td><td>≥ 1.5</td><td>Maximum scarcity premium applies (1.45×)</td></tr>' +
              '<tr><td><span class="badge" style="background:rgba(245,158,11,0.12);color:#fbbf24;">HIGH</span></td><td>1.1 – 1.49</td><td>Elevated scarcity premium (1.20×)</td></tr>' +
              '<tr><td><span class="badge" style="background:rgba(59,130,246,0.12);color:#60a5fa;">MEDIUM</span></td><td>0.8 – 1.09</td><td>Minor scarcity premium (1.08×)</td></tr>' +
              '<tr><td><span class="badge" style="background:rgba(16,185,129,0.12);color:#34d399;">LOW</span></td><td>&lt; 0.8</td><td>No scarcity premium (1.00×)</td></tr>' +
            '</tbody>' +
          '</table>' +
        '</section>' +

        /* ⑪ Try It */
        '<section class="docs-section" id="doc-tryit">' +
          '<h2>Try It</h2>' +
          '<p>Send a live request to the production API from this page. ' +
          (isLoggedIn
            ? 'Your license key is pre-injected automatically.'
            : 'Using the shared demo key. <a href="#signup">Get a dedicated key &rarr;</a>'
          ) + '</p>' +

          /* Endpoint selector */
          '<label class="form-label" style="display:block;margin-bottom:var(--space-2);">Endpoint</label>' +
          '<select id="tryit-endpoint-sel" class="tryit-endpoint-select" ' +
            'onchange="DB.pages._tryItSelectEndpoint()">' +
            TRY_IT_ENDPOINTS.map(function (ep, i) {
              return '<option value="' + i + '">' + ep.label + '</option>';
            }).join('') +
          '</select>' +

          /* Body area (hidden for GET) */
          '<div id="tryit-body-wrap" style="margin-top:var(--space-5);">' +
            '<label class="form-label" style="display:block;margin-bottom:var(--space-2);">Request Body (JSON)</label>' +
            '<textarea id="tryit-body" class="form-input tryit-textarea">' +
              _esc(TRY_IT_ENDPOINTS[2].body) +
            '</textarea>' +
          '</div>' +

          /* Action buttons */
          '<div class="tryit-actions">' +
            '<button class="btn btn-primary" id="tryit-send-btn" onclick="DB.pages._tryItSend()">Send Request &rarr;</button>' +
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
     ATTACHED HANDLERS
     ══════════════════════════════════════════════════════════════════════════ */

  /** Smooth-scroll to a documentation section. */
  DB.pages._docScrollTo = function (sectionId) {
    var el = document.getElementById('doc-' + sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /**
   * Copy text to clipboard, flash the button.
   * @param {HTMLElement} btn
   * @param {string}      text
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

  /**
   * Switch visible tab panel in a tabbed code block.
   * @param {string}      blockId  - The block id prefix
   * @param {number}      idx      - Index of the tab to show
   * @param {HTMLElement} btn      - The clicked tab button
   */
  DB.pages._switchTab = function (blockId, idx, btn) {
    /* Deactivate all tabs/panels in this block */
    var block = btn.closest('.code-block');
    if (!block) return;
    block.querySelectorAll('.code-tab-btn').forEach(function (b) {
      b.classList.remove('active');
    });
    block.querySelectorAll('.code-tab-panel').forEach(function (p) {
      p.style.display = 'none';
    });
    /* Activate the clicked one */
    btn.classList.add('active');
    var panel = document.getElementById(blockId + '-panel-' + idx);
    if (panel) panel.style.display = '';
  };

  /** Update the Try It body textarea when the endpoint selector changes. */
  DB.pages._tryItSelectEndpoint = function () {
    var sel     = document.getElementById('tryit-endpoint-sel');
    var bodyWrap= document.getElementById('tryit-body-wrap');
    var bodyEl  = document.getElementById('tryit-body');
    if (!sel) return;
    var ep = DB.pages._tryItEndpoints[parseInt(sel.value, 10)];
    if (!ep) return;

    if (ep.body) {
      bodyWrap.style.display = '';
      bodyEl.value = ep.body;
    } else {
      bodyWrap.style.display = 'none';
    }

    /* Clear previous response */
    var statusEl  = document.getElementById('tryit-status');
    var responseEl= document.getElementById('tryit-response');
    if (statusEl)  { statusEl.textContent = ''; statusEl.className = 'tryit-status'; }
    if (responseEl) responseEl.innerHTML = '';
  };

  /** Reset the Try It panel to defaults. */
  DB.pages._tryItReset = function () {
    var sel    = document.getElementById('tryit-endpoint-sel');
    if (sel) sel.value = '2';   /* default to POST /v1/valuate */
    DB.pages._tryItSelectEndpoint();
  };

  /** Send a live request to the API and display the response. */
  DB.pages._tryItSend = async function () {
    var sel       = document.getElementById('tryit-endpoint-sel');
    var bodyEl    = document.getElementById('tryit-body');
    var statusEl  = document.getElementById('tryit-status');
    var responseEl= document.getElementById('tryit-response');
    var btn       = document.getElementById('tryit-send-btn');

    var ep = DB.pages._tryItEndpoints[parseInt(sel.value, 10)];
    if (!ep) return;

    var url     = BASE + ep.path;
    var method  = ep.method;
    var payload = null;

    /* For POST endpoints, parse and validate the body */
    if (method === 'POST') {
      try {
        payload = JSON.parse(bodyEl.value);
      } catch (e) {
        statusEl.className   = 'tryit-status tryit-error';
        statusEl.textContent = '✕ Invalid JSON — ' + e.message;
        return;
      }
    }

    btn.textContent = 'Sending…';
    btn.disabled    = true;
    statusEl.className   = 'tryit-status';
    statusEl.textContent = '';
    responseEl.innerHTML = '';

    var t0 = performance.now();
    try {
      var fetchOpts = {
        method:  method,
        headers: { 'X-License-Key': KEY },
      };
      if (payload) {
        fetchOpts.headers['Content-Type'] = 'application/json';
        fetchOpts.body = JSON.stringify(payload);
      }

      var res     = await fetch(url, fetchOpts);
      var latency = Math.round(performance.now() - t0);
      var json    = await res.json();

      statusEl.className   = 'tryit-status ' + (res.ok ? 'tryit-ok' : 'tryit-error');
      statusEl.textContent = (res.ok ? '✓ ' : '✕ ') + res.status + ' ' + res.statusText + ' · ' + latency + 'ms';

      var prettyJson = JSON.stringify(json, null, 2);
      responseEl.innerHTML = (
        '<div class="code-block" style="margin-top:0.75rem;">' +
          '<div class="code-block-header">' +
            '<span class="code-block-lang">Response · ' + latency + 'ms</span>' +
            '<button class="code-copy-btn" ' +
              'onclick="DB.pages._docCopy(this,' + JSON.stringify(prettyJson) + ')"' +
            '>Copy</button>' +
          '</div>' +
          '<pre class="code-pre" style="max-height:400px;overflow:auto;">' + _esc(prettyJson) + '</pre>' +
        '</div>'
      );

    } catch (err) {
      var latency2 = Math.round(performance.now() - t0);
      statusEl.className   = 'tryit-status tryit-error';
      statusEl.textContent = '✕ Network error (' + latency2 + 'ms) — is the API reachable at ' + BASE + '?';
    }

    btn.textContent = 'Send Request →';
    btn.disabled    = false;
  };

};
