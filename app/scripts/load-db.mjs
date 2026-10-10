// Loads the OSM snapshots (data/superchargers.json, data/places.json) into Postgres.
// Safe to run again: stations and places are upserted, each station's distances are replaced,
// and stations missing from the snapshot are marked inactive (PRD import rules).
//
// Usage: node --env-file=.env.local scripts/load-db.mjs
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (run with --env-file=.env.local)");
  process.exit(1);
}

const read = (file) => JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), "utf8"));
const { stations } = read("superchargers.json");
const placesSnapshot = read("places.json");
const CHUNK = 2000;
const chunks = (rows) => Array.from({ length: Math.ceil(rows.length / CHUNK) }, (_, i) => rows.slice(i * CHUNK, (i + 1) * CHUNK));

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} });

const stationRows = stations.map((s) => ({
  id: s.id,
  slug: s.slug,
  state: s.state,
  city: s.city,
  name: s.name,
  city_label: s.cityLabel,
  near_label: s.nearLabel,
  street: s.street,
  address: s.address,
  lat: s.lat,
  lon: s.lon,
  stalls: s.stalls,
  max_kw: s.maxKw == null ? null : Math.round(s.maxKw),
  ccs: s.ccs,
  active: true,
}));

// Distinct places across all stations, plus each station's distance to them.
const placeByKey = new Map();
const links = [];
const key = (p) => `${p.category}|${p.name}|${p.lat}|${p.lon}`;
for (const [stationId, rows] of Object.entries(placesSnapshot.stations)) {
  for (const [categoryIndex, name, kind, distanceM, lat, lon] of rows) {
    const place = { category: placesSnapshot.categories[categoryIndex], name, kind, lat, lon };
    placeByKey.set(key(place), place);
    links.push({ stationId, placeKey: key(place), distance_m: distanceM, walk_min: Math.max(1, Math.round(distanceM / 80)) });
  }
}

await sql.begin(async (tx) => {
  for (const rows of chunks(stationRows)) {
    await tx`
      insert into public.stations ${tx(rows)}
      on conflict (id) do update set
        slug = excluded.slug, state = excluded.state, city = excluded.city, name = excluded.name,
        city_label = excluded.city_label, near_label = excluded.near_label, street = excluded.street,
        address = excluded.address, lat = excluded.lat, lon = excluded.lon, stalls = excluded.stalls,
        max_kw = excluded.max_kw, ccs = excluded.ccs, active = true, updated_at = now()`;
  }
  const ids = stationRows.map((row) => row.id);
  const [{ count: deactivated }] = await tx`
    with changed as (update public.stations set active = false, updated_at = now() where active and id <> all(${ids}) returning 1)
    select count(*)::int from changed`;
  console.log(`stations: ${stationRows.length} upserted, ${deactivated} deactivated`);

  const placeIds = new Map();
  for (const rows of chunks([...placeByKey.values()])) {
    const saved = await tx`
      insert into public.places ${tx(rows)}
      on conflict (category, name, lat, lon) do update set kind = excluded.kind, updated_at = now()
      returning id, category, name, lat, lon`;
    for (const row of saved) placeIds.set(key(row), row.id);
  }
  console.log(`places: ${placeIds.size} upserted`);

  await tx`delete from public.station_places where station_id = any(${Object.keys(placesSnapshot.stations)})`;
  const linkRows = links.map((link) => ({
    station_id: link.stationId,
    place_id: placeIds.get(link.placeKey),
    distance_m: link.distance_m,
    walk_min: link.walk_min,
  }));
  // A place listed twice for one station (same name, two OSM shapes) keeps the shorter distance.
  const deduped = [...new Map(linkRows.sort((a, b) => b.distance_m - a.distance_m).map((row) => [`${row.station_id}|${row.place_id}`, row])).values()];
  for (const rows of chunks(deduped)) await tx`insert into public.station_places ${tx(rows)}`;
  console.log(`station_places: ${deduped.length} distances`);

  // Carry over any Featured listings saved locally before the database existed.
  const localFile = new URL("../data/featured-listings.json", import.meta.url);
  const local = existsSync(localFile) ? JSON.parse(readFileSync(localFile, "utf8")) : [];
  for (const item of local) {
    await tx`
      insert into public.featured_listings (id, station_id, category, business_name, kind, offer_text, cta_label, cta_url,
        address, distance_m, lat, lon, contact_name, contact_email, phone, status, source, created_at, updated_at)
      values (${item.id}, ${item.stationId}, ${item.category}, ${item.businessName}, ${item.kind}, ${item.offerText},
        ${item.ctaLabel}, ${item.ctaUrl}, ${item.address}, ${item.distanceM}, ${item.lat}, ${item.lon},
        ${item.contactName}, ${item.contactEmail}, ${item.phone}, ${item.status}, ${item.source}, ${item.createdAt}, ${item.updatedAt})
      on conflict (id) do nothing`;
  }
  console.log(`featured_listings: ${local.length} carried over from the local file`);
});

await sql.end();
