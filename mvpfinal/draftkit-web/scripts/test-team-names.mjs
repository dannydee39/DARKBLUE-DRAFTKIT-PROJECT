import assert from "node:assert/strict";
import {
  buildTeamNameList,
  buildTeamsFromConfig,
  cloneLeagueConfig,
  validateLeagueConfig,
} from "../src/utils/draftSessions.js";

const setupConfig = {
  name: "Team Name Test",
  season: "2026",
  owners: 4,
  budget: 260,
  pool: "MLB",
  teamNames: ["Bronx Bombers", "Queens Kings", "", "South Side"],
  roster: { C: 1, OF: 1, P: 1, TAXI: 1 },
  scoring: { HR: true, RBI: true, W: true, SO: true },
};

const teamNames = buildTeamNameList(setupConfig, setupConfig.owners);
assert.deepEqual(teamNames, [
  "Bronx Bombers",
  "Queens Kings",
  "Owner 3",
  "South Side",
]);

const teams = buildTeamsFromConfig(setupConfig);
assert.equal(teams.length, 4);
assert.equal(teams[0].name, "Bronx Bombers");
assert.equal(teams[2].name, "Owner 3");
assert.deepEqual(teams[0].minorLeague, []);

const cloned = cloneLeagueConfig({
  ...setupConfig,
  teams: [
    {
      id: 1,
      name: "Renamed Alpha",
      budget_remaining: 200,
      roster: [{ playerId: 1, name: "Roster Player" }],
      taxiSquad: [],
      minorLeague: [],
    },
  ],
});

assert.equal(cloned.teamNames[0], "Bronx Bombers");
assert.equal(cloned.teams[0].name, "Renamed Alpha");
assert.equal(cloned.teams[0].roster.length, 1);

const duplicateValidation = validateLeagueConfig({
  ...setupConfig,
  teamNames: ["Same", "Same", "Other", "Another"],
});

assert.equal(duplicateValidation.errors.length, 0);
assert.ok(
  duplicateValidation.warnings.some((warning) =>
    warning.includes("same name"),
  ),
);

const resizedNames = buildTeamNameList(
  {
    owners: 2,
    teams: [
      { id: 1, name: "Alpha" },
      { id: 2, name: "Bravo" },
      { id: 3, name: "Charlie" },
    ],
  },
  2,
);

assert.deepEqual(resizedNames, ["Alpha", "Bravo"]);

console.log("team name utility tests passed");
