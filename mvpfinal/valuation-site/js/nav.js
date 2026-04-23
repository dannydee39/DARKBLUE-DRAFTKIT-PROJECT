/**
 * nav.js — Top navigation bar.
 *
 * Brand + public tabs (License, Endpoints, Account) + license status display.
 */

window.DB = window.DB || {};

DB.nav = (function () {

  var TABS = [
    ['license',   'License'],
    ['endpoints', 'Endpoints'],
    ['account',   'Account'],
  ];

  function render() {
    var header = document.getElementById('site-nav');
    if (!header) return;
    var maskedKey = DB.DEMO_KEY.slice(0, 7) + '••••' + DB.DEMO_KEY.slice(-4);

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
            '<div class="nav-license">' +
              '<span class="nav-license-label">License Status</span>' +
              '<code class="nav-license-value">Active · ' + maskedKey + '</code>' +
            '</div>' +
          '</div>' +

        '</div>' +
      '</nav>';

    _initScrollShadow();
  }

  function updateActive() {
    render();
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

  return { render: render, updateActive: updateActive };

}());
