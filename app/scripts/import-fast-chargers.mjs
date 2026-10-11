// Non-Tesla DC fast chargers (Electrify America, EVgo, ChargePoint…) in the US and Canada, for the
// route planner's fallback stops. Source: US DOE Alternative Fuels Data Center station data
// (public domain), written to data/fast-chargers.json. Visitors never call the API.
//
// Usage: NLR_API_KEY=… node scripts/import-fast-chargers.mjs
// The key is free at https://developer.nlr.gov/signup/ (the lab was NREL; developer.nrel.gov is gone).
// Without a key the shared DEMO_KEY is used, which allows only a few requests per hour.
import { writeFileSync } from "node:fs";

const API = "https://developer.nlr.gov/api/alt-fuel-stations/v1.json";
const MIN_KW = 50; // slower "fast" chargers barely help on a road trip

// Connector bits stored per station.
const CCS = 1;
const NACS = 2;

const key = process.env.NLR_API_KEY || "DEMO_KEY";
if (key === "DEMO_KEY") console.warn("No NLR_API_KEY set; using the rate-limited DEMO_KEY.");

const url = new URL(API);
for (const [name, value] of Object.entries({
  api_key: key,
  fuel_type: "ELEC",
  ev_charging_level: "dc_fast",
  status: "E", // open now (not planned or temporarily closed)
  access: "public",
  country: "all", // US and Canada
  limit: "all",
})) {
  url.searchParams.set(name, value);
}

const response = await fetch(url, { headers: { "User-Agent": "TeslaSuperchargerNearMe import" } });
if (!response.ok) throw new Error(`Download failed: ${response.status} ${await response.text()}`);
const { fuel_stations: all } = await response.json();

const stations = [];
for (const station of all) {
  if (/tesla/i.test(station.ev_network ?? "")) continue; // Superchargers come from our own data
  let connectors = 0;
  let maxKw = 0;
  for (const unit of station.ev_charging_units ?? []) {
    for (const [type, { power_kw: kw, port_count: ports }] of Object.entries(unit.connectors ?? {})) {
      if (!ports) continue;
      const bit = type === "J1772COMBO" ? CCS : type === "TESLA" ? NACS : 0;
      if (!bit || (kw !== null && kw < MIN_KW) || (kw === null && unit.charging_level !== "DC")) continue;
      connectors |= bit;
      maxKw = Math.max(maxKw, kw ?? 0);
    }
  }
  // Older records without per-unit detail: fall back to the station's connector list.
  if (!connectors && !(station.ev_charging_units ?? []).length) {
    if (station.ev_connector_types?.includes("J1772COMBO")) connectors |= CCS;
    if (station.ev_connector_types?.includes("TESLA")) connectors |= NACS;
  }
  if (!connectors) continue;

  stations.push([
    station.id,
    station.station_name.trim(),
    station.ev_network ?? "Other",
    Math.round(station.latitude * 1e5) / 1e5,
    Math.round(station.longitude * 1e5) / 1e5,
    station.ev_dc_fast_num ?? null,
    maxKw || null,
    connectors,
    [station.city, station.state].filter(Boolean).join(", ") || null,
  ]);
}

writeFileSync(
  new URL("../data/fast-chargers.json", import.meta.url),
  JSON.stringify({
    source: "US DOE Alternative Fuels Data Center",
    fetchedAt: new Date().toISOString().slice(0, 10),
    // [AFDC id, name, network, lat, lon, DC fast ports, max kW (null if unknown), connectors (1 CCS, 2 NACS), "City, ST"]
    stations,
  }),
);
console.log(`Wrote ${stations.length} non-Tesla fast-charging stations (of ${all.length} DC fast) to data/fast-chargers.json`);
