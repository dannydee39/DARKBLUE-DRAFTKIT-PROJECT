/**
 * auth-modal.js - API-backed login, signup, and password reset modal.
 */

window.DB = window.DB || {};

DB.authModal = (function () {
  var _overlay = null;
  var _mode = 'login';
  var _error = '';
  var _notice = '';
  var _busy = false;
  var _resetToken = '';

  function open(mode, options) {
    options = options || {};
    _mode = ['signup', 'forgot', 'reset'].includes(mode) ? mode : 'login';
    _resetToken = options.token || _resetToken || '';
    _error = '';
    _notice = '';
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
    var forgot = _mode === 'forgot';
    var reset = _mode === 'reset';
    var title = signup ? 'Create buyer account' : forgot ? 'Reset password' : reset ? 'Set new password' : 'Sign in';
    var button = _busy
      ? (signup ? 'Creating...' : forgot ? 'Sending...' : reset ? 'Updating...' : 'Signing in...')
      : (signup ? 'Create Account' : forgot ? 'Send Reset Link' : reset ? 'Update Password' : 'Sign In');

    _overlay.innerHTML =
      '<div class="db-auth-modal" role="dialog" aria-modal="true" aria-labelledby="db-auth-title">' +
        '<div class="db-auth-header">' +
          '<div>' +
            '<p class="db-auth-kicker">Dark Blue API</p>' +
            '<h2 id="db-auth-title">' + title + '</h2>' +
          '</div>' +
          '<button class="db-auth-close" type="button" aria-label="Close">×</button>' +
        '</div>' +

        '<div class="db-auth-intro">' +
          (forgot
            ? 'Enter the email for your buyer account. If it exists, a reset link will be sent.'
            : reset
              ? 'Choose a new password for this Dark Blue API buyer account.'
              : 'Buyer accounts now use backend sessions. New accounts receive their own unique valuation API license key.') +
        '</div>' +

        (!forgot && !reset
          ? '<div class="db-auth-toggle" role="tablist">' +
              '<button type="button" role="tab" data-mode="login" class="' + (signup ? '' : 'active') + '">Login</button>' +
              '<button type="button" role="tab" data-mode="signup" class="' + (signup ? 'active' : '') + '">Sign Up</button>' +
            '</div>'
          : '') +

        '<form class="db-auth-form" novalidate>' +
          (signup
            ? '<label class="db-auth-field"><span>Display Name</span>' +
              '<input name="displayName" type="text" placeholder="Commissioner or company name" autocomplete="name" /></label>'
            : '') +
          (!reset
            ? '<label class="db-auth-field"><span>Email</span>' +
              '<input name="email" type="email" placeholder="you@yourteam.com" autocomplete="email" required /></label>'
            : '<input name="token" type="hidden" value="' + _attr(_resetToken) + '" />') +
          (!forgot
            ? '<label class="db-auth-field"><span>' + (reset ? 'New Password' : 'Password') + '</span>' +
              '<input name="password" type="password" placeholder="Minimum 8 characters" autocomplete="' + (signup || reset ? 'new-password' : 'current-password') + '" required /></label>'
            : '') +
          (_error ? '<div class="db-auth-error">' + _esc(_error) + '</div>' : '') +
          (_notice ? '<div class="db-auth-notice">' + _esc(_notice) + '</div>' : '') +
          '<div class="db-auth-actions">' +
            (forgot || reset ? '<button type="button" class="btn btn-secondary" data-mode="login">Back to Sign In</button>' : '') +
            '<button type="submit" class="btn btn-primary" ' + (_busy ? 'disabled' : '') + '>' + button + '</button>' +
          '</div>' +
          '<p class="db-auth-foot">' +
            (forgot || reset
              ? 'Reset links are single-use and expire automatically.'
              : 'Forgot your password? <button type="button" class="db-auth-link" data-mode="forgot">Reset it</button>') +
          '</p>' +
        '</form>' +
      '</div>';

    _overlay.querySelector('.db-auth-close').addEventListener('click', close);

    _overlay.querySelectorAll('[data-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _mode = btn.getAttribute('data-mode');
        _error = '';
        _notice = '';
        _render();
      });
    });

    var form = _overlay.querySelector('.db-auth-form');
    form.addEventListener('submit', _onSubmit);

    var firstInput = _overlay.querySelector('input:not([type="hidden"])');
    if (firstInput) firstInput.focus();
  }

  function _onSubmit(event) {
    event.preventDefault();
    if (_busy) return;

    var form = event.currentTarget;
    var data = new FormData(form);
    var email = String(data.get('email') || '').trim();
    var password = String(data.get('password') || '');
    var displayName = String(data.get('displayName') || '').trim();
    var token = String(data.get('token') || _resetToken || '').trim();

    if (_mode !== 'reset' && !email) { _error = 'Email is required.'; _render(); return; }
    if (_mode !== 'forgot' && password.length < 8) { _error = 'Password must be at least 8 characters.'; _render(); return; }
    if (_mode === 'reset' && !token) { _error = 'A reset token is required.'; _render(); return; }

    _busy = true;
    _error = '';
    _notice = '';
    _render();

    var closeAfterSuccess = _mode === 'login' || _mode === 'signup';
    var action;
    if (_mode === 'signup') {
      action = DB.auth.signup({ email: email, password: password, displayName: displayName });
    } else if (_mode === 'forgot') {
      action = DB.auth.requestPasswordReset(email).then(function (body) {
        _busy = false;
        _notice = body.message || 'If that account exists, a reset link will be sent shortly.';
        _render();
      });
    } else if (_mode === 'reset') {
      action = DB.auth.confirmPasswordReset(token, password).then(function (body) {
        _busy = false;
        _notice = body.message || 'Password reset complete. Sign in with your new password.';
        _mode = 'login';
        _resetToken = '';
        _cleanResetTokenFromUrl();
        _render();
      });
    } else {
      action = DB.auth.login({ email: email, password: password });
    }

    action.then(function () {
      if (closeAfterSuccess) close();
    }).catch(function (err) {
      _busy = false;
      _error = (err && err.message) || 'Something went wrong.';
      _render();
    });
  }

  function _cleanResetTokenFromUrl() {
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete('resetToken');
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    } catch (err) {}
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

  window.addEventListener('DOMContentLoaded', function () {
    var params = new URLSearchParams(window.location.search);
    var token = params.get('resetToken');
    if (token) open('reset', { token: token });
  });

  return { open: open, close: close };
}());
