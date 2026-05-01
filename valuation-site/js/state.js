/**
 * state.js — Global state and API constants.
 *
 * Minimal namespace. No real auth, no session persistence — the site is a
 * static licensing + endpoint reference plus a buyer-account preview shell.
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

/* ── Auth (browser-only, Draft-Kit-style) ─────────────────────────────────── */

DB.AUTH_STORAGE_KEY = 'darkblue-api-session-v1';

DB.auth = (function () {
  var _listeners = [];
  var _user = null;

  try {
    var raw = window.localStorage.getItem(DB.AUTH_STORAGE_KEY);
    if (raw) _user = JSON.parse(raw);
  } catch (e) {
    _user = null;
  }

  function _persist() {
    try {
      if (_user) {
        window.localStorage.setItem(DB.AUTH_STORAGE_KEY, JSON.stringify(_user));
      } else {
        window.localStorage.removeItem(DB.AUTH_STORAGE_KEY);
      }
    } catch (e) {}
  }

  function _emit() {
    _listeners.slice().forEach(function (fn) {
      try { fn(_user); } catch (e) {}
    });
  }

  function login(fields) {
    var email = (fields && fields.email || '').trim();
    var name = (fields && fields.displayName || '').trim() || email.split('@')[0] || 'Buyer';
    if (!email) throw new Error('Email is required.');
    _user = {
      email: email,
      displayName: name,
      createdAt: new Date().toISOString(),
    };
    _persist();
    _emit();
    return _user;
  }

  function signup(fields) {
    return login(fields);
  }

  function logout() {
    _user = null;
    _persist();
    _emit();
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
    login: login,
    signup: signup,
    logout: logout,
    current: current,
    onChange: onChange,
  };
}());
