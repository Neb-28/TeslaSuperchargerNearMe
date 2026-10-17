// Server-only: "Tesla Superchargers near [town]" pages for towns of 5,000+ people that have no
// Supercharger of their own: US towns (data/towns.json, from scripts/import-towns.mjs) and towns in
// Canada, the UK, Australia, New Zealand and Ireland (data/world-towns.json, from
// scripts/import-world-towns.mjs). A town page lives at the URL its city page would have
// (/supercharger/va/dale-city, /supercharger/canada/oakville), so if the town gets a station, the
// same URL becomes the city page.
import townsData from "@/data/towns.json";
import worldTownsData from "@/data/world-towns.json";
import { distanceText, nearRadius, unitFor, type DistanceUnit } from "./distance";
import { milesBetween, type LatLng } from "./stations";
import {
  allCities,
  allWorldCities,
  cityHref,
  getCity,
  getCountry,
  isWorldStation,
  superchargers,
  worldStations,
  type CitySummary,
  type Supercharger,
} from "./superchargers";

export type Town = { state: string; slug: string; name: string; region?: string | null; lat: number; lon: number; population: number };
export type NearStation = { station: Supercharger; miles: number };
export type TownSummary = Town & { label: string; nearest: NearStation[]; within: number; unit: DistanceUnit; world: boolean };

const MAX_MILES = 50; // towns farther than this from any Supercharger get no page
const MIN_LISTED = 5;
const MAX_LISTED = 10;

// Spellings that differ between the town data and station addresses ("St. Paul" and "Saint Paul",
// "Boise City" and "Boise") still mean the same city page.
const canonical = (slug: string) =>
  slug
    .split("-")
    .map((word) => ({ saint: "st", fort: "ft", mount: "mt" })[word] ?? word)
    .join("-")
    .replace(/-city$/, "");

const cityKeys = new Set([...allCities(), ...allWorldCities()].map((city) => `${city.state}/${canonical(city.city)}`));

// Stations a town's page can list: US towns list US stations; towns abroad list their own country's.
const stationsIn = (() => {
  const byCountry = Map.groupBy(worldStations, (station) => station.state);
  return (state: string): Supercharger[] => byCountry.get(state) ?? superchargers;
})();

function nearestTo(state: string, point: LatLng, limit: number) {
  const near: NearStation[] = [];
  for (const station of stationsIn(state)) {
    // A degree of latitude is about 69 miles; skip far stations before the exact distance.
    if (Math.abs(station.lat - point[0]) > MAX_MILES / 69) continue;
    const miles = milesBetween(point, [station.lat, station.lon]);
    if (miles <= MAX_MILES) near.push({ station, miles });
  }
  return near.sort((a, b) => a.miles - b.miles).slice(0, limit);
}

// "Dale City, VA", "Oakville, ON", "Slough, United Kingdom" (like the city pages' labels).
function townLabel(town: Town) {
  const country = getCountry(town.state);
  if (!country) return `${town.name}, ${town.state.toUpperCase()}`;
  return `${town.name}, ${town.region ?? country.name}`;
}

let towns: Map<string, TownSummary> | null = null;

// Built on first use (the sitemap, a state page or a town page), not when a station page loads.
function townsByKey() {
  if (towns) return towns;
  towns = new Map();
  const all = [
    ...(townsData as { towns: Town[] }).towns.map((town) => ({ town, world: false })),
    ...(worldTownsData as { towns: Town[] }).towns.map((town) => ({ town, world: true })),
  ];
  for (const { town, world } of all) {
    const key = `${town.state}/${town.slug}`;
    if (getCity(town.state, town.slug) || cityKeys.has(`${town.state}/${canonical(town.slug)}`)) continue;
    const near = nearestTo(town.state, [town.lat, town.lon], Infinity);
    if (!near.length) continue;
    const unit = unitFor(town.state);
    const within = near.filter((item) => item.miles <= nearRadius(unit).miles).length;
    towns.set(key, {
      ...town,
      label: townLabel(town),
      nearest: near.slice(0, Math.min(MAX_LISTED, Math.max(MIN_LISTED, within))),
      within,
      unit,
      world,
    });
  }
  return towns;
}

export function getTown(state: string, slug: string) {
  return townsByKey().get(`${state}/${slug}`) ?? null;
}

export function allTowns() {
  return [...townsByKey().values()];
}

/** Biggest first, for the state or country page's "Towns near a Supercharger". */
export function townsInState(state: string) {
  return allTowns()
    .filter((town) => town.state === state)
    .sort((a, b) => b.population - a.population);
}

/** "2.6 miles" or "4.2 km" in the town's own unit; `short` gives "2.6 mi". */
export function townDistance(town: TownSummary, miles: number, short = false) {
  return distanceText(miles, town.unit, short);
}

/** "Tesla Superchargers near Dale City, VA (3 within 10 miles)", or the nearest one's distance. */
export function townTitle(town: TownSummary) {
  const count = town.within
    ? `${town.within} within ${nearRadius(town.unit).text}`
    : `nearest ${townDistance(town, town.nearest[0].miles)} away`;
  return `Tesla Superchargers near ${town.label} (${count})`;
}

// "13355 Minnieville Rd, Woodbridge": shorter than the station name, which repeats the state.
function shortName(station: Supercharger) {
  const city = isWorldStation(station) ? station.cityName : station.cityLabel?.replace(/, [A-Z]{2}$/, "");
  return station.street && city ? `${station.street}, ${city}` : station.name;
}

export function townDescription(town: TownSummary) {
  const closest = town.nearest
    .slice(0, 2)
    .map(({ station, miles }) => `${shortName(station)} (${townDistance(town, miles, true)}${station.stalls ? `, ${station.stalls} stalls` : ""})`);
  const lead = town.within
    ? `${town.within} Tesla Supercharger${town.within === 1 ? "" : "s"} within ${nearRadius(town.unit).text} of ${town.label}.`
    : `The nearest Tesla Supercharger to ${town.label} is ${townDistance(town, town.nearest[0].miles)} away.`;
  return `${lead} Closest: ${closest.join(" and ")}. See directions, charging speed and places to eat.`;
}

/** City pages of the nearest stations, nearest first, for links. */
export function nearbyCityPages(town: TownSummary, limit = 8): CitySummary[] {
  const cities = new Map<string, CitySummary>();
  for (const { station } of nearestTo(town.state, [town.lat, town.lon], 40)) {
    const city = getCity(station.state, station.city);
    if (city && !cities.has(cityHref(city.state, city.city))) cities.set(cityHref(city.state, city.city), city);
  }
  return [...cities.values()].slice(0, limit);
}

/** Other towns in the same state or country, nearest first. */
export function nearbyTowns(town: TownSummary, limit = 8) {
  return townsInState(town.state)
    .filter((item) => item.slug !== town.slug)
    .map((item) => ({ item, miles: milesBetween([town.lat, town.lon], [item.lat, item.lon]) }))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, limit)
    .map(({ item }) => item);
}
