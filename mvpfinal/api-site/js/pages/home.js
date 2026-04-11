window.DB = window.DB || {};
DB.pages = DB.pages || {};

DB.pages.home = function (container) {
  const licenseKey = DB.state.licenseKey || DB.DEMO_KEY;
  const primaryHref = DB.state.user ? '#dashboard' : '#pricing';
  const primaryLabel = DB.state.user ? 'Open Dashboard' : 'Get Your License Key';

  const valueCards = [
    {
      title: 'Player pool',
      body: 'Return the draftable player list with ranks, tiers, and the fields your UI needs before the room opens.',
    },
    {
      title: 'Live values',
      body: 'Request a live recommendation for the nominated player using your current draft state and budget context.',
    },
    {
      title: 'Tier context',
      body: 'Explain why a player sits where they do with buyer-friendly tier labels instead of only raw numbers.',
    },
    {
      title: 'Market context',
      body: 'Surface whether the room is spending hot or cold against baseline value so the UI can explain urgency.',
    },
  ];

  const endpointCards = [
    {
      id: 'endpoint-health',
      method: 'GET',
      methodClass: 'api-shell-method-get',
      path: '/health',
      title: 'Service check',
      desc: 'Use this before the draft starts to confirm the API is online and ready.',
      returns: [
        ['status', 'Simple availability signal for your app shell.'],
        ['uptime', 'Lets you display service stability or diagnostics.'],
        ['version', 'Useful when you need to confirm the deployed build.'],
      ],
    },
    {
      id: 'endpoint-players',
      method: 'GET',
      methodClass: 'api-shell-method-get',
      path: '/v1/players?league=NL',
      title: 'Player pool and ranking context',
      desc: 'Load the player inventory, overall order, tier placement, and photo data for DraftKit.',
      returns: [
        ['players[]', 'Each player entry with team, positions, rank, and tier fields.'],
        ['overall_rank', 'The product-ready ordering for large search and board flows.'],
        ['tier_rank', 'Where the player sits inside their tier, not just overall.'],
      ],
    },
    {
      id: 'endpoint-valuations',
      method: 'POST',
      methodClass: 'api-shell-method-post',
      path: '/v1/valuate',
      title: 'Live bid recommendation',
      desc: 'Submit the current draft state and get a bid ceiling plus the explanation a commissioner actually wants.',
      returns: [
        ['max_bid_recommendation', 'The number your draft UI can surface immediately.'],
        ['true_dollar_value', 'Baseline value for comparison against room behavior.'],
        ['player_tier', 'Human-readable classification for why the rank feels right.'],
        ['market_context', 'Inflation and draft-room context for better decisions.'],
      ],
    },
  ];

  const planCards = [
    {
      name: 'Demo Key',
      price: '$0',
      note: 'shared access',
      body: 'Try the response shape, verify headers, and see how the product fits into your draft flow.',
      cta: 'Read Docs',
      href: '#docs',
      featured: false,
    },
    {
      name: 'DraftKit License',
      price: '$99',
      note: 'per season',
      body: 'Dedicated access for a real product integration with valuation, players, and onboarding support.',
      cta: 'See Pricing',
      href: '#pricing',
      featured: true,
    },
    {
      name: 'Platform',
      price: 'Custom',
      note: 'teams and partners',
      body: 'Best fit when you need multi-product rollout, onboarding help, or extended licensing terms.',
      cta: 'Talk Licensing',
      href: '#pricing',
      featured: false,
    },
  ];

  const responseFields = [
    ['nominated_player', 'The player your room is deciding on right now.'],
    ['max_bid_recommendation', 'The top bid the product should recommend in the live room.'],
    ['true_dollar_value', 'The baseline value used to frame whether the market is rich or cheap.'],
    ['player_tier', 'A short label that makes the ranking easier to trust.'],
    ['market_context', 'A concise market signal such as inflated, neutral, or discounted.'],
    ['reasoning', 'One readable explanation string for the user-facing UI.'],
  ];

  container.innerHTML = `
    <section class="api-shell-page page-enter">
      <div class="api-shell-layout">
        <aside class="api-shell-rail">
          <div class="api-shell-rail-panel">
            <div class="api-shell-rail-heading">
              <p class="api-shell-kicker">Workspace</p>
              <h2>API Shell</h2>
            </div>

            <nav class="api-shell-rail-section" aria-label="Homepage sections">
              <p class="api-shell-rail-label">Navigate</p>
              <button type="button" class="api-shell-rail-link active" data-scroll-target="home-overview">
                <span class="api-shell-rail-icon">OV</span>
                <span>Overview</span>
              </button>
              <button type="button" class="api-shell-rail-link" data-scroll-target="home-licensing">
                <span class="api-shell-rail-icon">LC</span>
                <span>Licensing</span>
              </button>
              <button type="button" class="api-shell-rail-link" data-scroll-target="home-integration">
                <span class="api-shell-rail-icon">IN</span>
                <span>Integration</span>
              </button>
              <button type="button" class="api-shell-rail-link" data-scroll-target="home-endpoints">
                <span class="api-shell-rail-icon">EP</span>
                <span>Endpoints</span>
              </button>
            </nav>

            <div class="api-shell-rail-divider"></div>

            <div class="api-shell-rail-section">
              <p class="api-shell-rail-label">Endpoints</p>
              ${endpointCards.map(card => `
                <button type="button" class="api-shell-endpoint-link" data-scroll-target="${card.id}">
                  <span class="api-shell-endpoint-copy">
                    <span class="api-shell-endpoint-path">${card.path}</span>
                    <span class="api-shell-endpoint-note">${card.title}</span>
                  </span>
                  <span class="api-shell-endpoint-method ${card.methodClass}">${card.method}</span>
                </button>
              `).join('')}
            </div>

            <div class="api-shell-rail-divider"></div>

            <div class="api-shell-rail-section">
              <p class="api-shell-rail-label">Authentication</p>
              <div class="api-shell-key-card">
                <span class="api-shell-key-label">X-License-Key</span>
                <code class="api-shell-key-value">${licenseKey}</code>
                <p class="api-shell-key-note">Use this header on every licensed request.</p>
              </div>
            </div>
          </div>
        </aside>

        <div class="api-shell-main">
          <section class="api-shell-overview card" id="home-overview">
            <div class="api-shell-overview-copy">
              <p class="api-shell-kicker">Dark Blue Valuation API</p>
              <h1>API workspace overview</h1>
              <p class="api-shell-lead">
                Check the key, inspect the live endpoints, and see exactly what your buyer receives before you wire the API into DraftKit.
              </p>
              <div class="api-shell-overview-meta">
                <span class="api-shell-inline-pill">Service live</span>
                <span class="api-shell-inline-pill">JSON output</span>
                <span class="api-shell-inline-pill">DraftKit ready</span>
              </div>
              <ul class="api-shell-quicksteps">
                <li>Use the demo or licensed header to authenticate every request.</li>
                <li>Load the player pool first, then call live valuations as the room changes.</li>
                <li>Use tier and reasoning fields to explain the recommendation in the UI.</li>
              </ul>
              <div class="api-shell-overview-actions">
                <a href="${primaryHref}" class="btn btn-primary">${primaryLabel}</a>
                <a href="#docs" class="btn btn-secondary">View API Docs</a>
              </div>
            </div>

            <div class="api-shell-overview-side">
              <div class="api-shell-stat-grid">
                <article class="api-shell-stat-card">
                  <span class="api-shell-stat-value">3</span>
                  <span class="api-shell-stat-label">core endpoints</span>
                </article>
                <article class="api-shell-stat-card">
                  <span class="api-shell-stat-value">Live</span>
                  <span class="api-shell-stat-label">draft support</span>
                </article>
                <article class="api-shell-stat-card">
                  <span class="api-shell-stat-value">1</span>
                  <span class="api-shell-stat-label">license header</span>
                </article>
                <article class="api-shell-stat-card">
                  <span class="api-shell-stat-value">JSON</span>
                  <span class="api-shell-stat-label">buyer-ready output</span>
                </article>
              </div>
            </div>
          </section>

          <div class="api-shell-primary-grid">
            <section class="api-shell-unlocks card" id="home-integration">
              <div class="api-shell-section-header">
                <div>
                  <p class="api-shell-kicker">What your key unlocks</p>
                  <h2>One licensed API for search, values, tiers, and room context.</h2>
                </div>
                <span class="badge badge-blue">Draft Ready</span>
              </div>
              <div class="api-shell-value-grid">
                ${valueCards.map(card => `
                  <article class="api-shell-value-card">
                    <h3>${card.title}</h3>
                    <p>${card.body}</p>
                  </article>
                `).join('')}
              </div>
            </section>

            <section class="api-shell-response card">
              <div class="api-shell-section-header">
                <div>
                  <p class="api-shell-kicker">What the buyer gets back</p>
                  <h2>Readable response fields, not black-box output.</h2>
                </div>
                <span class="badge badge-dark">POST /v1/valuate</span>
              </div>
              <div class="api-shell-response-list">
                ${responseFields.map(([field, desc]) => `
                  <div class="api-shell-response-row">
                    <code>${field}</code>
                    <p>${desc}</p>
                  </div>
                `).join('')}
              </div>
            </section>
          </div>

          <section class="api-shell-endpoints card" id="home-endpoints">
            <div class="api-shell-section-header">
              <div>
                <p class="api-shell-kicker">Endpoint overview</p>
                <h2>The three routes a draft product actually needs.</h2>
              </div>
              <a href="#docs" class="btn btn-secondary btn-sm">Open Docs</a>
            </div>

            <div class="api-shell-endpoint-stack">
              ${endpointCards.map(card => `
                <article class="api-shell-endpoint-card" id="${card.id}">
                  <div class="api-shell-endpoint-card-head">
                    <span class="api-shell-endpoint-method ${card.methodClass}">${card.method}</span>
                    <code>${card.path}</code>
                    <span class="api-shell-endpoint-title">${card.title}</span>
                  </div>
                  <p class="api-shell-endpoint-desc">${card.desc}</p>
                  <div class="api-shell-field-grid">
                    ${card.returns.map(([field, desc]) => `
                      <div class="api-shell-field-card">
                        <code>${field}</code>
                        <p>${desc}</p>
                      </div>
                    `).join('')}
                  </div>
                </article>
              `).join('')}
            </div>
          </section>

          <section class="api-shell-pricing" id="home-licensing">
            <div class="api-shell-pricing-header">
              <div>
                <p class="api-shell-kicker">Licensing</p>
                <h2>Pick the access level that fits your rollout.</h2>
              </div>
              <p class="api-shell-pricing-sub">
                Keep this simple: demo for evaluation, DraftKit license for deployment, platform terms for larger rollouts.
              </p>
            </div>

            <div class="api-shell-pricing-grid">
              ${planCards.map(plan => `
                <article class="api-shell-plan ${plan.featured ? 'featured' : ''}">
                  <div class="api-shell-plan-top">
                    <p class="api-shell-plan-name">${plan.name}</p>
                    <div class="api-shell-plan-price-row">
                      <span class="api-shell-plan-price">${plan.price}</span>
                      <span class="api-shell-plan-note">${plan.note}</span>
                    </div>
                  </div>
                  <p class="api-shell-plan-body">${plan.body}</p>
                  <a href="${plan.href}" class="api-shell-plan-link">${plan.cta}</a>
                </article>
              `).join('')}
            </div>
          </section>
        </div>
      </div>
    </section>
  `;

  container.querySelectorAll('[data-scroll-target]').forEach((node) => {
    node.addEventListener('click', function () {
      const target = container.querySelector(`#${this.dataset.scrollTarget}`);
      if (!target) return;

      container.querySelectorAll('.api-shell-rail-link.active').forEach((link) => {
        link.classList.remove('active');
      });
      if (this.classList.contains('api-shell-rail-link')) {
        this.classList.add('active');
      }

      const navHeight = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--nav-height'),
        10
      ) || 68;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 20;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
};
