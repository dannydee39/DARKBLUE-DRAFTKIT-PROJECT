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
