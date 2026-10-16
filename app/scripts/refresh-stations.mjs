// The nightly station refresh (.github/workflows/refresh-stations.yml); also fine to run by hand.
//
//   1. Downloads supercharge.info's list once.
//   2. Checks the US list against it (scripts/reconcile-us-superchargers.mjs).
//   3. Refreshes the stations outside the US (scripts/import-world-superchargers.mjs).
//   4. Finds nearby places for stations that have none yet, mostly the ones just added
//      (scripts/import-places.mjs --missing), within a time limit so a slow Overpass server
//      can't hold up the station update; the next run continues.
//   5. Adds the places Overture Maps has and OSM lacks for those stations
//      (scripts/import-overture-places.mjs --missing).
//
// Steps 2 and 3 stop the run when the feed looks broken (their safety brakes), so a bad download
// never reaches the site. A short summary goes to $REFRESH_SUMMARY when it's set, for the commit.
//
// Usage: node scripts/refresh-stations.mjs
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FEED_URL = "https://supercharge.info/service/supercharge/allSites";
const PLACES_MINUTES = 20;

const scripts = new URL(".", import.meta.url).pathname;
const work = mkdtempSync(join(tmpdir(), "station-refresh-"));
const summary = [];

function run(script, ...args) {
  console.log(`\n▶ ${script} ${args.join(" ")}`);
  const result = spawnSync(process.execPath, [join(scripts, script), ...args], { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" });
  process.stdout.write(result.stdout);
  if (result.status !== 0) {
    console.error(`${script} failed; stopping the refresh.`);
    process.exit(result.status ?? 1);
  }
  return result.stdout.trim().split("\n").filter(Boolean);
}

const response = await fetch(FEED_URL, { headers: { "User-Agent": "TeslaSuperchargerNearMe import" } });
if (!response.ok) {
  console.error(`supercharge.info error ${response.status}; stopping the refresh.`);
  process.exit(1);
}
const feedFile = join(work, "allSites.json");
writeFileSync(feedFile, await response.text());

summary.push(...run("reconcile-us-superchargers.mjs", feedFile).slice(-1));
summary.push(...run("import-world-superchargers.mjs", feedFile));
for (const extra of [[], ["--world"]]) {
  const lines = run("import-places.mjs", "--missing", `--minutes=${PLACES_MINUTES}`, ...extra);
  summary.push(`Places${extra.length ? " (outside the US)" : ""}: ${lines.at(-1)}`);
}
summary.push(...run("import-overture-places.mjs", "--missing").slice(-1));

console.log(`\n${summary.join("\n")}`);
if (process.env.REFRESH_SUMMARY) appendFileSync(process.env.REFRESH_SUMMARY, `${summary.join("\n")}\n`);
