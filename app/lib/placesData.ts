// Server-only: loads the places snapshots, OpenStreetMap (scripts/import-places.mjs) plus the
// Overture Maps places OSM lacks (scripts/import-overture-places.mjs). When the M1 database lands,
// this becomes a query on the PRD's `places` and `station_places` tables.
import snapshot from "@/data/places.json";
import overtureSnapshot from "@/data/overture-places.json";
import { CATEGORIES, walkMinutes, type CategoryId, type Place } from "./places";

// [category index, name, kind, distance in meters, lat, lon]
type PlaceRow = [number, string, string, number, number, number];

const data = snapshot as unknown as { categories: string[]; stations: Record<string, PlaceRow[]> };
// Same row format and category order as data/places.json, and already without places OSM lists.
const overture = overtureSnapshot as unknown as { stations: Record<string, PlaceRow[]> };
const PER_CATEGORY = 10;

export function placesForStation(stationId: string): Record<CategoryId, Place[]> {
  const result = Object.fromEntries(CATEGORIES.map(({ id }) => [id, [] as Place[]])) as Record<CategoryId, Place[]>;
  for (const [index, name, kind, distanceM, lat, lon] of [...(data.stations[stationId] ?? []), ...(overture.stations[stationId] ?? [])]) {
    const category = data.categories[index] as CategoryId;
    // OSM names sometimes carry stray spaces ("Soluna  Restaurant").
    result[category]?.push({ name: name.replace(/\s+/g, " ").trim(), kind, category, distanceM, walkMin: walkMinutes(distanceM), lat, lon });
  }
  // The two sources together: the closest places first, 10 per category.
  for (const places of Object.values(result)) places.sort((a, b) => a.distanceM - b.distanceM).splice(PER_CATEGORY);
  return result;
}
