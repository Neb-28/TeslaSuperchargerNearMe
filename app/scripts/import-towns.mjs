// US towns of 5,000+ people, for "Tesla Superchargers near [town]" pages (lib/towns.ts), written
// to data/towns.json. Sources (US Census Bureau, public domain): the Gazetteer places file for
// names and center points, and the ACS 5-year total population table (B01003) for population.
// Both are plain downloads, no API key. Visitors never call the Census servers.
//
// Usage: node scripts/import-towns.mjs   (needs the `unzip` command)
//
// Every sizable place is kept, including towns that already have a city page; the site skips
// those at build time, so a town that gets a Supercharger later switches to its city page.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeData } from "./lib/write-data.mjs";

const MIN_POPULATION = 5000;
const GAZETTEER_YEAR = new Date().getFullYear() - 2; // published each fall; try the newest first
const ACS_YEAR = new Date().getFullYear() - 2;

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// The Census adds the kind of place to the name: "Dale City CDP", "Abbeville city".
const SUFFIX = / (CDP|city and borough|city|town|village|borough|comunidad|zona urbana|township|municipality|corporation)$/;
// Consolidated city-counties: "Nashville-Davidson metropolitan government (balance)" is Nashville.
const CONSOLIDATED = / (city|unified government|consolidated government|metro government|metropolitan government|urban county)$/;
// Census names that differ from what people search for.
const RENAMES = {
  "Urban Honolulu": "Honolulu",
  "San Buenaventura (Ventura)": "Ventura",
  "El Paso de Robles (Paso Robles)": "Paso Robles",
  "Village of Oak Creek (Big Park)": "Village of Oak Creek",
  "Boise City": "Boise",
};
// College campuses the Census counts as places ("University of California-Davis").
const CAMPUS = /^University( of | at |$)|University-| University$|Institute of Technology$/;

function townName(census, lsad) {
  let name = census.replace(/ \(balance\)$/, "");
  if (SUFFIX.test(name) && !["00", "UG", "MG", "CG", "UC"].includes(lsad)) name = name.replace(SUFFIX, "");
  else name = name.replace(CONSOLIDATED, "").split(/[-/]/)[0].replace(/ County$/, "");
  return RENAMES[name] ?? name;
}

async function download(urls, file) {
  for (const url of urls) {
    const response = await fetch(url);
    if (!response.ok) continue;
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    return url;
  }
  throw new Error(`None of these downloaded: ${urls.join(", ")}`);
}

const dir = mkdtempSync(join(tmpdir(), "towns-"));
try {
  const years = (year) => [year, year - 1, year - 2];

  const gazUrl = await download(
    years(GAZETTEER_YEAR).map((year) => `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/${year}_Gazetteer/${year}_Gaz_place_national.zip`),
    join(dir, "places.zip"),
  );
  const gazetteer = execFileSync("unzip", ["-p", join(dir, "places.zip")], { maxBuffer: 64 * 1024 * 1024 }).toString("utf8");

  const acsUrl = await download(
    years(ACS_YEAR).map((year) => `https://www2.census.gov/programs-surveys/acs/summary_file/${year}/table-based-SF/data/5YRData/acsdt5y${year}-b01003.dat`),
    join(dir, "population.dat"),
  );
  const population = new Map();
  for (const line of execFileSync("grep", ["^1600000US", join(dir, "population.dat")], { maxBuffer: 64 * 1024 * 1024 }).toString().split("\n")) {
    const [geoId, total] = line.split("|");
    if (geoId) population.set(geoId.slice("1600000US".length), Number(total));
  }

  const bySlug = new Map();
  const [header, ...rows] = gazetteer.trim().split("\n");
  const column = Object.fromEntries(header.split("\t").map((name, index) => [name.trim(), index]));
  for (const row of rows) {
    const cells = row.split("\t").map((cell) => cell.trim());
    const people = population.get(cells[column.GEOID]) ?? 0;
    if (people < MIN_POPULATION) continue;
    const name = townName(cells[column.NAME], cells[column.LSAD]);
    if (CAMPUS.test(name)) continue;
    const town = {
      state: cells[column.USPS].toLowerCase(),
      slug: slugify(name),
      name,
      lat: Number(Number(cells[column.INTPTLAT]).toFixed(5)),
      lon: Number(Number(cells[column.INTPTLONG]).toFixed(5)),
      population: people,
    };
    // Two places in one state can share a name (a city and a CDP); keep the bigger one.
    const key = `${town.state}/${town.slug}`;
    if ((bySlug.get(key)?.population ?? 0) < people) bySlug.set(key, town);
  }

  const towns = [...bySlug.values()].sort((a, b) => a.state.localeCompare(b.state) || b.population - a.population);
  writeData(new URL("../data/towns.json", import.meta.url), { sources: [gazUrl, acsUrl], fetchedAt: new Date().toISOString(), towns }, "towns");
  console.log(`${towns.length} places with ${MIN_POPULATION.toLocaleString("en-US")}+ people`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
