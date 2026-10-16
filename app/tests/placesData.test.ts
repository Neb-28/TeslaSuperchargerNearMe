import { describe, expect, it } from "vitest";
import overture from "@/data/overture-places.json";
import osm from "@/data/places.json";
import { placesForStation } from "@/lib/placesData";
import { CATEGORIES } from "@/lib/places";

type Row = [number, string, string, number, number, number];
const overtureRows = (overture as unknown as { stations: Record<string, Row[]> }).stations;
const osmRows = (osm as unknown as { categories: string[]; stations: Record<string, Row[]> }).stations;

// A station where Overture adds places on top of OSM's.
const stationId = Object.keys(overtureRows).find((id) => overtureRows[id].length >= 5 && (osmRows[id] ?? []).length >= 5)!;

describe("nearby places from OpenStreetMap and Overture", () => {
  it("include the places Overture adds", () => {
    const merged = Object.values(placesForStation(stationId)).flat().map((place) => place.name);
    const added = overtureRows[stationId].map((row) => row[1].replace(/\s+/g, " ").trim());
    expect(added.some((name) => merged.includes(name))).toBe(true);
  });

  it("list the closest first, at most 30 per category", () => {
    const places = placesForStation(stationId);
    for (const { id } of CATEGORIES) {
      const distances = places[id].map((place) => place.distanceM);
      expect(distances.length).toBeLessThanOrEqual(30);
      expect(distances).toEqual([...distances].sort((a, b) => a - b));
    }
  });

  it("don't repeat a place OSM already lists", () => {
    for (const [id, rows] of Object.entries(overtureRows).slice(0, 500)) {
      const osmNames = new Set((osmRows[id] ?? []).map((row) => row[1].toLowerCase()));
      for (const row of rows) expect(osmNames.has(row[1].toLowerCase()), `${id}: ${row[1]}`).toBe(false);
    }
  });

  it("go past 10 where there's more within a short walk, for the Show more button", () => {
    const longest = Math.max(...Object.keys(overtureRows).slice(0, 2000).flatMap((id) => Object.values(placesForStation(id)).map((list) => list.length)));
    expect(longest).toBeGreaterThan(10);
  });
});
