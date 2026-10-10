import { afterEach, describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";
import { allCities, cityHref, getCity, stationHref, stationTitle, superchargers } from "@/lib/superchargers";

describe("station titles", () => {
  it("are unique for every station", () => {
    const titles = superchargers.map(stationTitle);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("include the street and city when the station has an address", () => {
    const station = superchargers.find((item) => item.street && item.cityLabel)!;
    expect(stationTitle(station)).toContain(station.street!);
    expect(stationTitle(station)).toContain(station.cityLabel!);
  });

  it("say 'near' a city for stations OSM has no address for", () => {
    const station = superchargers.find((item) => item.nearLabel)!;
    expect(stationTitle(station)).toContain(`near ${station.nearLabel}`);
  });
});

describe("city and state pages", () => {
  it("cover every station that has a state and city", () => {
    for (const station of superchargers) {
      if (station.state === "us" || station.city === "unlisted") continue;
      const city = getCity(station.state, station.city);
      expect(city?.stations).toContain(station);
    }
  });

  it("give each city a readable 'City, ST' label", () => {
    for (const city of allCities()) expect(city.label).toMatch(/^.+, [A-Z]{2}$/);
  });
});

describe("sitemap", () => {
  const urls = sitemap().map((entry) => entry.url);

  it("lists home, every city page and every station page once", () => {
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.some((url) => url.endsWith(cityHref("tx", "austin")))).toBe(true);
    for (const station of superchargers.slice(0, 50)) expect(urls.some((url) => url.endsWith(stationHref(station)))).toBe(true);
    expect(urls.length).toBeGreaterThan(superchargers.length + allCities().length);
    expect(urls.length).toBeLessThan(50_000); // Google's per-sitemap limit
  });

  it("uses absolute https URLs and skips private pages", () => {
    for (const url of urls) expect(url).toMatch(/^https:\/\//);
    // Match whole leading path segments: a station on "Business Hub Drive" is fine.
    expect(urls.some((url) => /^\/(admin|api|business|favorites)(\/|$)/.test(new URL(url).pathname))).toBe(false);
  });
});

describe("robots.txt", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("blocks everything on preview and staging deployments", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const { default: robots } = await import("@/app/robots");
    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
  });

  it("allows crawling and points to the sitemap on the live site", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { default: robots } = await import("@/app/robots");
    const result = robots();
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
    expect(result.rules).toMatchObject({ allow: "/", disallow: expect.arrayContaining(["/admin", "/api/"]) });
  });
});
