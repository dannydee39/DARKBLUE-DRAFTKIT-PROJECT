/**
 * nav.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the top navigation bar and manages its dynamic state:
 *   - Highlights the active nav link based on current page
 *   - Shows "Sign In / Get Started" buttons when logged out
 *   - Swaps to user avatar + name when logged in
 *   - Adds a shadow on scroll via IntersectionObserver
 * ─────────────────────────────────────────────────────────────────────────────
 */

window.DB = window.DB || {};

DB.nav = (function () {

  /** Nav link definitions: [ pageId, display label ] */
  const NAV_LINKS = [
    ['home',    'Home'],
    ['pricing', 'Pricing'],
    ['docs',    'API Docs'],
  ];

  /** Render the full nav HTML into <header id="site-nav"> */
  function render() {
    const header = document.getElementById('site-nav');
    if (!header) return;

    const isLoggedIn = !!DB.state.user;

    // Build nav link list items
    const linkItems = NAV_LINKS.map(([id, label]) => `
      <li>
        <a href="#${id}" data-page="${id}" class="${DB.state.page === id ? 'active' : ''}">
          ${label}
        </a>
      </li>
    `).join('');

    // CTA area: show user info if logged in, else auth buttons
    const ctaHtml = isLoggedIn
      ? `<div class="nav-user" id="nav-user-btn" title="View Dashboard">
           <div class="nav-avatar">${DB.state.user.initials}</div>
           <span class="nav-user-name">${DB.state.user.name.split(' ')[0]}</span>
         </div>
         <button class="btn btn-sm btn-secondary" id="nav-logout-btn">Sign Out</button>`
      : `<a href="#login" class="btn btn-sm btn-secondary">Sign In</a>
         <a href="#pricing" class="btn btn-sm btn-primary">Get Started</a>`;

    header.innerHTML = `
      <nav class="nav" id="main-nav">
        <div class="container nav-inner">
          <!-- Logo -->
          <a href="#home" class="nav-logo" aria-label="Dark Blue API — Home">
            <div class="nav-logo-mark">DB</div>
            <div class="nav-logo-text">
              <span class="nav-logo-name">Dark Blue</span>
              <span class="nav-logo-sub">Valuation API</span>
            </div>
          </a>

          <!-- Navigation links -->
          <ul class="nav-links" role="list">
            ${linkItems}
          </ul>

          <!-- CTA / user area -->
          <div class="nav-cta">
            ${ctaHtml}
          </div>
        </div>
      </nav>
    `;

    // Bind events after injecting HTML
    _bindEvents();
    _initScrollShadow();
  }

  /** Update only the active link highlight (called by router on every navigation) */
  function updateActive(pageId) {
    // Also re-render fully since user state may have changed (login/logout)
    render();
  }

  /** Bind click handlers for logout and user-nav-btn */
  function _bindEvents() {
    // Logout button
    const logoutBtn = document.getElementById('nav-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        DB.logout();
        DB.nav.render();
        DB.router.go('home');
      });
    }

    // User avatar → go to dashboard
    const userBtn = document.getElementById('nav-user-btn');
    if (userBtn) {
      userBtn.addEventListener('click', function () {
        DB.router.go('dashboard');
      });
    }
  }

  /**
   * Add/remove .scrolled class on the nav element as the page scrolls.
   * This triggers a box-shadow for visual depth when the user has scrolled.
   */
  function _initScrollShadow() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    // Use a sentinel div at the very top of the viewport
    const sentinel = document.getElementById('scroll-sentinel');

    if (window.IntersectionObserver && sentinel) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          nav.classList.toggle('scrolled', !entry.isIntersecting);
        },
        { threshold: 1 }
      );
      observer.observe(sentinel);
    } else {
      // Fallback: listen to scroll event
      window.addEventListener('scroll', function () {
        nav.classList.toggle('scrolled', window.scrollY > 8);
      }, { passive: true });
    }
  }

  return { render, updateActive };

}());
