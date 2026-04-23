/**
 * auth-modal.js — Draft-Kit-style login / signup modal for the valuation site.
 *
 * Pure browser state. No real backend — this mirrors the Draft Kit local
 * auth UX so the buyer site has a session model instead of a fake license chip.
 */

window.DB = window.DB || {};

DB.authModal = (function () {
  var _overlay = null;
  var _mode = 'login';
  var _error = '';
  var _busy = false;

  function open(mode) {
    _mode = mode === 'signup' ? 'signup' : 'login';
    _error = '';
    _busy = false;
    _ensure();
    _render();
    document.body.classList.add('db-modal-open');
  }

  function close() {
    if (!_overlay) return;
    _overlay.remove();
    _overlay = null;
    document.body.classList.remove('db-modal-open');
  }

  function _ensure() {
    if (_overlay) return;
    _overlay = document.createElement('div');
    _overlay.className = 'db-auth-backdrop';
    _overlay.addEventListener('click', function (event) {
      if (event.target === _overlay) close();
    });
    document.body.appendChild(_overlay);
    window.addEventListener('keydown', _onKeyDown);
  }

  function _onKeyDown(event) {
    if (!_overlay) {
      window.removeEventListener('keydown', _onKeyDown);
      return;
    }
    if (event.key === 'Escape') close();
  }

  function _render() {
    if (!_overlay) return;
    var signup = _mode === 'signup';
    _overlay.innerHTML =
      '<div class="db-auth-modal" role="dialog" aria-modal="true" aria-labelledby="db-auth-title">' +
        '<div class="db-auth-header">' +
          '<div>' +
            '<p class="db-auth-kicker">Dark Blue API</p>' +
            '<h2 id="db-auth-title">' + (signup ? 'Create buyer account' : 'Sign in') + '</h2>' +
          '</div>' +
          '<button class="db-auth-close" type="button" aria-label="Close">×</button>' +
        '</div>' +

        '<div class="db-auth-intro">' +
          'Save your buyer profile, license context, and usage to this browser session. ' +
          'This uses the same local-session model as Draft Kit today.' +
        '</div>' +

        '<div class="db-auth-toggle" role="tablist">' +
          '<button type="button" role="tab" data-mode="login" class="' + (signup ? '' : 'active') + '">Login</button>' +
          '<button type="button" role="tab" data-mode="signup" class="' + (signup ? 'active' : '') + '">Sign Up</button>' +
        '</div>' +

        '<form class="db-auth-form" novalidate>' +
          (signup
            ? '<label class="db-auth-field"><span>Display Name</span>' +
              '<input name="displayName" type="text" placeholder="Commissioner or company name" autocomplete="name" /></label>'
            : '') +
          '<label class="db-auth-field"><span>Email</span>' +
            '<input name="email" type="email" placeholder="you@yourteam.com" autocomplete="email" required /></label>' +
          '<label class="db-auth-field"><span>Password</span>' +
            '<input name="password" type="password" placeholder="Minimum 8 characters" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" required /></label>' +
          (_error ? '<div class="db-auth-error">' + _esc(_error) + '</div>' : '') +
          '<div class="db-auth-actions">' +
            '<button type="submit" class="btn btn-primary" ' + (_busy ? 'disabled' : '') + '>' +
              (_busy ? (signup ? 'Creating…' : 'Signing in…') : (signup ? 'Create Account' : 'Sign In')) +
            '</button>' +
          '</div>' +
          '<p class="db-auth-foot">' +
            'No billing on this screen. Pricing and plan handoff live on the ' +
            '<a href="#pricing">Pricing</a> tab.' +
          '</p>' +
        '</form>' +
      '</div>';

    _overlay.querySelector('.db-auth-close').addEventListener('click', close);

    _overlay.querySelectorAll('.db-auth-toggle button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _mode = btn.getAttribute('data-mode') === 'signup' ? 'signup' : 'login';
        _error = '';
        _render();
      });
    });

    var form = _overlay.querySelector('.db-auth-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (_busy) return;
      var data = new FormData(form);
      var email = String(data.get('email') || '').trim();
      var password = String(data.get('password') || '');
      var displayName = String(data.get('displayName') || '').trim();

      if (!email) { _error = 'Email is required.'; _render(); return; }
      if (password.length < 8) { _error = 'Password must be at least 8 characters.'; _render(); return; }

      _busy = true;
      _error = '';
      _render();

      window.setTimeout(function () {
        try {
          if (_mode === 'signup') {
            DB.auth.signup({ email: email, displayName: displayName });
          } else {
            DB.auth.login({ email: email, displayName: displayName });
          }
          close();
        } catch (err) {
          _busy = false;
          _error = (err && err.message) || 'Something went wrong.';
          _render();
        }
      }, 280);
    });

    var firstInput = _overlay.querySelector('input');
    if (firstInput) firstInput.focus();
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { open: open, close: close };
}());
