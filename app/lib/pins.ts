// Client-safe station shape for the map and list (no data imports here).

export type Pin = {
  lat: number;
  lon: number;
  stalls: number | null;
  kw: number | null;
  name: string;
  href: string;
  // Outside the US: city, region, country and English city names, so map search finds them.
  search?: string;
};

// Wire format from /api/stations: [lat, lon, stalls, kw, name, href], about 70 KB gzipped for the US.
// Pins outside the US carry a 7th field with extra search words.
export type PinTuple = [number, number, number | null, number | null, string, string] | [number, number, number | null, number | null, string, string, string];

export function pinFromTuple([lat, lon, stalls, kw, name, href, search]: PinTuple): Pin {
  return search === undefined ? { lat, lon, stalls, kw, name, href } : { lat, lon, stalls, kw, name, href, search };
}
