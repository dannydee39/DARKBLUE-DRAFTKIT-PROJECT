/**
 * state.js — Global state and API constants.
 *
 * Minimal namespace. No auth, no session persistence — the site is a
 * static licensing + endpoint reference with no login flow.
 */

window.DB = window.DB || {};

/* ── API constants ─────────────────────────────────────────────────────────── */

DB.API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
              ? 'http://localhost:3001'
              : 'https://darkblueapi.anythingavenue.com';

DB.API_DISPLAY = 'https://darkblueapi.anythingavenue.com';
DB.DEMO_KEY    = 'DB-2026-DEMO-0001';

/* ── App state ─────────────────────────────────────────────────────────────── */

DB.state = { page: 'license' };
DB.pages = {};
