const assert = require("assert/strict");

const calls = [];
const sampleRoster = {
  roster: [
    {
      person: { id: 592450, fullName: "Aaron Judge" },
      jerseyNumber: "99",
      position: { abbreviation: "OF", name: "Outfielder" },
      status: { code: "A", description: "Active" },
    },
  ],
};

global.fetch = async (url) => {
  calls.push(String(url));
  return {
    ok: true,
    status: 200,
    async json() {
      return sampleRoster;
    },
  };
};

const { getMlbDepthCharts } = require("../services/mlbDepthCharts");

async function main() {
  const first = await getMlbDepthCharts({ forceRefresh: true });
  assert.equal(first.source, "mlb-stats-api-active-roster");
  assert.equal(first.teams.length, 30, "expected all MLB teams");
  assert.ok(first.teams.some((team) => team.team === "NYY"), "expected NYY team");
  assert.equal(first.teams.find((team) => team.team === "NYY").roster[0].mlbId, 592450);
  assert.equal(first.cache.hit, false);

  const callCountAfterFirst = calls.length;
  const second = await getMlbDepthCharts();
  assert.equal(second.cache.hit, true, "second call should use cache");
  assert.equal(calls.length, callCountAfterFirst, "cache should avoid upstream calls");

  console.log("MLB depth chart service tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
