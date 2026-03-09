/**
 * home.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Landing / home page renderer.
 *
 * Sections rendered (in order):
 *   1. Hero          — gradient banner, headline, CTAs, live response preview
 *   2. Trust strip   — social-proof stats
 *   3. Features grid — six value-prop cards
 *   4. How it works  — 3-step walkthrough
 *   5. Formula peek  — formula breakdown highlight
 *   6. CTA banner    — bottom conversion section
 * ─────────────────────────────────────────────────────────────────────────────
 */

window.DB = window.DB || {};
DB.pages  = DB.pages || {};

DB.pages.home = function (container) {

  /* ── Sample API response displayed in the hero code preview ─────────────── */
  const SAMPLE_RESPONSE = `<span class="tok-cmt">// POST /v1/valuate — response</span>
{
  <span class="tok-key">"nominated_player"</span>:      <span class="tok-str">"Shohei Ohtani"</span>,
  <span class="tok-key">"max_bid_recommendation"</span>: <span class="tok-num">69</span>,
  <span class="tok-key">"true_dollar_value"</span>:       <span class="tok-num">74.8</span>,
  <span class="tok-key">"reasoning"</span>:               <span class="tok-str">"Two-way elite. DH scarcity (1.12×). Inflation 1.08×."</span>,
  <span class="tok-key">"position_scarcity"</span>: {
    <span class="tok-key">"position"</span>:   <span class="tok-str">"DH"</span>,
    <span class="tok-key">"multiplier"</span>: <span class="tok-num">1.12</span>
  },
  <span class="tok-key">"inflation_factor"</span>:         <span class="tok-num">1.08</span>
}`;

  /* ── Feature card data ───────────────────────────────────────────────────── */
  const FEATURES = [
    {
      icon: '⚡',
      title: 'Real-time in &lt;200ms',
      desc:  'Sub-200ms median response. Fast enough for live auction momentum — no waiting, no guessing.',
    },
    {
      icon: '📐',
      title: 'SGP + Scarcity Algorithm',
      desc:  'Standings Gain Points scoring combined with live position scarcity and budget inflation calculations.',
    },
    {
      icon: '🔑',
      title: 'License Key Auth',
      desc:  'Every request authenticated via X-License-Key header. Rate limiting and CORS protection built in.',
    },
    {
      icon: '🗂',
      title: 'Any Roster Config',
      desc:  'Pass your own roster_config object. Works for any NL, AL, or mixed league with any slot structure.',
    },
    {
      icon: '📦',
      title: '313 Pre-loaded Players',
      desc:  'Full NL player pool pre-loaded with projected stats. No client-side data required.',
    },
    {
      icon: '🔌',
      title: 'Drop-in Integration',
      desc:  'Single POST endpoint. Returns JSON. Works from any frontend, mobile app, or server-side script.',
    },
  ];

  /* ── How it works steps ─────────────────────────────────────────────────── */
  const STEPS = [
    {
      num:   '1',
      title: 'Send your draft state',
      body:  'POST the nominated player name, each team\'s current roster and remaining budget, and your league\'s scoring categories.',
    },
    {
      num:   '2',
      title: 'The engine runs the math',
      body:  'SGP scoring, position scarcity analysis, and inflation factor are computed live against the current undrafted player pool.',
    },
    {
      num:   '3',
      title: 'Get back a precise max bid',
      body:  'Receive a recommended max bid, the player\'s true dollar value, and a human-readable reasoning string — in one response.',
    },
  ];

  /* ── Render ─────────────────────────────────────────────────────────────── */
  container.innerHTML = `

    <!-- ① Hero -->
    <section class="hero" aria-label="Hero">
      <div class="container hero-inner">
        <div class="hero-eyebrow">
          <span class="status-dot"></span>
          API v1 · Live
        </div>

        <h1 class="hero-headline">
          The Valuation Engine Behind<br>
          <span class="accent">Great Auction Drafts</span>
        </h1>

        <p class="hero-sub">
          Dark Blue gives any fantasy platform real-time auction intelligence.
          Send a player, a budget, and a league state — get back a precise,
          algorithmically-grounded max bid.
        </p>

        <div class="hero-actions">
          <a href="#pricing" class="btn btn-primary btn-lg">Get Your License Key</a>
          <a href="#docs"    class="btn btn-ghost  btn-lg">View API Docs</a>
        </div>

        <!-- Live response preview card -->
        <div class="hero-preview">
          <div class="code-block" style="box-shadow:0 32px 64px rgba(0,0,0,0.35);">
            <div class="code-block-header">
              <span class="code-block-lang">JSON Response</span>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:11px;color:#10b981;font-weight:600;">200 OK</span>
                <span style="font-size:11px;color:#475569;">143ms</span>
              </div>
            </div>
            <pre class="code-pre">${SAMPLE_RESPONSE}</pre>
          </div>
        </div>
      </div>
    </section>

    <!-- ② Trust strip -->
    <div class="trust-strip">
      <div class="container trust-strip-inner">
        <span class="trust-label">Built for draft day</span>
        <div class="trust-sep"></div>
        <div class="trust-stat">
          <span class="trust-stat-value">313</span>
          <span class="trust-stat-label">players pre-loaded</span>
        </div>
        <div class="trust-sep"></div>
        <div class="trust-stat">
          <span class="trust-stat-value">&lt;200ms</span>
          <span class="trust-stat-label">median response</span>
        </div>
        <div class="trust-sep"></div>
        <div class="trust-stat">
          <span class="trust-stat-value">4-layer</span>
          <span class="trust-stat-label">security model</span>
        </div>
        <div class="trust-sep"></div>
        <div class="trust-stat">
          <span class="trust-stat-value">1 endpoint</span>
          <span class="trust-stat-label">to integrate</span>
        </div>
      </div>
    </div>

    <!-- ③ Features grid -->
    <section class="section section-alt" aria-label="Features">
      <div class="container">
        <div class="text-center">
          <p class="label">What you get</p>
          <h2 class="heading-lg mt-2">Everything a live draft demands</h2>
          <p class="subheading mt-4" style="max-width:560px;margin-inline:auto;">
            One license key unlocks a production-grade valuation API purpose-built
            for the speed and complexity of auction fantasy drafts.
          </p>
        </div>

        <div class="features-grid">
          ${FEATURES.map(f => `
            <div class="feature-card">
              <div class="feature-icon">${f.icon}</div>
              <h3 class="feature-title">${f.title}</h3>
              <p class="feature-desc">${f.desc}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- ④ How it works -->
    <section class="section" aria-label="How it works">
      <div class="container">
        <div class="text-center">
          <p class="label">Integration</p>
          <h2 class="heading-lg mt-2">From click to max bid in three steps</h2>
        </div>

        <div class="steps-list">
          ${STEPS.map(s => `
            <div class="step">
              <div class="step-num">${s.num}</div>
              <div class="step-body">
                <h3>${s.title}</h3>
                <p>${s.body}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- ⑤ Formula highlight -->
    <section class="section section-alt" aria-label="The algorithm">
      <div class="container">
        <div class="text-center" style="max-width:600px;margin-inline:auto;margin-bottom:var(--space-10);">
          <p class="label">The algorithm</p>
          <h2 class="heading-lg mt-2">Not a lookup table. A live calculation.</h2>
          <p class="subheading mt-4">
            Every valuation is computed fresh from the current undrafted player pool.
            As players are taken, values shift — automatically.
          </p>
        </div>

        <div style="max-width:680px;margin-inline:auto;">
          <div class="code-block">
            <div class="code-block-header">
              <span class="code-block-lang">The Valuation Formula</span>
            </div>
            <pre class="code-pre"><span class="tok-cmt">// Step 1 — SGP base value (player's share of remaining pool value)</span>
sgp_base = (player_sgp_score / total_pool_sgp) × remaining_budget

<span class="tok-cmt">// Step 2 — Scarcity multiplier (supply vs. open roster slots)</span>
scarcity = slots_remaining / eligible_remaining   <span class="tok-cmt">// clamped 1.00–1.45</span>

<span class="tok-cmt">// Step 3 — Inflation (late-draft budget concentration)</span>
inflation = actual_remaining_budget / expected_budget   <span class="tok-cmt">// clamped 0.85–1.45</span>

<span class="tok-cmt">// Step 4 — Combine + apply 8% safety margin</span>
true_value = sgp_base × scarcity × inflation
max_bid    = round(true_value × <span class="tok-num">0.92</span>)</pre>
          </div>
        </div>
      </div>
    </section>

    <!-- ⑥ CTA Banner -->
    <section class="cta-banner" aria-label="Get started">
      <div class="container">
        <h2>Ready to draft smarter?</h2>
        <p>
          Plug the Dark Blue API into your draft kit and give every owner
          edge-of-seat, statistically-grounded bid recommendations in real time.
        </p>
        <div class="hero-actions">
          <a href="#pricing"  class="btn btn-primary btn-lg">See Licensing Plans</a>
          <a href="#docs"     class="btn btn-ghost   btn-lg">Try Sample Commands</a>
        </div>
      </div>
    </section>
  `;
};
