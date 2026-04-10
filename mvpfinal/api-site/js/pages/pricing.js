window.DB = window.DB || {};
DB.pages = DB.pages || {};

DB.pages.pricing = function (container) {
  const tiers = [
    {
      id: 'starter',
      name: 'Draft Day',
      price: '$0',
      period: 'shared demo key',
      featured: false,
      blurb: 'See the response shape and test the player endpoints before you buy.',
      features: [
        'Shared demo key',
        'Core player and valuation endpoints',
        'Best for evaluation and class review',
      ],
      cta: 'Start Free',
      ctaClass: 'plan-cta-outline',
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$99',
      period: 'per season',
      featured: true,
      blurb: 'The cleanest path for a real DraftKit deployment with a dedicated key.',
      features: [
        'Dedicated license key',
        'Player pool, tiers, and live bid guidance',
        'Built for real draft-day usage',
      ],
      cta: 'Get License Key',
      ctaClass: 'plan-cta-primary',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Custom',
      period: 'multi-platform',
      featured: false,
      blurb: 'For broader rollout, white-label plans, or custom onboarding support.',
      features: [
        'Multi-product licensing',
        'Higher-touch rollout support',
        'Best fit for serious platform scale',
      ],
      cta: 'Request Access',
      ctaClass: 'plan-cta-outline',
    },
  ];

  const useCases = [
    {
      title: '/health',
      body: 'Confirms the service is ready before your draft tool starts making calls.',
    },
    {
      title: '/v1/players',
      body: 'Returns the player pool plus ranking context that your UI can display before the auction starts.',
    },
    {
      title: '/v1/valuate',
      body: 'Returns the number buyers care about most: max bid guidance plus tier and market context.',
    },
  ];

  const faqs = [
    {
      q: 'What does the key actually unlock?',
      a: 'It unlocks authenticated access to the player pool and valuation endpoints so your draft product can request live bid guidance.',
    },
    {
      q: 'Why would I upgrade from the demo key?',
      a: 'The demo key is good for evaluation. A paid key is the cleaner path for real product usage and repeated draft-day traffic.',
    },
    {
      q: 'What does the API return that the draft room can show?',
      a: 'The core return values are max bid recommendation, true dollar value, player tier, market context, and a readable reasoning string.',
    },
  ];

  container.innerHTML = `
    <section class="pricing-shell-hero">
      <div class="container pricing-shell-grid">
        <div>
          <p class="label">Licensing</p>
          <h1 class="heading-lg pricing-shell-title">
            Buy the key. Call the endpoints. Show the draft room what matters.
          </h1>
          <p class="subheading pricing-shell-sub">
            The pricing page stays simple. Buyers want to know what they get, what key they use,
            and what the response unlocks inside DraftKit.
          </p>
          <div class="pricing-shell-actions">
            <a href="#docs" class="btn btn-secondary">View API Docs</a>
            <a href="#signup" class="btn btn-primary">Claim a Key</a>
          </div>
        </div>

        <div class="pricing-shell-summary card">
          <div class="pricing-shell-summary-row">
            <span class="pricing-shell-summary-label">X-License-Key</span>
            <code class="pricing-shell-summary-code">${DB.state.licenseKey || DB.DEMO_KEY}</code>
          </div>
          <div class="pricing-shell-summary-grid">
            <div>
              <span class="pricing-shell-summary-kicker">Buyer outcome</span>
              <p>Get player values, tiers, and market context into the draft room.</p>
            </div>
            <div>
              <span class="pricing-shell-summary-kicker">What returns</span>
              <p><code>max_bid_recommendation</code>, <code>true_dollar_value</code>, <code>player_tier</code>, <code>reasoning</code></p>
            </div>
            <div>
              <span class="pricing-shell-summary-kicker">Main endpoints</span>
              <p><code>/health</code>, <code>/v1/players</code>, <code>/v1/valuate</code></p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section pricing-shell-section">
      <div class="container">
        <div class="pricing-shell-header">
          <div>
            <p class="label">Plans</p>
            <h2 class="heading-md pricing-shell-section-title">Pick the key that fits your rollout</h2>
          </div>
          <p class="pricing-shell-caption">Keep the decision short and readable. Demo, Pro, or Enterprise.</p>
        </div>

        <div class="pricing-shell-card-grid">
          ${tiers.map(tier => `
            <article class="pricing-shell-card ${tier.featured ? 'featured' : ''}">
              ${tier.featured ? '<span class="pricing-shell-card-badge">Recommended</span>' : ''}
              <p class="pricing-shell-card-label">${tier.name}</p>
              <div class="pricing-shell-card-price">${tier.price}</div>
              <p class="pricing-shell-card-period">${tier.period}</p>
              <p class="pricing-shell-card-blurb">${tier.blurb}</p>
              <ul class="pricing-shell-list">
                ${tier.features.map(item => `<li>${item}</li>`).join('')}
              </ul>
              <button class="plan-cta ${tier.ctaClass}" onclick="DB.pages._pricingCTA('${tier.id}')">${tier.cta}</button>
            </article>
          `).join('')}
        </div>
      </div>
    </section>

    <section class="section pricing-shell-usecases">
      <div class="container">
        <p class="label">What the buyer needs to know</p>
        <h2 class="heading-md pricing-shell-section-title">What each endpoint gives them</h2>
        <div class="pricing-shell-usecase-grid">
          ${useCases.map(item => `
            <article class="pricing-shell-usecase-card">
              <h3>${item.title}</h3>
              <p>${item.body}</p>
            </article>
          `).join('')}
        </div>
      </div>
    </section>

    <section class="section pricing-shell-faq">
      <div class="container container-narrow">
        <p class="label text-center">FAQ</p>
        <h2 class="heading-md pricing-shell-section-title text-center">Short answers for the buying decision</h2>
        <div class="pricing-shell-faq-list">
          ${faqs.map(item => `
            <article class="pricing-shell-faq-item">
              <h3>${item.q}</h3>
              <p>${item.a}</p>
            </article>
          `).join('')}
        </div>
      </div>
    </section>
  `;

  DB.pages._pricingCTA = function (planId) {
    if (planId === 'starter') {
      DB.router.go('docs');
      return;
    }

    DB.state.fromPlan = planId;

    if (DB.state.user) {
      DB.router.go('dashboard');
    } else {
      DB.router.go('signup');
    }
  };
};
