// Server-only: loads the places snapshot (scripts/import-places.mjs). When the M1 database lands,
// this becomes a query on the PRD's `places` and `station_places` tables.
import snapshot from "@/data/places.json";
import { CATEGORIES, walkMinutes, type CategoryId, type Place } from "./places";

// [category index, name, kind, distance in meters, lat, lon]
type PlaceRow = [number, string, string, number, number, number];

const data = snapshot as unknown as { categories: string[]; stations: Record<string, PlaceRow[]> };

export function placesForStation(stationId: string): Record<CategoryId, Place[]> {
  const result = Object.fromEntries(CATEGORIES.map(({ id }) => [id, [] as Place[]])) as Record<CategoryId, Place[]>;
  for (const [index, name, kind, distanceM, lat, lon] of data.stations[stationId] ?? []) {
    const category = data.categories[index] as CategoryId;
    result[category]?.push({ name, kind, category, distanceM, walkMin: walkMinutes(distanceM), lat, lon });
  }
  return result;
}
