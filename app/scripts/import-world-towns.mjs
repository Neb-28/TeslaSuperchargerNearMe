// Towns of 5,000+ people in Canada, the UK, Australia, New Zealand and Ireland, for "Tesla
// Superchargers near [town]" pages abroad (lib/towns.ts), written to data/world-towns.json.
// Source: GeoNames cities5000 (CC BY 4.0, credited on the town pages), a plain download, no key.
// Visitors never call GeoNames.
//
// Usage: node scripts/import-world-towns.mjs   (needs the `unzip` command)
//
// Like the US import, towns that already have a city page are kept; the site skips them at build
// time, so a town that gets a Supercharger later switches to its city page.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeData } from "./lib/write-data.mjs";

const SOURCE = "https://download.geonames.org/export/dump/cities5000.zip";

// Country code → the country slug its station pages use (/supercharger/canada/...).
const COUNTRIES = { CA: "canada", GB: "united-kingdom", AU: "australia", NZ: "new-zealand", IE: "ireland" };

// GeoNames province and state codes → the abbreviations in our Canadian and Australian city labels.
const REGIONS = {
  CA: { "01": "AB", "02": "BC", "03": "MB", "04": "NB", "05": "NL", "07": "NS", "08": "ON", "09": "PE", "10": "QC", "11": "SK", "12": "YT", "13": "NT", "14": "NU" },
  AU: { "01": "ACT", "02": "NSW", "03": "NT", "04": "QLD", "05": "SA", "06": "TAS", "07": "VIC", "08": "WA" },
};

// Kinds of populated place to keep. Left out: PPLX (a neighbourhood or suburb inside a city:
// Australia alone has 1,200 of them), and abandoned, historical or religious places.
const KINDS = new Set(["PPL", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLC", "PPLL", "PPLS"]);

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// "City of Westminster" is searched as "Westminster".
const townName = (name) => name.replace(/^City of /, "");

const dir = mkdtempSync(join(tmpdir(), "world-towns-"));
try {
  const response = await fetch(SOURCE, { headers: { "User-Agent": "TeslaSuperchargerNearMe import" } });
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  writeFileSync(join(dir, "cities.zip"), Buffer.from(await response.arrayBuffer()));
  const text = execFileSync("unzip", ["-p", join(dir, "cities.zip")], { maxBuffer: 256 * 1024 * 1024 }).toString("utf8");

  const bySlug = new Map();
  for (const line of text.split("\n")) {
    // Columns: https://download.geonames.org/export/dump/readme.txt
    const cells = line.split("\t");
    const [, rawName, , , lat, lon, , kind, code, , admin1, , , , population] = cells;
    const state = COUNTRIES[code];
    if (!state || !KINDS.has(kind)) continue;
    const name = townName(rawName);
    const town = {
      state,
      slug: slugify(name),
      name,
      region: REGIONS[code]?.[admin1] ?? null,
      lat: Number(Number(lat).toFixed(5)),
      lon: Number(Number(lon).toFixed(5)),
      population: Number(population),
    };
    // Two places in one country can share a name (Richmond, BC and Richmond, ON); keep the bigger one.
    const key = `${state}/${town.slug}`;
    if ((bySlug.get(key)?.population ?? 0) < town.population) bySlug.set(key, town);
  }

  const towns = [...bySlug.values()].sort((a, b) => a.state.localeCompare(b.state) || b.population - a.population);
  writeData(
    new URL("../data/world-towns.json", import.meta.url),
    { source: SOURCE, license: "GeoNames, CC BY 4.0", fetchedAt: new Date().toISOString(), towns },
    "towns",
  );
  const counts = Object.entries(Object.groupBy(towns, (town) => town.state)).map(([state, list]) => `${state} ${list.length}`);
  console.log(`${towns.length} places with 5,000+ people: ${counts.join(", ")}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
