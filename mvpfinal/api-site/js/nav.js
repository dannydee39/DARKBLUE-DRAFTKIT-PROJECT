window.DB = window.DB || {};

DB.nav = (function () {
  const NAV_LINKS = [
    ['home', 'Home'],
    ['pricing', 'Pricing'],
    ['docs', 'API Docs'],
  ];

  function render() {
    const header = document.getElementById('site-nav');
    if (!header) return;

    const isLoggedIn = !!DB.state.user;
    const rawKeyValue = isLoggedIn ? DB.state.licenseKey : DB.DEMO_KEY;
    const keyNote = isLoggedIn ? 'Active license' : 'Demo key';
    const keyValue = _maskKey(rawKeyValue);

    const linksHtml = NAV_LINKS.map(([id, label]) => `
      <li>
        <a href="#${id}" data-page="${id}" class="${DB.state.page === id ? 'active' : ''}">
          ${label}
        </a>
      </li>
    `).join('');

    const ctaHtml = isLoggedIn
      ? `
        <button class="nav-link-btn" id="nav-dashboard-btn">Dashboard</button>
        <button class="btn btn-sm btn-secondary" id="nav-logout-btn">Sign Out</button>
      `
      : `
        <a href="#login" class="nav-link-btn nav-link-btn-primary">Sign In</a>
        <a href="#pricing" class="btn btn-sm btn-primary">Get Started</a>
      `;

    const userHtml = isLoggedIn
      ? `
        <div class="nav-user-chip" id="nav-user-btn" title="Open dashboard">
          <div class="nav-avatar">${DB.state.user.initials}</div>
          <span class="nav-user-name">${DB.state.user.name.split(' ')[0]}</span>
        </div>
      `
      : '';

    header.innerHTML = `
      <nav class="nav" id="main-nav">
        <div class="container nav-inner">
          <a href="#home" class="nav-brand" aria-label="Dark Blue API Home">
            <div class="nav-brand-mark">
              <img src="logo.png" width="28" height="28" alt="" />
            </div>
            <div class="nav-brand-copy">
              <span class="nav-brand-name">Dark Blue API</span>
              <span class="nav-brand-sub">Fantasy Baseball Valuation</span>
            </div>
          </a>

          <ul class="nav-links" role="list">
            ${linksHtml}
          </ul>

          <div class="nav-tools">
            <div class="nav-license">
              <span class="nav-license-label">X-License-Key</span>
              <code class="nav-license-value">${keyValue}</code>
              <span class="nav-license-note">${keyNote}</span>
            </div>
            ${userHtml}
            <div class="nav-cta">
              ${ctaHtml}
            </div>
          </div>
        </div>
      </nav>
    `;

    _bindEvents();
    _initScrollShadow();
  }

  function updateActive() {
    render();
  }

  function _bindEvents() {
    const logoutBtn = document.getElementById('nav-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        DB.logout();
        DB.nav.render();
        DB.router.go('home');
      });
    }

    const dashboardBtn = document.getElementById('nav-dashboard-btn');
    if (dashboardBtn) {
      dashboardBtn.addEventListener('click', function () {
        DB.router.go('dashboard');
      });
    }

    const userBtn = document.getElementById('nav-user-btn');
    if (userBtn) {
      userBtn.addEventListener('click', function () {
        DB.router.go('dashboard');
      });
    }
  }

  function _initScrollShadow() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

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
      window.addEventListener('scroll', function () {
        nav.classList.toggle('scrolled', window.scrollY > 8);
      }, { passive: true });
    }
  }

  function _maskKey(key) {
    if (!key || key.length < 10) return key;
    return key.slice(0, 7) + '••••' + key.slice(-4);
  }

  return { render, updateActive };
}());
