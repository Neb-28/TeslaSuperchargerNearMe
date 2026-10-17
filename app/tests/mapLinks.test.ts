import { describe, expect, it } from "vitest";
import { allCities, allWorldCities, getStationBySlug } from "@/lib/superchargers";
import { allTowns } from "@/lib/towns";

// "See them on the map" opens /map?station=<slug>; the map page centers on that station, and
// falls back to its default view when the slug is unknown.
describe("See them on the map", () => {
  it("points every city page at one of its own stations", () => {
    for (const city of [...allCities(), ...allWorldCities()]) {
      expect(getStationBySlug(city.stations[0].slug)?.id, `${city.state}/${city.city}`).toBe(city.stations[0].id);
    }
  });

  it("points every town page at its closest station", () => {
    const towns = allTowns();
    expect(towns.length).toBeGreaterThan(7000);
    for (const town of towns) {
      const { station } = town.nearest[0];
      expect(getStationBySlug(station.slug)?.id, `${town.state}/${town.slug}`).toBe(station.id);
    }
  });
});
