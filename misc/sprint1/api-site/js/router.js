/**
 * router.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hash-based SPA router.
 *
 * Pages are registered with DB.router.register(id, renderFn).
 * Navigation happens by setting window.location.hash = '#page-id', or
 * programmatically via DB.router.go('page-id').
 *
 * On every hash change:
 *   1. Determine which page is requested.
 *   2. Guard redirect: if page needs auth and user is not logged in → 'login'.
 *      If user is already logged in and tries to visit 'login'/'signup' → 'dashboard'.
 *   3. Call the registered render function with the target element.
 *   4. Update DB.state.page and re-render the nav active state.
 * ─────────────────────────────────────────────────────────────────────────────
 */

window.DB = window.DB || {};

DB.router = (function () {

  // Map of page-id → render function
  const _pages = {};

  // Pages that require the user to be authenticated
  const _protectedPages = new Set(['dashboard']);

  // Pages that authenticated users should be redirected away from
  const _authOnlyPages = new Set(['login', 'signup']);

  /**
   * Register a page renderer.
   * @param {string}   id       - URL hash fragment (without '#')
   * @param {Function} renderFn - function(container: HTMLElement) that writes the page HTML
   */
  function register(id, renderFn) {
    _pages[id] = renderFn;
  }

  /**
   * Programmatically navigate to a page.
   * Triggers the hashchange handler below.
   */
  function go(id) {
    window.location.hash = '#' + id;
  }

  /**
   * Resolve the intended page id from the current hash.
   * Falls back to 'home' if the hash is empty or unknown.
   */
  function _resolve() {
    const raw = window.location.hash.replace('#', '').trim().toLowerCase();
    return _pages[raw] ? raw : 'home';
  }

  /**
   * Apply auth guards, then render the appropriate page.
   * This function is called on every hashchange and on initial load.
   */
  function _render() {
    let pageId = _resolve();

    // Guard: protected page but not logged in → redirect to login
    if (_protectedPages.has(pageId) && !DB.state.user) {
      // Remember where they were trying to go so login can redirect back
      DB.state._returnTo = pageId;
      pageId = 'login';
      // Silently correct the hash without adding a history entry
      history.replaceState(null, '', '#login');
    }

    // Guard: auth page but already logged in → redirect to dashboard
    if (_authOnlyPages.has(pageId) && DB.state.user) {
      pageId = 'dashboard';
      history.replaceState(null, '', '#dashboard');
    }

    DB.state.page = pageId;

    // Get the viewport container
    const viewport = document.getElementById('app-viewport');
    if (!viewport) return;

    // Clear the viewport
    viewport.innerHTML = '';

    // Create a fresh page wrapper with the enter animation
    const wrapper = document.createElement('div');
    wrapper.className = 'page-enter';
    viewport.appendChild(wrapper);

    // Call the registered render function
    const renderFn = _pages[pageId] || _pages['home'];
    renderFn(wrapper);

    // Tell the nav to update its active link
    if (DB.nav && DB.nav.updateActive) {
      DB.nav.updateActive(pageId);
    }

    // Scroll to top on page change
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Listen for hash changes (back/forward, link clicks)
  window.addEventListener('hashchange', _render);

  // Initial render on page load
  window.addEventListener('DOMContentLoaded', _render);

  return { register, go };

}());
