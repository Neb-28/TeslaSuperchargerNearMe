// Brings data/superchargers.json (US) in line with supercharge.info, the community list of open
// Superchargers, while keeping every existing station's id and URL.
//
//   1. Each of our stations is paired with one supercharge.info site: first by id (OSM id, or our
//      own "s…" id for stations this script added), then nearest first within 500 m, then open
//      sites within 2 km.
//   2. Paired with an open site: kept, with the site's stall count and power (and marked
//      temporarilyClosed while the site says so). Stations OSM had no
//      address for also take the site's address (the slug stays, so the URL only changes its
//      city segment, and the station page redirects the old one).
//   3. Not paired, or paired with a site that isn't open (closed, planned, under construction):
//      removed, and its id is added to data/station-redirects.json pointing at the nearest kept
//      station, so old links and search results land on a real station.
//   4. Open sites none of ours paired with: added as new stations (id "s" + the site id).
//
// Usage:
//   node scripts/reconcile-us-superchargers.mjs                    # download the feed (~6.5 MB)
//   node scripts/reconcile-us-superchargers.mjs saved.json         # use an earlier download
//   node scripts/reconcile-us-superchargers.mjs saved.json --report=report.json
//   node scripts/reconcile-us-superchargers.mjs saved.json --force   # past the safety brake (see below)
//
// Station data: supercharge.info and OpenStreetMap contributors (ODbL), credited on the pages.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { writeData } from "./lib/write-data.mjs";

const FEED_URL = "https://supercharge.info/service/supercharge/allSites";
const OPEN_STATUSES = new Set(["OPEN", "EXPANDING", "CLOSED_TEMP"]);
const NEAR_KM = 0.5;
const FAR_KM = 2;

const args = process.argv.slice(2);
const source = args.find((arg) => !arg.startsWith("--"));
const reportPath = args.find((arg) => arg.startsWith("--report="))?.slice("--report=".length);
const force = args.includes("--force");

async function load() {
  if (source) return JSON.parse(readFileSync(source, "utf8"));
  const response = await fetch(FEED_URL, { headers: { "User-Agent": "TeslaSuperchargerNearMe import" } });
  if (!response.ok) throw new Error(`supercharge.info error ${response.status}`);
  return response.json();
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function km(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// The same city spelled two ways ("Mt Pleasant" and "Mount Pleasant") should share one city page.
const CITY_WORDS = { mt: "mount", ft: "fort", pt: "port", saint: "st" };
const cityKey = (name) => slugify(name).split("-").map((word) => CITY_WORDS[word] ?? word).join("-");

const dataUrl = (file) => new URL(`../data/${file}`, import.meta.url);
const snapshot = JSON.parse(readFileSync(dataUrl("superchargers.json"), "utf8"));
const redirectsFile = dataUrl("station-redirects.json");
const redirects = existsSync(redirectsFile) ? JSON.parse(readFileSync(redirectsFile, "utf8")).redirects : {};

const feed = await load();
const sites = feed
  .filter((site) => site.address?.country === "USA" && typeof site.gps?.latitude === "number" && site.gps.latitude !== 0)
  .map((site) => ({ ...site, lat: site.gps.latitude, lon: site.gps.longitude }));
const siteById = new Map(sites.map((site) => [site.id, site]));
const siteByOsmId = new Map(sites.filter((site) => site.osmId).map((site) => [site.osmId, site]));

const ours = snapshot.stations;
// Tesla Semi truck chargers were tagged like Superchargers in OSM; they're not for cars.
const isSemiCharger = (station) => /megacharger|tesla semi/i.test(station.name);
const pairs = new Map(); // our station id -> { site, km }
const taken = new Set(); // site ids already paired

// 1a. By id: our own "s…" ids, then the OSM id the site lists (checked against distance, since a
// node and a way can share a number).
for (const station of ours) {
  const site = station.id.startsWith("s")
    ? siteById.get(Number(station.id.slice(1)))
    : siteByOsmId.get(Number(station.id.slice(1)));
  if (!site || taken.has(site.id)) continue;
  const distance = km(station, site);
  if (station.id.startsWith("s") || distance <= FAR_KM) {
    pairs.set(station.id, { site, km: distance });
    taken.add(site.id);
  }
}

// 1b. Nearest first. At one spot, a station with an address wins over a duplicate without one.
for (const limit of [NEAR_KM, FAR_KM]) {
  const candidates = [];
  for (const station of ours) {
    if (pairs.has(station.id) || isSemiCharger(station)) continue;
    // Past 500 m only for stations with no site nearby: one next to a taken site is a duplicate.
    if (limit > NEAR_KM && sites.some((site) => km(station, site) <= NEAR_KM)) continue;
    for (const site of sites) {
      if (taken.has(site.id) || (limit > NEAR_KM && !OPEN_STATUSES.has(site.status))) continue;
      const distance = km(station, site);
      if (distance <= limit) candidates.push({ station, site, distance, rank: distance + (station.street ? 0 : 0.05) });
    }
  }
  candidates.sort((a, b) => a.rank - b.rank);
  for (const { station, site, distance } of candidates) {
    if (pairs.has(station.id) || taken.has(site.id)) continue;
    pairs.set(station.id, { site, km: distance });
    taken.add(site.id);
  }
}

const formatStreet = (site) => site.address.street?.trim() || null;
// "ccs" on our pages means Magic Dock (CCS cars plug in with no adapter of their own), which the
// feed lists as "multi" / "ccs1" plugs. Its "otherEVs" means open to other EVs with an adapter.
const hasMagicDock = (site) => Boolean(site.plugs?.multi || site.plugs?.ccs1);
const stateOf = (site) => (/^[A-Z]{2}$/.test(site.address.state ?? "") ? site.address.state : null);
const addressOf = (site) => {
  const state = stateOf(site);
  return [formatStreet(site), site.address.city, [state, site.address.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;
};
const nameOf = (site) => {
  const street = formatStreet(site);
  return `${site.address.city}, ${stateOf(site)}${street ? ` – ${street}` : ""}`;
};

// Existing city pages per state, so a station joins "mount-pleasant" rather than starting
// "mt-pleasant".
const citySlugs = new Map();
for (const station of ours) {
  if (!station.cityLabel) continue;
  const key = `${station.state}|${cityKey(station.cityLabel.split(",")[0])}`;
  if (!citySlugs.has(key)) citySlugs.set(key, { city: station.city, label: station.cityLabel });
}
const cityFor = (site) => citySlugs.get(`${stateOf(site).toLowerCase()}|${cityKey(site.address.city)}`) ?? null;

const kept = [];
const removed = [];
const updated = [];
for (const station of ours) {
  const pair = pairs.get(station.id);
  if (isSemiCharger(station)) {
    removed.push({ station, reason: "Tesla Semi truck charger, not for cars", site: null, km: null });
    continue;
  }
  if (!pair || !OPEN_STATUSES.has(pair.site.status)) {
    removed.push({ station, reason: pair ? `supercharge.info: ${pair.site.status.toLowerCase().replace("_", " ")}` : "no open Supercharger within 2 km", site: pair?.site ?? null, km: pair?.km ?? null });
    continue;
  }
  const { site } = pair;
  const next = { ...station };
  if (site.stallCount > 0) next.stalls = site.stallCount;
  if (site.powerKilowatt > 0) next.maxKw = site.powerKilowatt;
  next.ccs = station.ccs || hasMagicDock(site);
  if (site.status === "CLOSED_TEMP") next.temporarilyClosed = true;
  else delete next.temporarilyClosed;
  // No address in OSM: the site's own address replaces the borrowed "near …" city.
  if (!station.cityLabel && site.address.city && stateOf(site)) {
    const existingCity = cityFor(site);
    const street = formatStreet(site);
    next.state = stateOf(site).toLowerCase();
    next.city = existingCity?.city ?? slugify(site.address.city);
    next.cityLabel = existingCity?.label ?? `${site.address.city}, ${stateOf(site)}`;
    next.nearLabel = null;
    next.street = street;
    next.address = addressOf(site);
    next.name = `${next.cityLabel}${street ? ` – ${street}` : ""}`;
  }
  const changes = ["stalls", "maxKw", "ccs", "temporarilyClosed", "state", "city", "name", "address"].filter((key) => next[key] !== station[key]);
  if (changes.length) updated.push({ before: station, after: next, changes, km: pair.km });
  kept.push(next);
}

const added = [];
const usedNames = new Set(kept.map((station) => station.name));
for (const site of sites) {
  if (taken.has(site.id) || !OPEN_STATUSES.has(site.status) || !stateOf(site) || !site.address.city) continue;
  const state = stateOf(site).toLowerCase();
  const existingCity = cityFor(site);
  const street = formatStreet(site);
  const id = `s${site.id}`;
  let name = existingCity?.label ? `${existingCity.label}${street ? ` – ${street}` : ""}` : nameOf(site);
  if (usedNames.has(name)) name = `${name} (${site.stallCount ? `${site.stallCount} stalls` : `#${site.id}`})`;
  usedNames.add(name);
  const station = {
    id,
    slug: `${slugify((street ?? "").replace(/^[\d-]+[a-z]?\s+/i, "") || site.address.city) || "supercharger"}-${id}`,
    state,
    city: existingCity?.city ?? slugify(site.address.city),
    name,
    cityLabel: existingCity?.label ?? `${site.address.city}, ${stateOf(site)}`,
    street,
    nearLabel: null,
    address: addressOf(site),
    lat: Number(site.lat.toFixed(6)),
    lon: Number(site.lon.toFixed(6)),
    stalls: site.stallCount > 0 ? site.stallCount : null,
    maxKw: site.powerKilowatt > 0 ? site.powerKilowatt : null,
    ccs: hasMagicDock(site),
    ...(site.status === "CLOSED_TEMP" ? { temporarilyClosed: true } : {}),
  };
  added.push({ station, site });
  kept.push(station);
}

// Removed stations send visitors to the nearest station that's still on the site.
for (const entry of removed) {
  let best = null;
  for (const station of kept) {
    const distance = km(entry.station, station);
    if (!best || distance < best.distance) best = { station, distance };
  }
  entry.target = best.station;
  entry.targetKm = best.distance;
  if (!entry.site && !isSemiCharger(entry.station) && best.distance <= NEAR_KM) entry.reason = `duplicate of ${best.station.name}`;
  redirects[entry.station.id] = best.station.id;
}
// A redirect target can itself be removed on a later run: follow chains to a station that exists.
const keptIds = new Set(kept.map((station) => station.id));
for (const [from, to] of Object.entries(redirects)) {
  let target = to;
  const seen = new Set([from]);
  while (!keptIds.has(target) && redirects[target] && !seen.has(target)) {
    seen.add(target);
    target = redirects[target];
  }
  if (keptIds.has(from)) delete redirects[from]; // the station came back
  else redirects[from] = target;
}

const slugs = new Set(kept.map((station) => station.slug));
if (slugs.size !== kept.length) throw new Error("Station slugs are not unique");

// Safety brake for the nightly run: a broken or half-empty feed would otherwise remove hundreds of
// stations. Stop without writing anything; after a look at the feed, --force goes ahead.
const maxRemoved = Math.max(25, Math.round(ours.length * 0.05));
const openSites = sites.filter((site) => OPEN_STATUSES.has(site.status)).length;
if (!force && (removed.length > maxRemoved || openSites < ours.length * 0.9)) {
  console.error(`Stopped: ${removed.length} stations would be removed (limit ${maxRemoved}) and the feed lists ${openSites} open US sites for our ${ours.length}. Nothing was written.`);
  process.exit(1);
}

const stations = kept.sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city) || a.slug.localeCompare(b.slug));
writeData(
  dataUrl("superchargers.json"),
  { source: "OpenStreetMap contributors (ODbL), checked against supercharge.info", fetchedAt: snapshot.fetchedAt, checkedAt: new Date().toISOString(), stations },
  "stations",
);
writeFileSync(redirectsFile, JSON.stringify({ redirects: Object.fromEntries(Object.entries(redirects).sort()) }, null, 1) + "\n");

if (reportPath) {
  const brief = (station) => station && { id: station.id, name: station.name, state: station.state, city: station.city, slug: station.slug, address: station.address, lat: station.lat, lon: station.lon, stalls: station.stalls, maxKw: station.maxKw };
  const siteBrief = (site) => site && { id: site.id, name: site.name, status: site.status, address: addressOf(site), stalls: site.stallCount, kw: site.powerKilowatt, opened: site.dateOpened };
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        added: added.map(({ station, site }) => ({ station: brief(station), site: siteBrief(site) })),
        removed: removed.map((entry) => ({ station: brief(entry.station), reason: entry.reason, site: siteBrief(entry.site), km: entry.km, target: brief(entry.target), targetKm: entry.targetKm })),
        updated: updated.map((entry) => ({ before: brief(entry.before), after: brief(entry.after), changes: entry.changes, km: entry.km })),
        farPairs: [...pairs].filter(([, pair]) => pair.km > NEAR_KM).map(([id, pair]) => ({ id, km: pair.km, site: siteBrief(pair.site) })),
      },
      null,
      1,
    ),
  );
}
console.log(`US stations: ${ours.length} before, ${stations.length} after (${added.length} added, ${removed.length} removed, ${updated.length} updated)`);
