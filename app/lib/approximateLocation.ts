// The visitor's approximate location, which Vercel works out from their IP address and passes on
// every request as headers (https://vercel.com/docs/headers/request-headers). The map uses it only
// to choose where to start; it is never stored. Vercel replaces these headers on every request,
// so a visitor can't make another visitor's map start somewhere else.
import type { LatLng } from "./stations";

export type ApproximateLocation = {
  city: string; // "Los Angeles", "München"
  region: string | null; // ISO 3166-2 subdivision without the country: "CA", "ON", "ENG"
  countryCode: string; // ISO 3166-1 alpha-2: "US", "GB"
  position: LatLng;
};

const MAX_CITY_LENGTH = 60;

function decode(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return null;
  }
}

/** Null when any part is missing or doesn't look right; the map then starts where it always has. */
export function approximateLocation(headers: Headers): ApproximateLocation | null {
  const lat = Number.parseFloat(headers.get("x-vercel-ip-latitude") ?? "");
  const lon = Number.parseFloat(headers.get("x-vercel-ip-longitude") ?? "");
  const city = decode(headers.get("x-vercel-ip-city"));
  const countryCode = headers.get("x-vercel-ip-country")?.trim().toUpperCase() ?? "";
  const region = headers.get("x-vercel-ip-country-region")?.trim().toUpperCase() || null;

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (!city || city.length > MAX_CITY_LENGTH) return null;
  if (!/^[A-Z]{2}$/.test(countryCode)) return null;

  return {
    city,
    region: region && /^[A-Z0-9]{1,3}$/.test(region) ? region : null,
    countryCode,
    position: [lat, lon],
  };
}
