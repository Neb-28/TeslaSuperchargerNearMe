// Client-safe station shape for the map and list (no data imports here).

export type Pin = {
  lat: number;
  lon: number;
  stalls: number | null;
  kw: number | null;
  name: string;
  href: string;
};

// Wire format from /api/stations: [lat, lon, stalls, kw, name, href], about 70 KB gzipped for the US.
export type PinTuple = [number, number, number | null, number | null, string, string];

export function pinFromTuple([lat, lon, stalls, kw, name, href]: PinTuple): Pin {
  return { lat, lon, stalls, kw, name, href };
}
