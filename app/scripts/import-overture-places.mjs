// Places near every Supercharger from Overture Maps (data/overture-places.json), on top of the
// OpenStreetMap places in data/places.json: Overture fills in many restaurants and shops OSM lacks.
//
// Only places that add something are stored: a place OSM already lists (same name, nearby) is
// skipped, and each category keeps no more than the 10 closest places across both sources.
// lib/placesData.ts merges the two files for the station pages.
//
// Usage:
//   node scripts/import-overture-places.mjs              # every station (reads ~3 GB from Overture)
//   node scripts/import-overture-places.mjs --missing    # only stations not looked up yet
//   node scripts/import-overture-places.mjs --ids=ids.txt     # only these station ids (testing)
//   node scripts/import-overture-places.mjs --release=2026-09-23.1
//
// Data © Overture Maps Foundation: places from Meta and Microsoft (CDLA Permissive 2.0), Foursquare
// (Apache 2.0) and others; credited on the station pages and the About page.
import { existsSync, readFileSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { writeData } from "./lib/write-data.mjs";

const WALK_RADIUS_M = 600; // PRD: places within 600 m, as for OSM (scripts/import-places.mjs)
const PER_CATEGORY = 10;
const MIN_CONFIDENCE = 0.6;
const SAME_PLACE_M = 150; // the same business mapped by both sources lands this close
const PER_STATION_QUERIES = 50; // up to this many stations, query each one's area; beyond, scan once

const args = process.argv.slice(2);
const MISSING = args.includes("--missing");
const dataUrl = (file) => new URL(`../data/${file}`, import.meta.url);
const read = (file) => JSON.parse(readFileSync(dataUrl(file), "utf8"));

// Category ids and their order are shared with data/places.json (lib/places.ts CATEGORY_IDS).
const { categories, stations: osmPlaces } = read("places.json");
const categoryIndex = Object.fromEntries(categories.map((id, index) => [id, index]));

// Overture's taxonomy -> our categories, matching how scripts/import-places.mjs sorts OSM places.
function categorize([top, group, kind]) {
  if (top === "food_and_drink") {
    if (group === "non_alcoholic_beverage_venue" || kind === "cafe") return "coffee";
    if (group === "alcoholic_beverage_venue") return "bars";
    return "food";
  }
  if (top === "shopping") {
    if (kind === "liquor_store" || kind === "wine_store" || kind === "beer_wine_and_spirits_store") return "bars";
    if (group === "convenience_store" || kind === "grocery_store" || kind === "supermarket") return "grocery";
    if (group === "vehicle_dealer" || kind === "vehicle_parts_store" || NOT_SHOP_KINDS.has(kind)) return null;
    return "shops";
  }
  return null;
}

const humanize = (value) => {
  const text = String(value || "shop").replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function meters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// "Starbucks Coffee" and "Starbucks" are the same place when they're this close together.
const nameKey = (name) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
// Records that aren't places to walk to: websites, agencies and practices anywhere ("Zarbozz.Com",
// "Quoc Duong Real Estate" and "Dan D Hopner Md …" filed as restaurants), and companies among
// shops ("Weun Chan Inc"). Restaurants keep their "Inc" ("Phi Khanh Fast Food Inc" is a deli),
// and "Md Smokehouse" keeps its name. Bitcoin ATMs and coin machines aren't shops either.
const NOT_A_PLACE = /\.com\b|\breal estate\b|\s(md|dds|dmd|cpa|esq)(\s|$)|\b(bitcoin|crypto|coinstar|atm)\b/i;
const NOT_A_SHOP = /\b(inc|llc|l\.l\.c|ltd|corp|corporation|pllc|llp)\.?$/i;
const NOT_SHOP_KINDS = new Set(["safety_equipment_store", "medical_supply_store"]);
const sameName = (a, b) => a === b || (Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a)));

async function latestRelease() {
  const catalog = await (await fetch("https://stac.overturemaps.org/catalog.json")).json();
  return catalog.links.filter((link) => link.rel === "child").map((link) => link.href.split("/").at(-2)).sort().at(-1);
}

const release = args.find((arg) => arg.startsWith("--release="))?.slice("--release=".length) ?? (await latestRelease());
const OUT = dataUrl("overture-places.json");
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const output = previous?.stations ?? {};

const allStations = [...read("superchargers.json").stations, ...read("world-superchargers.json").stations];
const idsArg = args.find((arg) => arg.startsWith("--ids="));
const onlyIds = idsArg ? new Set(readFileSync(idsArg.slice("--ids=".length), "utf8").split(/\s+/).filter(Boolean)) : null;
// --missing waits until OSM has been searched for a station (data/places.json), so places OSM
// already lists are always left out.
const todo = allStations.filter(
  (station) => (!MISSING || (!output[station.id] && osmPlaces[station.id])) && (!onlyIds || onlyIds.has(station.id)),
);
// Stations no longer listed lose their entry.
const listed = new Set(allStations.map((station) => station.id));
for (const id of Object.keys(output)) if (!listed.has(id)) delete output[id];
console.log(`Overture release ${release}: ${todo.length} stations to look up`);

if (todo.length) {
  const db = await DuckDBInstance.create(":memory:");
  const connection = await db.connect();
  await connection.run("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';");
  const source = `read_parquet('s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*', hive_partitioning=1)`;
  const columns = `names.primary AS name, taxonomy.hierarchy AS hierarchy, taxonomy.primary AS kind, bbox.ymin AS lat, bbox.xmin AS lon`;
  // Business-registry records (a company name, no way to contact it) aren't places to walk to:
  // keep places with a website or a phone number.
  const keep = `names.primary IS NOT NULL AND taxonomy.hierarchy[1] IN ('food_and_drink', 'shopping')
    AND confidence >= ${MIN_CONFIDENCE} AND coalesce(operating_status, 'open') = 'open'
    AND (len(websites) > 0 OR len(phones) > 0)`;
  // A box a little larger than the walking radius around each station.
  const box = (station) => {
    const dLat = (WALK_RADIUS_M + 50) / 111_320;
    const dLon = dLat / Math.max(Math.cos((station.lat * Math.PI) / 180), 0.05);
    return { lat0: station.lat - dLat, lat1: station.lat + dLat, lon0: station.lon - dLon, lon1: station.lon + dLon };
  };

  const candidates = new Map(todo.map((station) => [station.id, []]));
  if (todo.length <= PER_STATION_QUERIES) {
    // A few stations (the nightly run): each query reads only the files' parts around one station.
    for (const station of todo) {
      const b = box(station);
      const result = await connection.runAndReadAll(
        `SELECT ${columns} FROM ${source} WHERE bbox.xmin BETWEEN ${b.lon0} AND ${b.lon1} AND bbox.ymin BETWEEN ${b.lat0} AND ${b.lat1} AND ${keep}`,
      );
      candidates.get(station.id).push(...result.getRowObjectsJS());
    }
  } else {
    // Many stations: one pass over the places files, joined with every station's box.
    await connection.run("CREATE TABLE boxes (id VARCHAR, lat0 DOUBLE, lat1 DOUBLE, lon0 DOUBLE, lon1 DOUBLE)");
    const appender = await connection.createAppender("boxes");
    for (const station of todo) {
      const b = box(station);
      appender.appendVarchar(station.id);
      for (const value of [b.lat0, b.lat1, b.lon0, b.lon1]) appender.appendDouble(value);
      appender.endRow();
    }
    appender.closeSync();
    const started = Date.now();
    const result = await connection.runAndReadAll(`
      SELECT boxes.id AS station, p.* FROM (SELECT ${columns} FROM ${source} WHERE ${keep}) p
      JOIN boxes ON p.lon BETWEEN boxes.lon0 AND boxes.lon1 AND p.lat BETWEEN boxes.lat0 AND boxes.lat1`);
    for (const row of result.getRowObjectsJS()) candidates.get(row.station).push(row);
    console.log(`Read Overture places in ${Math.round((Date.now() - started) / 1000)} s`);
  }

  for (const station of todo) {
    const osm = (osmPlaces[station.id] ?? []).map(([category, name, , distance, lat, lon]) => ({ category, key: nameKey(name), distance, lat, lon }));
    const seen = [];
    const added = [];
    const rows = candidates
      .get(station.id)
      .map((place) => ({ ...place, distance: Math.round(meters([station.lat, station.lon], [place.lat, place.lon])) }))
      .filter((place) => place.distance <= WALK_RADIUS_M)
      .sort((a, b) => a.distance - b.distance);
    for (const place of rows) {
      const category = categorize(place.hierarchy ?? []);
      if (!category) continue;
      const key = nameKey(place.name);
      if (!key || NOT_A_PLACE.test(place.name) || (category === "shops" && NOT_A_SHOP.test(place.name.trim()))) continue;
      const near = (other) => meters([place.lat, place.lon], [other.lat, other.lon]) <= SAME_PLACE_M;
      // Already listed by OSM (in any category): the same name anywhere around the station (the two
      // sources often place a chain store a few hundred meters apart), or a similar name nearby.
      // Also skip duplicates within Overture.
      if (osm.some((other) => other.key === key || (sameName(key, other.key) && near(other)))) continue;
      if (seen.some((other) => sameName(key, other.key) && near(other))) continue;
      seen.push({ key, lat: place.lat, lon: place.lon });
      // Keep it only if it's among the 10 closest in its category across both sources.
      const index = categoryIndex[category];
      const closer = osm.filter((other) => other.category === index && other.distance <= place.distance).length
        + added.filter((row) => row[0] === index).length;
      if (closer >= PER_CATEGORY) continue;
      added.push([index, place.name.trim(), humanize(place.kind), place.distance, Number(place.lat.toFixed(5)), Number(place.lon.toFixed(5))]);
    }
    output[station.id] = added;
  }
}

writeData(OUT, { source: "Overture Maps Foundation", release, fetchedAt: new Date().toISOString(), stations: output }, "stations");
const withPlaces = allStations.filter((station) => output[station.id]?.length).length;
console.log(`Overture places added near ${withPlaces} of ${allStations.length} stations`);
