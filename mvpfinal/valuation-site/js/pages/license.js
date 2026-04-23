/**
 * license.js — Public buyer-journey page for the licensed valuation product.
 *
 * Focus:
 *   1. What the product is
 *   2. What the license unlocks
 *   3. How to start quickly
 *   4. How Draft Kit relates to the separate licensed API
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
    '        { "id": 1, "budget_remaining": 248, "roster": ["Freddie Freeman"] }\n' +
    '      ],\n' +
    '      "nominated_player": "Shohei Ohtani",\n' +
    '      "roster_config": {\n' +
    '        "C":1, "1B":1, "2B":1, "3B":1, "SS":1,\n' +
    '        "OF":3, "SP":2, "RP":2, "UTIL":1, "BN":2\n' +
    '      }\n' +
    '    }\n' +
    "  }'";

  var QUICKSTART_RESPONSE = JSON.stringify(
    {
      player: 'Shohei Ohtani',
      max_bid_recommendation: 69,
      true_dollar_value: 74.8,
      market_context: { label: 'Hot', delta_percent: 8.0 },
      scarcity_tier: 'HIGH',
      reasoning:
        'DH scarce. Market inflation +8.0%. Player tier: Elite. Scarcity: HIGH. TDV: $75.',
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
            '<h1>Buy the valuation engine, not another generic docs page.</h1>' +
            '<p class="license-lead">' +
              'This product gives fantasy baseball builders a licensed player pool, live auction ' +
              'valuation endpoint, and a buyer flow that stays simple: one key, one backend, ' +
              'three endpoints.' +
            '</p>' +
            '<div class="license-hero-actions">' +
              '<a class="btn btn-primary" href="#account">View Buyer Account</a>' +
              '<a class="btn btn-secondary" href="#endpoints">Open Endpoint Guide</a>' +
            '</div>' +
          '</div>' +
          '<div class="license-hero-grid">' +
            _signalCard('Plan', 'DraftKit License', '$99 / season for a live valuation license.') +
            _signalCard('Auth', 'X-License-Key', 'No OAuth flow. Send one header on each request.') +
            _signalCard('Runtime', 'Server-side first', 'Keep the key in your backend, not in the browser.') +
          '</div>' +
        '</header>' +

        '<section class="license-section" id="lic-auth">' +
          '<div class="license-section-label">Authentication</div>' +
          '<h2>Every request needs one header.</h2>' +
          '<p>Include <code>X-License-Key</code> on every request except <code>/health</code>. ' +
          'Use the live test key to confirm the contract, then rotate into a dedicated buyer key ' +
          'for the full production path.</p>' +
          '<div class="license-key-block">' +
            '<div class="license-key-row">' +
              '<span class="license-key-label">Header</span>' +
              '<code class="license-key-mono">X-License-Key</code>' +
            '</div>' +
            '<div class="license-key-row">' +
              '<span class="license-key-label">Demo Key</span>' +
              '<code class="license-key-mono license-key-value">' + KEY + '</code>' +
              '<button class="license-copy-btn license-copy-trigger" data-copy="' + _attr(KEY) + '">Copy</button>' +
            '</div>' +
          '</div>' +
          '<div class="license-key-notes">' +
            '<div class="license-note"><strong>Live test key</strong> lets a buyer validate the response shape immediately before wiring in a dedicated production key.</div>' +
            '<div class="license-note"><strong>Dedicated license key</strong> follows the same contract and is the normal path for long-running production traffic.</div>' +
            '<div class="license-note"><strong>Current rate limit</strong> is 120 requests per minute per IP. Handle <code>429</code> responses with modest retry logic.</div>' +
          '</div>' +
        '</section>' +

        '<section class="license-section" id="lic-buyer-flow">' +
          '<div class="license-section-label">Buyer Journey</div>' +
          '<h2>What the license actually unlocks.</h2>' +
          '<p>The product is intentionally narrow. It gives a draft app or backend service the three pieces it needs to feel live during an auction.</p>' +
          '<div class="license-journey-grid">' +
            _journeyCard('01', 'Load the player pool', 'Call <code>/v1/players</code> once before the draft starts to populate search, tiers, and board context.') +
            _journeyCard('02', 'Value each nomination', 'Send the full draft state to <code>/v1/valuate</code> and receive a bid recommendation plus reasoning.') +
            _journeyCard('03', 'Keep the key server-side', 'Route browser traffic through your backend so the license key stays in infrastructure you control.') +
          '</div>' +
          '<div class="license-unlock-grid">' +
            _unlockCard('Real response shape', 'Buyers get the same response contract the Draft Kit uses: recommendation, true value, scarcity, inflation, and reasoning.') +
            _unlockCard('Stateless integration', 'Nothing is stored between calls. Send the full current draft state each time and the API returns a decision immediately.') +
            _unlockCard('Separate product boundary', 'Draft Kit remains its own full-stack app. The licensed API remains its own buyer-facing product and domain.') +
          '</div>' +
        '</section>' +

        '<section class="license-section" id="lic-quickstart">' +
          '<div class="license-section-label">Quick Start</div>' +
          '<h2>Start with one clean request.</h2>' +
          '<p>A buyer should be able to understand the integration in under a minute: copy the key, hit the endpoint, inspect the response, then open the Account tab for the customer dashboard.</p>' +
          '<div class="license-quickstart-grid">' +
            '<div>' +
              '<ol class="license-steps">' +
                '<li><div class="license-step-num">1</div><div class="license-step-copy"><strong>Copy the key.</strong><p>Use the live test key for onboarding and integration checks. Dedicated buyer keys follow the same header shape.</p></div></li>' +
                '<li><div class="license-step-num">2</div><div class="license-step-copy"><strong>Send one request.</strong><p>Start with <code>POST ' + DISPLAY + '/v1/valuate</code> so you can see the real decision payload immediately.</p></div></li>' +
                '<li><div class="license-step-num">3</div><div class="license-step-copy"><strong>Move the key behind your backend.</strong><p>Your UI should talk to your server, and your server should talk to the licensed API.</p></div></li>' +
              '</ol>' +
              '<div class="license-callout">' +
                '<strong>Draft Kit relationship:</strong> the browser for <code>' + DRAFTKIT_APP + '</code> calls <code>' + DRAFTKIT_API + '</code>. ' +
                '<code>draftkit-api</code> then proxies to <code>' + DISPLAY + '</code> using the server-managed license key. ' +
                'That is the clean production pattern for any customer app as well.' +
              '</div>' +
            '</div>' +
            '<div class="license-quickstart-code">' +
              _codeBlock('cURL', QUICKSTART_CURL) +
              _codeBlock('Response · 200 OK', QUICKSTART_RESPONSE) +
            '</div>' +
          '</div>' +
        '</section>' +

        '<section class="license-section license-plans-section" id="lic-plans">' +
          '<div class="license-section-label">Plans</div>' +
          '<h2>Two tiers. Clear handoff.</h2>' +
          '<div class="license-plans">' +
            _planCard('Test Access', 'Free', [
              'Live test key: <code>' + KEY + '</code>',
              'All three endpoints',
              'Use for response-shape validation',
              'Best for onboarding, wiring, and endpoint testing',
            ], '<a class="btn btn-secondary btn-sm" href="#endpoints">Read Endpoints</a>') +
            _planCard('DraftKit License', '$99 <span class="license-plan-unit">/ season</span>', [
              'Dedicated key per buyer',
              'Same core API contract',
              'Server-side production use',
              'Buyer dashboard in the Account tab',
            ], '<a class="btn btn-primary btn-sm" href="#account">Open Account View</a>', true) +
          '</div>' +
        '</section>' +

        '<section class="license-section license-bridge-section" id="lic-relationship">' +
          '<div class="license-section-label">Product Relationship</div>' +
          '<h2>Draft Kit is not the licensed API product.</h2>' +
          '<div class="license-bridge">' +
            '<div class="license-bridge-card">' +
              '<div class="license-bridge-kicker">DB Draft Kit</div>' +
              '<h3>Commissioner-facing app</h3>' +
              '<p>Owns user login, cloud drafts, saved state, and the draft-room UI.</p>' +
              '<div class="license-bridge-meta"><code>' + DRAFTKIT_APP + '</code></div>' +
            '</div>' +
            '<div class="license-bridge-arrow">via<br /><code>draftkit-api</code></div>' +
            '<div class="license-bridge-card license-bridge-card-accent">' +
              '<div class="license-bridge-kicker">Dark Blue MLB Valuation API</div>' +
              '<h3>Separate licensed product</h3>' +
              '<p>Owns MLB player data, valuation math, <code>X-License-Key</code> auth, and buyer-facing docs.</p>' +
              '<div class="license-bridge-meta"><code>' + PRODUCT_SITE + '</code></div>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<footer class="license-footer">' +
          '<span>API Base: <code>' + DISPLAY + '</code></span>' +
          '<span>Buyer Site: <code>' + PRODUCT_SITE + '</code></span>' +
          '<span>Draft Kit App: <code>' + DRAFTKIT_APP + '</code></span>' +
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

  function _journeyCard(step, title, body) {
    return (
      '<article class="license-journey-card">' +
        '<div class="license-journey-step">' + step + '</div>' +
        '<h3>' + title + '</h3>' +
        '<p>' + body + '</p>' +
      '</article>'
    );
  }

  function _unlockCard(title, body) {
    return (
      '<article class="license-unlock-card">' +
        '<h3>' + title + '</h3>' +
        '<p>' + body + '</p>' +
      '</article>'
    );
  }

  function _planCard(name, price, items, cta, featured) {
    return (
      '<div class="license-plan' + (featured ? ' license-plan-featured' : '') + '">' +
        '<div class="license-plan-header">' +
          '<span class="license-plan-name">' + name + '</span>' +
          '<span class="license-plan-price">' + price + '</span>' +
        '</div>' +
        '<ul>' + items.map(function (item) { return '<li>' + item + '</li>'; }).join('') + '</ul>' +
        '<div class="license-plan-cta">' + cta + '</div>' +
      '</div>'
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
