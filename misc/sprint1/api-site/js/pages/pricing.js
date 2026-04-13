/**
 * pricing.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pricing page renderer.
 *
 * Sections:
 *   1. Page header        — headline + subtitle
 *   2. Tier card grid     — Draft Day (free), Pro ($99/season), Enterprise (custom)
 *   3. FAQ strip          — 5 common licensing questions
 *
 * CTA flow (fake auth):
 *   - "Start Free"       → goes directly to #docs (show them demo key)
 *   - "Get License Key"  → stores plan in DB.state.fromPlan → navigates to #signup
 *   - "Contact Sales"    → alert with email address
 *
 * Uses existing CSS classes from:
 *   pricing.css  — .pricing-header, .pricing-grid, .tier-card, .popular-ribbon,
 *                  .tier-name, .tier-price, .tier-features, .pricing-faq, .faq-item
 *   base.css     — .container, .label, .heading-xl, .heading-md, .mt-2
 *   components.css — .btn, .btn-primary, .btn-secondary, .btn-full, .badge
 * ─────────────────────────────────────────────────────────────────────────────
 */

window.DB = window.DB || {};
DB.pages  = DB.pages || {};

DB.pages.pricing = function (container) {

  /* ── Tier definitions ─────────────────────────────────────────────────────
     features: string → included, { text, missing: true } → not included.
  ─────────────────────────────────────────────────────────────────────────── */
  var TIERS = [
    {
      id:      'starter',
      name:    'Draft Day',
      price:   '$0',
      period:  '',
      tagline: 'Try the API with the shared demo key. Perfect for evaluation and one-off drafts.',
      cta:     'Start Free',
      ctaCls:  'btn-secondary',
      features: [
        'Shared demo key — DB-2026-DEMO-0001',
        'Full access to /v1/valuate endpoint',
        '20 req / 15 min rate limit (shared)',
        'Full NL player pool (313 players)',
        'JSON response with reasoning string',
        { text: 'Dedicated license key',     missing: true },
        { text: 'Commercial use rights',     missing: true },
        { text: 'Multi-platform license',    missing: true },
      ],
    },
    {
      id:      'pro',
      name:    'Pro',
      price:   '$99',
      period:  '/ season',
      tagline: 'One key. One platform. Full auction season coverage without rate limit anxiety.',
      cta:     'Get Your License Key',
      ctaCls:  'btn-primary',
      popular: true,
      features: [
        'Dedicated license key (yours alone)',
        'Unlimited requests per season',
        'Commercial use — 1 platform',
        'Full player pool + all scoring configs',
        'JSON response + human reasoning string',
        'Email support within 48 h',
        { text: 'Multi-platform license',    missing: true },
        { text: 'White-label branding',      missing: true },
      ],
    },
    {
      id:      'enterprise',
      name:    'Enterprise',
      price:   'Custom',
      period:  '',
      tagline: 'Multi-platform distribution, SLA guarantees, and white-label rights for platforms.',
      cta:     'Contact Sales',
      ctaCls:  'btn-secondary',
      features: [
        'Multi-platform license key(s)',
        'Unlimited requests + burst allowance',
        'Commercial use — unlimited platforms',
        'White-label branding option',
        'Custom player pool update schedule',
        'Dedicated SLA + uptime guarantee',
        'Priority support + onboarding session',
        'Custom scoring category additions',
      ],
    },
  ];

  /* ── FAQ data ─────────────────────────────────────────────────────────────── */
  var FAQS = [
    {
      q: 'What counts as one "season"?',
      a: 'A Pro license covers one full MLB auction draft season — typically February through late August. Licenses expire at season end and renew at the same rate.',
    },
    {
      q: 'Can I use the API in a commercial draft kit product?',
      a: 'Yes — Pro includes commercial use rights for a single platform. Enterprise licenses extend that to unlimited platforms with optional white-labeling.',
    },
    {
      q: 'Is there a request limit on Pro?',
      a: 'Pro is effectively unlimited for realistic auction draft usage. Burst protection only activates for sustained automated abuse (> 1 req/sec). Normal draft tools will never hit it.',
    },
    {
      q: 'What happens if I hit the Demo key limit?',
      a: 'The API returns HTTP 429 with a Retry-After header indicating when your window resets. The demo key is shared across all demo users and resets every 15 minutes.',
    },
    {
      q: 'Do you offer refunds?',
      a: 'Yes — request a refund within 7 days of purchase and fewer than 50 API calls made for a full refund. No questions asked.',
    },
  ];

  /* ── Render a single tier card ────────────────────────────────────────────── */
  function _renderTier(tier) {
    var popularBadge = tier.popular
      ? '<div class="popular-ribbon">Most Popular</div>'
      : '';

    var featureItems = tier.features.map(function (f) {
      if (typeof f === 'string') return '<li>' + f + '</li>';
      return '<li class="' + (f.missing ? 'missing' : '') + '">' + f.text + '</li>';
    }).join('');

    return (
      '<div class="tier-card ' + (tier.popular ? 'popular' : '') + '">' +
        popularBadge +
        '<div class="tier-name">' + tier.name + '</div>' +
        '<div class="tier-price">' +
          '<span class="tier-price-amount">' + tier.price + '</span>' +
          (tier.period ? '<span class="tier-price-period">' + tier.period + '</span>' : '') +
        '</div>' +
        '<p class="tier-tagline">' + tier.tagline + '</p>' +
        '<div class="tier-divider"></div>' +
        '<ul class="tier-features">' + featureItems + '</ul>' +
        '<button ' +
          'class="btn ' + tier.ctaCls + ' btn-full" ' +
          'data-plan="' + tier.id + '" ' +
          'onclick="DB.pages._pricingCTA(\'' + tier.id + '\')"' +
        '>' + tier.cta + '</button>' +
      '</div>'
    );
  }

  /* ── Render FAQ items ─────────────────────────────────────────────────────── */
  var faqHtml = FAQS.map(function (f) {
    return (
      '<div class="faq-item">' +
        '<div class="faq-q">' + f.q + '</div>' +
        '<div class="faq-a">' + f.a  + '</div>' +
      '</div>'
    );
  }).join('');

  /* ── Inject page HTML ─────────────────────────────────────────────────────── */
  container.innerHTML = (
    /* Page header */
    '<div class="pricing-header container">' +
      '<p class="label">Licensing</p>' +
      '<h1 class="heading-xl mt-2">One API. Three ways to license it.</h1>' +
      '<p>Start free with the shared demo key. Upgrade when you\'re ready for production.</p>' +
    '</div>' +

    /* Tier grid */
    '<div class="container">' +
      '<div class="pricing-grid">' +
        TIERS.map(_renderTier).join('') +
      '</div>' +
    '</div>' +

    /* FAQ */
    '<div class="pricing-faq container">' +
      '<h2 class="heading-md">Common questions</h2>' +
      faqHtml +
    '</div>'
  );

  /* ── CTA click handler (attached to window.DB.pages so inline onclick works) ──
     Called from each tier card's onclick attribute.
  ─────────────────────────────────────────────────────────────────────────────── */
  DB.pages._pricingCTA = function (planId) {
    if (planId === 'enterprise') {
      // Enterprise: surface contact info (replace with a real form in production)
      window.alert(
        'Enterprise Sales\n\n' +
        'Email: api@darkblue.io\n' +
        'We respond within one business day with a custom pricing proposal.'
      );
      return;
    }

    if (planId === 'starter') {
      // Free tier: send them to the docs to see the demo key immediately
      DB.router.go('docs');
      return;
    }

    // Pro: save the intended plan so the signup page can pre-select it
    DB.state.fromPlan = planId;

    if (DB.state.user) {
      // Already logged in — just go to dashboard where the key is displayed
      DB.router.go('dashboard');
    } else {
      DB.router.go('signup');
    }
  };

};
