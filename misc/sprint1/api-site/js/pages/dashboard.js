/**
 * dashboard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard page renderer.
 *
 * Shown after a successful sign-up or sign-in. This is the "claim your key"
 * destination — where draft kit builders see their license key and start
 * integrating with the Dark Blue API.
 *
 * Sections rendered:
 *   1. Success banner      — green banner shown only on first claim (justClaimed)
 *   2. Page header         — welcome greeting, plan badge
 *   3. License key card    — the key displayed blurred, revealed on hover/click
 *      + Copy + Regenerate buttons
 *   4. Usage stats card    — fake request counts, latency, uptime, reset date
 *   5. Quick-start sidebar — numbered 3-step guide + copy-able cURL command
 *
 * Everything here is client-side only. No backend calls are made.
 * The license key is generated deterministically by state.js (DB.generateKey).
 *
 * CSS dependencies:
 *   css/pages/dashboard.css — .success-banner, .dashboard-grid, .dashboard-main,
 *                              .dashboard-sidebar, .license-key-card,
 *                              .license-key-header, .license-key-label,
 *                              .license-key-hint, .license-key-display,
 *                              .license-key-value, .license-key-actions,
 *                              .license-key-meta, .usage-bar-wrap, .usage-bar,
 *                              .quickstart-panel, .quickstart-steps
 *   css/components.css      — .card, .badge, .code-block, .btn
 * ─────────────────────────────────────────────────────────────────────────────
 */

window.DB = window.DB || {};
DB.pages  = DB.pages || {};

DB.pages.dashboard = function (container) {

  /* ── Auth guard ───────────────────────────────────────────────────────────
     The router already redirects unauthenticated users to #login, but we add
     a graceful fallback in case state becomes stale mid-session.
  ─────────────────────────────────────────────────────────────────────────── */
  if (!DB.state.user) {
    DB.router.go('login');
    return;
  }

  var user        = DB.state.user;
  var licenseKey  = DB.state.licenseKey;
  var plan        = DB.state.plan || 'starter';
  var justClaimed = DB.state.justClaimed;

  /* ── Fake usage stats per plan (cosmetic — no real tracking) ─────────────── */
  var PLAN_META = {
    starter:    { label: 'Draft Day',  color: 'var(--text-muted)',  used:  47,   total: 300,  rateLabel: '20 / 15 min' },
    pro:        { label: 'Pro',        color: 'var(--blue-500)',     used:  1842, total: null, rateLabel: 'Unlimited'   },
    enterprise: { label: 'Enterprise', color: '#7c3aed',             used:  9201, total: null, rateLabel: 'Unlimited+' },
  };
  var meta = PLAN_META[plan] || PLAN_META.starter;

  /* ── Reset date: first day of next calendar month ────────────────────────── */
  var now       = new Date();
  var resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
                    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  var issuedDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  /* ── Usage bar width (only shown for rate-limited plans) ─────────────────── */
  var barPct = (meta.total)
    ? Math.min(Math.round((meta.used / meta.total) * 100), 100)
    : 0;

  /* ── cURL quick-start command (uses the user's actual license key) ────────── */
  var curlCmd = (
    'curl -X POST ' + DB.API_BASE + '/v1/valuate \\\n' +
    '  -H "Content-Type: application/json" \\\n' +
    '  -H "X-License-Key: ' + licenseKey + '" \\\n' +
    '  -d \'{\n' +
    '    "draft_state": {\n' +
    '      "total_teams": 12,\n' +
    '      "budget_per_team": 260,\n' +
    '      "scoring_categories": ["HR","RBI","AVG","SB","ERA","SO","WHIP"],\n' +
    '      "teams": [{"id":1,"budget_remaining":248,"roster":[]}],\n' +
    '      "nominated_player": "Shohei Ohtani",\n' +
    '      "roster_config": {\n' +
    '        "C":1,"1B":1,"2B":1,"3B":1,"SS":1,\n' +
    '        "OF":3,"SP":2,"RP":2,"UTIL":1,"BN":2\n' +
    '      }\n' +
    '    }\n' +
    '  }\''
  );

  /* ── Success banner HTML (only on first claim) ───────────────────────────── */
  var successBannerHtml = justClaimed ? (
    '<div class="success-banner" id="success-banner">' +
      '<div class="container success-banner-inner">' +
        '<div class="success-icon">✓</div>' +
        '<div class="success-body">' +
          '<strong>Your license key is ready!</strong> ' +
          'Active immediately — no email confirmation required. Start integrating now.' +
        '</div>' +
        '<button class="success-close" aria-label="Dismiss success banner" ' +
          'onclick="' +
            'document.getElementById(\'success-banner\').style.display=\'none\';' +
            'DB.state.justClaimed=false;' +
          '">×</button>' +
      '</div>' +
    '</div>'
  ) : '';

  /* ── Usage stats section HTML ────────────────────────────────────────────── */
  var usageSectionHtml = meta.total
    // Rate-limited plan: show a bar
    ? (
      '<div class="usage-bar-wrap">' +
        '<div class="usage-bar ' + (barPct > 80 ? 'usage-bar-warn' : '') + '" style="width:' + barPct + '%;"></div>' +
      '</div>' +
      '<div class="usage-bar-labels">' +
        '<span>' + meta.used + ' used</span>' +
        '<span>' + meta.total + ' limit</span>' +
      '</div>'
    )
    // Unlimited plan: show a green confirmation line
    : (
      '<div class="usage-unlimited">' +
        '✓ Unlimited requests — ' + meta.rateLabel +
      '</div>'
    );

  /* ── Three quick-start steps ─────────────────────────────────────────────── */
  var STEPS = [
    {
      title: 'Copy your license key',
      body:  'Use the key card on the left. Keep it private — treat it like a password.',
    },
    {
      title: 'Send a POST request',
      body:  'Include <code>nominated_player</code>, your team rosters, and remaining budgets.',
    },
    {
      title: 'Read the max bid',
      body:  'Bid the <code>max_bid_recommendation</code>, or anything below it for a steal.',
    },
  ];

  var stepsHtml = STEPS.map(function (s, i) {
    return (
      '<li class="quickstart-step">' +
        '<div class="quickstart-step-num">' + (i + 1) + '</div>' +
        '<div class="quickstart-step-body">' +
          '<strong>' + s.title + '</strong>' +
          '<p>' + s.body + '</p>' +
        '</div>' +
      '</li>'
    );
  }).join('');

  /* ── Render page HTML ─────────────────────────────────────────────────────── */
  container.innerHTML = (
    successBannerHtml +

    /* Page header */
    '<div class="container dashboard-header">' +
      '<p class="label">Dashboard</p>' +
      '<h1 class="heading-lg mt-2">Welcome back, ' + user.name.split(' ')[0] + '.</h1>' +
      '<p class="dashboard-subtitle">' +
        'Your <span style="color:' + meta.color + ';font-weight:600;">' + meta.label + '</span> ' +
        'license is active. Copy your key or send your first request below.' +
      '</p>' +
    '</div>' +

    /* Two-column grid */
    '<div class="container dashboard-grid">' +

      /* ── Left / main column ─────────────────────────────────────────────── */
      '<div class="dashboard-main">' +

        /* License Key Card */
        '<div class="card license-key-card">' +
          '<div class="license-key-header">' +
            '<div>' +
              '<div class="license-key-label">Your License Key</div>' +
              '<div class="license-key-hint">Hover to reveal · click Copy to grab it</div>' +
            '</div>' +
            '<span class="badge badge-blue">' + meta.label + '</span>' +
          '</div>' +
          '<div class="license-key-display">' +
            '<code class="license-key-value" id="key-value">' + licenseKey + '</code>' +
          '</div>' +
          '<div class="license-key-actions">' +
            '<button class="btn btn-sm btn-secondary" id="copy-key-btn" ' +
              'onclick="DB.pages._copyKey()">Copy Key</button>' +
            '<button class="btn btn-sm btn-ghost" ' +
              'onclick="DB.pages._regenerateKey()">Regenerate</button>' +
          '</div>' +
          '<div class="license-key-meta">' +
            '<span>Issued: ' + issuedDate + '</span>' +
            '<span class="meta-sep">·</span>' +
            '<span>Resets: ' + resetDate + '</span>' +
            '<span class="meta-sep">·</span>' +
            '<span>' + user.email + '</span>' +
          '</div>' +
        '</div>' +

        /* Usage Stats Card */
        '<div class="card" style="margin-top:1rem;">' +
          '<div class="usage-header">' +
            '<div>' +
              '<div class="license-key-label">API Usage</div>' +
              '<div class="license-key-hint">This billing period</div>' +
            '</div>' +
            '<span class="usage-count">' + meta.used.toLocaleString() + '</span>' +
          '</div>' +
          usageSectionHtml +
          '<div class="usage-stats-row">' +
            '<div class="usage-stat">' +
              '<div class="usage-stat-value">&lt;180ms</div>' +
              '<div class="usage-stat-label">Avg latency</div>' +
            '</div>' +
            '<div class="usage-stat">' +
              '<div class="usage-stat-value">99.8%</div>' +
              '<div class="usage-stat-label">Uptime (30d)</div>' +
            '</div>' +
            '<div class="usage-stat">' +
              '<div class="usage-stat-value">' + resetDate.split(',')[0] + '</div>' +
              '<div class="usage-stat-label">Period resets</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

      '</div>' + /* /dashboard-main */

      /* ── Right / sidebar column ─────────────────────────────────────────── */
      '<aside class="dashboard-sidebar">' +
        '<div class="quickstart-panel">' +
          '<h3 class="quickstart-title">Quick Start</h3>' +
          '<p class="quickstart-sub">Three steps to your first valuation.</p>' +
          '<ol class="quickstart-steps">' + stepsHtml + '</ol>' +

          /* Copy-able cURL command */
          '<div class="code-block" style="margin-top:1rem;">' +
            '<div class="code-block-header">' +
              '<span class="code-block-lang">cURL</span>' +
              '<button class="code-copy-btn" id="curl-copy-btn" ' +
                'onclick="DB.pages._copyCurl()" title="Copy command">Copy</button>' +
            '</div>' +
            '<pre class="code-pre" style="white-space:pre-wrap;word-break:break-all;font-size:0.7rem;">' +
              _escapeHtml(curlCmd) +
            '</pre>' +
          '</div>' +

          '<a href="#docs" class="btn btn-secondary btn-full btn-sm" ' +
            'style="margin-top:1rem;">Full API Docs →</a>' +
        '</div>' +
      '</aside>' +

    '</div>' /* /dashboard-grid */
  );

  /* ══════════════════════════════════════════════════════════════════════════
     Action handlers
     ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Copy the license key to the system clipboard.
   * Falls back to a text-selection highlight if the Clipboard API is unavailable.
   */
  DB.pages._copyKey = function () {
    var key = DB.state.licenseKey;
    var btn = document.getElementById('copy-key-btn');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(key).then(function () {
        if (btn) {
          btn.textContent = '✓ Copied!';
          setTimeout(function () { btn.textContent = 'Copy Key'; }, 2000);
        }
      }).catch(function () { _fallbackSelect('key-value'); });
    } else {
      _fallbackSelect('key-value');
    }
  };

  /**
   * Copy the quick-start cURL command to the system clipboard.
   */
  DB.pages._copyCurl = function () {
    var btn = document.getElementById('curl-copy-btn');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(curlCmd).then(function () {
        if (btn) {
          btn.textContent = '✓ Copied';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 2000);
        }
      }).catch(function () {});
    }
  };

  /**
   * Regenerate the license key (visual-only: appends a timestamp salt so
   * DB.generateKey produces a different output, then re-renders the page).
   */
  DB.pages._regenerateKey = function () {
    if (!window.confirm(
      'Regenerate your license key?\n\n' +
      'The current key will stop working immediately. ' +
      'You\'ll need to update it anywhere it\'s already been used.'
    )) return;

    // Append current timestamp as salt so the deterministic hash changes
    var newKey = DB.generateKey(user.email + Date.now(), plan);
    DB.state.licenseKey  = newKey;
    DB.state.justClaimed = false; // don't show success banner on re-render
    DB.saveSession();
    DB.router.go('dashboard'); // re-render with new key
  };

  /* ── Internal helpers ─────────────────────────────────────────────────────── */

  /**
   * Fallback selection highlight for browsers without Clipboard API.
   * @param {string} elementId
   */
  function _fallbackSelect(elementId) {
    var el = document.getElementById(elementId);
    if (!el) return;
    var range = document.createRange();
    range.selectNode(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }

  /**
   * Escape HTML special characters to safely insert dynamic text into innerHTML.
   * Prevents XSS in code blocks and any user-controlled string rendering.
   * @param {string} str
   * @returns {string}
   */
  function _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

};

/* ── Module-level helper alias (called during rendering before the closure
   is complete, so we define it outside so it's available synchronously) ────── */
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
