const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dbvalue-auth-"));
process.env.VALUATION_AUTH_DB_PATH = path.join(tempDir, "valuation-auth.db");
process.env.NODE_ENV = "test";
process.env.MAIL_TRANSPORT = "json";
process.env.PASSWORD_RESET_EXPOSE_TOKEN = "true";
process.env.PASSWORD_RESET_BASE_URL = "http://localhost:5173";
process.env.API_KEYS = "DB-2026-DEMO-0001";

const { createApp } = require("../server");

async function withServer(app, run) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_err) {
    body = text;
  }
  return { response, body };
}

function cookieFrom(response) {
  const raw = response.headers.get("set-cookie") || "";
  return raw.split(";")[0];
}

async function signup(baseUrl, suffix) {
  return jsonFetch(`${baseUrl}/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `buyer-${suffix}@example.com`,
      displayName: `Buyer ${suffix}`,
      password: "Password123!",
    }),
  });
}

async function main() {
  const app = createApp({ nodeEnv: "test", rateLimitMax: 500, sessionCleanupMs: 0 });
  await withServer(app, async (baseUrl) => {
    const first = await signup(baseUrl, "one");
    assert.equal(first.response.status, 201, "signup should create first buyer");
    assert.equal(first.body.authenticated, true);
    assert.ok(first.body.user.license.key.startsWith("DB-"), "signup should return a license key");

    const firstCookie = cookieFrom(first.response);
    assert.ok(firstCookie.includes("darkblue_value_session="), "signup should set valuation session cookie");

    const second = await signup(baseUrl, "two");
    assert.equal(second.response.status, 201, "signup should create second buyer");
    assert.notEqual(
      first.body.user.license.key,
      second.body.user.license.key,
      "each buyer account should receive a unique license key",
    );

    const me = await jsonFetch(`${baseUrl}/v1/auth/me`, {
      headers: { Cookie: firstCookie },
    });
    assert.equal(me.response.status, 200);
    assert.equal(me.body.authenticated, true);
    assert.equal(me.body.user.email, "buyer-one@example.com");
    assert.equal(me.body.user.license.key, first.body.user.license.key);

    const licensedPlayers = await jsonFetch(`${baseUrl}/v1/players?league=AL&limit=1`, {
      headers: { "X-License-Key": first.body.user.license.key },
    });
    assert.equal(licensedPlayers.response.status, 200, "account license should authorize API calls");
    assert.ok(Array.isArray(licensedPlayers.body.players), "players response should include player list");

    const resetRequest = await jsonFetch(`${baseUrl}/v1/auth/password-reset/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "buyer-one@example.com" }),
    });
    assert.equal(resetRequest.response.status, 202, "password reset request should be accepted");
    assert.ok(resetRequest.body.resetToken, "test mode should expose reset token");
    assert.ok(resetRequest.body.resetUrl.includes("resetToken="), "reset URL should include reset token");

    const resetConfirm = await jsonFetch(`${baseUrl}/v1/auth/password-reset/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: resetRequest.body.resetToken,
        password: "NewPassword123!",
      }),
    });
    assert.equal(resetConfirm.response.status, 200, "password reset confirm should succeed");

    const oldLogin = await jsonFetch(`${baseUrl}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "buyer-one@example.com",
        password: "Password123!",
      }),
    });
    assert.equal(oldLogin.response.status, 401, "old password should stop working after reset");

    const newLogin = await jsonFetch(`${baseUrl}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "buyer-one@example.com",
        password: "NewPassword123!",
      }),
    });
    assert.equal(newLogin.response.status, 200, "new password should log in");
    assert.equal(
      newLogin.body.user.license.key,
      first.body.user.license.key,
      "password reset should preserve the account license key",
    );

    const logout = await jsonFetch(`${baseUrl}/v1/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookieFrom(newLogin.response) },
    });
    assert.equal(logout.response.status, 200, "logout should succeed");
  });

  console.log("PASS test:auth-licenses");
}

main().catch((error) => {
  console.error("FAIL test:auth-licenses");
  console.error(error);
  process.exit(1);
});
