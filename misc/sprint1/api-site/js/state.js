/**
 * state.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Global application state for the Dark Blue API marketing/licensing site.
 *
 * All modules write/read through the `DB` namespace attached to `window`.
 * This avoids ES module imports so the site works as static files (no bundler
 * or dev server required — just open index.html in a browser).
 *
 * State shape:
 *   DB.state = {
 *     page:        string,          // current page id ('home'|'pricing'|'docs'|'login'|'signup'|'dashboard')
 *     user:        object|null,     // { email, name, initials } when logged in
 *     licenseKey:  string|null,     // active license key string
 *     plan:        string|null,     // 'starter'|'pro'|'enterprise'
 *     fromPlan:    string|null,     // which plan triggered the auth flow
 *     justClaimed: boolean,         // show success banner on dashboard after claim
 *   }
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Create the global namespace if it doesn't exist yet.
window.DB = window.DB || {};

/* ─────────────────────────────────────────────────────────────────────────────
   Default / initial state
───────────────────────────────────────────────────────────────────────────── */
DB.state = {
  page:        'home',
  user:        null,
  licenseKey:  null,
  plan:        null,
  fromPlan:    null,   // plan tier the user clicked before being sent to auth
  justClaimed: false,
};

/* ─────────────────────────────────────────────────────────────────────────────
   API constants
   The production API endpoint and demo key are defined here so all modules
   reference one source of truth.
───────────────────────────────────────────────────────────────────────────── */
/* In development (localhost), route Try It requests to the local Express
   server so the panel works without deploying. In production this constant
   is the real API host and the display URL shown in all code examples. */
DB.API_BASE  = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
               ? 'http://localhost:3001'
               : 'https://draftapi.anythingavenue.com';
DB.API_DISPLAY = 'https://draftapi.anythingavenue.com'; // always prod URL for docs display
DB.DEMO_KEY  = 'DB-2026-DEMO-0001';

/* ─────────────────────────────────────────────────────────────────────────────
   Session persistence helpers
   We use sessionStorage so the logged-in state survives page refreshes within
   the same browser tab but resets when the tab is closed (appropriate for a
   demo / fake-auth flow).
───────────────────────────────────────────────────────────────────────────── */

/**
 * Persist the current state snapshot to sessionStorage.
 * Called after every mutation that needs to survive a hash change.
 */
DB.saveSession = function () {
  try {
    sessionStorage.setItem('db_session', JSON.stringify({
      user:       DB.state.user,
      licenseKey: DB.state.licenseKey,
      plan:       DB.state.plan,
    }));
  } catch (_) { /* sessionStorage may be unavailable in some environments */ }
};

/**
 * Restore persisted state from sessionStorage on startup.
 * Called once by main.js before the router first renders.
 */
DB.restoreSession = function () {
  try {
    const raw = sessionStorage.getItem('db_session');
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.user)       DB.state.user       = saved.user;
    if (saved.licenseKey) DB.state.licenseKey = saved.licenseKey;
    if (saved.plan)       DB.state.plan       = saved.plan;
  } catch (_) { /* malformed JSON — ignore */ }
};

/* ─────────────────────────────────────────────────────────────────────────────
   Auth helpers
───────────────────────────────────────────────────────────────────────────── */

/**
 * Derive a display name and initials from an email address.
 * e.g. "john.smith@gmail.com" → { name: "John Smith", initials: "JS" }
 */
DB.nameFromEmail = function (email) {
  const local = email.split('@')[0];                     // "john.smith"
  const parts = local.replace(/[._\-+]/g, ' ')           // "john smith"
                     .split(' ')
                     .filter(Boolean)
                     .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  const name     = parts.join(' ') || 'Draft Owner';
  const initials = parts.map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'DO';
  return { name, initials };
};

/**
 * Generate a deterministic fake license key from an email + plan.
 * Format: DB-2026-XXXX-XXXX where X is an uppercase hex segment.
 *
 * The key looks authentic but is entirely client-side — no backend involved.
 */
DB.generateKey = function (email, plan) {
  // Simple deterministic hash — not cryptographic, just cosmetically plausible.
  let h = 0;
  const seed = email + plan + '2026';
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  const abs  = Math.abs(h);
  const seg1 = (abs       & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  const seg2 = ((abs >> 4) & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');

  const prefix = plan === 'enterprise' ? 'DB-ENT'
               : plan === 'pro'        ? 'DB-PRO'
               :                        'DB-STR';

  return `${prefix}-${seg1}-${seg2}`;
};

/**
 * Log the user in with a fake auth flow.
 * @param {string} email
 * @param {string} plan  - tier they signed up for
 */
DB.login = function (email, plan) {
  const { name, initials } = DB.nameFromEmail(email);
  DB.state.user       = { email, name, initials };
  DB.state.licenseKey = DB.generateKey(email, plan);
  DB.state.plan       = plan;
  DB.state.justClaimed= true;
  DB.saveSession();
};

/** Log the user out and clear session data. */
DB.logout = function () {
  DB.state.user        = null;
  DB.state.licenseKey  = null;
  DB.state.plan        = null;
  DB.state.fromPlan    = null;
  DB.state.justClaimed = false;
  try { sessionStorage.removeItem('db_session'); } catch (_) {}
};
