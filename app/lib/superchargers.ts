// Server-only: loads the ~900 KB Supercharger snapshot (scripts/import-superchargers.mjs).
// When the M1 database lands, these functions become SQL queries with the same shapes.
import snapshot from "@/data/superchargers.json";
import type { Pin, PinTuple } from "./pins";
import { milesBetween, type LatLng } from "./stations";

export type Supercharger = {
  id: string;
  slug: string;
  state: string; // lowercase 2-letter code, or "us" when OSM has no state
  city: string; // slug, or "unlisted"
  name: string;
  cityLabel: string | null;
  address: string | null;
  lat: number;
  lon: number;
  stalls: number | null;
  maxKw: number | null;
  ccs: boolean; // has a CCS (Magic Dock) connector, so non-Tesla EVs can plug in
};

export const superchargers = (snapshot as { stations: Supercharger[] }).stations;
export const snapshotDate = (snapshot as { fetchedAt: string | null }).fetchedAt;

export function stationHref(station: Pick<Supercharger, "state" | "city" | "slug">) {
  return `/supercharger/${station.state}/${station.city}/${station.slug}`;
}

const bySlug = new Map(superchargers.map((station) => [station.slug, station]));

export function getStationBySlug(slug: string) {
  return bySlug.get(slug) ?? null;
}

export function stationPins(): PinTuple[] {
  return superchargers.map((station) => [station.lat, station.lon, station.stalls, station.maxKw, station.name, stationHref(station)]);
}

export function toPin(station: Supercharger): Pin {
  return { lat: station.lat, lon: station.lon, stalls: station.stalls, kw: station.maxKw, name: station.name, href: stationHref(station) };
}

export function nearestStations(point: LatLng, limit = 25) {
  return superchargers
    .map((station) => ({ station, miles: milesBetween(point, [station.lat, station.lon]) }))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, limit);
}
