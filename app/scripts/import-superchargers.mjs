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
  // The house number keeps stations on the same road apart ("Dublin, CA – 7201 Dublin Boulevard").
  const name =
    specificName ?? (city && state ? `${city}, ${state}${street ? ` – ${street}` : ""}` : "Tesla Supercharger");
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
    street,
    // Set below when OSM has no city: the nearest station's city, shown as "near …".
    nearLabel: null,
    address,
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    stalls: Number.isFinite(capacity) && capacity > 0 ? capacity : null,
    maxKw: maxKw(tags),
    // A CCS socket means a Magic Dock adapter, so non-Tesla EVs can charge there.
    ccs: Object.keys(tags).some((key) => key.startsWith("socket:type1_combo")),
  };
}

function km(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const raw = await load(process.argv[2]);
const normalized = raw.elements.filter((element) => isSupercharger(element.tags ?? {})).map(normalize).filter(Boolean);

// About 9% of stations have no address in OSM. Borrow the nearest addressed station's city
// (within 40 km) so they get a real state/city page and an honest "near …" name.
const addressed = normalized.filter((station) => station.cityLabel);
for (const station of normalized) {
  if (station.cityLabel) continue;
  let best = null;
  for (const other of addressed) {
    const distance = km(station, other);
    if (distance < 40 && (!best || distance < best.distance)) best = { other, distance };
  }
  if (!best) continue;
  station.state = best.other.state;
  station.city = best.other.city;
  station.nearLabel = best.other.cityLabel;
  if (station.name === "Tesla Supercharger") station.name = `Tesla Supercharger near ${best.other.cityLabel}`;
  station.slug = `near-${best.other.city}-${station.id}`;
}

// Any names still shared (two entries at one address) get the stall count, then a number.
const byName = Map.groupBy(normalized, (station) => station.name);
for (const group of byName.values()) {
  if (group.length < 2) continue;
  group.forEach((station, index) => {
    station.name = `${station.name} (${station.stalls ? `${station.stalls} stalls` : `#${index + 1}`})`;
  });
}
const stillShared = Map.groupBy(normalized, (station) => station.name);
for (const group of stillShared.values()) {
  if (group.length > 1) group.forEach((station, index) => (station.name = `${station.name} #${index + 1}`));
}

const stations = normalized.sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city) || a.slug.localeCompare(b.slug));

writeFileSync(
  new URL("../data/superchargers.json", import.meta.url),
  JSON.stringify({ source: "OpenStreetMap contributors (ODbL)", fetchedAt: raw.osm3s?.timestamp_osm_base ?? null, stations }),
);
console.log(`Wrote ${stations.length} Superchargers`);
