// Server-only: "Tesla Superchargers near [town]" pages for US towns of 5,000+ people that have
// no Supercharger of their own (data/towns.json, from scripts/import-towns.mjs). A town page
// lives at the URL its city page would have (/supercharger/va/dale-city), so if the town gets a
// station, the same URL becomes the city page.
import townsData from "@/data/towns.json";
import { milesBetween, type LatLng } from "./stations";
import { allCities, cityHref, getCity, superchargers, type CitySummary, type Supercharger } from "./superchargers";

export type Town = { state: string; slug: string; name: string; lat: number; lon: number; population: number };
export type NearStation = { station: Supercharger; miles: number };
export type TownSummary = Town & { label: string; nearest: NearStation[]; within: number };

export const NEAR_MILES = 10; // the count in the title: "(3 within 10 miles)"
const MAX_MILES = 50; // towns farther than this from any Supercharger get no page
const MIN_LISTED = 5;
const MAX_LISTED = 10;

// Spellings that differ between the Census and station addresses ("St. Paul" and "Saint Paul",
// "Boise City" and "Boise") still mean the same city page.
const canonical = (slug: string) =>
  slug
    .split("-")
    .map((word) => ({ saint: "st", fort: "ft", mount: "mt" })[word] ?? word)
    .join("-")
    .replace(/-city$/, "");

const cityKeys = new Set(allCities().map((city) => `${city.state}/${canonical(city.city)}`));

function nearestTo(point: LatLng, limit: number) {
  const near: NearStation[] = [];
  for (const station of superchargers) {
    // A degree of latitude is about 69 miles; skip far stations before the exact distance.
    if (Math.abs(station.lat - point[0]) > MAX_MILES / 69) continue;
    const miles = milesBetween(point, [station.lat, station.lon]);
    if (miles <= MAX_MILES) near.push({ station, miles });
  }
  return near.sort((a, b) => a.miles - b.miles).slice(0, limit);
}

let towns: Map<string, TownSummary> | null = null;

// Built on first use (the sitemap, a state page or a town page), not when a station page loads.
function townsByKey() {
  if (towns) return towns;
  towns = new Map();
  for (const town of (townsData as { towns: Town[] }).towns) {
    const key = `${town.state}/${town.slug}`;
    if (getCity(town.state, town.slug) || cityKeys.has(`${town.state}/${canonical(town.slug)}`)) continue;
    const near = nearestTo([town.lat, town.lon], Infinity);
    if (!near.length) continue;
    const within = near.filter((item) => item.miles <= NEAR_MILES).length;
    towns.set(key, {
      ...town,
      label: `${town.name}, ${town.state.toUpperCase()}`,
      nearest: near.slice(0, Math.min(MAX_LISTED, Math.max(MIN_LISTED, within))),
      within,
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

/** Biggest first, for the state page's "Towns near a Supercharger". */
export function townsInState(state: string) {
  return allTowns()
    .filter((town) => town.state === state)
    .sort((a, b) => b.population - a.population);
}

export function milesText(miles: number) {
  return miles < 10 ? `${miles.toFixed(1)} miles` : `${Math.round(miles)} miles`;
}

/** "Tesla Superchargers near Dale City, VA (3 within 10 miles)", or the nearest one's distance. */
export function townTitle(town: TownSummary) {
  const count = town.within ? `${town.within} within ${NEAR_MILES} miles` : `nearest ${Math.round(town.nearest[0].miles)} miles away`;
  return `Tesla Superchargers near ${town.label} (${count})`;
}

// "13355 Minnieville Rd, Woodbridge": shorter than the station name, which repeats the state.
function shortName(station: Supercharger) {
  const city = station.cityLabel?.replace(/, [A-Z]{2}$/, "");
  return station.street && city ? `${station.street}, ${city}` : station.name;
}

export function townDescription(town: TownSummary) {
  const closest = town.nearest.slice(0, 2).map(({ station, miles }) => `${shortName(station)} (${milesText(miles).replace("miles", "mi")}${station.stalls ? `, ${station.stalls} stalls` : ""})`);
  const lead = town.within
    ? `${town.within} Tesla Supercharger${town.within === 1 ? "" : "s"} within ${NEAR_MILES} miles of ${town.label}.`
    : `The nearest Tesla Supercharger to ${town.label} is ${milesText(town.nearest[0].miles)} away.`;
  return `${lead} Closest: ${closest.join(" and ")}. See directions, charging speed and places to eat.`;
}

/** City pages of the nearest stations, nearest first, for links. */
export function nearbyCityPages(town: TownSummary, limit = 8): CitySummary[] {
  const cities = new Map<string, CitySummary>();
  for (const { station } of nearestTo([town.lat, town.lon], 40)) {
    const city = getCity(station.state, station.city);
    if (city && !cities.has(cityHref(city.state, city.city))) cities.set(cityHref(city.state, city.city), city);
  }
  return [...cities.values()].slice(0, limit);
}

/** Other towns in the same state, nearest first. */
export function nearbyTowns(town: TownSummary, limit = 8) {
  return townsInState(town.state)
    .filter((item) => item.slug !== town.slug)
    .map((item) => ({ item, miles: milesBetween([town.lat, town.lon], [item.lat, item.lon]) }))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, limit)
    .map(({ item }) => item);
}
