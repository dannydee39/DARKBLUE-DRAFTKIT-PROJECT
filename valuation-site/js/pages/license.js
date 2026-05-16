/**
 * license.js — Concise overview of the licensed valuation product.
 *
 * Scope (kept deliberately tight):
 *   1. What the product is
 *   2. How to make one clean request
 *   3. How it relates to Draft Kit
 *
 * Pricing, plans, and FAQ live on the dedicated Pricing tab so this page
 * stays scannable for new buyers.
 */

window.DB = window.DB || {};
DB.pages = DB.pages || {};

DB.pages.license = function (container) {
  var KEY = DB.DEMO_KEY;
  var DISPLAY = DB.API_DISPLAY;
  var PRODUCT_SITE = DB.PRODUCT_SITE;
  var DRAFTKIT_APP = DB.DRAFTKIT_APP;
  var DRAFTKIT_API = DB.DRAFTKIT_API;

  var QUICKSTART_CURL =
    'curl -X POST ' + DISPLAY + '/v1/valuate \\\n' +
    '  -H "Content-Type: application/json" \\\n' +
    '  -H "X-License-Key: ' + KEY + '" \\\n' +
    "  -d '{\n" +
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
    "  }'";

  var QUICKSTART_RESPONSE = JSON.stringify(
    {
      count: 1821,
      drafted_count: 3,
      undrafted_count: 1818,
      generated_at: '2026-04-23T19:45:00.000Z',
      market_inflation: 1.045,
      market_context: { label: 'Neutral', delta_percent: 4.5 },
      stat_window: 'THREE_YEAR',
      rubric_coverage: {
        valuation_variation_test_cases: 5,
        custom_one_or_three_year_stats: 'Supported through draft_state.player_stat_overrides and runtime weighted stats_window.',
        predictive_stats: 'Projected playing time and FPTS feed predictive_adjustment.',
        age: 'Player age feeds age_adjustment.',
        injury_status: 'Player updates, player-pool injury status, and commissioner notes feed risk_adjustment.',
        scarcity: 'Roster config and undrafted pool feed position scarcity.',
        depth_chart_position: 'draft_state.depth_chart_context feeds depth_chart_adjustment when Draft Kit sends real MLB team, position, rank, status, role confidence, and volume context.',
      },
      valuations: {
        'Juan Soto': {
          player: 'Juan Soto',
          player_id: 3,
          player_tier: 'Elite',
          base_value: 56,
          stat_baseline_value: 56,
          true_dollar_value: 58,
          max_bid_recommendation: 53,
          market_inflation: 1.045,
          market_context: { label: 'Neutral', delta_percent: 4.5 },
          scarcity_tier: 'HIGH',
          position_scarcity: { OF: 'HIGH' },
          draftability_score: 1.04,
          value_delta: 2,
          is_drafted: false,
          predictive_adjustment: { multiplier: 1.03, source: 'predictive playing-time and production inputs', volume_score: 82 },
          age_adjustment: { multiplier: 1.03, age: 27, band: 'PRIME' },
          depth_chart_adjustment: { multiplier: 1.05, depth_position: 'OF', depth_rank: 1, depth: 'Everyday hitter', mlb_team: 'NYY', active_roster: true, role_confidence: 'HIGH', volume_score: 92 },
          valuation_breakdown: {
            formula: 'stat_baseline_value * scoring * scarcity * predictive * age * depth_chart * market_inflation * injury_risk',
            stat_baseline_value: 56,
            scoring_multiplier: 1,
            scarcity_multiplier: 1.2,
            predictive_multiplier: 1.03,
            age_multiplier: 1.03,
            depth_chart_multiplier: 1.05,
            market_inflation_multiplier: 1.045,
            injury_risk_multiplier: 1,
            true_dollar_value: 58,
          },
          reasoning: 'OF scarce — high demand in pool. Market inflation +4.5%. Player tier: Elite. Scarcity: HIGH. TDV: $58.',
        },
      },
    },
    null,
    2,
  );

  container.innerHTML =
    '<div class="page-license">' +
      '<div class="license-container">' +
        '<header class="license-header license-hero">' +
          '<div class="license-hero-copy">' +
            '<p class="license-kicker">Dark Blue MLB Valuation API</p>' +
            '<h1>A licensed valuation engine for auction drafts.</h1>' +
            '<p class="license-lead">' +
              'One license, one key, three endpoints. Load the player pool once, ' +
              'send full draft state to one valuation endpoint, keep the key server-side.' +
            '</p>' +
            '<div class="license-hero-actions">' +
              '<a class="btn btn-primary" href="#pricing">See Pricing</a>' +
              '<a class="btn btn-secondary" href="#endpoints">Open Endpoint Guide</a>' +
            '</div>' +
          '</div>' +
          '<div class="license-hero-grid">' +
            _signalCard('Auth', 'X-License-Key', 'One header, no OAuth.') +
            _signalCard('Runtime', 'Server-side', 'Proxy from your backend.') +
          '</div>' +
        '</header>' +

        '<section class="license-section" id="lic-quickstart">' +
          '<div class="license-section-label">Quick Start</div>' +
          '<h2>One request, one valuation dictionary.</h2>' +
          '<p>Copy the test key, hit <code>/v1/valuate</code> with the current draft state, inspect the returned valuation dictionary. ' +
          'Roster entries are sent as <code>[player_name, mlb_team]</code> tuples. The response includes <code>valuation_breakdown</code> so buyers can see the stat window, predictive, age, injury, scarcity, depth, and inflation factors. Once it works, move the key behind your backend and call it from there.</p>' +
          '<div class="license-key-block">' +
            '<div class="license-key-row">' +
              '<span class="license-key-label">Demo Key</span>' +
              '<code class="license-key-mono license-key-value">' + KEY + '</code>' +
              '<button class="license-copy-btn license-copy-trigger" data-copy="' + _attr(KEY) + '">Copy</button>' +
            '</div>' +
          '</div>' +
          '<div class="license-quickstart-code">' +
            _codeBlock('cURL', QUICKSTART_CURL) +
            _codeBlock('Response · 200 OK', QUICKSTART_RESPONSE) +
          '</div>' +
        '</section>' +

        '<section class="license-section license-bridge-section" id="lic-relationship">' +
          '<div class="license-section-label">Product Relationship</div>' +
          '<h2>Draft Kit uses this engine — it is not this engine.</h2>' +
          '<div class="license-bridge">' +
            '<div class="license-bridge-card">' +
            '<div class="license-bridge-kicker">DB Draft Kit</div>' +
            '<h3>Commissioner app</h3>' +
            '<p>Login, cloud drafts, saved state, draft-room UI, and locally cached valuation results.</p>' +
            '<div class="license-bridge-meta"><code>' + DRAFTKIT_APP + '</code></div>' +
          '</div>' +
            '<div class="license-bridge-arrow">via<br /><code>draftkit-api</code></div>' +
            '<div class="license-bridge-card license-bridge-card-accent">' +
            '<div class="license-bridge-kicker">Dark Blue Valuation API</div>' +
            '<h3>Licensed engine</h3>' +
            '<p>MLB data, transparent batch valuation math, and <code>X-License-Key</code> auth.</p>' +
            '<div class="license-bridge-meta"><code>' + PRODUCT_SITE + '</code></div>' +
          '</div>' +
          '</div>' +
        '</section>' +

        '<footer class="license-footer">' +
          '<span>API Base: <code>' + DISPLAY + '</code></span>' +
          '<span>Pricing: <a href="#pricing">see the Pricing tab</a></span>' +
        '</footer>' +
      '</div>' +
    '</div>';

  container.querySelectorAll('.license-copy-trigger').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      if (!text || !navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(function () {
        var original = btn.textContent;
        btn.textContent = 'Copied';
        btn.classList.add('copied');
        window.setTimeout(function () {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1800);
      }).catch(function () {});
    });
  });

  function _signalCard(label, value, copy) {
    return (
      '<article class="license-signal-card">' +
        '<div class="license-signal-label">' + label + '</div>' +
        '<div class="license-signal-value">' + value + '</div>' +
        '<p class="license-signal-copy">' + copy + '</p>' +
      '</article>'
    );
  }

  function _codeBlock(label, code) {
    return (
      '<div class="code-block">' +
        '<div class="code-block-header">' +
          '<span class="code-block-lang">' + label + '</span>' +
          '<button class="license-copy-btn license-copy-trigger" data-copy="' + _attr(code) + '">Copy</button>' +
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
