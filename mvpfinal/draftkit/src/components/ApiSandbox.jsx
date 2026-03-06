// ─────────────────────────────────────────────────────────────────────────────
// components/ApiSandbox.jsx
//
// Interactive API testing sandbox. Lets users:
//  - Edit a JSON request payload inline
//  - Send it to POST /v1/valuate
//  - See the full response in real-time
//  - View response status, latency, and key extracted values
//
// This is primarily a developer/power-user tool to test the valuation API
// without needing curl or Postman.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { API_BASE, DEMO_KEY, PROD_DISPLAY_URL } from "../constants.js";

/**
 * ApiSandbox
 *
 * @param {Object} props
 * @param {Object} props.league    - Current league state (used to pre-fill the payload)
 * @param {string} props.apiStatus - "online" | "offline" | "checking"
 * @returns {JSX.Element}
 */
export default function ApiSandbox({ league, apiStatus }) {

  // ── Default request payload ────────────────────────────────────────────
  // Pre-filled with a realistic example based on the current league config.
  // Users can edit this JSON directly in the textarea.
  const defaultPayload = {
    license_key: DEMO_KEY,
    draft_state: {
      total_teams: league?.owners || 12,
      budget_per_team: league?.budget || 260,
      scoring_categories: ["HR", "RBI", "AVG", "SB", "ERA", "SO", "WHIP"],
      teams: [
        { id: 1, budget_remaining: 248, roster: ["Garrett Crochet"] },
      ],
      nominated_player: "Gerrit Cole",
      roster_config: {
        C: 1, "1B": 1, "2B": 1, "3B": 1, SS: 1,
        OF: 3, SP: 2, RP: 2, UTIL: 1, BN: 2,
      },
    },
  };

  // ── Component state ───────────────────────────────────────────────────────
  const [payload,  setPayload]  = useState(JSON.stringify(defaultPayload, null, 2));
  const [response, setResponse] = useState(null);   // { status, data, ok }
  const [loading,  setLoading]  = useState(false);
  const [elapsed,  setElapsed]  = useState(null);   // ms
  const [error,    setError]    = useState(null);   // parse / network error string

  /**
   * sendRequest — parses the textarea JSON and fires it at the API.
   *
   * Handles:
   *  - JSON parse errors (invalid syntax in the textarea)
   *  - Network fetch errors (API offline)
   *  - Non-200 responses (still shows the response body)
   */
  async function sendRequest() {
    setLoading(true);
    setError(null);
    setResponse(null);
    const t0 = Date.now();

    try {
      // Parse the user's edited JSON — will throw on syntax errors
      const parsed = JSON.parse(payload);

      const r = await fetch(`${API_BASE}/v1/valuate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-License-Key": parsed.license_key || DEMO_KEY,
        },
        body: JSON.stringify(parsed),
      });

      const data = await r.json();
      setResponse({ status: r.status, data, ok: r.ok });
      setElapsed(Date.now() - t0);

    } catch (e) {
      // Show the error (either JSON parse error or fetch/network error)
      setError(e.message);
    }

    setLoading(false);
  }

  /**
   * resetPayload — restores the textarea to the default example payload.
   * Useful if the user has garbled the JSON.
   */
  function resetPayload() {
    setPayload(JSON.stringify(defaultPayload, null, 2));
    setResponse(null);
    setError(null);
  }

  return (
    <div className="sandbox-layout">
      <h2 className="sandbox-title">API TESTING SANDBOX</h2>
      <p className="dict-sub">
        Edit the JSON payload and send it to the valuation API. Modify{" "}
        <code style={{ color: "var(--green)", fontFamily: "var(--mono)" }}>
          nominated_player
        </code>{" "}
        to test different valuations.
      </p>

      {/* ── Endpoint info bar ─────────────────────────────────────────────── */}
      <div className="sandbox-endpoint-bar">
        <div className="endpoint-left">
          <span className="endpoint-label">ENDPOINT</span>
          <div>
            <span className="endpoint-method">POST</span>
            <span className="endpoint-url">{PROD_DISPLAY_URL}/v1/valuate</span>
          </div>
        </div>
        <div className="endpoint-auth-block">
          <span className="endpoint-label">AUTH</span>
          <span className="endpoint-auth">X-License-Key: DB-2026-XXXX</span>
        </div>
        {/* Live API status indicator */}
        <div className="endpoint-status">
          <div className={`api-dot ${apiStatus}`} />
          <span className="api-status-label">{apiStatus.toUpperCase()}</span>
        </div>
      </div>

      {/* ── Split pane: payload editor + response viewer ──────────────────── */}
      <div className="sandbox-panels">

        {/* ── Left: Request Payload Editor ───────────────────────────────── */}
        <div className="sandbox-panel">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div className="sandbox-panel-label">REQUEST PAYLOAD (JSON)</div>
            <button
              onClick={resetPayload}
              style={{
                fontSize: 10,
                color: "var(--muted2)",
                background: "var(--bg3)",
                border: "1px solid var(--border2)",
                borderRadius: 4,
                padding: "2px 8px",
                cursor: "pointer",
              }}
            >
              Reset Example
            </button>
          </div>

          {/* Editable JSON textarea */}
          <textarea
            className="sandbox-textarea"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            spellCheck={false}
            placeholder="Enter draft_state JSON here…"
          />

          {/* Send button */}
          <button
            className="init-btn"
            onClick={sendRequest}
            disabled={loading || apiStatus === "offline"}
            title={apiStatus === "offline" ? "API is offline" : "Send request"}
          >
            {loading ? "Sending…" : "Send Request"}
          </button>
          {apiStatus === "offline" && (
            <p style={{ fontSize: 10, color: "var(--red)", textAlign: "center", marginTop: 6 }}>
              API server is offline. Start it with: <code>npm run dev</code> in mvpfinal/api/
            </p>
          )}
        </div>

        {/* ── Right: API Response Viewer ──────────────────────────────────── */}
        <div className="sandbox-panel">
          <div className="sandbox-panel-label">API RESPONSE</div>

          <div className="sandbox-response">
            {/* Error message (JSON parse or network error) */}
            {error && (
              <div className="sandbox-error">
                ✕ Error: {error}
              </div>
            )}
            {/* JSON response body */}
            {response && (
              <pre className="sandbox-json">
                {JSON.stringify(response.data, null, 2)}
              </pre>
            )}
            {/* Placeholder states */}
            {!response && !error && !loading && (
              <div className="sandbox-placeholder">
                Response will appear here after you send a request…
              </div>
            )}
            {loading && (
              <div className="sandbox-placeholder">Sending request…</div>
            )}
          </div>

          {/* ── Status bar: shows status code, latency, key values ─────── */}
          {response && (
            <div className="sandbox-status-bar">
              <span className={response.ok ? "status-ok" : "status-err"}>
                {response.status} {response.ok ? "OK" : "ERROR"}
              </span>
              {elapsed != null && <span> · {elapsed}ms</span>}
              {response.data?.max_bid_recommendation && (
                <span>
                  {" "}· Max Bid:{" "}
                  <strong style={{ color: "var(--green)" }}>
                    ${response.data.max_bid_recommendation}
                  </strong>
                  {response.data.true_dollar_value && (
                    <> · TDV: ${response.data.true_dollar_value}</>
                  )}
                  {response.data.market_inflation && (
                    <>
                      {" "}· Inflation: +
                      {((response.data.market_inflation - 1) * 100).toFixed(1)}%
                    </>
                  )}
                  {response.data.scarcity_tier && (
                    <> · Tier: {response.data.scarcity_tier}</>
                  )}
                </span>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
