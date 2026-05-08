/**
 * state.js — Global state and API constants.
 *
 * Minimal namespace plus API-backed buyer authentication.
 */

window.DB = window.DB || {};

/* ── API constants ─────────────────────────────────────────────────────────── */

DB.API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
              ? 'http://localhost:3001'
              : 'https://darkblueapi.anythingavenue.com';

DB.API_DISPLAY = 'https://darkblueapi.anythingavenue.com';
DB.DEMO_KEY    = 'DB-2026-DEMO-0001';
DB.PRODUCT_SITE = 'https://darkbluevalue.anythingavenue.com';
DB.DRAFTKIT_APP = 'https://draft.anythingavenue.com';
DB.DRAFTKIT_API = 'https://draftapi.anythingavenue.com';

/* ── App state ─────────────────────────────────────────────────────────────── */

DB.state = { page: 'license' };
DB.pages = {};

/* ── Auth (API-backed buyer sessions) ─────────────────────────────────────── */

DB.auth = (function () {
  var _listeners = [];
  var _user = null;
  var _ready = false;

  function _request(path, options) {
    options = options || {};
    return fetch(DB.API_BASE + path, Object.assign({
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    }, options)).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) {
          var error = new Error(body.message || body.error || 'Request failed.');
          error.status = response.status;
          error.body = body;
          throw error;
        }
        return body;
      });
    });
  }

  function _setUser(user) {
    _user = user || null;
    _ready = true;
    _emit();
    return _user;
  }

  function _emit() {
    _listeners.slice().forEach(function (fn) {
      try { fn(_user); } catch (e) {}
    });
  }

  function init() {
    return _request('/v1/auth/me', { method: 'GET', headers: {} })
      .then(function (body) {
        return _setUser(body.authenticated ? body.user : null);
      })
      .catch(function () {
        return _setUser(null);
      });
  }

  function login(fields) {
    var email = (fields && fields.email || '').trim();
    var password = String(fields && fields.password || '');
    if (!email) throw new Error('Email is required.');
    if (!password) throw new Error('Password is required.');
    return _request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email, password: password }),
    }).then(function (body) {
      return _setUser(body.user);
    });
  }

  function signup(fields) {
    var email = (fields && fields.email || '').trim();
    var password = String(fields && fields.password || '');
    var displayName = (fields && fields.displayName || '').trim();
    if (!email) throw new Error('Email is required.');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    return _request('/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: email, password: password, displayName: displayName }),
    }).then(function (body) {
      return _setUser(body.user);
    });
  }

  function logout() {
    return _request('/v1/auth/logout', { method: 'POST', body: '{}' })
      .catch(function () {})
      .then(function () {
        return _setUser(null);
      });
  }

  function requestPasswordReset(email) {
    return _request('/v1/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email: email }),
    });
  }

  function confirmPasswordReset(token, password) {
    return _request('/v1/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token: token, password: password }),
    });
  }

  function current() {
    return _user;
  }

  function onChange(fn) {
    _listeners.push(fn);
    return function () {
      _listeners = _listeners.filter(function (f) { return f !== fn; });
    };
  }

  return {
    init: init,
    login: login,
    signup: signup,
    logout: logout,
    requestPasswordReset: requestPasswordReset,
    confirmPasswordReset: confirmPasswordReset,
    current: current,
    onChange: onChange,
    ready: function () { return _ready; },
  };
}());

DB.auth.init();
