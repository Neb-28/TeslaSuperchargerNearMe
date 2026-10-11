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

export async function searchAddress(text: string): Promise<{ label: string; position: LatLng } | null> {
  const url = new URL(`${baseUrl()}/geocode/search`);
  url.searchParams.set("api_key", process.env.ORS_API_KEY ?? "");
  url.searchParams.set("text", text);
  url.searchParams.set("size", "1");

  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!response?.ok) throw new RoutingError(response?.status === 429 ? BUSY : "Address search isn't available right now.", response?.status === 429 ? 429 : 502);

  const feature = (await response.json()).features?.[0];
  if (!feature) return null;
  const [lon, lat] = feature.geometry.coordinates as [number, number];
  return { label: String(feature.properties?.label ?? text), position: [lat, lon] };
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
    body: JSON.stringify({ coordinates: [[from[1], from[0]], [to[1], to[0]]], instructions: false }),
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
