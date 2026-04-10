window.DB = window.DB || {};
DB.pages = DB.pages || {};

DB.pages.home = function (container) {
  const licenseKey = DB.state.licenseKey || DB.DEMO_KEY;
  const primaryHref = DB.state.user ? '#dashboard' : '#pricing';
  const primaryLabel = DB.state.user ? 'Open Dashboard' : 'Get Your License Key';

  const endpointCards = [
    {
      method: 'GET',
      methodClass: 'method-get',
      path: '/health',
      desc: 'Check availability before your draft tools send a request.',
      returns: ['status', 'uptime', 'version'],
    },
    {
      method: 'GET',
      methodClass: 'method-get',
      path: '/v1/players?league=NL',
      desc: 'Load the player pool, rank context, and tier visibility for your league.',
      returns: ['players', 'overall_rank', 'tier_rank', 'player_tier'],
    },
    {
      method: 'POST',
      methodClass: 'method-post',
      path: '/v1/valuate',
      desc: 'Get live bid guidance for the nominated player using current draft state.',
      returns: ['max_bid_recommendation', 'true_dollar_value', 'market_context', 'reasoning'],
    },
  ];

  const planCards = [
    {
      name: 'Draft Day',
      price: '$0',
      period: 'shared demo key',
      featured: false,
      features: [
        'Try the core endpoints with the demo key',
        'Best for evaluation and class review',
        'Great for understanding the response shape',
      ],
      cta: 'Try Demo',
      href: '#docs',
      ctaClass: 'plan-cta-outline',
    },
    {
      name: 'Pro',
      price: '$99',
      period: 'per season',
      featured: true,
      features: [
        'Dedicated license key for your product',
        'Live player values, tiers, and market context',
        'Built for real draft-day usage',
      ],
      cta: 'Get License Key',
      href: '#pricing',
      ctaClass: 'plan-cta-primary',
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'multi-platform',
      featured: false,
      features: [
        'Custom rollout and white-label support',
        'Multi-team or multi-product licensing',
        'Best fit for serious platform deployment',
      ],
      cta: 'View Plans',
      href: '#pricing',
      ctaClass: 'plan-cta-outline',
    },
  ];

  const responseJson = `{
  "nominated_player": "Juan Soto",
  "max_bid_recommendation": 47,
  "true_dollar_value": 52.3,
  "player_tier": "Elite",
  "market_context": { "label": "inflated", "delta_percent": 8 },
  "reasoning": "High floor bat with premium OBP and stable playing time."
}`;

  container.innerHTML = `
    <section class="api-home-hero">
      <div class="container api-home-hero-grid">
        <div class="api-home-hero-copy">
          <p class="api-home-eyebrow">Licensed Valuation API</p>
          <h1 class="api-home-headline">
            Draft smarter with real valuations, not just rankings.
          </h1>
          <p class="api-home-sub">
            Dark Blue gives DraftKit and fantasy baseball platforms a licensed API for player pools,
            live bid guidance, tiers, and market context during auction drafts.
          </p>
          <div class="api-home-actions">
            <a href="${primaryHref}" class="btn btn-primary btn-lg">${primaryLabel}</a>
            <a href="#docs" class="btn btn-secondary btn-lg">View API Docs</a>
          </div>
          <div class="api-home-metrics">
            <div class="api-home-metric">
              <span class="api-home-metric-value">3</span>
              <span class="api-home-metric-label">core endpoints</span>
            </div>
            <div class="api-home-metric">
              <span class="api-home-metric-value">1</span>
              <span class="api-home-metric-label">license key</span>
            </div>
            <div class="api-home-metric">
              <span class="api-home-metric-value">Live</span>
              <span class="api-home-metric-label">draft support</span>
            </div>
          </div>
        </div>

        <div class="api-home-hero-panel card">
          <div class="api-home-panel-header">
            <div>
              <p class="api-home-panel-kicker">What your key unlocks</p>
              <h2>One API for player pool, tiers, and bid guidance</h2>
            </div>
            <span class="badge badge-blue">Draft Ready</span>
          </div>
          <div class="api-home-key-strip">
            <span class="api-home-key-label">X-License-Key</span>
            <code class="api-home-key-value">${licenseKey}</code>
          </div>
          <div class="api-home-value-grid">
            <article class="api-home-value-card">
              <h3>Player pool</h3>
              <p>Pull the eligible player list before the room opens.</p>
            </article>
            <article class="api-home-value-card">
              <h3>Live values</h3>
              <p>See what the nominated player is worth right now.</p>
            </article>
            <article class="api-home-value-card">
              <h3>Tier context</h3>
              <p>Give the draft room a simpler explanation for why players rank where they do.</p>
            </article>
            <article class="api-home-value-card">
              <h3>Market context</h3>
              <p>Show when the room is spending above or below baseline value.</p>
            </article>
          </div>
        </div>
      </div>
    </section>

    <section class="api-home-strip">
      <div class="container api-home-strip-inner">
        <span>Built for DraftKit integration</span>
        <span class="api-home-strip-divider"></span>
        <span>Demo key and dedicated key flows</span>
        <span class="api-home-strip-divider"></span>
        <span>Buyer-friendly API onboarding</span>
      </div>
    </section>

    <section class="section api-home-section api-home-section-light">
      <div class="container">
        <p class="label">What you call</p>
        <h2 class="heading-lg api-home-section-title">The three endpoints a draft product actually needs</h2>
        <p class="subheading api-home-section-sub">
          The landing page stays simple. Your buyer only needs to know what each endpoint gives them,
          what key they use, and how the response helps the draft room.
        </p>

        <div class="api-home-endpoints-grid">
          ${endpointCards.map(card => `
            <article class="api-home-endpoint-card">
              <div class="api-home-endpoint-header">
                <span class="api-home-method ${card.methodClass}">${card.method}</span>
                <code class="api-home-endpoint-path">${card.path}</code>
              </div>
              <div class="api-home-endpoint-body">
                <p>${card.desc}</p>
                <div class="api-home-return-block">
                  <span class="api-home-return-label">Returns</span>
                  <div class="api-home-return-tags">
                    ${card.returns.map(tag => `<span class="api-home-return-tag">${tag}</span>`).join('')}
                  </div>
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    </section>

    <section class="section api-home-section api-home-section-dark">
      <div class="container api-home-proof-grid">
        <div>
          <p class="label">What the response gives you</p>
          <h2 class="heading-lg api-home-section-title api-home-section-title-inverse">
            Give the buyer the number, the tier, and the reason.
          </h2>
          <p class="subheading api-home-section-sub api-home-section-sub-inverse">
            A draft room does not just want a score. It wants a bid ceiling, a tier label, and enough
            market context to explain the recommendation on the spot.
          </p>
          <ul class="api-home-proof-list">
            <li>Max bid recommendation for the nominated player</li>
            <li>True dollar value to compare against market behavior</li>
            <li>Tier and market context for quick explanation</li>
            <li>Readable reasoning string for the UI</li>
          </ul>
        </div>
        <div class="code-block">
          <div class="code-block-header">
            <span class="code-block-lang">Sample Response</span>
            <span class="badge badge-dark">POST /v1/valuate</span>
          </div>
          <pre class="code-pre">
<span class="tok-key">"nominated_player"</span>: <span class="tok-str">"Juan Soto"</span>
<span class="tok-key">"max_bid_recommendation"</span>: <span class="tok-num">47</span>
<span class="tok-key">"true_dollar_value"</span>: <span class="tok-num">52.3</span>
<span class="tok-key">"player_tier"</span>: <span class="tok-str">"Elite"</span>
<span class="tok-key">"market_context"</span>: <span class="tok-str">"inflated"</span>
<span class="tok-key">"reasoning"</span>: <span class="tok-str">"High floor bat with stable role."</span></pre>
        </div>
      </div>
    </section>

    <section class="section api-home-section api-home-section-light">
      <div class="container">
        <p class="label">Licensing</p>
        <h2 class="heading-lg api-home-section-title">Choose the key that fits your draft product</h2>
        <p class="subheading api-home-section-sub">
          Start with the demo key, then move to a dedicated license once you are ready to plug the API into DraftKit
          or your own interface.
        </p>

        <div class="api-home-plan-grid">
          ${planCards.map(plan => `
            <article class="api-home-plan-card ${plan.featured ? 'featured' : ''}">
              ${plan.featured ? '<span class="api-home-plan-badge">Recommended</span>' : ''}
              <p class="api-home-plan-name">${plan.name}</p>
              <div class="api-home-plan-price-row">
                <span class="api-home-plan-price">${plan.price}</span>
                <span class="api-home-plan-period">${plan.period}</span>
              </div>
              <ul class="api-home-plan-list">
                ${plan.features.map(feature => `<li>${feature}</li>`).join('')}
              </ul>
              <a href="${plan.href}" class="plan-cta ${plan.ctaClass}">${plan.cta}</a>
            </article>
          `).join('')}
        </div>
      </div>
    </section>

    <section class="api-home-cta">
      <div class="container api-home-cta-inner">
        <div>
          <p class="label">Ready to connect it?</p>
          <h2 class="heading-md api-home-cta-title">License the API, test the endpoints, and plug it into your draft flow.</h2>
        </div>
        <div class="api-home-actions">
          <a href="#pricing" class="btn btn-primary">See Plans</a>
          <a href="#docs" class="btn btn-secondary">Read Docs</a>
        </div>
      </div>
    </section>
  `;
};
