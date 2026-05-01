const fs = require("fs");
const path = require("path");

const PLAYERS_FILE = path.join(__dirname, "../data/players.json");
const MLB_SEARCH_ENDPOINT = "https://statsapi.mlb.com/api/v1/people/search?names=";

const MANUAL_OVERRIDES = {
  "C.J. Abrams": { query: "CJ Abrams" },
  "Nate Lowe": { query: "Nathaniel Lowe" },
  "Joseph Ortiz": { query: "Joey Ortiz" },
  "J.J. Bleday": { query: "JJ Bleday" },
  "Mike Siani": { query: "Michael Siani" },
  "Benjamin Cowles": { query: "Ben Cowles" },
  "Ji-Hwan Bae": { query: "Ji Hwan Bae" },
};

function normalizeName(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'’]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildPhotoUrl(mlbId) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${mlbId}/headshot/67/current`;
}

async function searchPeople(query) {
  const response = await fetch(`${MLB_SEARCH_ENDPOINT}${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error(`MLB search failed for "${query}" with ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data.people) ? data.people : [];
}

function chooseBestMatch(player, people) {
  if (!people.length) return null;

  const target = normalizeName(player.name);
  const exact = people.filter((person) => normalizeName(person.fullName) === target);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    const activeExact = exact.find((person) => person.active);
    return activeExact || exact[0];
  }

  const activePeople = people.filter((person) => person.active);
  if (activePeople.length === 1) return activePeople[0];
  if (people.length === 1) return people[0];

  return activePeople[0] || people[0] || null;
}

async function resolvePlayer(player) {
  const override = MANUAL_OVERRIDES[player.name] || {};
  const candidates = [
    override.query,
    player.name,
    player.name.replace(/[.'’]/g, ""),
    player.name.replace(/\bJr\.\b/g, "Jr").replace(/\bSr\.\b/g, "Sr"),
  ].filter(Boolean);

  const seen = new Set();
  for (const candidate of candidates) {
    const key = normalizeName(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const people = await searchPeople(candidate);
    const match = chooseBestMatch(player, people);
    if (match) {
      return {
        mlbId: match.id,
        photoUrl: buildPhotoUrl(match.id),
      };
    }
  }

  return { mlbId: null, photoUrl: null };
}

async function main() {
  const players = JSON.parse(fs.readFileSync(PLAYERS_FILE, "utf8"));
  const unresolved = [];

  for (const player of players) {
    const next = await resolvePlayer(player);
    player.mlbId = next.mlbId;
    player.photoUrl = next.photoUrl;
    if (!next.mlbId) unresolved.push(player.name);
  }

  fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2), "utf8");

  console.log(`Updated ${players.length} players.`);
  console.log(`Resolved headshots: ${players.length - unresolved.length}`);
  console.log(`Unresolved: ${unresolved.length}`);

  if (unresolved.length) {
    console.log("Missing names:");
    unresolved.forEach((name) => console.log(` - ${name}`));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
