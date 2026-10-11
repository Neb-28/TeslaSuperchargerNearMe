import { otherChargersFor } from "@/lib/fastChargers";
import { geocodeZip } from "@/lib/geocode";
import { drivingRoute, RoutingError, routingConfigured, searchAddress, type AddressMatch } from "@/lib/openRouteService";
import { CATEGORIES } from "@/lib/places";
import { placesForStation } from "@/lib/placesData";
import { planTrip, sampleRoute, type RouteStation } from "@/lib/routePlanner";
import type { LatLng } from "@/lib/stations";
import { stationHref, superchargers, worldStations } from "@/lib/superchargers";
import { isPlug, KM_PER_MILE, RANGE_MAX_MI, RANGE_MIN_MI } from "@/lib/vehicles";
import { parseZip } from "@/lib/zipQuery";

// GET /api/route-plan?from=&to=&range=346&plug=nacs
// from/to: an address, a US ZIP code, or "lat,lon" (the visitor's location).
// range: the car's range when full, in miles (EPA figure from the vehicle picker, or typed).
// plug: "nacs" (Teslas, NACS ports), "ccs-adapter" (CCS port with a NACS adapter) or "ccs" (CCS only).
// adapter=1: a NACS car that carries a CCS adapter, so other networks' CCS chargers work too.
// Superchargers come first; other networks' fast chargers fill gaps Superchargers can't bridge.
// Every trip is planned as leaving with 80% (lib/routePlanner.ts START_PCT).
// → { from, to, distanceKm, durationS, path, stops, arrivePct, stuckAtKm }

const allStations = [...superchargers, ...worldStations];
const toRouteStation = (station: (typeof allStations)[number]): RouteStation => ({
  id: station.id,
  name: station.name,
  href: stationHref(station),
  network: null,
  label: station.cityLabel ?? (station.nearLabel ? `near ${station.nearLabel}` : null),
  lat: station.lat,
  lon: station.lon,
  stalls: station.stalls,
  maxKw: station.maxKw,
});
const everyStation = allStations.map(toRouteStation);
// CCS-only cars: Magic Dock stations in the US, and native CCS stations elsewhere.
const ccsStations = allStations.filter((station) => station.ccs || /^CCS/i.test(station.plug ?? "")).map(toRouteStation);

const COORDS = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

function coordinates(text: string): LatLng | null {
  const match = COORDS.exec(text);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
}

type Place = { label: string; position: LatLng; country: string | null };

// Places we can resolve without a search: the visitor's own location, or a US ZIP code.
function exactPlace(text: string): Place | null {
  const position = coordinates(text);
  if (position) return { label: "Your location", position, country: null };
  if (parseZip(text)) {
    const zip = geocodeZip(text);
    if (zip) return { label: `ZIP ${zip.label}`, position: zip.position, country: "USA" };
  }
  return null;
}

// Place names can be ambiguous: "Miami" finds Barranquilla, Colombia first, and "Richmond" near
// Arlington, VA finds Staten Island (Richmond County) first. When the other end is an exact point,
// take the closest of the best matches; otherwise prefer a match in the other end's country.
async function resolveTrip(fromText: string, toText: string): Promise<[Place | null, Place | null]> {
  const fromExact = exactPlace(fromText);
  const toExact = exactPlace(toText);
  const [fromMatches, toMatches] = await Promise.all([
    fromExact ? null : searchAddress(fromText, toExact?.position),
    toExact ? null : searchAddress(toText, fromExact?.position),
  ]);
  const closestBest = (matches: AddressMatch[]) => {
    const best = Math.max(...matches.map((match) => match.confidence));
    return matches.filter((match) => match.confidence === best).sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))[0];
  };
  const pick = (matches: AddressMatch[] | null, other: Place | null, otherMatches: AddressMatch[] | null) => {
    if (!matches?.length) return null;
    if (other) return closestBest(matches);
    const otherCountry = otherMatches?.[0]?.country;
    return matches.find((match) => otherCountry && match.country === otherCountry) ?? matches[0];
  };
  return [fromExact ?? pick(fromMatches, toExact, toMatches), toExact ?? pick(toMatches, fromExact, fromMatches)];
}

// What's within walking distance; we only have this for Superchargers.
function nearbySummary(station: RouteStation) {
  if (station.network !== null) return null;
  const places = placesForStation(station.id);
  return Object.fromEntries(CATEGORIES.map(({ id }) => [id, places[id].length]));
}

const fail = (message: string, status: number) => Response.json({ error: message }, { status });

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const fromText = params.get("from")?.trim() ?? "";
  const toText = params.get("to")?.trim() ?? "";
  const plug = params.get("plug");
  const rangeMi = Number(params.get("range"));

  if (!fromText || fromText.length > 200) return fail("Enter where you're starting from.", 400);
  if (!toText || toText.length > 200) return fail("Enter where you're going.", 400);
  // The current planner page always sends a plug; only an out-of-date copy of the page doesn't.
  if (!isPlug(plug)) return fail("This page is out of date. Please reload it and choose your car again.", 400);
  if (!Number.isFinite(rangeMi) || rangeMi < RANGE_MIN_MI || rangeMi > RANGE_MAX_MI) {
    return fail(`Enter a range between ${RANGE_MIN_MI} and ${RANGE_MAX_MI} miles.`, 400);
  }
  if (!routingConfigured()) return fail("The route planner isn't available yet.", 503);

  try {
    const [from, to] = await resolveTrip(fromText, toText);
    if (!from) return fail("We couldn't find your starting point. Try a city, address or ZIP code.", 404);
    if (!to) return fail("We couldn't find your destination. Try a city, address or ZIP code.", 404);

    const route = await drivingRoute(from.position, to.position);
    const plan = planTrip({
      path: route.path,
      totalKm: route.distanceKm,
      stations: [...(plug === "ccs" ? ccsStations : everyStation), ...otherChargersFor(plug, params.get("adapter") === "1")],
      rangeKm: rangeMi * KM_PER_MILE,
    });

    const body = {
      from,
      to,
      distanceKm: route.distanceKm,
      durationS: route.durationS,
      // About one point per kilometer is plenty to draw the route.
      path: sampleRoute(route.path, route.distanceKm, 1).map((sample) => sample.point.map((value) => Math.round(value * 1e5) / 1e5)),
      stops: plan.stops.map((stop) => ({ ...stop, nearby: nearbySummary(stop.station) })),
      arrivePct: plan.arrivePct,
      stuckAtKm: plan.stuckAtKm,
    };
    // Same trip, same answer: let the CDN reuse it (saves our daily routing quota). Trips that
    // start at the visitor's own location are personal, so those are never cached.
    const personal = coordinates(fromText) || coordinates(toText);
    return Response.json(body, {
      headers: { "Cache-Control": personal ? "private, no-store" : "public, max-age=3600, s-maxage=86400" },
    });
  } catch (error) {
    if (error instanceof RoutingError) return fail(error.message, error.status);
    throw error;
  }
}
