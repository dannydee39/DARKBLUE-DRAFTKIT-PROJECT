const assert = require("assert/strict");
const players = require("../data/players.json");

function assertFiniteNumber(value, label) {
  assert.equal(typeof value, "number", `${label} should be a number`);
  assert.ok(Number.isFinite(value), `${label} should be finite`);
}

function assertWorkloadField(player, key) {
  /*
   * These fields are the generated playing-time inputs used by the valuation
   * depth/role math. They are not third-party future projections; they are
   * derived by scripts/generate-players.js from the weighted MLB stat line.
   * Keeping this as a validation requirement prevents the app from silently
   * showing weaker proxy-only role estimates for the main player pool.
   */
  assertFiniteNumber(player[key], `${player.name} ${key}`);
  assert.ok(player[key] >= 0, `${player.name} ${key} should not be negative`);
}

function main() {
  assert.ok(Array.isArray(players), "players.json should export an array");
  assert.ok(players.length > 500, "real player pool should contain a substantial set of players");

  const nameSet = new Set();
  const mlbIdSet = new Set();

  let hitters = 0;
  let pitchers = 0;
  let headshots = 0;

  players.forEach((player, index) => {
    assertFiniteNumber(player.id, `player[${index}].id`);
    assert.equal(typeof player.name, "string", `player[${index}].name should be a string`);
    assert.ok(player.name.trim().length > 0, `player[${index}].name should not be empty`);
    assert.equal(typeof player.team, "string", `player[${index}].team should be a string`);
    assert.ok(["AL", "NL", "ALL"].includes(player.league), `player[${index}].league should be AL/NL/ALL`);
    assert.ok(Array.isArray(player.pos) && player.pos.length > 0, `player[${index}].pos should be a non-empty array`);
    assert.ok(["Elite", "Starter", "Bench"].includes(player.tier), `player[${index}].tier should be valid`);
    assertFiniteNumber(player.baseValue, `player[${index}].baseValue`);
    assert.ok(player.baseValue >= 1, `player[${index}].baseValue should be at least 1`);
    assertFiniteNumber(player.fpts, `player[${index}].fpts`);
    assert.ok(!nameSet.has(player.name), `Duplicate player name found: ${player.name}`);
    nameSet.add(player.name);

    if (player.mlbId != null) {
      assertFiniteNumber(player.mlbId, `player[${index}].mlbId`);
      assert.ok(!mlbIdSet.has(player.mlbId), `Duplicate mlbId found: ${player.mlbId}`);
      mlbIdSet.add(player.mlbId);
    }

    if (player.photoUrl) {
      assert.equal(typeof player.photoUrl, "string", `player[${index}].photoUrl should be a string`);
      assert.ok(player.photoUrl.startsWith("https://"), `player[${index}].photoUrl should be an https URL`);
      headshots += 1;
    }

    const isPitcher = ["SP", "RP"].includes(player.pos[0]);
    if (isPitcher) {
      pitchers += 1;
      assertWorkloadField(player, "projected_games");
      assertWorkloadField(player, "projected_innings");
      assert.ok(player.era !== null, `${player.name} should have pitcher ERA`);
      assert.ok(player.whip !== null, `${player.name} should have pitcher WHIP`);
      assertFiniteNumber(player.so, `${player.name} so`);
      assertFiniteNumber(player.w, `${player.name} w`);
      assertFiniteNumber(player.sv, `${player.name} sv`);
    } else {
      hitters += 1;
      assertWorkloadField(player, "projected_games");
      assertWorkloadField(player, "projected_plate_appearances");
      assertWorkloadField(player, "projected_at_bats");
      assertFiniteNumber(player.hr, `${player.name} hr`);
      assertFiniteNumber(player.rbi, `${player.name} rbi`);
      assertFiniteNumber(player.r, `${player.name} r`);
      assertFiniteNumber(player.sb, `${player.name} sb`);
      assert.equal(typeof player.avg, "string", `${player.name} avg should be a string rate`);
      assert.equal(typeof player.obp, "string", `${player.name} obp should be a string rate`);
      assert.equal(typeof player.slg, "string", `${player.name} slg should be a string rate`);
    }
  });

  assert.ok(hitters > 200, "player pool should contain a large hitter set");
  assert.ok(pitchers > 100, "player pool should contain a meaningful pitcher set");
  assert.ok(headshots > players.length * 0.8, "most players should have headshots");

  console.log("PASS validate:players");
  console.log(`players=${players.length} hitters=${hitters} pitchers=${pitchers} headshots=${headshots}`);
}

main();
