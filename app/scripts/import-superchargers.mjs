// One-time snapshot of US Tesla Superchargers from OpenStreetMap, written to data/superchargers.json.
// This is the seed for the M1 nightly import job; visitors never call Overpass themselves.
//
// Usage:
//   node scripts/import-superchargers.mjs                 # download from Overpass (takes a minute)
//   node scripts/import-superchargers.mjs saved.json      # re-process an earlier Overpass download
//
// Data © OpenStreetMap contributors, ODbL. Pages that show it carry the OSM credit.
import { readFileSync, writeFileSync } from "node:fs";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const QUERY = `[out:json][timeout:300];
area["ISO3166-1"="US"][admin_level=2]->.us;
nwr["amenity"="charging_station"]["brand"~"^tesla",i](area.us);
out center tags;`;

async function load(source) {
  if (source) return JSON.parse(readFileSync(source, "utf8"));
  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "TeslaSuperchargerNearMe import" },
    body: "data=" + encodeURIComponent(QUERY),
  });
  if (!response.ok) throw new Error(`Overpass error ${response.status}`);
  return response.json();
}

function isSupercharger(tags) {
  const text = ["name", "brand", "network", "operator", "description"].map((key) => tags[key] ?? "").join(" ").toLowerCase();
  if (text.includes("destination") || text.includes("no supercharger")) return false;
  return text.includes("supercharger") || Object.keys(tags).some((key) => key.startsWith("socket:tesla_supercharger"));
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Highest charging power listed on any socket, e.g. "socket:nacs:output" = "250 kW".
function maxKw(tags) {
  const outputs = Object.entries(tags)
    .filter(([key]) => key.startsWith("socket:") && key.endsWith(":output"))
    .map(([, value]) => Number.parseFloat(String(value)))
    .filter((kw) => Number.isFinite(kw) && kw > 0 && kw < 1000);
  return outputs.length ? Math.max(...outputs) : null;
}

const GENERIC_NAMES = new Set(["tesla supercharger", "tesla", "supercharger", "tesla, inc."]);

function normalize(element) {
  const tags = element.tags ?? {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat == null || lon == null) return null;

  const city = tags["addr:city"]?.trim() || null;
  const state = tags["addr:state"]?.trim().toUpperCase() || null;
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ") || null;
  const specificName = tags.name && !GENERIC_NAMES.has(tags.name.trim().toLowerCase()) ? tags.name.trim() : null;

  // Tesla names stations "City, ST - Location"; OSM usually just says "Tesla Supercharger".
  const name =
    specificName ?? (city && state ? `${city}, ${state}${tags["addr:street"] ? ` – ${tags["addr:street"]}` : ""}` : "Tesla Supercharger");
  const address = [street, city, [state, tags["addr:postcode"]].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;

  const id = `${element.type[0]}${element.id}`;
  const capacity = Number.parseInt(tags.capacity ?? "", 10);

  return {
    id,
    slug: `${slugify(tags["addr:street"] ?? specificName ?? "supercharger") || "supercharger"}-${id}`,
    state: state && /^[A-Z]{2}$/.test(state) ? state.toLowerCase() : "us",
    city: city ? slugify(city) : "unlisted",
    name,
    cityLabel: city && state ? `${city}, ${state}` : null,
    address,
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    stalls: Number.isFinite(capacity) && capacity > 0 ? capacity : null,
    maxKw: maxKw(tags),
    // A CCS socket means a Magic Dock adapter, so non-Tesla EVs can charge there.
    ccs: Object.keys(tags).some((key) => key.startsWith("socket:type1_combo")),
  };
}

const raw = await load(process.argv[2]);
const stations = raw.elements
  .filter((element) => isSupercharger(element.tags ?? {}))
  .map(normalize)
  .filter(Boolean)
  .sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city) || a.slug.localeCompare(b.slug));

writeFileSync(
  new URL("../data/superchargers.json", import.meta.url),
  JSON.stringify({ source: "OpenStreetMap contributors (ODbL)", fetchedAt: raw.osm3s?.timestamp_osm_base ?? null, stations }),
);
console.log(`Wrote ${stations.length} Superchargers`);
