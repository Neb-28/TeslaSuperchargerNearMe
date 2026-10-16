// Snapshot of places near every Supercharger, written to data/places.json.
// Seed for the M1 nightly import job (PRD "Import job"); visitors never call Overpass.
//
// Usage: node scripts/import-places.mjs        (needs data/superchargers.json; can take an hour)
//        node scripts/import-places.mjs --fresh  (start over instead of resuming)
//        node scripts/import-places.mjs --first=38.63,-77.29  (do the area around a point first)
//        node scripts/import-places.mjs --world  (stations outside the US, data/world-superchargers.json)
//        node scripts/import-places.mjs --missing  (only stations with no places yet, e.g. just added;
//                                                   add --world for stations outside the US)
//        node scripts/import-places.mjs --missing --ids=new-ids.txt  (only these station ids, one per line)
//        node scripts/import-places.mjs --missing --minutes=20  (start no new batch after 20 minutes)
//
// US stations are looked up around Tesla stations as mapped in OpenStreetMap. Many stations
// abroad (China especially) aren't in OSM, so --world searches around each station's own
// coordinates instead, in small batches of nearby stations.
//
// Progress is saved after every grid cell, so the site can use partial data and a stopped run
// resumes where it left off. Cells that keep failing are skipped and retried on the next run.
//
// The US is split into grid cells so each Overpass query stays small, and queries run one at a
// time with pauses, within the public server's fair-use limits.
// Data © OpenStreetMap contributors, ODbL.
import { existsSync, readFileSync } from "node:fs";
import { writeData } from "./lib/write-data.mjs";

// The main public server is often busy (504); retries alternate with a public mirror.
const OVERPASS_URLS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const CELL_DEGREES = 3;
const WALK_RADIUS_M = 600; // PRD: places within 600 m
const CHARGER_RADIUS_M = 1600; // other EV chargers: about a mile, since you drive there
const PER_CATEGORY = 10;

// Order matters: the index is stored in the output (see lib/places.ts CATEGORY_IDS).
const CATEGORY_IDS = ["food", "coffee", "grocery", "bars", "shops", "chargers"];

const KIND_LABELS = {
  restaurant: "Restaurant",
  fast_food: "Fast food",
  food_court: "Food court",
  ice_cream: "Ice cream",
  cafe: "Café",
  coffee: "Coffee shop",
  bar: "Bar",
  pub: "Pub",
  biergarten: "Beer garden",
  wine: "Wine shop",
  alcohol: "Liquor store",
  supermarket: "Supermarket",
  convenience: "Convenience store",
  greengrocer: "Greengrocer",
};

const NOT_SHOPS = new Set(["vacant", "car", "car_repair", "car_parts", "tyres", "fuel", "funeral_directors", "yes"]);

function isTesla(tags) {
  return ["brand", "operator", "network", "name"].some((key) => /tesla/i.test(tags[key] ?? ""));
}

function categorize(tags) {
  const { amenity, shop } = tags;
  if (amenity === "charging_station") return isTesla(tags) ? null : "chargers";
  if (amenity === "cafe" || shop === "coffee") return "coffee";
  if (["restaurant", "fast_food", "food_court", "ice_cream"].includes(amenity)) return "food";
  if (["bar", "pub", "biergarten"].includes(amenity) || ["wine", "alcohol"].includes(shop)) return "bars";
  if (["supermarket", "convenience", "greengrocer"].includes(shop)) return "grocery";
  if (shop && !NOT_SHOPS.has(shop)) return "shops";
  return null;
}

function humanize(value) {
  const text = value.replace(/_/g, " ").split(";")[0];
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function describe(tags, category) {
  if (category === "chargers") {
    const network = tags.network || tags.brand || tags.operator;
    const outputs = Object.entries(tags)
      .filter(([key]) => key.startsWith("socket:") && key.endsWith(":output"))
      .map(([, value]) => Number.parseFloat(value))
      .filter(Number.isFinite);
    const fast = outputs.some((kw) => kw >= 50) || Object.keys(tags).some((key) => /socket:(type1_combo|chademo)/.test(key));
    // Skip the name when it just repeats the network ("EVgo" vs "eVgo").
    const name =
      tags.name && tags.name.toLowerCase() !== network?.toLowerCase()
        ? `${network ? `${network} · ` : ""}${tags.name}`
        : network || "EV charging station";
    return { name, kind: fast ? "DC fast charging" : "Level 2 charging" };
  }
  const kindKey = tags.amenity && KIND_LABELS[tags.amenity] ? tags.amenity : tags.shop;
  return { name: tags.name, kind: KIND_LABELS[kindKey] ?? humanize(kindKey ?? "Shop") };
}

function meters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function overpass(query) {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const url = OVERPASS_URLS[(attempt - 1) % OVERPASS_URLS.length];
    let problem;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "TeslaSuperchargerNearMe import" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(240_000),
      });
      if (response.ok) return (await response.json()).elements ?? [];
      problem = response.status;
    } catch (error) {
      // Dropped connections and timeouts are as common as 504s on the public servers.
      problem = error.cause?.code ?? error.name;
    }
    const wait = Math.min(attempt * 15, 60);
    console.warn(`  ${new URL(url).host} ${problem}, retrying in ${wait}s`);
    await sleep(wait * 1000);
  }
  return null; // give up on this cell for now; the next run retries it
}

const WORLD = process.argv.includes("--world");
const WORLD_BATCH = 25;
const { stations } = JSON.parse(
  readFileSync(new URL(WORLD ? "../data/world-superchargers.json" : "../data/superchargers.json", import.meta.url), "utf8"),
);

// Group stations into grid cells; world cells are split into small batches (keys start "w:").
const cells = new Map();
for (const station of stations) {
  const key = `${Math.floor(station.lat / CELL_DEGREES)}:${Math.floor(station.lon / CELL_DEGREES)}`;
  if (!cells.has(key)) cells.set(key, []);
  cells.get(key).push(station);
}
if (WORLD) {
  for (const [key, cellStations] of [...cells]) {
    cells.delete(key);
    for (let i = 0; i < cellStations.length; i += WORLD_BATCH) cells.set(`w:${key}:${i / WORLD_BATCH}`, cellStations.slice(i, i + WORLD_BATCH));
  }
}

function queryFor(cellStations) {
  if (WORLD || MISSING) {
    const around = (radius, station) => `(around:${radius},${station.lat},${station.lon})`;
    const parts = cellStations.flatMap((station) => [
      `nwr${around(WALK_RADIUS_M, station)}["amenity"~"^(restaurant|fast_food|food_court|ice_cream|cafe|bar|pub|biergarten)$"]["name"];`,
      `nwr${around(WALK_RADIUS_M, station)}["shop"]["name"];`,
      `nwr${around(CHARGER_RADIUS_M, station)}["amenity"="charging_station"];`,
    ]);
    return `[out:json][timeout:180];\n(\n${parts.join("\n")}\n);\nout center tags;`;
  }
  const lats = cellStations.map((s) => s.lat);
  const lons = cellStations.map((s) => s.lon);
  const bbox = [Math.min(...lats) - 0.001, Math.min(...lons) - 0.001, Math.max(...lats) + 0.001, Math.max(...lons) + 0.001].join(",");
  return `[out:json][timeout:180];
nwr["amenity"="charging_station"]["brand"~"^tesla",i](${bbox})->.sc;
(
  nwr(around.sc:${WALK_RADIUS_M})["amenity"~"^(restaurant|fast_food|food_court|ice_cream|cafe|bar|pub|biergarten)$"]["name"];
  nwr(around.sc:${WALK_RADIUS_M})["shop"]["name"];
  nwr(around.sc:${CHARGER_RADIUS_M})["amenity"="charging_station"];
);
out center tags;`;
}

const OUT = new URL("../data/places.json", import.meta.url);
const previous = !process.argv.includes("--fresh") && existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const output = previous?.stations ?? {};
const cellsDone = new Set(previous?.cellsDone ?? []);
const save = () => writeData(OUT, { categories: CATEGORY_IDS, cellsDone: [...cellsDone], stations: output }, "stations");

// --missing: only stations with no places yet, searched around their own coordinates like --world
// (stations added from supercharge.info may not be in OSM). These batches aren't marked done.
const MISSING = process.argv.includes("--missing");
const minutesArg = process.argv.find((arg) => arg.startsWith("--minutes="));
const deadline = minutesArg ? Date.now() + Number(minutesArg.slice("--minutes=".length)) * 60_000 : Infinity;
const idsArg = process.argv.find((arg) => arg.startsWith("--ids="));
const onlyIds = idsArg ? new Set(readFileSync(idsArg.slice("--ids=".length), "utf8").split(/\s+/).filter(Boolean)) : null;
if (MISSING) {
  const todo = stations.filter((station) => !output[station.id] && (!onlyIds || onlyIds.has(station.id)));
  cells.clear();
  for (let i = 0; i < todo.length; i += WORLD_BATCH) cells.set(`m:${i / WORLD_BATCH}`, todo.slice(i, i + WORLD_BATCH));
}

// Optionally process the cell containing a given point first (handy for testing one area).
const firstArg = process.argv.find((arg) => arg.startsWith("--first="));
const order = [...cells];
if (firstArg) {
  const [lat, lon] = firstArg.slice("--first=".length).split(",").map(Number);
  const firstKey = `${Math.floor(lat / CELL_DEGREES)}:${Math.floor(lon / CELL_DEGREES)}`;
  const isFirst = (key) => key === firstKey || key.startsWith(`w:${firstKey}:`);
  order.sort(([a], [b]) => isFirst(b) - isFirst(a));
}

let done = 0;
let skipped = 0;
for (const [cellKey, cellStations] of order) {
  done++;
  if (cellsDone.has(cellKey)) continue;
  if (Date.now() > deadline) {
    console.warn(`Time limit reached after ${done - 1} of ${cells.size} batches; the next run continues.`);
    break;
  }
  const query = queryFor(cellStations);

  const elements = await overpass(query);
  if (!elements) {
    skipped++;
    console.warn(`cell ${done}/${cells.size}: skipped after repeated errors`);
    continue;
  }
  const places = elements
    .map((element) => {
      const tags = element.tags ?? {};
      const category = categorize(tags);
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (!category || lat == null || lon == null) return null;
      return { category, ...describe(tags, category), lat, lon };
    })
    .filter(Boolean);

  for (const station of cellStations) {
    const near = places
      .map((place) => ({ ...place, distance: Math.round(meters([station.lat, station.lon], [place.lat, place.lon])) }))
      .filter((place) => place.distance <= (place.category === "chargers" ? CHARGER_RADIUS_M : WALK_RADIUS_M))
      .sort((a, b) => a.distance - b.distance);

    const rows = [];
    for (const [index, category] of CATEGORY_IDS.entries()) {
      const seen = new Set();
      near
        .filter((place) => place.category === category)
        .filter((place) => {
          // The same business is often mapped twice (a point and a building outline).
          const key = place.name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, PER_CATEGORY)
        .forEach((place) => rows.push([index, place.name, place.kind, place.distance, Number(place.lat.toFixed(5)), Number(place.lon.toFixed(5))]));
    }
    // Searches around a station's own coordinates (--world, --missing) also record "nothing
    // nearby", so --missing doesn't search the same empty spot again. The US grid search only finds
    // places around stations mapped in OSM, so there an empty result isn't final.
    if (rows.length || WORLD || MISSING) output[station.id] = rows;
  }

  if (!MISSING) cellsDone.add(cellKey);
  save();
  console.log(`cell ${done}/${cells.size}: ${cellStations.length} stations, ${places.length} places`);
  await sleep(3000);
}

save();
const withPlaces = stations.filter((station) => output[station.id]?.length).length;
const searched = stations.filter((station) => output[station.id]).length;
console.log(`Places near ${withPlaces} of ${stations.length} stations (${searched - withPlaces} searched, nothing nearby)${skipped ? `; ${skipped} batches skipped, run again to retry them` : ""}`);
