/**
 * login.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Login + sign-up page renderer.
 *
 * The same function handles both #login and #signup hash routes. It renders
 * a centered auth card with two tabs:
 *   "Sign In"     — email + mock password → DB.login() → #dashboard
 *   "Get Started" — email + plan selection → DB.login() → #dashboard
 *
 * IMPORTANT: This is a DEMO / FAKE auth flow.
 *   - No network request is made to any backend.
 *   - DB.login(email, plan) generates a deterministic license key client-side
 *     and stores user info in sessionStorage.
 *   - The router guards #dashboard so unauthenticated users are redirected here.
 *
 * Plan pre-selection:
 *   If the user arrived via a pricing CTA button, DB.state.fromPlan is set to
 *   the chosen plan and the sign-up tab's plan radio will be pre-selected.
 *
 * CSS dependencies:
 *   css/pages/login.css — auth-card, auth-tabs, auth-tab, auth-panel,
 *                          plan-radio-group, plan-radio, form-error, auth-switch
 *   css/components.css  — .form-input, .form-group, .form-label, .btn, .btn-primary,
 *                          .btn-full
 *   css/base.css        — .mt-4, .hidden
 * ─────────────────────────────────────────────────────────────────────────────
 */

window.DB = window.DB || {};
DB.pages  = DB.pages || {};

DB.pages.login = function (container) {

  /* ── Determine starting tab from the current URL hash ─────────────────────
     #login  → show Sign In tab
     #signup → show Get Started tab  (e.g. arrived from a pricing CTA)
  ─────────────────────────────────────────────────────────────────────────── */
  var startTab = (window.location.hash === '#signup') ? 'signup' : 'login';

  /* ── Plan radio: which tier should be pre-selected on the sign-up tab ────── */
  var prePlan = DB.state.fromPlan || 'starter';

  /* ── Build the plan radio HTML ────────────────────────────────────────────── */
  var planRadios = [
    { id: 'starter', name: 'Draft Day', price: 'Free' },
    { id: 'pro',     name: 'Pro',       price: '$99 / season' },
  ].map(function (p) {
    var sel = (p.id === prePlan) ? 'selected' : '';
    var chk = (p.id === prePlan) ? 'checked'  : '';
    return (
      '<label class="plan-radio ' + sel + '" data-plan="' + p.id + '">' +
        '<input type="radio" name="plan" value="' + p.id + '" ' + chk + ' />' +
        '<div class="plan-radio-info">' +
          '<span class="plan-radio-name">' + p.name  + '</span>' +
          '<span class="plan-radio-price">'+ p.price + '</span>' +
        '</div>' +
      '</label>'
    );
  }).join('');

  /* ── Render page HTML ─────────────────────────────────────────────────────── */
  container.innerHTML = (
    '<div class="auth-page">' +
      '<div class="auth-card">' +

        /* Logo / brand */
        '<div class="auth-logo">' +
          '<div class="auth-logo-mark">DB</div>' +
          '<div class="auth-logo-name">Dark Blue API</div>' +
          '<div class="auth-logo-sub">Fantasy Baseball Valuation Engine</div>' +
        '</div>' +

        /* Tab switcher */
        '<div class="auth-tabs">' +
          '<button id="tab-login"  class="auth-tab ' + (startTab === 'login'  ? 'active' : '') + '" ' +
            'onclick="DB.pages._authTab(\'login\')">Sign In</button>' +
          '<button id="tab-signup" class="auth-tab ' + (startTab === 'signup' ? 'active' : '') + '" ' +
            'onclick="DB.pages._authTab(\'signup\')">Get Started</button>' +
        '</div>' +

        /* ── Sign In panel ───────────────────────────────────────────────── */
        '<div id="panel-login" class="auth-panel ' + (startTab === 'login' ? '' : 'hidden') + '">' +
          '<div class="form-group">' +
            '<label class="form-label" for="login-email">Email address</label>' +
            '<input id="login-email" class="form-input" type="email" ' +
              'placeholder="you@example.com" autocomplete="email" />' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label" for="login-password">Password</label>' +
            '<input id="login-password" class="form-input" type="password" ' +
              'placeholder="••••••••" autocomplete="current-password" />' +
          '</div>' +
          '<div id="login-error" class="form-error hidden"></div>' +
          '<button class="btn btn-primary btn-full" style="margin-top:1rem;" ' +
            'onclick="DB.pages._submitLogin()">Sign In</button>' +
          '<p class="auth-switch">No account? ' +
            '<a href="#signup" onclick="DB.pages._authTab(\'signup\');return false;">Get started free →</a>' +
          '</p>' +
        '</div>' +

        /* ── Sign Up panel ───────────────────────────────────────────────── */
        '<div id="panel-signup" class="auth-panel ' + (startTab === 'signup' ? '' : 'hidden') + '">' +
          '<div class="form-group">' +
            '<label class="form-label" for="signup-email">Email address</label>' +
            '<input id="signup-email" class="form-input" type="email" ' +
              'placeholder="you@example.com" autocomplete="email" />' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">License tier</label>' +
            '<div class="plan-radio-group" id="plan-radio-group">' +
              planRadios +
            '</div>' +
          '</div>' +
          '<div id="signup-error" class="form-error hidden"></div>' +
          '<button class="btn btn-primary btn-full" style="margin-top:1rem;" ' +
            'onclick="DB.pages._submitSignup()">Claim My License Key →</button>' +
          '<p class="auth-switch">Already have a key? ' +
            '<a href="#login" onclick="DB.pages._authTab(\'login\');return false;">Sign in →</a>' +
          '</p>' +
        '</div>' +

      '</div>' + /* /auth-card */
    '</div>'    /* /auth-page */
  );

  /* ── Bind plan radio highlight on click ──────────────────────────────────── */
  var planLabels = container.querySelectorAll('.plan-radio');
  planLabels.forEach(function (label) {
    label.addEventListener('click', function () {
      planLabels.forEach(function (l) { l.classList.remove('selected'); });
      label.classList.add('selected');
    });
  });

  /* ══════════════════════════════════════════════════════════════════════════
     Event handlers — attached to DB.pages so inline onclick attributes work.
     ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Switch between Sign In and Get Started tabs.
   * Updates panel visibility, tab active class, and URL hash (silently).
   * @param {string} tab - 'login' | 'signup'
   */
  DB.pages._authTab = function (tab) {
    document.getElementById('panel-login') .classList.toggle('hidden', tab !== 'login');
    document.getElementById('panel-signup').classList.toggle('hidden', tab !== 'signup');
    document.getElementById('tab-login')   .classList.toggle('active', tab === 'login');
    document.getElementById('tab-signup')  .classList.toggle('active', tab === 'signup');
    // Update the URL hash without pushing a new history entry
    history.replaceState(null, '', '#' + tab);
  };

  /**
   * Handle Sign In form submission.
   * Any valid email + any password is accepted (demo auth — no backend).
   */
  DB.pages._submitLogin = function () {
    var email  = (document.getElementById('login-email').value || '').trim();
    var errEl  = document.getElementById('login-error');

    // Basic email validation
    if (!email || !email.includes('@')) {
      errEl.textContent = 'Please enter a valid email address.';
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');

    // Use the plan from the existing session (if any) or default to starter
    var plan = DB.state.plan || 'starter';
    DB.login(email, plan);
    DB.state.justClaimed = false; // signing back in ≠ claiming a new key
    DB.router.go('dashboard');
  };

  /**
   * Handle Get Started (sign-up) form submission.
   * Reads the selected plan from the radio group, generates the key, stores session.
   */
  DB.pages._submitSignup = function () {
    var email  = (document.getElementById('signup-email').value || '').trim();
    var errEl  = document.getElementById('signup-error');

    // Basic email validation
    if (!email || !email.includes('@')) {
      errEl.textContent = 'Please enter a valid email address.';
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');

    // Read selected plan radio; fall back to the plan that sent them here
    var checked = document.querySelector('input[name="plan"]:checked');
    var plan    = checked ? checked.value : (DB.state.fromPlan || 'starter');

    DB.login(email, plan);   // sets justClaimed = true, stores to sessionStorage
    DB.state.fromPlan = null; // clear referral plan after use
    DB.router.go('dashboard');
  };

};
