const fs = require("fs");
const os = require("os");
const path = require("path");

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dbdraftkit-auth-"));
  process.env.AUTH_DB_PATH = path.join(tempDir, "draftkit-auth.db");
  process.env.NODE_ENV = "development";
  process.env.ALLOWED_ORIGINS = "http://localhost:4173,https://draft.anythingavenue.com";
  process.env.MAIL_TRANSPORT = "json";
  process.env.PASSWORD_RESET_BASE_URL = "https://draft.anythingavenue.com";
  process.env.PASSWORD_RESET_EXPOSE_TOKEN = "true";

  const { createApp } = require("../server");
  const app = createApp({ rateLimitMax: 5000 });
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";

  function updateCookie(response) {
    const raw = response.headers.get("set-cookie");
    if (!raw) return;
    cookie = raw.split(";")[0];
  }

  async function request(pathname, options = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(options.headers || {}),
      },
    });
    updateCookie(response);
    const body = await response.json();
    return { response, body };
  }

  try {
    const email = `tester-${Date.now()}@anythingavenue.com`;
    const password = "password123";

    const signup = await request("/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        displayName: "Sprint Four Tester",
      }),
    });
    if (!signup.response.ok || !signup.body?.authenticated) {
      throw new Error(`Signup failed: ${JSON.stringify(signup.body)}`);
    }

    const me = await request("/v1/auth/me", { method: "GET" });
    if (!me.body?.authenticated || me.body?.user?.email !== email) {
      throw new Error("Session lookup failed after signup.");
    }

    const draft = {
      id: "draft-cloud-test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
      source: "cloud",
      league: {
        name: "Cloud League",
        season: "2026",
        owners: 12,
        budget: 260,
        pool: "MLB",
        roster: { C: 1, "1B": 1, "2B": 1, "3B": 1, SS: 1, OF: 3, SP: 2, RP: 2, UTIL: 1, BN: 2, TAXI: 3 },
        scoring: { R: true, HR: true, RBI: true, SB: true, AVG: true, W: true, SV: true, ERA: true, WHIP: true, SO: true },
        keeperLeague: true,
        commissionerUnlocked: false,
        teams: Array.from({ length: 12 }, (_, index) => ({
          id: index + 1,
          name: `Owner ${index + 1}`,
          budget_remaining: 260,
          roster: [],
          taxiSquad: [],
        })),
      },
      players: [],
      notes: {},
      favorites: {},
      currentOwnerIdx: 0,
    };

    const created = await request("/v1/drafts", {
      method: "POST",
      body: JSON.stringify({ draft }),
    });
    if (!created.response.ok || created.body?.draft?.id !== draft.id) {
      throw new Error(`Draft create failed: ${JSON.stringify(created.body)}`);
    }

    const listed = await request("/v1/drafts", { method: "GET" });
    if (listed.body?.count !== 1) {
      throw new Error(`Draft list returned unexpected count: ${JSON.stringify(listed.body)}`);
    }

    const opened = await request(`/v1/drafts/${draft.id}/open`, { method: "POST" });
    if (!opened.body?.ok) {
      throw new Error(`Draft open marker failed: ${JSON.stringify(opened.body)}`);
    }

    const updated = await request(`/v1/drafts/${draft.id}`, {
      method: "PUT",
      body: JSON.stringify({
        draft: {
          ...draft,
          league: {
            ...draft.league,
            name: "Cloud League Updated",
          },
        },
      }),
    });
    if (updated.body?.draft?.league?.name !== "Cloud League Updated") {
      throw new Error(`Draft update failed: ${JSON.stringify(updated.body)}`);
    }

    const removed = await request(`/v1/drafts/${draft.id}`, { method: "DELETE" });
    if (!removed.body?.ok) {
      throw new Error(`Draft delete failed: ${JSON.stringify(removed.body)}`);
    }

    const logout = await request("/v1/auth/logout", { method: "POST" });
    if (!logout.body?.ok) {
      throw new Error(`Logout failed: ${JSON.stringify(logout.body)}`);
    }

    const afterLogout = await request("/v1/auth/me", { method: "GET" });
    if (afterLogout.body?.authenticated) {
      throw new Error("User still authenticated after logout.");
    }

    const unknownReset = await request("/v1/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email: `missing-${Date.now()}@anythingavenue.com` }),
    });
    if (unknownReset.response.status !== 202 || unknownReset.body?.resetToken) {
      throw new Error(`Unknown-account reset did not return a generic 202: ${JSON.stringify(unknownReset.body)}`);
    }

    const resetRequest = await request("/v1/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    if (
      resetRequest.response.status !== 202 ||
      !resetRequest.body?.resetToken ||
      !resetRequest.body?.resetUrl?.includes("https://draft.anythingavenue.com")
    ) {
      throw new Error(`Password reset request failed: ${JSON.stringify(resetRequest.body)}`);
    }

    const shortPasswordReset = await request("/v1/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({
        token: resetRequest.body.resetToken,
        password: "short",
      }),
    });
    if (shortPasswordReset.response.status !== 400) {
      throw new Error(`Short password reset should fail: ${JSON.stringify(shortPasswordReset.body)}`);
    }

    const activeLogin = await request("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!activeLogin.body?.authenticated) {
      throw new Error(`Login before reset failed: ${JSON.stringify(activeLogin.body)}`);
    }

    const newPassword = "password456";
    const confirmedReset = await request("/v1/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({
        token: resetRequest.body.resetToken,
        password: newPassword,
      }),
    });
    if (!confirmedReset.body?.ok) {
      throw new Error(`Password reset confirm failed: ${JSON.stringify(confirmedReset.body)}`);
    }

    const resetClearedSession = await request("/v1/auth/me", { method: "GET" });
    if (resetClearedSession.body?.authenticated) {
      throw new Error("Password reset should invalidate existing sessions.");
    }

    const oldPasswordLogin = await request("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (oldPasswordLogin.response.status !== 401) {
      throw new Error(`Old password should fail after reset: ${JSON.stringify(oldPasswordLogin.body)}`);
    }

    const newPasswordLogin = await request("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: newPassword }),
    });
    if (!newPasswordLogin.body?.authenticated) {
      throw new Error(`New password login failed after reset: ${JSON.stringify(newPasswordLogin.body)}`);
    }

    const reusedReset = await request("/v1/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({
        token: resetRequest.body.resetToken,
        password: "password789",
      }),
    });
    if (reusedReset.response.status !== 400 || reusedReset.body?.code !== "INVALID_RESET_TOKEN") {
      throw new Error(`Reset token reuse should fail: ${JSON.stringify(reusedReset.body)}`);
    }

    console.log("Auth + draft cloud regression passed.");
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
