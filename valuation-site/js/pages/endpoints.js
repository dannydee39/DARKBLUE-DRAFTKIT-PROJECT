/**
 * endpoints.js — Endpoints tab renderer.
 *
 * Endpoint cards, a Valuation API news demo push, and a live Try It panel.
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
      product: 'Dark Blue MLB Valuation API',
      version: '1.0.0',
      timestamp: '2026-04-10T14:30:00.000Z',
      environment: 'production',
    }, null, 2
  );

  var PLAYERS_RESPONSE = JSON.stringify({
    count: 1,
    sort: 'tier,baseValue desc,fpts desc',
    grouped_by: null,
    groups: null,
    players: [
      {
        id:        1,
        name:      'Shohei Ohtani',
        team:      'LAD',
        league:    'NL',
        pos:       ['DH', 'SP'],
        tier:      'Elite',
        baseValue: 75,
        hr:        48,
        rbi:       112,
        r:         102,
        sb:        22,
        avg:       '0.288',
        obp:       '0.381',
        slg:       '0.574',
        era:       null,
        so:        null,
        whip:      null,
        w:         null,
        sv:        null,
        fpts:      842,
        depth:     'Elite',
        injury:    null,
        note:      null,
        photoUrl:  'https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/660271/headshot/67/current',
        overall_rank: 1,
        tier_rank: 1,
      },
    ],
  }, null, 2);

  var VALUATE_RESPONSE = JSON.stringify({
    count:                  1821,
    drafted_count:          3,
    undrafted_count:        1818,
    generated_at:           '2026-04-23T19:45:00.000Z',
    market_inflation:       1.045,
    market_context:         { label: 'Neutral', delta_percent: 4.5 },
    stat_window:            'THREE_YEAR',
    rubric_coverage: {
      valuation_variation_test_cases: 5,
      custom_one_or_three_year_stats: 'Supported through draft_state.player_stat_overrides and runtime weighted stats_window.',
      predictive_stats: 'Projected playing time and FPTS feed predictive_adjustment.',
      age: 'Player age feeds age_adjustment.',
      injury_status: 'Valuation API player updates feed risk_adjustment and player-card news.',
      scarcity: 'Roster config and undrafted pool feed position scarcity.',
      depth_chart_position: 'draft_state.depth_chart_context feeds depth_chart_adjustment when Draft Kit sends real MLB team, position, rank, status, role confidence, and volume context.',
      draftkit_refresh: 'Draft Kit posts the full draft_state after draft-state cache invalidation.',
    },
    valuations: {
      'Juan Soto': {
        player:                 'Juan Soto',
        player_id:              3,
        player_tier:            'Elite',
        base_value:             56,
        stat_baseline_value:    56,
        true_dollar_value:      58,
        max_bid_recommendation: 53,
        market_inflation:       1.045,
        market_context:         { label: 'Neutral', delta_percent: 4.5 },
        scarcity_tier:          'HIGH',
        position_scarcity:      { OF: 'HIGH' },
        draftability_score:     1.04,
        value_delta:            2,
        is_drafted:             false,
        predictive_adjustment:  { multiplier: 1.03, source: 'predictive playing-time and production inputs', fpts_delta_percent: 0, volume_score: 82 },
        age_adjustment:         { multiplier: 1.03, age: 27, band: 'PRIME' },
        depth_chart_adjustment: { multiplier: 1.05, depth: 'Everyday hitter', depth_position: 'OF', depth_rank: 1, status: 'Active', mlb_team: 'NYY', active_roster: true, role_confidence: 'HIGH', volume_score: 82, role: 'Everyday volume' },
        stat_profile:           { window: 'THREE_YEAR', selected_source: 'runtime weighted player stats', predictive_available: true, runtime_stats_window: '2023-2025 weighted' },
        valuation_breakdown: {
          formula:                    'stat_baseline_value * scoring * scarcity * predictive * age * depth_chart * market_inflation * injury_risk',
          stat_baseline_value:        56,
          scoring_multiplier:         1,
          scarcity_multiplier:        1.2,
          predictive_multiplier:      1.03,
          age_multiplier:             1.03,
          depth_chart_multiplier:     1.05,
          market_inflation_multiplier: 1.045,
          injury_risk_multiplier:     1,
          true_dollar_value:          58,
          max_bid_recommendation:     53,
        },
        rubric_checks: {
          custom_one_or_three_year_stats_used: true,
          predictive_stats_used: true,
          age_used: true,
          injury_status_used: false,
          scarcity_used: true,
          depth_chart_position_used: true,
        },
        reasoning:              'OF scarce — high demand in pool. Market inflation +4.5%. Player tier: Elite. Scarcity: HIGH. TDV: $58.',
        stats:                  { tier: 'Elite', positions: ['OF'], team: 'NYM', league: 'NL' },
      },
    },
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
    '        { "id": 1, "budget_remaining": 248, "roster": [["Garrett Crochet", "BOS"], ["Paul Goldschmidt", "NYY"]] },\n' +
    '        { "id": 2, "budget_remaining": 215, "roster": [["Freddie Freeman", "LAD"]] }\n' +
    '      ],\n' +
    '      "valuation_options": { "stat_window": "THREE_YEAR" },\n' +
    '      "player_stat_overrides": {\n' +
    '        "3": {\n' +
    '          "player_id": 3,\n' +
    '          "one_year": { "fpts": 720, "hr": 33, "rbi": 91, "r": 105, "sb": 12, "avg": 0.275 },\n' +
    '          "three_year": { "fpts": 790, "hr": 37, "rbi": 97, "r": 113, "sb": 23, "avg": 0.281 },\n' +
    '          "predictive": { "fpts": 820, "projected_games": 155, "projected_plate_appearances": 690 }\n' +
    '        }\n' +
    '      },\n' +
    '      "depth_chart_context": {\n' +
    '        "3": { "player_id": 3, "mlb_team": "NYY", "depth_position": "OF", "depth_rank": 1, "depth_role": "Everyday hitter", "status": "Active", "is_starter": true, "active_roster": true, "role_confidence": "HIGH", "volume_score": 92 }\n' +
    '      },\n' +
    '      "roster_config": {\n' +
    '        "C":2, "1B":1, "2B":1, "CI":1, "3B":1, "SS":1,\n' +
    '        "MI":1, "OF":5, "SP":0, "RP":0, "P":9, "UTIL":1, "BN":0, "TAXI":0\n' +
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
        { id: 1, budget_remaining: 248, roster: [["Garrett Crochet", "BOS"], ["Paul Goldschmidt", "NYY"]] },
        { id: 2, budget_remaining: 215, roster: [["Freddie Freeman", "LAD"]] },
      ],
      valuation_options: { stat_window: 'THREE_YEAR' },
      player_stat_overrides: {
        3: {
          player_id: 3,
          one_year: { fpts: 720, hr: 33, rbi: 91, r: 105, sb: 12, avg: 0.275 },
          three_year: { fpts: 790, hr: 37, rbi: 97, r: 113, sb: 23, avg: 0.281 },
          predictive: { fpts: 820, projected_games: 155, projected_plate_appearances: 690 },
        },
      },
      depth_chart_context: {
        3: { player_id: 3, mlb_team: 'NYY', depth_position: 'OF', depth_rank: 1, depth_role: 'Everyday hitter', status: 'Active', is_starter: true, active_roster: true, role_confidence: 'HIGH', volume_score: 92 },
      },
      roster_config: { C: 2, '1B': 1, '2B': 1, CI: 1, '3B': 1, SS: 1, MI: 1, OF: 5, SP: 0, RP: 0, P: 9, UTIL: 1, BN: 0, TAXI: 0 },
    },
  }, null, 2);

  /* ── Page HTML ───────────────────────────────────────────────────────────── */

  container.innerHTML =
    '<div class="page-endpoints">' +
      '<div class="endpoints-container">' +

        /* Header */
        '<header class="endpoints-header">' +
          '<p class="endpoints-kicker">API Reference</p>' +
          '<h1>Valuations, player data, and pushed news for draft products.</h1>' +
          '<p class="endpoints-lead">' +
            'Base URL: <code>' + DISPLAY + '</code>' +
          '</p>' +
        '</header>' +

        '<section class="ep-flow-strip">' +
          '<div class="ep-flow-card">' +
            '<div class="ep-flow-label">Quickstart</div>' +
            '<p>Use <code>/v1/players</code> before the draft and <code>/v1/valuate</code> whenever the draft state changes.</p>' +
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
              'Filter by league, position, tier, excluded drafted names, or grouped tier output without changing the base contract.' +
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
                  '<tr>' +
                    '<td><code>pos</code></td>' +
                    '<td>string</td>' +
                    '<td><code>ALL</code></td>' +
                    '<td>Filter to one eligible position such as <code>OF</code> or <code>SP</code>.</td>' +
                  '</tr>' +
                  '<tr>' +
                    '<td><code>tier</code></td>' +
                    '<td>string</td>' +
                    '<td><code>ALL</code></td>' +
                    '<td>Restrict the result to <code>Elite</code>, <code>Core</code>, or <code>Depth</code>.</td>' +
                  '</tr>' +
                  '<tr>' +
                    '<td><code>drafted</code></td>' +
                    '<td>string</td>' +
                    '<td>none</td>' +
                    '<td>Comma-separated player names to exclude from the returned pool.</td>' +
                  '</tr>' +
                  '<tr>' +
                    '<td><code>group_by</code></td>' +
                    '<td>string</td>' +
                    '<td>none</td>' +
                    '<td>Set to <code>tier</code> to include grouped tier buckets alongside the flat list.</td>' +
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
              'The core endpoint. Send your full draft state once; receive a full valuation dictionary ' +
              'for the player pool, backed by stat-window baselines, predictive playing time, age, injury risk, depth context, position scarcity, and market inflation. Drafted rosters are sent as <code>[player_name, mlb_team]</code> tuples.' +
            '</p>' +
            '<div class="ep-callout">' +
              'This endpoint is <strong>stateless</strong>. Send the complete, current ' +
              'draft state on every request. Nothing is stored server-side between calls.' +
            '</div>' +
            '<div class="ep-why">' +
              '<strong>Why it matters:</strong> This is what runs during the draft. Every time the draft state changes, ' +
              'your backend refreshes the valuation dictionary and your UI reads player prices from that local cache.' +
            '</div>' +

            '<div class="ep-params">' +
              '<h4>Request Body \u2014 <code>draft_state</code></h4>' +
              '<table class="ep-table">' +
                '<thead><tr><th>Field</th><th>Type</th><th>Req</th><th>Description</th></tr></thead>' +
                '<tbody>' +
                  '<tr><td><code>draft_state</code></td><td>object</td>' +
                    '<td><span class="ep-req">required</span></td>' +
                    '<td>Container for the live league snapshot the API values against.</td></tr>' +
                  '<tr><td><code>total_teams</code></td><td>int</td>' +
                    '<td>optional</td>' +
                    '<td>Number of teams in the league. Defaults to <code>12</code>.</td></tr>' +
                  '<tr><td><code>budget_per_team</code></td><td>int</td>' +
                    '<td>optional</td>' +
                    '<td>Starting auction budget per team. Defaults to <code>260</code>.</td></tr>' +
                  '<tr><td><code>scoring_categories</code></td><td>string[]</td>' +
                    '<td>optional</td>' +
                    '<td>League scoring metadata. The current MVP examples use standard 5x5-style categories when supplied.</td></tr>' +
                  '<tr><td><code>teams</code></td><td>object[]</td>' +
                    '<td>optional</td>' +
                    '<td>Team snapshots with <code>id</code>, <code>budget_remaining</code>, and <code>[player_name, mlb_team]</code> roster tuples.</td></tr>' +
                  '<tr><td><code>teams[].roster</code></td><td>string[][]</td>' +
                    '<td>optional</td>' +
                    '<td>Already-drafted players expressed as arrays like <code>["Freddie Freeman","LAD"]</code>.</td></tr>' +
                  '<tr><td><code>roster_config</code></td><td>object</td>' +
                    '<td>optional</td>' +
                    '<td>Slot counts per position. For predictable integrations, send your league template explicitly instead of relying on server defaults.</td></tr>' +
                  '<tr><td><code>valuation_options.stat_window</code></td><td>string</td>' +
                    '<td>optional</td>' +
                    '<td>Select <code>ONE_YEAR</code>, <code>THREE_YEAR</code>, or <code>BLEND</code>. Defaults to the weighted runtime three-year baseline.</td></tr>' +
                  '<tr><td><code>player_stat_overrides</code></td><td>object</td>' +
                    '<td>optional</td>' +
                    '<td>Per-player custom one-year, three-year, and predictive stats keyed by player id.</td></tr>' +
                  '<tr><td><code>depth_chart_context</code></td><td>object</td>' +
                    '<td>optional</td>' +
                    '<td>Per-player depth position, depth rank, role, active status, and starter flag keyed by player id.</td></tr>' +
                '</tbody>' +
              '</table>' +
            '</div>' +

            '<div class="ep-callout">' +
              'Every player valuation includes <code>valuation_breakdown</code>, a readable formula with each multiplier: ' +
              '<code>stat_baseline_value * scoring * scarcity * predictive * age * depth_chart * market_inflation * injury_risk</code>.' +
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
                  '<tr><td><code>429</code></td><td>Rate limit exceeded. Check <code>Retry-After</code> header.</td></tr>' +
                  '<tr><td><code>500</code></td><td>Internal error. Retry with backoff.</td></tr>' +
                '</tbody>' +
              '</table>' +
            '</div>' +
          '</div>' +
        '</article>' +

        /* ── POST /v1/player-updates/demo ──────────────────────────────── */
        '<article class="ep-card" id="ep-player-news-demo">' +
          '<div class="ep-card-head">' +
            '<span class="ep-method ep-post">POST</span>' +
            '<code class="ep-path">/v1/player-updates/demo</code>' +
            '<span class="ep-auth ep-auth-required">Key required</span>' +
          '</div>' +
          '<div class="ep-card-body">' +
            '<p class="ep-desc">' +
              'Creates a notification-worthy player update inside the Valuation API feed. Draft Kit listens to this feed through its backend proxy, so an open draft board receives the pushed alert without creating local news.' +
            '</p>' +
            '<div class="ep-callout">' +
              'This button is for operator demonstrations. It writes through the same persisted player-update path that future live news ingestion uses, marked with <code>source_type: "MANUAL_DEMO"</code>.' +
            '</div>' +
            '<div class="demo-news-grid">' +
              '<label class="demo-news-field">' +
                '<span>Player</span>' +
                '<input id="demo-news-player" list="demo-news-player-list" value="Aaron Judge" placeholder="Search any player" autocomplete="off" />' +
                '<datalist id="demo-news-player-list"></datalist>' +
              '</label>' +
              '<label class="demo-news-field">' +
                '<span>Status</span>' +
                '<select id="demo-news-alert-status">' +
                  '<option value="INJURY_HIGH">Major injury concern</option>' +
                  '<option value="INJURY_MEDIUM">Injury watch</option>' +
                  '<option value="DAY_TO_DAY">Day-to-day</option>' +
                  '<option value="ACTIVE">Cleared / active</option>' +
                  '<option value="ROLE_GAIN">Role increase</option>' +
                  '<option value="ROLE_LOSS">Role decrease</option>' +
                  '<option value="ROLE_CHANGE">Role change</option>' +
                  '<option value="LINEUP_CHANGE">Lineup change</option>' +
                  '<option value="TRANSACTION">Transaction</option>' +
                  '<option value="CONTRACT">Contract status</option>' +
                  '<option value="NEWS">General player news</option>' +
                '</select>' +
              '</label>' +
              '<label class="demo-news-field demo-news-field-wide">' +
                '<span>Draft impact note</span>' +
                '<textarea id="demo-news-impact" rows="2" placeholder="Optional note shown in Draft Kit"></textarea>' +
              '</label>' +
            '</div>' +
            '<div class="ep-tryit-actions">' +
              '<button class="btn btn-primary" id="demo-news-send">Push Demo News</button>' +
            '</div>' +
            '<div id="demo-news-status" class="ep-tryit-status"></div>' +
            '<div id="demo-news-response"></div>' +
          '</div>' +
        '</article>' +

        /* ── Try It ──────────────────────────────────────────────────────── */
        '<section class="ep-tryit" id="ep-tryit">' +
          '<div class="ep-tryit-head">' +
            '<h2>Try It</h2>' +
            '<p>Send a live <code>POST /v1/valuate</code> request using the live test key and inspect the returned valuation dictionary.</p>' +
          '</div>' +
          '<div class="ep-tryit-note">' +
            'The API must be running at <code>' + BASE + '</code>. ' +
            'In development: <code>cd valuation-api && node server.js</code>' +
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

  /* Demo News Push */
  var demoNewsPlayers = [];
  loadDemoNewsPlayers();

  var demoNewsBtn = document.getElementById('demo-news-send');
  if (demoNewsBtn) {
    demoNewsBtn.addEventListener('click', async function () {
      var statusEl = document.getElementById('demo-news-status');
      var responseEl = document.getElementById('demo-news-response');
      var playerInput = document.getElementById('demo-news-player');
      var alertStatusEl = document.getElementById('demo-news-alert-status');
      var impactEl = document.getElementById('demo-news-impact');
      var selectedPlayer = findDemoNewsPlayer(playerInput && playerInput.value);
      var impactSummary = impactEl ? impactEl.value.trim() : '';

      demoNewsBtn.textContent = 'Pushing...';
      demoNewsBtn.disabled = true;
      statusEl.className = 'ep-tryit-status';
      statusEl.textContent = '';
      responseEl.innerHTML = '';

      var t0 = performance.now();
      try {
        var res = await fetch(BASE + '/v1/player-updates/demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-License-Key': KEY },
          body: JSON.stringify({
            player_id: selectedPlayer ? selectedPlayer.id : undefined,
            player_name: selectedPlayer ? selectedPlayer.name : (playerInput && playerInput.value),
            alert_status: alertStatusEl ? alertStatusEl.value : 'INJURY_HIGH',
            impact_summary: impactSummary || undefined,
          }),
        });
        var latency = Math.round(performance.now() - t0);
        var json = await res.json();

        statusEl.className = 'ep-tryit-status ' + (res.ok ? 'ep-tryit-ok' : 'ep-tryit-error');
        statusEl.textContent = (res.ok ? 'Pushed ' : 'Failed ') +
          res.status + ' ' + res.statusText + ' · ' + latency + 'ms';

        responseEl.innerHTML =
          '<div class="code-block" style="margin-top:0.75rem;">' +
            '<div class="code-block-header">' +
              '<span class="code-block-lang">Response · ' + latency + 'ms</span>' +
            '</div>' +
            '<pre class="code-pre" style="max-height:300px;overflow:auto;">' +
              _esc(JSON.stringify(json, null, 2)) +
            '</pre>' +
          '</div>';
      } catch (err) {
        var ms = Math.round(performance.now() - t0);
        statusEl.className = 'ep-tryit-status ep-tryit-error';
        statusEl.textContent = 'Network error (' + ms + 'ms) — is the API running at ' + BASE + '?';
      }

      demoNewsBtn.textContent = 'Push Demo News';
      demoNewsBtn.disabled = false;
    });
  }

  async function loadDemoNewsPlayers() {
    var listEl = document.getElementById('demo-news-player-list');
    if (!listEl) return;

    try {
      var res = await fetch(BASE + '/v1/players?league=ALL', {
        headers: { 'X-License-Key': KEY },
      });
      var json = await res.json();
      demoNewsPlayers = Array.isArray(json.players) ? json.players : [];
      listEl.innerHTML = demoNewsPlayers
        .slice()
        .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); })
        .map(function (player) {
          return '<option value="' + _attr(player.name) + '">' +
            _esc([player.team, (player.pos || []).join('/')].filter(Boolean).join(' · ')) +
          '</option>';
        })
        .join('');
    } catch (err) {
      listEl.innerHTML = '';
    }
  }

  function findDemoNewsPlayer(value) {
    var normalized = normalizeDemoNewsName(value);
    if (!normalized) return null;
    return demoNewsPlayers.find(function (player) {
      return normalizeDemoNewsName(player.name) === normalized;
    }) || null;
  }

  function normalizeDemoNewsName(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, ' ')
      .trim()
      .toLowerCase();
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
