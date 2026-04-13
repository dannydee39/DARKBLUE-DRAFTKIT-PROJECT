/**
 * home.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Landing / home page renderer.
 *
 * Sections rendered (in order):
 *   1. Hero          — animated code block, bold headline, two CTAs
 *   2. Stats strip   — 4 key numbers
 *   3. Use Cases     — 4 cards for different buyer personas
 *   4. How it works  — 3-step walkthrough with connector line
 *   5. Endpoints     — quick preview of all 5 endpoints
 *   6. CTA banner    — bottom conversion section
 *   7. Footer
 * ─────────────────────────────────────────────────────────────────────────────
 */

window.DB = window.DB || {};
DB.pages  = DB.pages || {};

DB.pages.home = function (container) {

  var BASE = DB.API_DISPLAY;

  /* ── Hero code block: request side ──────────────────────────────────────── */
  var HERO_REQUEST = (
    '<span class="tok-cmt">// POST /v1/valuate — send draft state</span>\n' +
    '<span class="tok-flag">curl</span> -X POST <span class="tok-url">' + BASE + '/v1/valuate</span> \\\n' +
    '  -H <span class="tok-str">"X-License-Key: DB-2026-DEMO-0001"</span> \\\n' +
    '  -H <span class="tok-str">"Content-Type: application/json"</span> \\\n' +
    '  -d <span class="tok-str">\'{\n' +
    '    "draft_state": {\n' +
    '      "total_teams": 12,\n' +
    '      "budget_per_team": 260,\n' +
    '      "nominated_player": "Shohei Ohtani",\n' +
    '      "teams": [{ "id": 1, "budget_remaining": 248, "roster": [] }]\n' +
    '    }\n' +
    '  }\'</span>'
  );

  /* ── Hero code block: response side ─────────────────────────────────────── */
  var HERO_RESPONSE = (
    '<span class="tok-cmt">// Response — 200 OK · 143ms</span>\n' +
    '{\n' +
    '  <span class="tok-key">"player"</span>:                   <span class="tok-str">"Shohei Ohtani"</span>,\n' +
    '  <span class="tok-key">"true_dollar_value"</span>:        <span class="tok-num">75</span>,\n' +
    '  <span class="tok-key">"max_bid_recommendation"</span>:   <span class="tok-num">69</span>,\n' +
    '  <span class="tok-key">"scarcity_tier"</span>:            <span class="tok-str">"LOW"</span>,\n' +
    '  <span class="tok-key">"market_inflation"</span>:         <span class="tok-num">1</span>,\n' +
    '  <span class="tok-key">"draftability_score"</span>:       <span class="tok-num">1</span>,\n' +
    '  <span class="tok-key">"reasoning"</span>:                <span class="tok-str">"Tier: LOW. TDV: $75."</span>,\n' +
    '  <span class="tok-key">"stats"</span>: {\n' +
    '    <span class="tok-key">"tier"</span>:      <span class="tok-str">"Elite"</span>,\n' +
    '    <span class="tok-key">"positions"</span>: <span class="tok-str">["DH","SP"]</span>,\n' +
    '    <span class="tok-key">"team"</span>:      <span class="tok-str">"LAD"</span>\n' +
    '  }\n' +
    '}'
  );

  /* ── Use cases ───────────────────────────────────────────────────────────── */
  var USE_CASES = [
    {
      icon:  '⚡',
      title: 'Auction Draft War Room',
      desc:  'Embed directly in your draft kit. Get live, context-aware valuations the moment a player is nominated — before anyone else bids.',
    },
    {
      icon:  '🏢',
      title: 'Fantasy Platform Integration',
      desc:  'License the API to power your platform\'s valuation engine. One endpoint, production-grade reliability, SGP + scarcity math included.',
    },
    {
      icon:  '📋',
      title: 'Draft Board Builder',
      desc:  'Build ranked draft boards with state-aware dollar values. Call <code>/v1/valuate/all</code> once to get every eligible player priced in context.',
    },
    {
      icon:  '📌',
      title: 'Watchlist Valuation',
      desc:  'Score a custom list of players in a single batch request. Send up to 300 names and get back true dollar values sorted by rank.',
    },
  ];

  /* ── How it works ────────────────────────────────────────────────────────── */
  var STEPS = [
    {
      num:   '1',
      title: 'Send your draft state',
      body:  'POST the nominated player name, every team\'s current roster, remaining budgets, and your league\'s scoring categories. The API is fully stateless.',
    },
    {
      num:   '2',
      title: 'The engine runs the math',
      body:  'SGP scoring, position scarcity analysis, and market inflation are computed live against the current undrafted player pool — values shift as players are taken.',
    },
    {
      num:   '3',
      title: 'Get a precise dollar value back',
      body:  'Receive the player\'s true dollar value, a recommended max bid (TDV − 8% safety margin), scarcity tier, inflation factor, and a human-readable reasoning string.',
    },
  ];

  /* ── Endpoints preview ───────────────────────────────────────────────────── */
  var ENDPOINTS = [
    { method: 'get',  path: '/health',           desc: 'Server health check — no auth required' },
    { method: 'get',  path: '/v1/players',        desc: 'Full player pool with stats and tiers' },
    { method: 'post', path: '/v1/valuate',         desc: 'Single-player contextual valuation' },
    { method: 'post', path: '/v1/valuate/batch',   desc: 'Batch valuations for a list of players' },
    { method: 'get',  path: '/v1/valuate/all',     desc: 'Price every eligible player at once' },
  ];

  /* ── Render ──────────────────────────────────────────────────────────────── */
  container.innerHTML = (

    /* ① Hero */
    '<section class="hero" aria-label="Hero">' +
      '<div class="container hero-inner">' +
        '<div class="hero-eyebrow">' +
          '<span class="status-dot"></span>' +
          'API v1.0 &nbsp;&middot;&nbsp; Live in Production' +
        '</div>' +

        '<h1 class="hero-headline">' +
          'Know What Every Player is Worth.<br>' +
          '<span class="accent">Before Anyone Else Bids.</span>' +
        '</h1>' +

        '<p class="hero-sub">' +
          'Dark Blue delivers real-time, draft-state-aware auction valuations. ' +
          'Send a player name and your league context — get back a statistically ' +
          'grounded max bid recommendation in under 200ms.' +
        '</p>' +

        '<div class="hero-actions">' +
          '<a href="#docs"    class="btn btn-primary btn-lg">View API Docs</a>' +
          '<a href="#pricing" class="btn btn-ghost   btn-lg">Get a License Key</a>' +
        '</div>' +

        /* Two-panel code preview */
        '<div class="hero-preview">' +
          '<div class="code-block" style="box-shadow:0 32px 64px rgba(0,0,0,0.4),0 0 40px rgba(59,130,246,0.06);">' +
            '<div class="code-block-header">' +
              '<span class="code-block-lang">Request</span>' +
              '<span style="font-size:11px;color:var(--text-faint);">cURL</span>' +
            '</div>' +
            '<pre class="code-pre" style="font-size:0.75rem;">' + HERO_REQUEST + '</pre>' +
          '</div>' +
          '<div class="code-block" style="box-shadow:0 32px 64px rgba(0,0,0,0.4),0 0 40px rgba(59,130,246,0.06);">' +
            '<div class="code-block-header">' +
              '<span class="code-block-lang">Response</span>' +
              '<div style="display:flex;align-items:center;gap:8px;">' +
                '<span style="font-size:11px;color:var(--success);font-weight:600;">200 OK</span>' +
                '<span style="font-size:11px;color:var(--text-faint);">143ms</span>' +
              '</div>' +
            '</div>' +
            '<pre class="code-pre" id="hero-response-pre" style="font-size:0.75rem;">' + HERO_RESPONSE + '</pre>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ② Stats strip */
    '<div class="trust-strip">' +
      '<div class="container trust-strip-inner">' +
        '<span class="trust-label">Built for draft day</span>' +
        '<div class="trust-sep"></div>' +
        '<div class="trust-stat">' +
          '<span class="trust-stat-value">313</span>' +
          '<span class="trust-stat-label">players tracked</span>' +
        '</div>' +
        '<div class="trust-sep"></div>' +
        '<div class="trust-stat">' +
          '<span class="trust-stat-value">5</span>' +
          '<span class="trust-stat-label">endpoints</span>' +
        '</div>' +
        '<div class="trust-sep"></div>' +
        '<div class="trust-stat">' +
          '<span class="trust-stat-value">&lt;200ms</span>' +
          '<span class="trust-stat-label">response time</span>' +
        '</div>' +
        '<div class="trust-sep"></div>' +
        '<div class="trust-stat">' +
          '<span class="trust-stat-value">SGP + Scarcity</span>' +
          '<span class="trust-stat-label">valuation model</span>' +
        '</div>' +
      '</div>' +
    '</div>' +

    /* ③ Use Cases */
    '<section class="section section-alt" aria-label="Use Cases">' +
      '<div class="container">' +
        '<div class="text-center">' +
          '<p class="label">Use Cases</p>' +
          '<h2 class="heading-lg mt-2">Built for every fantasy context</h2>' +
          '<p class="subheading mt-4" style="max-width:560px;margin-inline:auto;">' +
            'One license key, four powerful ways to give your owners an edge on draft day.' +
          '</p>' +
        '</div>' +

        '<div class="use-cases-grid">' +
          USE_CASES.map(function (uc) {
            return (
              '<div class="use-case-card">' +
                '<div class="use-case-icon">' + uc.icon + '</div>' +
                '<h3 class="use-case-title">' + uc.title + '</h3>' +
                '<p class="use-case-desc">' + uc.desc + '</p>' +
              '</div>'
            );
          }).join('') +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ④ How It Works */
    '<section class="section" aria-label="How it works">' +
      '<div class="container">' +
        '<div class="text-center">' +
          '<p class="label">Integration</p>' +
          '<h2 class="heading-lg mt-2">From request to max bid in three steps</h2>' +
          '<p class="subheading mt-4" style="max-width:540px;margin-inline:auto;">' +
            'The API is stateless — you own the draft state and send it fresh on every call.' +
          '</p>' +
        '</div>' +

        '<div class="steps-list">' +
          STEPS.map(function (s) {
            return (
              '<div class="step">' +
                '<div class="step-num">' + s.num + '</div>' +
                '<div class="step-body">' +
                  '<h3>' + s.title + '</h3>' +
                  '<p>' + s.body + '</p>' +
                '</div>' +
              '</div>'
            );
          }).join('') +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ⑤ Endpoints Preview */
    '<section class="section section-alt" aria-label="API Endpoints">' +
      '<div class="container">' +
        '<div class="text-center">' +
          '<p class="label">API Surface</p>' +
          '<h2 class="heading-lg mt-2">Five focused endpoints</h2>' +
          '<p class="subheading mt-4" style="max-width:520px;margin-inline:auto;">' +
            'Everything you need, nothing you don\'t. Clean JSON in, clean JSON out.' +
          '</p>' +
        '</div>' +

        '<div class="endpoints-preview-grid">' +
          ENDPOINTS.map(function (ep) {
            return (
              '<div class="endpoint-preview-card">' +
                '<div class="ep-badge-row">' +
                  '<span class="ep-method ' + ep.method + '">' + ep.method.toUpperCase() + '</span>' +
                '</div>' +
                '<div class="ep-path">' + ep.path + '</div>' +
                '<div class="ep-desc">' + ep.desc + '</div>' +
              '</div>'
            );
          }).join('') +
        '</div>' +

        '<div class="text-center" style="margin-top:var(--space-10);">' +
          '<a href="#docs" class="btn btn-primary">Read the full documentation &rarr;</a>' +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ⑥ CTA Banner */
    '<section class="cta-banner" aria-label="Get started">' +
      '<div class="container">' +
        '<h2>Start building in minutes.</h2>' +
        '<p>' +
          'Plug the Dark Blue Valuation API into your draft kit and give every owner ' +
          'algorithmically-grounded bid recommendations in real time.' +
        '</p>' +
        '<div class="hero-actions">' +
          '<a href="#pricing" class="btn btn-primary btn-lg">See Licensing Plans</a>' +
          '<a href="#docs"    class="btn btn-ghost   btn-lg">Explore the Docs</a>' +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ⑦ Footer */
    '<footer class="site-footer" role="contentinfo">' +
      '<div class="container">' +
        '<div class="footer-inner">' +
          '<div class="footer-brand">' +
            '<div class="footer-logo">' +
              '<div class="footer-logo-mark">' +
                '<img src="logo.png" width="32" height="32" alt="" style="display:block;border-radius:6px;">' +
              '</div>' +
              '<span style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--text-primary);">Dark Blue</span>' +
            '</div>' +
            '<p class="footer-tagline">' +
              'Real-time auction valuation API for fantasy baseball platforms. ' +
              'Built for speed, accuracy, and live draft conditions.' +
            '</p>' +
          '</div>' +
          '<div class="footer-links-group">' +
            '<span class="footer-links-title">Product</span>' +
            '<a href="#home"    class="footer-link">Home</a>' +
            '<a href="#pricing" class="footer-link">Pricing</a>' +
            '<a href="#docs"    class="footer-link">API Docs</a>' +
          '</div>' +
          '<div class="footer-links-group">' +
            '<span class="footer-links-title">Account</span>' +
            '<a href="#login"     class="footer-link">Sign In</a>' +
            '<a href="#pricing"   class="footer-link">Get a Key</a>' +
            '<a href="#dashboard" class="footer-link">Dashboard</a>' +
          '</div>' +
        '</div>' +
        '<div class="footer-bottom">' +
          '<span class="footer-copy">&copy; ' + new Date().getFullYear() + ' Dark Blue. All rights reserved.</span>' +
          '<div class="footer-status">' +
            '<span class="status-dot"></span>' +
            'All systems operational' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</footer>'
  );

  /* ── Typing cursor on hero response preview ──────────────────────────────── */
  var pre = container.querySelector('#hero-response-pre');
  if (pre) {
    var cursor = document.createElement('span');
    cursor.className = 'type-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    pre.appendChild(cursor);
  }
};
