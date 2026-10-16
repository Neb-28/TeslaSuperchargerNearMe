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

// Pins carry no status; a temporarily closed station's name ends with this label (listName in
// lib/superchargers.ts), which is also how the map knows not to call it "Nearest".
export const CLOSED_LABEL = " · Temporarily closed";
export const isClosedPin = (pin: Pick<Pin, "name">) => pin.name.endsWith(CLOSED_LABEL);

const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Map search by name: a station's name (which includes its city) or, outside the US, its city,
// region and country names. Shared by the map and the server, so both agree on a "match".
export function pinMatches(pin: Pin, query: string) {
  const needle = query.trim().toLowerCase();
  return pin.search === undefined ? pin.name.toLowerCase().includes(needle) : fold(`${pin.name} ${pin.search}`).includes(fold(needle));
}

export function pinFromTuple([lat, lon, stalls, kw, name, href, search]: PinTuple): Pin {
  return search === undefined ? { lat, lon, stalls, kw, name, href } : { lat, lon, stalls, kw, name, href, search };
}
