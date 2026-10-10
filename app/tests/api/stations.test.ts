import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/stations/route";
import { getStationBySlug, nearestStations, stationHref, superchargers } from "@/lib/superchargers";

describe("GET /api/stations", () => {
  it("returns a pin for every Supercharger", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pins).toHaveLength(superchargers.length);
    expect(body.pins.length).toBeGreaterThan(3000);
  });

  it("returns pins as [lat, lon, stalls, kw, name, href] inside the US", async () => {
    const { pins } = await GET().json();
    for (const [lat, lon, stalls, kw, name, href] of pins) {
      expect(lat).toBeGreaterThan(17); // Puerto Rico
      expect(lat).toBeLessThan(72); // Alaska
      expect(lon).toBeLessThan(-60);
      expect(stalls === null || stalls > 0).toBe(true);
      expect(kw === null || kw > 0).toBe(true);
      expect(name).toBeTruthy();
      expect(href).toMatch(/^\/supercharger\/[a-z]{2}\/[a-z0-9-]+\/[a-z0-9-]+$/);
    }
  });

  it("is cacheable", () => {
    expect(GET().headers.get("Cache-Control")).toContain("s-maxage");
  });
});

describe("Supercharger data", () => {
  it("gives every station a unique page", () => {
    const hrefs = superchargers.map(stationHref);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("finds a station by its slug", () => {
    const station = superchargers[0];
    expect(getStationBySlug(station.slug)).toEqual(station);
    expect(getStationBySlug("does-not-exist")).toBeNull();
  });

  it("sorts nearest stations by distance", () => {
    // Arlington, VA (ZIP 22202)
    const nearest = nearestStations([38.8569, -77.0515], 5);
    expect(nearest).toHaveLength(5);
    expect(nearest[0].miles).toBeLessThan(5);
    for (let i = 1; i < nearest.length; i++) expect(nearest[i].miles).toBeGreaterThanOrEqual(nearest[i - 1].miles);
  });
});
