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
    '        { "id": 1, "budget_remaining": 248, "roster": ["Freddie Freeman"] },\n' +
    '        { "id": 2, "budget_remaining": 214, "roster": ["Ronald Acuna Jr."] }\n' +
    '      ],\n' +
    '      "roster_config": {\n' +
    '        "C":1, "1B":1, "2B":1, "3B":1, "SS":1,\n' +
    '        "OF":3, "SP":2, "RP":2, "UTIL":1, "BN":2\n' +
    '      }\n' +
    '    }\n' +
    "  }'";

  var QUICKSTART_RESPONSE = JSON.stringify(
    {
      count: 1821,
      market_inflation: 1.08,
      market_context: { label: 'Hot', delta_percent: 8.0 },
      valuations: {
        'Shohei Ohtani': {
          player: 'Shohei Ohtani',
          max_bid_recommendation: 69,
          true_dollar_value: 74.8,
          scarcity_tier: 'HIGH',
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
          '<p>Copy the test key, hit <code>/v1/valuate</code> with the current draft state, inspect the returned player dictionary. ' +
          'Once it works, move the key behind your backend and call it from there.</p>' +
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
            '<p>MLB data, batch valuation math, and <code>X-License-Key</code> auth.</p>' +
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
