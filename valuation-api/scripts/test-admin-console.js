const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "db-admin-console-"));
process.env.ADMIN_CONSOLE_PASSWORD = "test-admin-password";
process.env.ADMIN_CONSOLE_SESSION_SECRET = "test-admin-session-secret";
process.env.API_KEYS = "DB-2026-DEMO-0001";
process.env.PLAYER_UPDATES_FILE = path.join(tempDir, "player-updates.json");
process.env.SESSION_CLEANUP_MS = "0";

const app = require("../server");

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

async function main() {
  const server = await listen();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const root = await fetch(`${baseUrl}/`, { redirect: "manual" });
    assert.equal(root.status, 302, "root should redirect to admin console");
    assert.equal(root.headers.get("location"), "/admin");

    const loginPage = await fetch(`${baseUrl}/admin`);
    assert.equal(loginPage.status, 200, "admin login page should render");
    assert.match(await loginPage.text(), /Admin Console/);

    const blocked = await fetch(`${baseUrl}/admin/api/players`);
    assert.equal(blocked.status, 401, "admin API should require login");

    const failedLogin = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    assert.equal(failedLogin.status, 401, "wrong admin password should fail");

    const login = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "test-admin-password" }),
    });
    assert.equal(login.status, 200, "correct admin password should login");
    const cookie = login.headers.get("set-cookie");
    assert.ok(cookie && cookie.includes("db_api_admin="), "login should set admin cookie");

    const headers = { Cookie: cookie };
    const consolePage = await fetch(`${baseUrl}/admin`, { headers });
    assert.equal(consolePage.status, 200, "authenticated admin page should render console");
    assert.match(await consolePage.text(), /API Test Bench/);

    const players = await fetch(`${baseUrl}/admin/api/players?search=Ohtani&limit=5`, { headers });
    assert.equal(players.status, 200, "admin player search should work");
    const playersJson = await players.json();
    assert.ok(playersJson.players.some((player) => player.name === "Shohei Ohtani"));

    const demo = await fetch(`${baseUrl}/admin/api/player-updates/demo`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        player_name: "Shohei Ohtani",
        alert_status: "ROLE_GAIN",
      }),
    });
    assert.equal(demo.status, 201, "admin demo alert push should work");
    const demoJson = await demo.json();
    assert.equal(demoJson.update.player_name, "Shohei Ohtani");
    assert.equal(demoJson.update.alert_status, "ROLE_GAIN");
    assert.equal(demoJson.update.tone, "positive");

    console.log("PASS test:admin-console");
  } finally {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
