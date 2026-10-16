// Snapshot of Tesla Superchargers outside the US, written to data/world-superchargers.json.
// Source: supercharge.info's free public allSites feed (no key). OpenStreetMap's coverage outside
// the US is patchy (China especially), so the rest of the world comes from this feed; US stations
// keep coming from data/superchargers.json (OpenStreetMap) and are untouched by this script.
//
// Usage:
//   node scripts/import-world-superchargers.mjs              # download the feed (~6.5 MB)
//   node scripts/import-world-superchargers.mjs saved.json   # re-process an earlier download
//   node scripts/import-world-superchargers.mjs saved.json --force  # past the safety brake (see below)
//
// Only built stations are kept (OPEN, EXPANDING, and CLOSED_TEMP, shown as temporarily closed),
// matching the US data. Station data: supercharge.info (credited on the pages that show it).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { writeData } from "./lib/write-data.mjs";

const FEED_URL = "https://supercharge.info/service/supercharge/allSites";
const KEEP_STATUSES = new Set(["OPEN", "EXPANDING", "CLOSED_TEMP"]);

async function load(source) {
  if (source) return JSON.parse(readFileSync(source, "utf8"));
  const response = await fetch(FEED_URL, { headers: { "User-Agent": "TeslaSuperchargerNearMe import" } });
  if (!response.ok) throw new Error(`supercharge.info error ${response.status}`);
  return response.json();
}

// Spells out letters that don't decompose into a base letter plus an accent (ß, ø, ı…).
const TRANSLITERATE = { ß: "ss", ø: "o", Ø: "o", æ: "ae", Æ: "ae", œ: "oe", Œ: "oe", ı: "i", İ: "i", đ: "d", Đ: "d", ł: "l", Ł: "l", þ: "th", Þ: "th", ð: "d", Ð: "d" };
function slugify(value) {
  return String(value || "")
    .replace(/[ßøØæÆœŒıİđĐłŁþÞðÐ]/g, (ch) => TRANSLITERATE[ch])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Feed spelling -> display name + ISO 3166-1 alpha-2 code (the code drives the flag emoji).
const COUNTRIES = {
  Australia: ["Australia", "AU"], Austria: ["Austria", "AT"], Belgium: ["Belgium", "BE"],
  "Bosnia and Herzegovina": ["Bosnia and Herzegovina", "BA"], Bulgaria: ["Bulgaria", "BG"], Canada: ["Canada", "CA"],
  Chile: ["Chile", "CL"], China: ["China", "CN"], Colombia: ["Colombia", "CO"], Croatia: ["Croatia", "HR"],
  "Czech Republic": ["Czechia", "CZ"], Czechia: ["Czechia", "CZ"], Denmark: ["Denmark", "DK"], Estonia: ["Estonia", "EE"],
  Finland: ["Finland", "FI"], France: ["France", "FR"], Germany: ["Germany", "DE"], Greece: ["Greece", "GR"],
  "Hong Kong": ["Hong Kong", "HK"], Hungary: ["Hungary", "HU"], Iceland: ["Iceland", "IS"], India: ["India", "IN"],
  Ireland: ["Ireland", "IE"], Israel: ["Israel", "IL"], Italy: ["Italy", "IT"], Japan: ["Japan", "JP"], Jordan: ["Jordan", "JO"],
  Kazakhstan: ["Kazakhstan", "KZ"], Latvia: ["Latvia", "LV"], Liechtenstein: ["Liechtenstein", "LI"], Lithuania: ["Lithuania", "LT"],
  Luxembourg: ["Luxembourg", "LU"], Macau: ["Macau", "MO"], Malaysia: ["Malaysia", "MY"], Mexico: ["Mexico", "MX"], Morocco: ["Morocco", "MA"],
  Netherlands: ["Netherlands", "NL"], "New Zealand": ["New Zealand", "NZ"], Norway: ["Norway", "NO"], Oman: ["Oman", "OM"],
  Philippines: ["Philippines", "PH"], Poland: ["Poland", "PL"], Portugal: ["Portugal", "PT"], Qatar: ["Qatar", "QA"],
  Romania: ["Romania", "RO"], "Saudi Arabia": ["Saudi Arabia", "SA"], Serbia: ["Serbia", "RS"], Singapore: ["Singapore", "SG"],
  Slovakia: ["Slovakia", "SK"], Slovenia: ["Slovenia", "SI"], "South Korea": ["South Korea", "KR"], Spain: ["Spain", "ES"],
  Sweden: ["Sweden", "SE"], Switzerland: ["Switzerland", "CH"], Taiwan: ["Taiwan", "TW"], Thailand: ["Thailand", "TH"],
  Turkey: ["Turkey", "TR"], "United Arab Emirates": ["United Arab Emirates", "AE"], "United Kingdom": ["United Kingdom", "GB"],
  Uruguay: ["Uruguay", "UY"],
};

// Countries whose regions the feed gives as short codes, like US states ("Toronto, ON").
const CODED_REGIONS = new Set(["CA", "AU"]);

function plugLabel(plugs = {}) {
  if (plugs.nacs) return "NACS";
  if (plugs.ccs2) return "CCS2";
  if (plugs.gbt) return "GB/T";
  if (plugs.ccs1) return "CCS1";
  if (plugs.type2) return "Type 2";
  if (plugs.tpc) return "NACS"; // Tesla's connector, the same plug as NACS
  return null;
}

const raw = await load(process.argv.slice(2).find((arg) => !arg.startsWith("--")));
const rows = raw
  .filter((s) => s.address?.country && s.address.country !== "USA")
  .filter((s) => KEEP_STATUSES.has(s.status))
  .filter((s) => s.address.city && typeof s.gps?.latitude === "number" && typeof s.gps?.longitude === "number" && s.gps.latitude !== 0)
  .sort((a, b) => a.id - b.id);

const unmapped = new Set(rows.map((s) => s.address.country).filter((c) => !COUNTRIES[c]));
if (unmapped.size) console.warn(`Unmapped countries (add to COUNTRIES): ${[...unmapped].join(", ")}`);

// City slugs are unique per country; the same city name in two regions gets the region added.
const cityRegions = new Map();
for (const s of rows) {
  const key = `${s.address.country}|${slugify(s.address.city)}`;
  if (!cityRegions.has(key)) cityRegions.set(key, new Set());
  cityRegions.get(key).add(slugify(s.address.state || ""));
}

const stations = rows.map((s) => {
  const a = s.address;
  const [countryName, countryCode] = COUNTRIES[a.country] ?? [a.country, null];
  const region = String(a.state || "").trim();
  const baseCity = slugify(a.city) || `city-${s.id}`;
  const shared = (cityRegions.get(`${a.country}|${slugify(a.city)}`)?.size ?? 1) > 1;
  const city = shared && region ? `${baseCity}-${slugify(region)}` : baseCity;
  const cityLabel = CODED_REGIONS.has(countryCode) && region
    ? `${a.city}, ${region.toUpperCase()}`
    : shared && region
      ? `${a.city}, ${region}`
      : `${a.city}, ${countryName}`;
  // Feed names look like "London, UK - Canary Wharf"; the part after " - " names the location.
  const location = String(s.name || "").split(" - ").slice(1).join(" - ").trim();
  const id = `s${s.id}`;
  const street = a.street?.trim() || null;
  const address = [street, [a.zip, a.city].filter(Boolean).join(" "), countryName].filter(Boolean).join(", ");
  return {
    id,
    slug: `${slugify(location || street || a.city) || "supercharger"}-${id}`,
    state: slugify(countryName), // the country takes the place of the US state in URLs
    city,
    name: String(s.name || `${a.city} Supercharger`).replace(/ - /g, " – "),
    cityLabel,
    nearLabel: null,
    street,
    address,
    lat: Number(s.gps.latitude.toFixed(6)),
    lon: Number(s.gps.longitude.toFixed(6)),
    stalls: typeof s.stallCount === "number" && s.stallCount > 0 ? s.stallCount : null,
    maxKw: typeof s.powerKilowatt === "number" && s.powerKilowatt > 0 ? s.powerKilowatt : null,
    ccs: Boolean(s.otherEVs), // open to non-Tesla EVs
    plug: plugLabel(s.plugs),
    country: countryName,
    countryCode,
    cityName: a.city,
    region: region || null,
    ...(s.status === "CLOSED_TEMP" ? { temporarilyClosed: true } : {}),
  };
});

const slugs = new Set(stations.map((s) => s.slug));
if (slugs.size !== stations.length) throw new Error("Station slugs are not unique");

// Stations that dropped out of the feed (closed, or moved to a new site id) send their visitors to
// the nearest station still listed, through data/station-redirects.json (shared with the US list).
const OUT = new URL("../data/world-superchargers.json", import.meta.url);
const REDIRECTS = new URL("../data/station-redirects.json", import.meta.url);
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")).stations : [];
const redirects = existsSync(REDIRECTS) ? JSON.parse(readFileSync(REDIRECTS, "utf8")).redirects : {};
const currentIds = new Set(stations.map((s) => s.id));
const km = (a, b) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const h = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
const dropped = previous.filter((old) => !currentIds.has(old.id));
// Safety brake for the nightly run, as in reconcile-us-superchargers.mjs: a broken feed must not
// empty the map. Stop without writing anything; --force goes ahead.
const maxDropped = Math.max(25, Math.round(previous.length * 0.05));
if (!process.argv.includes("--force") && (dropped.length > maxDropped || stations.length < previous.length * 0.9)) {
  console.error(`Stopped: ${dropped.length} stations would drop out (limit ${maxDropped}), ${stations.length} listed for ${previous.length} before. Nothing was written.`);
  process.exit(1);
}
for (const old of dropped) {
  const nearest = stations.reduce((best, s) => (!best || km(old, s) < km(old, best) ? s : best), null);
  redirects[old.id] = nearest.id;
}
for (const id of currentIds) delete redirects[id]; // a station that came back
writeFileSync(REDIRECTS, JSON.stringify({ redirects: Object.fromEntries(Object.entries(redirects).sort()) }, null, 1) + "\n");
if (dropped.length) console.log(`${dropped.length} stations dropped out of the feed; redirected to the nearest listed station`);

writeData(OUT, { source: "supercharge.info", fetchedAt: new Date().toISOString(), stations }, "stations");
const countries = new Set(stations.map((s) => s.state));
const cities = new Set(stations.map((s) => `${s.state}/${s.city}`));
console.log(`Wrote ${stations.length} Superchargers outside the US: ${countries.size} countries, ${cities.size} cities`);
