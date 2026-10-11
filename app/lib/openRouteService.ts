// Server-only: driving routes and address search from openrouteservice (HeiGIT, OpenStreetMap data).
// ORS_API_KEY stays on the server. ORS_BASE_URL can point to a self-hosted instance later.
import type { LatLng } from "./stations";

const baseUrl = () => (process.env.ORS_BASE_URL || "https://api.openrouteservice.org").replace(/\/+$/, "");

export function routingConfigured() {
  return Boolean(process.env.ORS_API_KEY);
}

// Errors safe to show visitors, with the HTTP status our API answers with.
export class RoutingError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

const BUSY = "The route planner is busy right now. Please try again in a minute.";
const SNAP_RADIUS_M = 5000;

export type AddressMatch = {
  label: string;
  position: LatLng;
  country: string | null;
  confidence: number; // 0–1, how well the match fits the text
  distanceKm: number | null; // from the `near` point, when one was given
};

// The best few matches for an address or place name, best first. `near` biases the search
// toward a point (e.g. the other end of the trip when that's an exact location).
export async function searchAddress(text: string, near?: LatLng): Promise<AddressMatch[]> {
  const url = new URL(`${baseUrl()}/geocode/search`);
  url.searchParams.set("api_key", process.env.ORS_API_KEY ?? "");
  url.searchParams.set("text", text);
  url.searchParams.set("size", "5");
  if (near) {
    url.searchParams.set("focus.point.lat", String(near[0]));
    url.searchParams.set("focus.point.lon", String(near[1]));
  }

  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!response?.ok) throw new RoutingError(response?.status === 429 ? BUSY : "Address search isn't available right now.", response?.status === 429 ? 429 : 502);

  const features = ((await response.json()).features ?? []) as { geometry: { coordinates: [number, number] }; properties?: Record<string, unknown> }[];
  return features.map(({ geometry, properties }) => ({
    label: String(properties?.label ?? text),
    position: [geometry.coordinates[1], geometry.coordinates[0]] as LatLng,
    country: typeof properties?.country_a === "string" ? properties.country_a : null,
    confidence: typeof properties?.confidence === "number" ? properties.confidence : 0,
    distanceKm: typeof properties?.distance === "number" ? properties.distance : null,
  }));
}

// The street address nearest a point (for "Use my location"), or null if there's none.
export async function nearestAddress(position: LatLng): Promise<string | null> {
  const url = new URL(`${baseUrl()}/geocode/reverse`);
  url.searchParams.set("api_key", process.env.ORS_API_KEY ?? "");
  url.searchParams.set("point.lat", String(position[0]));
  url.searchParams.set("point.lon", String(position[1]));
  url.searchParams.set("size", "1");
  // A street address, else the street, else the town (rural spots). Without this the nearest
  // "venue" wins, which can be a numbered room or a colonnade instead of an address.
  url.searchParams.set("layers", "address,street,locality,county");

  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!response?.ok) throw new RoutingError(response?.status === 429 ? BUSY : "Address lookup isn't available right now.", response?.status === 429 ? 429 : 502);
  const label = (await response.json()).features?.[0]?.properties?.label;
  return typeof label === "string" ? label : null;
}

export async function drivingRoute(from: LatLng, to: LatLng): Promise<{ path: LatLng[]; distanceKm: number; durationS: number }> {
  const response = await fetch(`${baseUrl()}/v2/directions/driving-car/geojson`, {
    method: "POST",
    headers: {
      Authorization: process.env.ORS_API_KEY ?? "",
      "Content-Type": "application/json",
      Accept: "application/geo+json, application/json",
    },
    // A city's search result is its center point, which can be far from any road (Orlando's is
    // inside the airport grounds), so look for the nearest road within 5 km rather than 350 m.
    body: JSON.stringify({ coordinates: [[from[1], from[0]], [to[1], to[0]]], instructions: false, radiuses: [SNAP_RADIUS_M, SNAP_RADIUS_M] }),
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);

  if (!response) throw new RoutingError("The route planner didn't answer. Please try again.");
  if (!response.ok) {
    const code = (await response.json().catch(() => null))?.error?.code;
    if (response.status === 429) throw new RoutingError(BUSY, 429);
    if (code === 2010) throw new RoutingError("We couldn't find a road near the start or the destination. Try a nearby address.", 404);
    if (code === 2009) throw new RoutingError("There's no driving route between these places.", 404);
    if (code === 2004) throw new RoutingError("That trip is too long to plan in one go. Try a closer destination.", 400);
    throw new RoutingError("The route planner isn't available right now. Please try again later.");
  }

  const feature = (await response.json()).features?.[0];
  if (!feature) throw new RoutingError("There's no driving route between these places.", 404);
  return {
    path: (feature.geometry.coordinates as [number, number][]).map(([lon, lat]) => [lat, lon]),
    distanceKm: feature.properties.summary.distance / 1000,
    durationS: feature.properties.summary.duration,
  };
}
