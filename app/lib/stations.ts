// Shared map helpers (client-safe). Station data itself lives in lib/superchargers.ts (server).

export type LatLng = [number, number];

// Where the map opens when we don't know the visitor's location (Fairfax, VA).
export const DEFAULT_CENTER: LatLng = [38.8027, -77.2962];

export function milesBetween(a: LatLng, b: LatLng) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}
