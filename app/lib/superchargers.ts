// Server-only: loads the ~900 KB Supercharger snapshot (scripts/import-superchargers.mjs).
// When the M1 database lands, these functions become SQL queries with the same shapes.
import snapshot from "@/data/superchargers.json";
import type { Pin, PinTuple } from "./pins";
import { milesBetween, type LatLng } from "./stations";

export type Supercharger = {
  id: string;
  slug: string;
  state: string; // lowercase 2-letter code, or "us" when OSM has no state
  city: string; // slug, or "unlisted"
  name: string;
  cityLabel: string | null; // "Austin, TX" from the station's own address
  nearLabel: string | null; // no address in OSM: the nearest station's city, shown as "near …"
  street: string | null; // "15201 Potomac Town Place"
  address: string | null;
  lat: number;
  lon: number;
  stalls: number | null;
  maxKw: number | null;
  ccs: boolean; // has a CCS (Magic Dock) connector, so non-Tesla EVs can plug in
};

export const superchargers = (snapshot as { stations: Supercharger[] }).stations;
export const snapshotDate = (snapshot as { fetchedAt: string | null }).fetchedAt;

export function stationHref(station: Pick<Supercharger, "state" | "city" | "slug">) {
  return `/supercharger/${station.state}/${station.city}/${station.slug}`;
}

const bySlug = new Map(superchargers.map((station) => [station.slug, station]));

export function getStationBySlug(slug: string) {
  return bySlug.get(slug) ?? null;
}

export function stationPins(): PinTuple[] {
  return superchargers.map((station) => [station.lat, station.lon, station.stalls, station.maxKw, station.name, stationHref(station)]);
}

export function toPin(station: Supercharger): Pin {
  return { lat: station.lat, lon: station.lon, stalls: station.stalls, kw: station.maxKw, name: station.name, href: stationHref(station) };
}

export function nearestStations(point: LatLng, limit = 25) {
  return superchargers
    .map((station) => ({ station, miles: milesBetween(point, [station.lat, station.lon]) }))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, limit);
}

// ---------- SEO: titles, states and cities ----------

// "Tesla Supercharger at 15201 Potomac Town Place, Woodbridge, VA". Street plus city keeps the
// ~3,200 page titles apart; the rare leftovers get the stall count or a number.
const titles = (() => {
  const base = new Map<string, string>();
  for (const station of superchargers) {
    let title: string;
    if (station.street && station.cityLabel) title = `Tesla Supercharger at ${station.street}, ${station.cityLabel}`;
    else if (station.cityLabel) title = station.name.includes(station.cityLabel) ? `Tesla Supercharger in ${station.cityLabel}` : `${station.name}, ${station.cityLabel}`;
    else title = station.name;
    base.set(station.id, title);
  }
  const groups = Map.groupBy(superchargers, (station) => base.get(station.id)!);
  const unique = new Map<string, string>();
  for (const [title, group] of groups) {
    group.forEach((station, index) => {
      const extra = group.length === 1 ? "" : station.stalls && new Set(group.map((item) => item.stalls)).size === group.length ? ` (${station.stalls} stalls)` : ` (#${index + 1})`;
      unique.set(station.id, `${title}${extra}`);
    });
  }
  return unique;
})();

export function stationTitle(station: Supercharger) {
  return titles.get(station.id)!;
}

// Stations without any city (very remote) only get station pages, not state/city pages.
const listed = superchargers.filter((station) => station.state !== "us" && station.city !== "unlisted");

export type CitySummary = { state: string; city: string; name: string; label: string; stations: Supercharger[]; stalls: number };

function cityName(stations: Supercharger[]) {
  const own = stations.find((station) => station.cityLabel)?.cityLabel ?? stations[0].nearLabel ?? stations[0].city;
  return own.replace(/, [A-Z]{2}$/, "");
}

const citiesByKey = new Map<string, CitySummary>();
for (const [key, stations] of Map.groupBy(listed, (station) => `${station.state}/${station.city}`)) {
  const [state, city] = key.split("/");
  const name = cityName(stations);
  citiesByKey.set(key, {
    state,
    city,
    name,
    label: `${name}, ${state.toUpperCase()}`,
    stations: [...stations].sort((a, b) => (b.stalls ?? 0) - (a.stalls ?? 0) || a.name.localeCompare(b.name)),
    stalls: stations.reduce((sum, station) => sum + (station.stalls ?? 0), 0),
  });
}

export function getCity(state: string, city: string) {
  return citiesByKey.get(`${state}/${city}`) ?? null;
}

export function allCities() {
  return [...citiesByKey.values()];
}

export function citiesInState(state: string) {
  return allCities()
    .filter((city) => city.state === state)
    .sort((a, b) => b.stations.length - a.stations.length || a.name.localeCompare(b.name));
}

export function statesWithStations() {
  return [...Map.groupBy(listed, (station) => station.state)].map(([state, stations]) => ({
    state,
    count: stations.length,
    stalls: stations.reduce((sum, station) => sum + (station.stalls ?? 0), 0),
  }));
}

export function cityHref(state: string, city: string) {
  return `/supercharger/${state}/${city}`;
}

export function stateHref(state: string) {
  return `/supercharger/${state}`;
}

// Other cities in the same state, nearest first (internal links between city pages).
export function nearbyCities(city: CitySummary, limit = 8) {
  const center = (item: CitySummary): LatLng => [
    item.stations.reduce((sum, station) => sum + station.lat, 0) / item.stations.length,
    item.stations.reduce((sum, station) => sum + station.lon, 0) / item.stations.length,
  ];
  const origin = center(city);
  return citiesInState(city.state)
    .filter((item) => item.city !== city.city)
    .map((item) => ({ item, miles: milesBetween(origin, center(item)) }))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, limit)
    .map(({ item }) => item);
}
