/**
 * nav.js — Top navigation bar.
 *
 * Brand + public tabs (License, Pricing, Endpoints, Account) + an auth chip
 * that toggles between "Sign In" and a Draft-Kit-style account pill.
 */

window.DB = window.DB || {};

DB.nav = (function () {

  var TABS = [
    ['license',   'License'],
    ['pricing',   'Pricing'],
    ['endpoints', 'Endpoints'],
    ['account',   'Account'],
  ];

  var _bound = false;

  function render() {
    var header = document.getElementById('site-nav');
    if (!header) return;
    var user = DB.auth && DB.auth.current ? DB.auth.current() : null;

    var tabsHtml = TABS.map(function (t) {
      var cls = DB.state.page === t[0] ? 'active' : '';
      return (
        '<li>' +
          '<a href="#' + t[0] + '" data-page="' + t[0] + '" class="' + cls + '">' +
            t[1] +
          '</a>' +
        '</li>'
      );
    }).join('');

    var authHtml = user
      ? '<button class="nav-account-chip" type="button" id="nav-account-chip" title="Open account">' +
          '<span class="nav-account-avatar">' + _initials(user) + '</span>' +
          '<span class="nav-account-copy">' +
            '<span class="nav-account-name">' + _esc(user.displayName || user.email) + '</span>' +
            '<span class="nav-account-sub">Signed in</span>' +
          '</span>' +
        '</button>'
      : '<button class="nav-signin-btn" type="button" id="nav-signin-btn">Sign In</button>';

    header.innerHTML =
      '<nav class="nav" id="main-nav">' +
        '<div class="container nav-inner">' +

          '<a href="#license" class="nav-brand" aria-label="Dark Blue API">' +
            '<div class="nav-brand-mark">' +
              '<img src="logo.png" width="28" height="28" alt="" />' +
            '</div>' +
            '<div class="nav-brand-copy">' +
              '<span class="nav-brand-name">Dark Blue API</span>' +
              '<span class="nav-brand-sub">Valuation Engine</span>' +
            '</div>' +
          '</a>' +

          '<ul class="nav-links" role="list">' + tabsHtml + '</ul>' +

          '<div class="nav-tools">' +
            '<div class="nav-auth">' + authHtml + '</div>' +
          '</div>' +

        '</div>' +
      '</nav>';

    _bindAuthControls();
    _initScrollShadow();
    _bindAuthListener();
  }

  function updateActive() {
    render();
  }

  function _bindAuthControls() {
    var signinBtn = document.getElementById('nav-signin-btn');
    if (signinBtn) {
      signinBtn.addEventListener('click', function () {
        if (DB.authModal) DB.authModal.open('login');
      });
    }
    var chip = document.getElementById('nav-account-chip');
    if (chip) {
      chip.addEventListener('click', function () {
        if (DB.router) DB.router.go('account');
      });
    }
  }

  function _bindAuthListener() {
    if (_bound) return;
    _bound = true;
    if (!DB.auth || !DB.auth.onChange) return;
    DB.auth.onChange(function () {
      render();
      // Re-render the current page so pages that depend on auth (account) refresh.
      if (DB.router && DB.router.refresh) DB.router.refresh();
    });
  }

  function _initScrollShadow() {
    var nav = document.getElementById('main-nav');
    if (!nav) return;

    var sentinel = document.getElementById('scroll-sentinel');

    if (window.IntersectionObserver && sentinel) {
      var observer = new IntersectionObserver(
        function (entries) {
          nav.classList.toggle('scrolled', !entries[0].isIntersecting);
        },
        { threshold: 1 }
      );
      observer.observe(sentinel);
    } else {
      window.addEventListener('scroll', function () {
        nav.classList.toggle('scrolled', window.scrollY > 8);
      }, { passive: true });
    }
  }

  function _initials(user) {
    if (!user) return '?';
    var src = (user.displayName || user.email || '').trim();
    if (!src) return '?';
    var parts = src.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return src.slice(0, 2).toUpperCase();
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { render: render, updateActive: updateActive };

}());
