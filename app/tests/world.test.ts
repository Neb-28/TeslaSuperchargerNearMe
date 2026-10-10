import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/stations/route";
import sitemap from "@/app/sitemap";
import {
  cityHref,
  countries,
  getCity,
  getCountry,
  getStationBySlug,
  nearbyCities,
  stationHref,
  stationPins,
  stationTitle,
  superchargers,
  worldStations,
} from "@/lib/superchargers";
import { US_STATES } from "@/lib/usStates";

const call = (query = "") => GET(new Request(`http://localhost/api/stations${query}`));

describe("GET /api/stations with a country", () => {
  it("still returns exactly the US list without a country", async () => {
    expect((await call().json()).pins).toEqual(stationPins());
    expect((await GET().json()).pins).toEqual(stationPins());
  });

  it("returns only that country's stations, with search words", async () => {
    const { pins } = await call("?country=germany").json();
    expect(pins.length).toBe(getCountry("germany")!.count);
    for (const pin of pins) {
      expect(pin[5]).toMatch(/^\/supercharger\/germany\/[a-z0-9-]+\/[a-z0-9-]+$/);
      expect(pin[6]).toContain("Germany");
    }
    expect(pins.some((pin: unknown[]) => String(pin[6]).includes("Munich"))).toBe(true);
  });

  it("falls back to the US list for an unknown country", async () => {
    expect((await call("?country=atlantis").json()).pins).toHaveLength(superchargers.length);
  });
});

describe("world data", () => {
  it("never collides with US station slugs or state codes", () => {
    const usSlugs = new Set(superchargers.map((station) => station.slug));
    expect(worldStations.some((station) => usSlugs.has(station.slug))).toBe(false);
    for (const country of countries) expect(US_STATES[country.slug]).toBeUndefined();
    expect(new Set(worldStations.map((station) => station.slug)).size).toBe(worldStations.length);
  });

  it("has London and Munich as city pages", () => {
    const london = getCity("united-kingdom", "london");
    const munich = getCity("germany", "munchen");
    expect(london?.stations.length).toBeGreaterThan(5);
    expect(munich?.name).toBe("München");
    expect(nearbyCities(munich!).every((city) => city.state === "germany")).toBe(true);
  });

  it("finds world stations by slug and gives each a unique title", () => {
    const station = worldStations[0];
    expect(getStationBySlug(station.slug)).toBe(station);
    const titles = worldStations.map(stationTitle);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("puts every country, world city and world station in the sitemap", () => {
    const urls = new Set(sitemap().map((entry) => new URL(entry.url).pathname));
    expect(urls.has("/supercharger/germany")).toBe(true);
    expect(urls.has(cityHref("united-kingdom", "london"))).toBe(true);
    expect(urls.has(stationHref(worldStations[worldStations.length - 1]))).toBe(true);
  });
});

describe("country homepages", () => {
  it("rewrites /?country=<slug> for exactly the countries we have", async () => {
    const config = (await import("@/next.config")).default;
    const rewrites = await config.rewrites!();
    const [rule] = Array.isArray(rewrites) ? rewrites : (rewrites.beforeFiles ?? []);
    expect(rule.destination).toBe("/home/:country");
    const value = new RegExp(`^${rule.has![0].value}$`);
    for (const country of countries) expect(value.test(country.slug)).toBe(true);
    expect(value.test("united-states")).toBe(false);
    expect(value.test("atlantis")).toBe(false);
  });
});
