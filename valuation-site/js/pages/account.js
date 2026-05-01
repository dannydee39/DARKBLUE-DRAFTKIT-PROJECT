/**
 * account.js — Buyer account/dashboard page.
 *
 * No separate backend auth exists for the valuation site today, so this page
 * behaves like a customer portal with browser-persisted buyer details and
 * live API health/integration checks.
 */

window.DB = window.DB || {};
DB.pages = DB.pages || {};

DB.pages.account = function (container) {
  var user = DB.auth && DB.auth.current ? DB.auth.current() : null;
  if (!user) {
    _renderSignInPrompt(container);
    return;
  }
  var profile = _loadProfile();
  // Pull owner/email from the authed session so the dashboard reflects
  // who is actually signed in instead of the hard-coded default buyer.
  profile = Object.assign({}, profile, {
    ownerName: user.displayName || profile.ownerName,
    email: user.email || profile.email,
  });
  var KEY = profile.licenseKey || DB.DEMO_KEY;
  var DISPLAY = DB.API_DISPLAY;
  var PRODUCT_SITE = DB.PRODUCT_SITE;
  var DRAFTKIT_APP = DB.DRAFTKIT_APP;
  var DRAFTKIT_API = DB.DRAFTKIT_API;
  var usagePercent = Math.max(
    0,
    Math.min(100, Math.round((profile.requestsUsed / profile.requestsLimit) * 100))
  );
  var headersBlock =
    'X-License-Key: ' + KEY + '\n' +
    'Content-Type: application/json';

  container.innerHTML =
    '<div class="page-account">' +
      '<div class="account-container">' +
        '<header class="account-header">' +
          '<div class="account-header-top">' +
            '<div>' +
              '<p class="license-kicker">Buyer Account</p>' +
              '<h1>Welcome back, ' + _esc(profile.ownerName) + '.</h1>' +
            '</div>' +
            '<div class="account-header-chip">License active</div>' +
          '</div>' +
          '<p class="account-lead">' +
            _esc(profile.company) + ' is on the ' + _esc(profile.plan) + '. ' +
            'Manage your key, verify the live API, and hand the exact integration details ' +
            'to your backend team from one place.' +
          '</p>' +
          '<div class="account-actions">' +
            '<button class="btn btn-primary" id="account-edit-open" type="button">Edit Buyer Details</button>' +
            '<a class="btn btn-secondary" href="#endpoints">Open Endpoint Guide</a>' +
            '<button class="btn btn-secondary account-copy-trigger" type="button" data-copy="' + _attr(DISPLAY) + '">Copy API Base URL</button>' +
            '<button class="btn btn-secondary" id="account-signout" type="button">Sign Out</button>' +
          '</div>' +
        '</header>' +

        '<section class="account-summary-grid">' +
          _summaryCard('Buyer', _esc(profile.ownerName), _esc(profile.company) + ' · ' + _esc(profile.accountId)) +
          _summaryCard('Plan', _esc(profile.plan), _esc(profile.billing) + ' · renews ' + _esc(profile.renewsOn)) +
          _summaryCard('Environment', _esc(profile.environment), 'Primary app: ' + _esc(profile.appName)) +
          _summaryCard('Usage This Month', _number(profile.requestsUsed) + ' / ' + _number(profile.requestsLimit), 'Requests across player-pool and valuation traffic.') +
          _summaryCard('Live API Status', '<span id="account-summary-live" class="account-inline-status loading">Checking…</span>', 'Health, player-pool, and valuation checks run when this page loads.') +
        '</section>' +

        '<section class="account-panel-grid">' +
          '<article class="account-panel account-panel-primary">' +
            '<div class="account-panel-kicker">Customer Profile</div>' +
            '<h2>Who this license belongs to</h2>' +
            '<div class="account-detail-list">' +
              _detailRow('Account owner', profile.ownerName) +
              _detailRow('Organization', profile.company) +
              _detailRow('Billing email', profile.email) +
              _detailRow('Primary app', profile.appName) +
              _detailRow('Region', profile.region) +
              _detailRow('Member since', profile.memberSince) +
            '</div>' +
            '<div class="account-note-stack">' +
              '<div class="account-note"><strong>Account ID:</strong> ' + _esc(profile.accountId) + '</div>' +
              '<div class="account-note"><strong>Customize:</strong> Use Edit Buyer Details any time to update the owner, company, and plan shown on this account page.</div>' +
            '</div>' +
          '</article>' +

          '<article class="account-panel">' +
            '<div class="account-panel-kicker">Access & Key</div>' +
            '<h2>Current license details</h2>' +
            '<div class="account-key-card">' +
              '<div class="account-key-row">' +
                '<span>Base URL</span>' +
                '<code class="account-key-value">' + _esc(DISPLAY) + '</code>' +
                '<button class="license-copy-btn account-copy-trigger" type="button" data-copy="' + _attr(DISPLAY) + '">Copy</button>' +
              '</div>' +
              '<div class="account-key-row">' +
                '<span>Header</span>' +
                '<code class="account-key-value">X-License-Key</code>' +
              '</div>' +
              '<div class="account-key-row">' +
                '<span>Key</span>' +
                '<code class="account-key-value">' + _esc(_maskKey(KEY)) + '</code>' +
                '<button class="license-copy-btn account-copy-trigger" type="button" data-copy="' + _attr(KEY) + '">Copy Live Test Key</button>' +
              '</div>' +
            '</div>' +
            '<div class="account-note-stack">' +
              '<div class="account-note"><strong>Key mode:</strong> live test access is ready now. Production keys follow the same request format and rotate from this account area.</div>' +
              '<div class="account-note"><strong>Rate window:</strong> 120 requests per minute per IP. Handle <code>429</code> with modest retry logic.</div>' +
            '</div>' +
            '<div class="code-block">' +
              '<div class="code-block-header">' +
                '<span class="code-block-lang">Request Headers</span>' +
                '<button class="license-copy-btn account-copy-trigger" type="button" data-copy="' + _attr(headersBlock) + '">Copy</button>' +
              '</div>' +
              '<pre class="code-pre">' + _esc(headersBlock) + '</pre>' +
            '</div>' +
          '</article>' +
        '</section>' +

        '<section class="account-panel-grid">' +
          '<article class="account-panel">' +
            '<div class="account-panel-kicker">Usage</div>' +
            '<h2>Traffic this billing cycle</h2>' +
            '<div class="account-usage-meter">' +
              '<div class="account-usage-meter-bar">' +
                '<div class="account-usage-meter-fill" style="width:' + usagePercent + '%"></div>' +
              '</div>' +
              '<div class="account-usage-meter-copy">' +
                '<strong>' + usagePercent + '% used</strong>' +
                '<span>' + _number(profile.requestsUsed) + ' of ' + _number(profile.requestsLimit) + ' requests</span>' +
              '</div>' +
            '</div>' +
            '<div class="account-mini-grid">' +
              _miniStat('Current plan', profile.plan) +
              _miniStat('Billing', profile.billing) +
              _miniStat('Renews', profile.renewsOn) +
              _miniStat('Workspace', profile.appName) +
            '</div>' +
          '</article>' +

          '<article class="account-panel">' +
            '<div class="account-panel-kicker">Live Checks</div>' +
            '<h2>Connection status right now</h2>' +
            '<div class="account-status-list">' +
              _liveStatusRow('Health check', 'account-live-health', 'Checking…') +
              _liveStatusRow('Player pool', 'account-live-players', 'Checking…') +
              _liveStatusRow('Valuation test', 'account-live-valuate', 'Checking…') +
            '</div>' +
            '<div class="account-live-card" id="account-live-card">' +
              '<div class="account-live-card-label">Latest valuation response</div>' +
              '<div class="account-live-card-value">Loading live response…</div>' +
              '<p>We run one live valuation request so the buyer page shows a real response instead of a placeholder.</p>' +
            '</div>' +
          '</article>' +
        '</section>' +

        '<section class="account-panel-grid">' +
          '<article class="account-panel">' +
            '<div class="account-panel-kicker">Connected Apps</div>' +
            '<h2>Where this license is used</h2>' +
            '<div class="account-relationship">' +
              '<div class="account-relationship-card">' +
                '<div class="account-relationship-label">Your backend</div>' +
                '<p>Use your own server to hold the key, call the API, and return pricing data to your frontend safely.</p>' +
                '<code>' + _esc(profile.appName) + '</code>' +
              '</div>' +
              '<div class="account-relationship-arrow">to<br /><code>' + _esc(DISPLAY) + '</code></div>' +
              '<div class="account-relationship-card account-relationship-card-accent">' +
                '<div class="account-relationship-label">DB Draft Kit</div>' +
                '<p>The Draft Kit product uses the same valuation contract through <code>draftkit-api</code> and keeps its own account system separate.</p>' +
                '<code>' + _esc(DRAFTKIT_API) + '</code>' +
              '</div>' +
            '</div>' +
          '</article>' +

          '<article class="account-panel">' +
            '<div class="account-panel-kicker">Next Steps</div>' +
            '<h2>What a buyer normally does next</h2>' +
            '<ol class="account-checklist">' +
              '<li><strong>Confirm reachability.</strong> Verify <code>/health</code> once from your backend or integration host.</li>' +
              '<li><strong>Load the player pool.</strong> Use <code>/v1/players</code> before the draft starts so your UI has rankings and tiers ready.</li>' +
              '<li><strong>Refresh the valuation dictionary.</strong> Send your full draft state to <code>/v1/valuate</code> whenever the draft changes, using <code>[player_name, mlb_team]</code> roster tuples, and cache the returned player values locally.</li>' +
              '<li><strong>Keep the key server-side.</strong> Draft Kit follows this pattern through <code>draftkit-api</code>, and your own app should too.</li>' +
            '</ol>' +
            '<div class="account-note-stack">' +
              '<div class="account-note"><strong>Buyer portal:</strong> <code>' + _esc(PRODUCT_SITE) + '</code></div>' +
              '<div class="account-note"><strong>Draft Kit app:</strong> <code>' + _esc(DRAFTKIT_APP) + '</code></div>' +
            '</div>' +
          '</article>' +
        '</section>' +

        '<section class="account-panel account-editor-panel" id="account-editor-panel" hidden>' +
          '<div class="account-panel-kicker">Customize Buyer Details</div>' +
          '<h2>Make this account look like your customer view</h2>' +
          '<form class="account-editor-grid" id="account-editor-form">' +
            _editorField('Owner Name', 'ownerName', profile.ownerName) +
            _editorField('Organization', 'company', profile.company) +
            _editorField('Billing Email', 'email', profile.email) +
            _editorField('Primary App', 'appName', profile.appName) +
            _editorField('Plan Name', 'plan', profile.plan) +
            _editorField('Renewal Date', 'renewsOn', profile.renewsOn) +
            '<div class="account-editor-actions">' +
              '<button class="btn btn-primary" type="submit">Save Buyer Details</button>' +
              '<button class="btn btn-secondary" type="button" id="account-editor-cancel">Cancel</button>' +
              '<button class="btn btn-secondary" type="button" id="account-editor-reset">Reset Defaults</button>' +
            '</div>' +
          '</form>' +
        '</section>' +
      '</div>' +
    '</div>';

  _bindCopyButtons(container);
  _bindEditor(container, profile);
  _runLiveChecks(container, KEY);

  var signOutBtn = container.querySelector('#account-signout');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', function () {
      if (DB.auth) DB.auth.logout();
    });
  }
};

function _renderSignInPrompt(container) {
  container.innerHTML =
    '<div class="page-account">' +
      '<div class="account-container">' +
        '<div class="account-signin-gate">' +
          '<p class="license-kicker">Buyer Account</p>' +
          '<h1>Sign in to view your buyer dashboard.</h1>' +
          '<p>Licensing, usage, and live API checks live behind a session so ' +
          'the account view reflects a real buyer instead of a demo placeholder.</p>' +
          '<div class="account-signin-actions">' +
            '<button class="btn btn-primary" type="button" id="account-gate-login">Sign In</button>' +
            '<button class="btn btn-secondary" type="button" id="account-gate-signup">Create Account</button>' +
            '<a class="btn btn-secondary" href="#pricing">See Pricing</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  var loginBtn = container.querySelector('#account-gate-login');
  var signupBtn = container.querySelector('#account-gate-signup');
  if (loginBtn) loginBtn.addEventListener('click', function () { if (DB.authModal) DB.authModal.open('login'); });
  if (signupBtn) signupBtn.addEventListener('click', function () { if (DB.authModal) DB.authModal.open('signup'); });
}

function _bindEditor(container, profile) {
  var openBtn = container.querySelector('#account-edit-open');
  var panel = container.querySelector('#account-editor-panel');
  var form = container.querySelector('#account-editor-form');
  var cancelBtn = container.querySelector('#account-editor-cancel');
  var resetBtn = container.querySelector('#account-editor-reset');

  if (openBtn && panel) {
    openBtn.addEventListener('click', function () {
      panel.hidden = false;
      var firstField = form && form.querySelector('input');
      if (firstField) firstField.focus();
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (cancelBtn && panel) {
    cancelBtn.addEventListener('click', function () {
      panel.hidden = true;
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      window.localStorage.removeItem(_storageKey());
      DB.pages.account(container);
    });
  }

  if (!form) return;

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var formData = new FormData(form);
    var nextProfile = {
      ownerName: _readField(formData, 'ownerName', profile.ownerName),
      company: _readField(formData, 'company', profile.company),
      email: _readField(formData, 'email', profile.email),
      appName: _readField(formData, 'appName', profile.appName),
      plan: _readField(formData, 'plan', profile.plan),
      renewsOn: _readField(formData, 'renewsOn', profile.renewsOn),
    };

    _saveProfile(nextProfile);
    DB.pages.account(container);
  });
}

function _bindCopyButtons(container) {
  container.querySelectorAll('.account-copy-trigger').forEach(function (btn) {
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
}

function _runLiveChecks(container, key) {
  var summary = container.querySelector('#account-summary-live');
  var healthEl = container.querySelector('#account-live-health');
  var playersEl = container.querySelector('#account-live-players');
  var valuateEl = container.querySelector('#account-live-valuate');
  var liveCard = container.querySelector('#account-live-card');

  var healthOk = false;
  var playersOk = false;
  var valuateOk = false;

  function refreshSummary() {
    if (!summary) return;
    if (healthOk && playersOk && valuateOk) {
      summary.className = 'account-inline-status online';
      summary.textContent = 'Online';
      return;
    }
    if (healthOk || playersOk || valuateOk) {
      summary.className = 'account-inline-status partial';
      summary.textContent = 'Partial';
      return;
    }
    summary.className = 'account-inline-status offline';
    summary.textContent = 'Offline';
  }

  refreshSummary();

  fetch(DB.API_BASE + '/health')
    .then(function (response) { return response.json().then(function (body) { return { ok: response.ok, body: body }; }); })
    .then(function (result) {
      healthOk = !!(result.ok && result.body && result.body.status === 'online');
      _setLiveStatus(healthEl, healthOk, healthOk ? 'Online' : 'Unavailable');
      refreshSummary();
    })
    .catch(function () {
      _setLiveStatus(healthEl, false, 'Unavailable');
      refreshSummary();
    });

  fetch(DB.API_BASE + '/v1/players?league=ALL', {
    headers: { 'X-License-Key': key },
  })
    .then(function (response) { return response.json().then(function (body) { return { ok: response.ok, body: body }; }); })
    .then(function (result) {
      var count = Array.isArray(result.body)
        ? result.body.length
        : Number(result.body && result.body.count) || (result.body && result.body.players ? result.body.players.length : 0);
      playersOk = !!(result.ok && count > 0);
      _setLiveStatus( playersEl, playersOk, playersOk ? (_number(count) + ' players ready') : 'Unavailable');
      refreshSummary();
    })
    .catch(function () {
      _setLiveStatus(playersEl, false, 'Unavailable');
      refreshSummary();
    });

  fetch(DB.API_BASE + '/v1/valuate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-License-Key': key,
    },
    body: JSON.stringify({
      draft_state: {
        total_teams: 12,
        budget_per_team: 260,
        scoring_categories: ['HR', 'RBI', 'AVG', 'SB', 'ERA', 'SO', 'WHIP'],
        teams: [
          { id: 1, budget_remaining: 248, roster: [['Garrett Crochet', 'BOS'], ['Paul Goldschmidt', 'NYY']] },
          { id: 2, budget_remaining: 215, roster: [['Freddie Freeman', 'LAD']] },
        ],
        roster_config: {
          C: 2, '1B': 1, '2B': 1, CI: 1, '3B': 1, SS: 1,
          MI: 1, OF: 5, SP: 0, RP: 0, P: 9, UTIL: 1, BN: 0, TAXI: 0,
        },
      },
    }),
  })
    .then(function (response) { return response.json().then(function (body) { return { ok: response.ok, body: body }; }); })
    .then(function (result) {
      var body = result.body || {};
      var valuationNames = body.valuations ? Object.keys(body.valuations) : [];
      var sampleName = body.valuations && body.valuations['Shohei Ohtani']
        ? 'Shohei Ohtani'
        : valuationNames[0];
      var sample = sampleName ? body.valuations[sampleName] : null;
      valuateOk = !!(result.ok && sample);
      _setLiveStatus(valuateEl, valuateOk, valuateOk ? 'Response received' : 'Unavailable');
      if (liveCard) {
        liveCard.innerHTML =
          '<div class="account-live-card-label">Latest valuation response</div>' +
          '<div class="account-live-card-value">' +
            (valuateOk ? (_esc(sampleName) + ' · $' + _number(sample.max_bid_recommendation || 0)) : 'Could not load live valuation') +
          '</div>' +
          '<p>' +
            (valuateOk
              ? ('True value $' + _number(sample.true_dollar_value || 0) + ' · ' + _esc(body.market_context && body.market_context.label ? body.market_context.label : 'Market context ready') + ' · ' + _esc(sample.reasoning || 'Batch valuation dictionary loaded successfully.'))
              : 'The API did not return a live valuation during this page load. Recheck the endpoint guide and try again.'
            ) +
          '</p>';
      }
      refreshSummary();
    })
    .catch(function () {
      _setLiveStatus(valuateEl, false, 'Unavailable');
      if (liveCard) {
        liveCard.innerHTML =
          '<div class="account-live-card-label">Latest valuation response</div>' +
          '<div class="account-live-card-value">Could not load live valuation</div>' +
          '<p>Check the endpoint guide or verify the active license key before retrying.</p>';
      }
      refreshSummary();
    });
}

function _setLiveStatus(node, ok, text) {
  if (!node) return;
  node.innerHTML =
    '<span class="account-status-pill ' + (ok ? 'online' : 'offline') + '">' + (ok ? 'Ready' : 'Check') + '</span>' +
    '<strong>' + _esc(text) + '</strong>';
}

function _summaryCard(label, value, body) {
  return (
    '<article class="account-summary-card">' +
      '<div class="account-summary-label">' + label + '</div>' +
      '<div class="account-summary-value">' + value + '</div>' +
      '<p>' + body + '</p>' +
    '</article>'
  );
}

function _detailRow(label, value) {
  return (
    '<div class="account-detail-row">' +
      '<span>' + _esc(label) + '</span>' +
      '<strong>' + _esc(value) + '</strong>' +
    '</div>'
  );
}

function _miniStat(label, value) {
  return (
    '<div class="account-mini-stat">' +
      '<div class="account-mini-stat-label">' + _esc(label) + '</div>' +
      '<div class="account-mini-stat-value">' + _esc(value) + '</div>' +
    '</div>'
  );
}

function _liveStatusRow(label, id, value) {
  return (
    '<div class="account-status-row" id="' + id + '">' +
      '<span>' + _esc(label) + '</span>' +
      '<strong>' + _esc(value) + '</strong>' +
    '</div>'
  );
}

function _editorField(label, name, value) {
  return (
    '<label class="account-editor-field">' +
      '<span>' + _esc(label) + '</span>' +
      '<input type="text" name="' + _attr(name) + '" value="' + _attr(value) + '" />' +
    '</label>'
  );
}

function _storageKey() {
  return 'darkblue-api-buyer-profile-v1';
}

function _defaultProfile() {
  return {
    ownerName: 'Avery Chen',
    company: 'Northside League Ops',
    email: 'avery@northsideleague.com',
    appName: 'Northside Auction Suite',
    plan: 'DraftKit License',
    billing: '$99 / season',
    renewsOn: 'Mar 31, 2027',
    memberSince: 'Mar 2026',
    region: 'US-East',
    accountId: 'acct_2026_014',
    requestsUsed: 8412,
    requestsLimit: 25000,
    environment: 'Production',
    licenseKey: DB.DEMO_KEY,
  };
}

function _loadProfile() {
  var defaults = _defaultProfile();
  try {
    var raw = window.localStorage.getItem(_storageKey());
    if (!raw) return defaults;
    var parsed = JSON.parse(raw);
    return Object.assign({}, defaults, parsed || {});
  } catch (error) {
    return defaults;
  }
}

function _saveProfile(nextFields) {
  var merged = Object.assign({}, _loadProfile(), nextFields || {});
  window.localStorage.setItem(_storageKey(), JSON.stringify(merged));
}

function _readField(formData, key, fallback) {
  return String(formData.get(key) || '').trim() || fallback;
}

function _maskKey(key) {
  var str = String(key || '');
  if (str.length <= 8) return str;
  return str.slice(0, 7) + '••••' + str.slice(-4);
}

function _number(value) {
  if (!Number.isFinite(Number(value))) return String(value);
  return Number(value).toLocaleString();
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
