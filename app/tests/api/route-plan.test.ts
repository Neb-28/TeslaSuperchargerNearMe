import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/route-plan/route";
import { superchargers } from "@/lib/superchargers";

const call = (query: Record<string, string>) => GET(new Request(`https://example.com/api/route-plan?${new URLSearchParams(query)}`));
const trip = { from: "22202", to: "10001", range: "346", plug: "nacs" };

// A route made of real US stations' positions, so the planner has stations right on it.
function fakeRoute(points: [number, number][], distanceM: number) {
  return {
    features: [{ geometry: { coordinates: points.map(([lat, lon]) => [lon, lat]) }, properties: { summary: { distance: distanceM, duration: 3600 } } }],
  };
}

describe("GET /api/route-plan", () => {
  beforeEach(() => {
    process.env.ORS_API_KEY = "test-key";
  });
  afterEach(() => {
    delete process.env.ORS_API_KEY;
    vi.unstubAllGlobals();
  });

  it("checks the inputs before calling anything", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect((await call({ ...trip, from: "" })).status).toBe(400);
    expect((await call({ ...trip, plug: "spaceship" })).status).toBe(400);
    expect((await call({ ...trip, range: "5000" })).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("says when the planner isn't set up", async () => {
    delete process.env.ORS_API_KEY;
    const response = await call(trip);
    expect(response.status).toBe(503);
  });

  it("plans a trip from ZIP codes without address search", async () => {
    const a = superchargers[0];
    const b = superchargers[1];
    const fetchSpy = vi.fn(async () => Response.json(fakeRoute([[a.lat, a.lon], [b.lat, b.lon]], 50_000)));
    vi.stubGlobal("fetch", fetchSpy);

    const response = await call(trip);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // directions only; ZIPs are looked up locally
    // City centers can be far from a road (Orlando's is inside the airport): search up to 5 km.
    const sent = JSON.parse(String((fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(sent.radiuses).toEqual([5000, 5000]);
    expect(body.from.label).toBe("ZIP 22202");
    expect(body.stops).toEqual([]);
    expect(body.arrivePct).toBeGreaterThan(10);
    expect(response.headers.get("cache-control")).toContain("s-maxage");
  });

  it("never caches trips from the visitor's own location", async () => {
    const a = superchargers[0];
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(fakeRoute([[a.lat, a.lon], [a.lat + 0.1, a.lon]], 12_000))));
    const response = await call({ ...trip, from: `${a.lat},${a.lon}` });
    expect(response.status).toBe(200);
    expect((await response.json()).from.label).toBe("Your location");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("uses other networks where there are no Superchargers, and labels them", async () => {
    // Newfoundland's Trans-Canada Highway has ChargePoint fast chargers (St. John's, Clarenville,
    // Gander) and no Supercharger: St. John's → Clarenville → Gander → Grand Falls, about 290 km.
    const waypoints: [number, number][] = [[47.5085, -52.8298], [48.14544, -53.96047], [48.95005, -54.61573], [48.93, -55.66]];
    const points = waypoints.flatMap(([lat, lon], i) => {
      const next = waypoints[i + 1];
      if (!next) return [[lat, lon] as [number, number]];
      return Array.from({ length: 100 }, (_, step) => [lat + ((next[0] - lat) * step) / 100, lon + ((next[1] - lon) * step) / 100] as [number, number]);
    });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(fakeRoute(points, 290_000))));

    const response = await call({ from: "47.5085,-52.8298", to: "48.93,-55.66", range: "150", plug: "ccs" });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.stops.length).toBeGreaterThan(0);
    for (const stop of body.stops) {
      expect(stop.station.network).toBe("ChargePoint");
      expect(stop.station.href).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\//);
      expect(stop.nearby).toBeNull();
    }
    expect(body.arrivePct).toBeGreaterThanOrEqual(10);
  });

  it("picks the match in the same country when a name is ambiguous", async () => {
    // "Miami" finds Barranquilla, Colombia first; with Atlanta, GA it should be Miami, FL.
    const place = (label: string, lat: number, lon: number, country: string) => ({
      geometry: { coordinates: [lon, lat] },
      properties: { label, country_a: country },
    });
    const fetchSpy = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/geocode/search")) {
        return Response.json({
          features:
            url.searchParams.get("text") === "Miami"
              ? [place("Barranquilla, AT, Colombia", 10.96, -74.8, "COL"), place("Miami, FL, USA", 25.77, -80.19, "USA")]
              : [place("Atlanta, GA, USA", 33.75, -84.39, "USA"), place("Atalanta, SC, Brazil", -27.4, -49.8, "BRA")],
        });
      }
      return Response.json(fakeRoute([[25.77, -80.19], [33.75, -84.39]], 1_000_000));
    });
    vi.stubGlobal("fetch", fetchSpy);

    const body = await (await call({ from: "Miami", to: "Atlanta", range: "346", plug: "nacs" })).json();
    expect(body.from.label).toBe("Miami, FL, USA");
    expect(body.to.label).toBe("Atlanta, GA, USA");
  });

  it("next to a ZIP code, searches near it and takes the closest good match", async () => {
    // "Richmond" from Arlington, VA: Staten Island (Richmond County) ranks first but Richmond, VA is closer.
    const match = (label: string, lat: number, lon: number, distance: number) => ({
      geometry: { coordinates: [lon, lat] },
      properties: { label, country_a: "USA", confidence: 1, distance },
    });
    const fetchSpy = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/geocode/search")) {
        return Response.json({ features: [match("Staten Island, NY, USA", 40.58, -74.15, 314), match("Richmond, VA, USA", 37.54, -77.44, 154)] });
      }
      return Response.json(fakeRoute([[38.86, -77.05], [37.54, -77.44]], 170_000));
    });
    vi.stubGlobal("fetch", fetchSpy);

    const body = await (await call({ from: "22202", to: "Richmond", range: "346", plug: "nacs" })).json();
    const search = new URL(String(fetchSpy.mock.calls.find(([input]) => String(input).includes("/geocode/search"))![0]));
    expect(Number(search.searchParams.get("focus.point.lat"))).toBeCloseTo(38.86, 1);
    expect(body.to.label).toBe("Richmond, VA, USA");
  });

  it("passes on a friendly message when there's no road nearby", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: 2010 } }, { status: 404 })));
    const response = await call(trip);
    expect(response.status).toBe(404);
    expect((await response.json()).error).toMatch(/couldn't find a road/);
  });
});
