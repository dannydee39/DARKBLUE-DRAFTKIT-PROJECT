/**
 * pricing.js — Dedicated pricing tab.
 *
 * Pulls the plan cards out of the License page so the license overview can
 * stay tight and marketing / billing details live on their own surface.
 */

window.DB = window.DB || {};
DB.pages = DB.pages || {};

DB.pages.pricing = function (container) {
  var KEY = DB.DEMO_KEY;

  container.innerHTML =
    '<div class="page-pricing">' +
      '<div class="license-container">' +
        '<header class="license-header pricing-hero">' +
          '<p class="license-kicker">Pricing</p>' +
          '<h1>One license. One key. One seasonal price.</h1>' +
          '<p class="license-lead">' +
            'Start on the shared test key to validate the contract, then pick up a ' +
            'dedicated seasonal license when you are ready to ship into production.' +
          '</p>' +
        '</header>' +

        '<section class="license-section license-plans-section" id="pricing-plans">' +
          '<div class="license-plans">' +
            _planCard('Test Access', 'Free', [
              'Shared live test key',
              'Valuation, player data, depth, and news demo endpoints',
              'For onboarding and contract validation',
            ], '<a class="btn btn-secondary btn-sm" href="#endpoints">Open Endpoints</a>', false) +

            _planCard('DraftKit License', '$99 <span class="license-plan-unit">/ season</span>', [
              'Dedicated buyer key',
              '25k requests / month included',
              'Server-side production use',
              'Buyer dashboard on the Account tab',
            ], '<button type="button" class="btn btn-primary btn-sm" id="pricing-start-cta">Start a License</button>', true) +
          '</div>' +
        '</section>' +

        '<section class="license-section" id="pricing-faq">' +
          '<div class="license-section-label">FAQ</div>' +
          '<h2>Quick answers.</h2>' +
          '<div class="pricing-faq-grid">' +
            _faqCard(
              'What counts as a request?',
              'Any successful call to <code>/v1/players</code> or one full-state call to <code>/v1/valuate</code>. ' +
              '<code>/health</code> is free and never metered.'
            ) +
            _faqCard(
              'What happens at the limit?',
              'Requests above the monthly allowance return <code>429</code>. You can handle those with modest retries or upgrade the allowance per season.'
            ) +
            _faqCard(
              'Can I rotate the key?',
              'Yes. Dedicated keys follow the same <code>X-License-Key</code> header shape, so rotation is a one-line change in your backend.'
            ) +
            _faqCard(
              'How is this different from Draft Kit?',
              'Draft Kit is its own product with its own login and cloud drafts. The valuation API is the licensed engine behind it. You can license the engine without using Draft Kit.'
            ) +
          '</div>' +
        '</section>' +

        '<footer class="license-footer">' +
          '<span>Billing is manual today. After you create an account on this site, reach out to set up the seasonal license.</span>' +
        '</footer>' +
      '</div>' +
    '</div>';

  var cta = container.querySelector('#pricing-start-cta');
  if (cta) {
    cta.addEventListener('click', function () {
      var user = DB.auth && DB.auth.current && DB.auth.current();
      if (user) {
        DB.router.go('account');
      } else if (DB.authModal) {
        DB.authModal.open('signup');
      }
    });
  }

  function _planCard(name, price, items, cta, featured) {
    return (
      '<div class="license-plan' + (featured ? ' license-plan-featured' : '') + '">' +
        '<div class="license-plan-header">' +
          '<span class="license-plan-name">' + name + '</span>' +
          '<span class="license-plan-price">' + price + '</span>' +
        '</div>' +
        '<ul>' + items.map(function (item) { return '<li>' + item + '</li>'; }).join('') + '</ul>' +
        '<div class="license-plan-cta">' + cta + '</div>' +
      '</div>'
    );
  }

  function _faqCard(q, a) {
    return (
      '<article class="pricing-faq-card">' +
        '<h3>' + q + '</h3>' +
        '<p>' + a + '</p>' +
      '</article>'
    );
  }
};
