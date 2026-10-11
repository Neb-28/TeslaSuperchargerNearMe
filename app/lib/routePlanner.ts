// Picks charging stops along a driving route: Tesla Superchargers first, other networks' fast
// chargers only where Superchargers can't get the car through. Pure functions, so it runs anywhere
// and is easy to test; the API route feeds it the route from openrouteservice and our station lists.
import type { LatLng } from "./stations";

export type RouteStation = {
  id: string;
  name: string;
  href: string; // station page for Superchargers, directions for other networks
  network: string | null; // null: Tesla Supercharger; otherwise "Electrify America", "EVgo"…
  label: string | null; // "Austin, TX"
  lat: number;
  lon: number;
  stalls: number | null;
  maxKw: number | null;
};

const isSupercharger = (candidate: { station: RouteStation }) => candidate.station.network === null;

export type PlannedStop = {
  station: RouteStation;
  atKm: number; // distance along the route where you leave it for the station
  detourKm: number; // straight-line distance from the route to the station
  arrivePct: number;
  departPct: number;
  chargeMin: number;
};

export type TripPlan = {
  stops: PlannedStop[];
  arrivePct: number | null; // battery left at the destination, if it can be reached
  stuckAtKm: number | null; // set when no station is within reach from here on
};

export type PlanOptions = {
  path: LatLng[];
  totalKm: number;
  stations: RouteStation[];
  rangeKm: number;
  startPct?: number; // trips are planned as if leaving with 80%
  reservePct?: number; // never plan to arrive anywhere with less than this
  stopAtPct?: number; // aim to reach each stop with between reservePct and this left
  chargeToPct?: number; // Superchargers slow down a lot above 80%
  maxDetourKm?: number;
};

export const START_PCT = 80;
export const RESERVE_PCT = 10;
export const STOP_AT_PCT = 15;
export const CHARGE_TO_PCT = 80;
export const MAX_DETOUR_KM = 8; // about 5 miles off the route
const SAMPLE_KM = 0.5;
const CELL_DEG = 0.1; // ~11 km, more than MAX_DETOUR_KM, so a 3×3 block of cells covers it
const MAX_STOPS = 40;
const MIN_HOP_KM = 50;
const USEFUL_GAIN_KM = 20;
const DESTINATION_CUSHION_PCT = 5;
const FINAL_CHARGE_MAX_PCT = 90;
const EARLY_STOP_PCT = 35;

const toRad = (deg: number) => (deg * Math.PI) / 180;
// Round a charge level up, ignoring floating-point dust (85.0000001% is 85%).
const roundUpPct = (pct: number) => Math.ceil(pct - 1e-6);

export function kmBetween(a: LatLng, b: LatLng) {
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Route points about every `spacingKm`, each with its distance from the start, scaled so the last
// one matches the route's official length.
export function sampleRoute(path: LatLng[], totalKm: number, spacingKm = SAMPLE_KM) {
  if (path.length === 0) return [];
  const raw: { point: LatLng; km: number }[] = [{ point: path[0], km: 0 }];
  let km = 0;
  let lastKept = 0;
  for (let i = 1; i < path.length; i++) {
    km += kmBetween(path[i - 1], path[i]);
    if (km - lastKept >= spacingKm || i === path.length - 1) {
      raw.push({ point: path[i], km });
      lastKept = km;
    }
  }
  const scale = km > 0 && totalKm > 0 ? totalKm / km : 1;
  return raw.map((sample) => ({ point: sample.point, km: sample.km * scale }));
}

// Stations within `maxDetourKm` of the route, with where along the route they are.
export function stationsAlongRoute(path: LatLng[], totalKm: number, stations: RouteStation[], maxDetourKm = MAX_DETOUR_KM) {
  const samples = sampleRoute(path, totalKm);
  const grid = new Map<string, { point: LatLng; km: number }[]>();
  const cellKey = (lat: number, lon: number) => `${Math.floor(lat / CELL_DEG)}:${Math.floor(lon / CELL_DEG)}`;
  for (const sample of samples) {
    const key = cellKey(sample.point[0], sample.point[1]);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(sample);
  }

  const found: { station: RouteStation; atKm: number; detourKm: number }[] = [];
  for (const station of stations) {
    const row = Math.floor(station.lat / CELL_DEG);
    const col = Math.floor(station.lon / CELL_DEG);
    let best: { km: number; distance: number } | null = null;
    for (let dRow = -1; dRow <= 1; dRow++) {
      for (let dCol = -1; dCol <= 1; dCol++) {
        for (const sample of grid.get(`${row + dRow}:${col + dCol}`) ?? []) {
          const distance = kmBetween(sample.point, [station.lat, station.lon]);
          if (!best || distance < best.distance) best = { km: sample.km, distance };
        }
      }
    }
    if (best && best.distance <= maxDetourKm) found.push({ station, atKm: best.km, detourKm: best.distance });
  }
  return found.sort((a, b) => a.atKm - b.atKm);
}

// Rough Supercharger time to go from one charge level to another, rounded to 5 minutes.
// Based on typical 10→80% sessions: ~25 min at 250 kW, ~32 min at 150 kW, ~45 min below that.
export function chargeMinutes(fromPct: number, toPct: number, maxKw: number | null) {
  if (toPct <= fromPct) return 0;
  const tenToEighty = (maxKw ?? 150) >= 250 ? 25 : (maxKw ?? 150) >= 150 ? 32 : 45;
  return Math.max(5, Math.round(((toPct - fromPct) / 70) * tenToEighty / 5) * 5);
}

// Greedy plan: leave with 80% and drive until the battery is down to 10–15%, then stop at the best
// Supercharger in that band (fastest, then closest to the route). Repeat until the destination is in reach.
// No Supercharger in the band (a gap ahead)? Stop at the last one before the gap, if Superchargers can
// carry the trip on from there. Only when they can't, use another network's charger.
export function planTrip({
  path,
  totalKm,
  stations,
  rangeKm,
  startPct = START_PCT,
  reservePct = RESERVE_PCT,
  stopAtPct = STOP_AT_PCT,
  chargeToPct = CHARGE_TO_PCT,
  maxDetourKm = MAX_DETOUR_KM,
}: PlanOptions): TripPlan {
  const candidates = stationsAlongRoute(path, totalKm, stations, maxDetourKm);
  const usableKm = (pct: number) => (rangeKm * Math.max(0, pct - reservePct)) / 100;
  const pctFor = (km: number) => (km / rangeKm) * 100;

  const stops: PlannedStop[] = [];
  let atKm = 0;
  let pct = startPct;
  let backToRouteKm = 0; // after a stop, the drive back to the route

  while (stops.length < MAX_STOPS) {
    const toDestination = totalKm - atKm + backToRouteKm;
    if (usableKm(pct) >= toDestination) {
      return { stops, arrivePct: Math.round(pct - pctFor(toDestination)), stuckAtKm: null };
    }

    const reachable = candidates.filter(
      (candidate) => candidate.atKm > atKm + 1 && candidate.atKm - atKm + backToRouteKm + candidate.detourKm <= usableKm(pct),
    );
    if (reachable.length === 0) {
      return { stops, arrivePct: null, stuckAtKm: Math.min(totalKm, atKm + Math.max(0, usableKm(pct) - backToRouteKm)) };
    }

    type Candidate = (typeof reachable)[number];
    const arriveAt = (candidate: Candidate) => pct - pctFor(candidate.atKm - atKm + backToRouteKm + candidate.detourKm);
    // Stations reached with 10–15% left: prefer faster chargers, then shorter detours, then later ones.
    const bestInBand = (list: Candidate[]) =>
      list
        .filter((candidate) => arriveAt(candidate) <= stopAtPct)
        .sort((a, b) => (b.station.maxKw ?? 0) - (a.station.maxKw ?? 0) || a.detourKm - b.detourKm || b.atKm - a.atKm)[0];
    // From here, the drive to the destination or to the next useful station (just down the road
    // doesn't count: stopping again a few miles later isn't progress).
    const nextLegFrom = (from: Candidate, among: Candidate[]) =>
      Math.min(
        totalKm - from.atKm + from.detourKm,
        ...among.filter((next) => next.atKm > from.atKm + MIN_HOP_KM).map((next) => next.atKm - from.atKm + from.detourKm + next.detourKm),
      );
    const superchargers = candidates.filter(isSupercharger);
    const superchargersCarryOn = (from: Candidate) => nextLegFrom(from, superchargers) <= usableKm(100);

    const reachableSuperchargers = reachable.filter(isSupercharger);
    const reachableOthers = reachable.filter((candidate) => !isSupercharger(candidate));
    const lastSupercharger = reachableSuperchargers.at(-1);
    const otherNetworkPick = bestInBand(reachableOthers) ?? reachableOthers.at(-1);
    // Another network only helps when it gets meaningfully farther than the last Supercharger.
    const othersHelp = otherNetworkPick && (!lastSupercharger || otherNetworkPick.atKm > lastSupercharger.atKm + MIN_HOP_KM);
    // A Supercharger that means stopping with lots of charge left (and charging past 90% for the next
    // stretch) isn't a sensible stop when another network has a charger in the 10–15% band or farther.
    const reasonableSupercharger = lastSupercharger && arriveAt(lastSupercharger) <= EARLY_STOP_PCT;
    const pick =
      bestInBand(reachableSuperchargers) ??
      (lastSupercharger && (!othersHelp || (reasonableSupercharger && superchargersCarryOn(lastSupercharger))) ? lastSupercharger : undefined) ??
      otherNetworkPick ??
      reachable[reachable.length - 1];
    const arrivePct = arriveAt(pick);

    // Charge to 80%, or more when the next Supercharger (or the destination) is farther than that
    // allows. If no Supercharger is in reach even on a full battery, plan for the next station of any network.
    let nextLegKm = nextLegFrom(pick, superchargers);
    if (nextLegKm > usableKm(100)) nextLegKm = nextLegFrom(pick, candidates);
    const neededPct = roundUpPct(reservePct + pctFor(nextLegKm));
    // Last stop: charge just enough for the destination (plus a small cushion). That also lets a
    // stop go a little past 80% when it saves a whole extra stop.
    const destinationPct = roundUpPct(reservePct + pctFor(totalKm - pick.atKm + pick.detourKm) + DESTINATION_CUSHION_PCT);
    const finalStop = destinationPct <= FINAL_CHARGE_MAX_PCT;
    const departPct = Math.max(arrivePct, finalStop ? destinationPct : Math.min(100, Math.max(chargeToPct, neededPct)));

    // A stop that barely extends the trip (topping up a full battery just down the road) is no help.
    const reachWithoutKm = atKm + usableKm(pct) - backToRouteKm;
    if (!finalStop && pick.atKm + usableKm(departPct) - pick.detourKm <= reachWithoutKm + USEFUL_GAIN_KM) {
      return { stops, arrivePct: null, stuckAtKm: Math.min(totalKm, reachWithoutKm) };
    }
    stops.push({
      station: pick.station,
      atKm: pick.atKm,
      detourKm: pick.detourKm,
      arrivePct: Math.round(arrivePct),
      departPct: Math.round(departPct),
      chargeMin: chargeMinutes(arrivePct, departPct, pick.station.maxKw),
    });
    atKm = pick.atKm;
    pct = departPct;
    backToRouteKm = pick.detourKm;
  }
  return { stops, arrivePct: null, stuckAtKm: atKm };
}
