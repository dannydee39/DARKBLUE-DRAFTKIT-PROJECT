/**
 * license.js — License tab renderer.
 *
 * Sections:
 *   1. Header          — one-liner about the API
 *   2. Authentication  — X-License-Key header, demo key, copy button
 *   3. What you get    — response fields from /v1/valuate
 *   4. Integration     — 3-step quick start
 *   5. Plans           — Demo vs DraftKit License (small, subordinate)
 */

window.DB = window.DB || {};
DB.pages  = DB.pages || {};

DB.pages.license = function (container) {

  var KEY     = DB.DEMO_KEY;
  var DISPLAY = DB.API_DISPLAY;

  container.innerHTML =
    '<div class="page-license">' +
      '<div class="license-container">' +

        /* ── Header ──────────────────────────────────────────────────────── */
        '<header class="license-header">' +
          '<p class="license-kicker">Dark Blue Valuation API</p>' +
          '<h1>License & integrate in minutes.</h1>' +
          '<p class="license-lead">' +
            'One API key, three endpoints, real-time auction draft intelligence ' +
            'for fantasy baseball products.' +
          '</p>' +
        '</header>' +

        /* ── Authentication ──────────────────────────────────────────────── */
        '<section class="license-section" id="lic-auth">' +
          '<div class="license-section-label">Authentication</div>' +
          '<h2>Every request needs one header.</h2>' +
          '<p>Include <code>X-License-Key</code> on every call except ' +
          '<code>/health</code>. That\u2019s it \u2014 no OAuth, no tokens, no sessions.</p>' +

          '<div class="license-key-block">' +
            '<div class="license-key-row">' +
              '<span class="license-key-label">Header</span>' +
              '<code class="license-key-mono">X-License-Key</code>' +
            '</div>' +
            '<div class="license-key-row">' +
              '<span class="license-key-label">Demo Key</span>' +
              '<code class="license-key-mono license-key-value">' + KEY + '</code>' +
              '<button class="license-copy-btn" id="lic-copy-key">Copy</button>' +
            '</div>' +
          '</div>' +

          '<div class="license-key-notes">' +
            '<div class="license-note">' +
              '<strong>Demo key</strong> \u2014 shared across all evaluators. ' +
              'Use it to verify the response shape, test authentication, and wire ' +
              'up the main endpoints before class review.' +
            '</div>' +
            '<div class="license-note">' +
              '<strong>Licensed key</strong> \u2014 dedicated, one per buyer. ' +
              'Use it when moving from demo/testing into real DraftKit integration.' +
            '</div>' +
            '<div class="license-note">' +
              '<strong>Rate limiting</strong> \u2014 the current API server applies ' +
              'a flat limit of 120 requests per minute per IP. Keep retries modest and ' +
              'watch for <code>429</code> responses.' +
            '</div>' +
          '</div>' +
        '</section>' +

        /* ── What You Get ────────────────────────────────────────────────── */
        '<section class="license-section" id="lic-response">' +
          '<div class="license-section-label">Response</div>' +
          '<h2>What the API returns.</h2>' +
          '<p>Call <code>POST /v1/valuate</code> with your current draft state. ' +
          'The response gives your UI everything it needs:</p>' +

          '<div class="license-fields">' +
            _field('max_bid_recommendation', 'integer',
              'The number to bid. Includes an 8% safety margin \u2014 never go above this.') +
            _field('true_dollar_value', 'float',
              'Raw calculated value before the safety margin. Good for comparison views.') +
            _field('reasoning', 'string',
              'One human-readable sentence combining tier, scarcity, and inflation context.') +
            _field('position_scarcity', 'object',
              'Position, multiplier (1.00\u20131.45), tier (CRITICAL/HIGH/MEDIUM/LOW), open slots, eligible players.') +
            _field('inflation_factor', 'float',
              'Whether the room is spending hot or cold relative to expected pace.') +
            _field('base_value', 'float',
              'SGP base value before scarcity and inflation adjustments.') +
          '</div>' +

          '<p class="license-aside">' +
            '<code>GET /v1/players</code> returns the full player pool with tiers, ' +
            'ranks, projected stats, and base values \u2014 everything the board needs before ' +
            'the first nomination.' +
          '</p>' +
        '</section>' +

        /* ── Integration ─────────────────────────────────────────────────── */
        '<section class="license-section" id="lic-integrate">' +
          '<div class="license-section-label">Quick Start</div>' +
          '<h2>Three steps to live valuations.</h2>' +

          '<ol class="license-steps">' +
            '<li>' +
              '<div class="license-step-num">1</div>' +
              '<div class="license-step-copy">' +
                '<strong>Set the header.</strong>' +
                '<p>Add <code>X-License-Key: ' + KEY + '</code> to every request. ' +
                'The header is the same for all three endpoints.</p>' +
              '</div>' +
            '</li>' +
            '<li>' +
              '<div class="license-step-num">2</div>' +
              '<div class="license-step-copy">' +
                '<strong>Load the player pool.</strong>' +
                '<p>Call <code>GET ' + DISPLAY + '/v1/players</code> at startup. ' +
                'Use the response to populate your draft board, search, and tier views.</p>' +
              '</div>' +
            '</li>' +
            '<li>' +
              '<div class="license-step-num">3</div>' +
              '<div class="license-step-copy">' +
                '<strong>Valuate on nomination.</strong>' +
                '<p>Call <code>POST ' + DISPLAY + '/v1/valuate</code> with the full draft ' +
                'state each time a player is nominated. The response tells your UI exactly ' +
                'what to bid and why.</p>' +
              '</div>' +
            '</li>' +
          '</ol>' +
        '</section>' +

        /* ── Plans ───────────────────────────────────────────────────────── */
        '<section class="license-section license-plans-section" id="lic-plans">' +
          '<div class="license-section-label">Plans</div>' +
          '<h2>Two tiers. No surprises.</h2>' +

          '<div class="license-plans">' +
            '<div class="license-plan">' +
              '<div class="license-plan-header">' +
                '<span class="license-plan-name">Demo</span>' +
                '<span class="license-plan-price">Free</span>' +
              '</div>' +
              '<ul>' +
                '<li>Shared key: <code>' + KEY + '</code></li>' +
                '<li>Shared evaluation key</li>' +
                '<li>All three endpoints</li>' +
                '<li>Full response shape</li>' +
              '</ul>' +
            '</div>' +
            '<div class="license-plan license-plan-featured">' +
              '<div class="license-plan-header">' +
                '<span class="license-plan-name">DraftKit License</span>' +
                '<span class="license-plan-price">$99 <span class="license-plan-unit">/ season</span></span>' +
              '</div>' +
              '<ul>' +
                '<li>Dedicated key per buyer</li>' +
                '<li>Same core API contract</li>' +
                '<li>All three endpoints</li>' +
                '<li>Production use in DraftKit</li>' +
              '</ul>' +
            '</div>' +
          '</div>' +
        '</section>' +

        /* ── Footer ──────────────────────────────────────────────────────── */
        '<footer class="license-footer">' +
          '<span>API Base: <code>' + DISPLAY + '</code></span>' +
        '</footer>' +

      '</div>' +
    '</div>';

  /* ── Bind copy button ──────────────────────────────────────────────────── */
  var copyBtn = document.getElementById('lic-copy-key');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(KEY).then(function () {
        copyBtn.textContent = 'Copied';
        copyBtn.classList.add('copied');
        setTimeout(function () {
          copyBtn.textContent = 'Copy';
          copyBtn.classList.remove('copied');
        }, 2000);
      }).catch(function () {});
    });
  }

  /* ── Helper: render a response field row ───────────────────────────────── */
  function _field(name, type, desc) {
    return (
      '<div class="license-field">' +
        '<div class="license-field-head">' +
          '<code>' + name + '</code>' +
          '<span class="license-field-type">' + type + '</span>' +
        '</div>' +
        '<p>' + desc + '</p>' +
      '</div>'
    );
  }
};
