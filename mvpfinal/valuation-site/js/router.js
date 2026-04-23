/**
 * router.js — Hash-based SPA router.
 *
 * Public tabs: #license (default), #endpoints, and #account.
 * No auth guards — the site is public.
 */

window.DB = window.DB || {};

DB.router = (function () {

  var _pages = {};

  function register(id, renderFn) {
    _pages[id] = renderFn;
  }

  function go(id) {
    window.location.hash = '#' + id;
  }

  function _resolve() {
    var raw = window.location.hash.replace('#', '').trim().toLowerCase();
    return _pages[raw] ? raw : 'license';
  }

  function _render() {
    var pageId = _resolve();
    DB.state.page = pageId;

    var viewport = document.getElementById('app-viewport');
    if (!viewport) return;

    viewport.innerHTML = '';

    var wrapper = document.createElement('div');
    wrapper.className = 'page-enter';
    viewport.appendChild(wrapper);

    var renderFn = _pages[pageId] || _pages['license'];
    renderFn(wrapper);

    if (DB.nav && DB.nav.updateActive) {
      DB.nav.updateActive(pageId);
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  window.addEventListener('hashchange', _render);
  window.addEventListener('DOMContentLoaded', _render);

  return { register: register, go: go };

}());
