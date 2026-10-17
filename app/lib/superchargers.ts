// Server-only: loads the ~900 KB Supercharger snapshot (scripts/import-superchargers.mjs).
// When the M1 database lands, these functions become SQL queries with the same shapes.
import snapshot from "@/data/superchargers.json";
import stationRedirects from "@/data/station-redirects.json";
import worldSnapshot from "@/data/world-superchargers.json";
import { CLOSED_LABEL, type Pin, type PinTuple } from "./pins";
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
  // Outside the US only (data/world-superchargers.json); US stations show "NACS".
  plug?: string | null;
  // supercharge.info lists the station as temporarily closed: the page says so, lists label it
  // and the route planner skips it.
  temporarilyClosed?: boolean;
};

// The station's name as lists and the map show it, with a closed station labeled.
export const listName = (station: Supercharger) => (station.temporarilyClosed ? `${station.name}${CLOSED_LABEL}` : station.name);

export const superchargers = (snapshot as { stations: Supercharger[] }).stations;
// When the list last changed: the latest supercharge.info check, or the OSM download before any.
export const snapshotDate = (snapshot as { fetchedAt: string | null; checkedAt?: string }).checkedAt ?? (snapshot as { fetchedAt: string | null }).fetchedAt;

export function stationHref(station: Pick<Supercharger, "state" | "city" | "slug">) {
  return `/supercharger/${station.state}/${station.city}/${station.slug}`;
}

const bySlug = new Map(superchargers.map((station) => [station.slug, station]));

export function getStationBySlug(slug: string) {
  return bySlug.get(slug) ?? worldBySlug.get(slug) ?? null;
}

export function stationPins(): PinTuple[] {
  return superchargers.map((station) => [station.lat, station.lon, station.stalls, station.maxKw, listName(station), stationHref(station)]);
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
  return titles.get(station.id) ?? worldTitles.get(station.id)!;
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
  return citiesByKey.get(`${state}/${city}`) ?? worldCitiesByKey.get(`${state}/${city}`) ?? null;
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

/** The middle of a city's (or any group's) stations, for distances to and from it. */
export function cityCenter(city: Pick<CitySummary, "stations">): LatLng {
  return [
    city.stations.reduce((sum, station) => sum + station.lat, 0) / city.stations.length,
    city.stations.reduce((sum, station) => sum + station.lon, 0) / city.stations.length,
  ];
}

// Other cities in the same state, nearest first (internal links between city pages).
export function nearbyCities(city: CitySummary, limit = 8) {
  const origin = cityCenter(city);
  return (getCountry(city.state)?.cities ?? citiesInState(city.state))
    .filter((item) => item.city !== city.city)
    .map((item) => ({ item, miles: milesBetween(origin, cityCenter(item)) }))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, limit)
    .map(({ item }) => item);
}

// ---------- The rest of the world (data/world-superchargers.json, from supercharge.info) ----------
// Outside the US a country takes the place of the state: /supercharger/germany/munchen/<station>.
// Country slugs are full names, so they never collide with two-letter US state codes. The US
// functions above are unchanged; world stations only show up through the lookups that fall back
// to them (station by slug, city, title) and through the country functions below.

export type WorldSupercharger = Supercharger & {
  country: string;
  countryCode: string | null;
  cityName: string;
  region: string | null;
};

export const worldStations = (worldSnapshot as unknown as { stations: WorldSupercharger[] }).stations;
export const worldSnapshotDate = (worldSnapshot as { fetchedAt: string | null }).fetchedAt;
const worldBySlug = new Map(worldStations.map((station) => [station.slug, station]));
const byId = new Map<string, Supercharger | WorldSupercharger>([...superchargers, ...worldStations].map((station) => [station.id, station]));

export function getStationById(id: string) {
  return byId.get(id) ?? null;
}

// Removed stations (closed, duplicates, not open yet) point at the nearest station still listed
// (scripts/reconcile-us-superchargers.mjs), so old links and search results land on a real one.
const redirectedIds = (stationRedirects as { redirects: Record<string, string> }).redirects;

// For a slug that isn't a current station, where its visitors should go: the same station under
// a new slug (the id at the end, "aborn-square-n12914068932", stays the same), or the station a
// removed one was redirected to.
export function replacementForSlug(slug: string) {
  const id = /-([nwrs]\d+)$/.exec(slug)?.[1];
  if (!id) return null;
  return byId.get(id) ?? byId.get(redirectedIds[id] ?? "") ?? null;
}

// The closest other Supercharger anywhere (US or world), for the station page's "About" text.
export function nearestOtherSupercharger(station: Supercharger) {
  let best: { station: Supercharger; miles: number } | null = null;
  for (const other of byId.values()) {
    if (other.id === station.id) continue;
    // Skip the far side of the world cheaply before the exact distance.
    if (Math.abs(other.lat - station.lat) > (best ? best.miles / 69 : 90)) continue;
    const miles = milesBetween([station.lat, station.lon], [other.lat, other.lon]);
    if (!best || miles < best.miles) best = { station: other, miles };
  }
  return best;
}

const US_COUNTRY = { slug: "united-states", code: "US", name: "United States" } as const;

export function isWorldStation(station: Supercharger): station is WorldSupercharger {
  return "country" in station;
}

const worldTitles = (() => {
  const base = new Map(
    worldStations.map((station) => [
      station.id,
      station.street ? `Tesla Supercharger at ${station.street}, ${station.cityLabel}` : `Tesla Supercharger in ${station.cityLabel}`,
    ]),
  );
  const unique = new Map<string, string>();
  for (const [title, group] of Map.groupBy(worldStations, (station) => base.get(station.id)!)) {
    group.forEach((station, index) => unique.set(station.id, group.length === 1 ? title : `${title} (#${index + 1})`));
  }
  return unique;
})();

export type CountrySummary = {
  slug: string;
  code: string | null;
  name: string;
  count: number;
  stalls: number;
  cities: CitySummary[]; // most stations first
  center: LatLng; // the busiest city, where the map opens for this country
};

const worldCitiesByKey = new Map<string, CitySummary>();
for (const [key, stations] of Map.groupBy(worldStations, (station) => `${station.state}/${station.city}`)) {
  const [state, city] = key.split("/");
  worldCitiesByKey.set(key, {
    state,
    city,
    name: stations[0].cityName,
    label: stations[0].cityLabel ?? stations[0].cityName,
    stations: [...stations].sort((a, b) => (b.stalls ?? 0) - (a.stalls ?? 0) || a.name.localeCompare(b.name)),
    stalls: stations.reduce((sum, station) => sum + (station.stalls ?? 0), 0),
  });
}

export const countries: CountrySummary[] = [...Map.groupBy(worldStations, (station) => station.state)]
  .map(([slug, stations]) => {
    const cities = [...worldCitiesByKey.values()]
      .filter((city) => city.state === slug)
      .sort((a, b) => b.stations.length - a.stations.length || a.name.localeCompare(b.name));
    return {
      slug,
      code: stations[0].countryCode,
      name: stations[0].country,
      count: stations.length,
      stalls: stations.reduce((sum, station) => sum + (station.stalls ?? 0), 0),
      cities,
      center: cityCenter(cities[0]),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const countryBySlug = new Map(countries.map((country) => [country.slug, country]));

export function getCountry(slug: string) {
  return countryBySlug.get(slug) ?? null;
}

export function allWorldCities() {
  return [...worldCitiesByKey.values()];
}

/** The page heading for a state code or country slug ("Virginia", "Germany"). */
export function areaName(state: string, usName: (code: string) => string) {
  return getCountry(state)?.name ?? usName(state);
}

/** A country name as it reads after "across" or "in": "the United Kingdom", "Germany". */
export function countryPhrase(name: string) {
  return /^(United Kingdom|United Arab Emirates|Netherlands|Philippines|United States)$/.test(name) ? `the ${name}` : name;
}

/** Every country with stations for the flag dropdown: the US first, then A–Z. */
export function countryOptions() {
  return [
    { slug: US_COUNTRY.slug, code: US_COUNTRY.code, name: US_COUNTRY.name, count: superchargers.length },
    ...countries.map((country) => ({ slug: country.slug, code: country.code, name: country.name, count: country.count })),
  ];
}

// Extra words a station can be found by on the map: its city and country, plus English names
// for cities the feed spells locally ("Munich" for München).
export const ENGLISH_NAMES: Record<string, string> = {
  München: "Munich", Köln: "Cologne", "Frankfurt am Main": "Frankfurt", Nürnberg: "Nuremberg", Roma: "Rome",
  Milano: "Milan", Napoli: "Naples", Venezia: "Venice", Firenze: "Florence", Torino: "Turin", Praha: "Prague",
  Warszawa: "Warsaw", Göteborg: "Gothenburg", Beograd: "Belgrade", Sevilla: "Seville", "Ciudad de México": "Mexico City",
  București: "Bucharest", København: "Copenhagen", Wien: "Vienna", Lisboa: "Lisbon", Athina: "Athens",
};

function worldPin(station: WorldSupercharger): PinTuple {
  const search = [station.cityName, ENGLISH_NAMES[station.cityName], station.region, station.country].filter(Boolean).join(" ");
  return [station.lat, station.lon, station.stalls, station.maxKw, listName(station), stationHref(station), search];
}

export function countryPins(slug: string): PinTuple[] {
  return worldStations.filter((station) => station.state === slug).map(worldPin);
}

export function nearestInCountry(slug: string, point: LatLng, limit = 25) {
  return worldStations
    .filter((station) => station.state === slug)
    .map((station) => ({ station, miles: milesBetween(point, [station.lat, station.lon]) }))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, limit);
}
