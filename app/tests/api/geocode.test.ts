import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/geocode/route";
import { looksLikeAddress, parseZip } from "@/lib/zipQuery";

function call(query?: string, country?: string) {
  const url = new URL("http://localhost/api/geocode");
  if (query !== undefined) url.searchParams.set("q", query);
  if (country) url.searchParams.set("country", country);
  return GET(new Request(url));
}

// openrouteservice's answer for one match.
const orsMatch = (label: string, lat: number, lon: number, confidence = 1) => ({
  features: [{ geometry: { coordinates: [lon, lat] }, properties: { label, country_a: "USA", confidence } }],
});

afterEach(() => {
  delete process.env.ORS_API_KEY;
  vi.unstubAllGlobals();
});

describe("GET /api/geocode", () => {
  it("returns the center of a known ZIP code", async () => {
    const response = await call("22202");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.label).toBe("22202");
    // Arlington, VA (Crystal City / Pentagon City)
    expect(body.position[0]).toBeCloseTo(38.857, 2);
    expect(body.position[1]).toBeCloseTo(-77.051, 2);
  });

  it("accepts ZIP+4 and surrounding spaces", async () => {
    const response = await call("  22202-4512 ");
    expect(response.status).toBe(200);
    expect((await response.json()).label).toBe("22202");
  });

  it("is cacheable", async () => {
    const response = await call("90210");
    expect(response.headers.get("Cache-Control")).toContain("max-age");
  });

  it("returns 404 for a ZIP that doesn't exist", async () => {
    const response = await call("00000");
    expect(response.status).toBe(404);
  });

  it.each([undefined, "", "   ", "x".repeat(201)])("returns 400 for %j", async (query) => {
    const response = await call(query);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBeTruthy();
  });

  it("looks up ZIP codes locally, without the address service", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect((await call("22202")).status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("finds a street address, inside the map's country", async () => {
    process.env.ORS_API_KEY = "test-key";
    const fetchSpy = vi.fn(async () => Response.json(orsMatch("1600 Amphitheatre Parkway, Mountain View, CA, USA", 37.422, -122.084)));
    vi.stubGlobal("fetch", fetchSpy);

    const response = await call("1600 Amphitheatre Pkwy, Mountain View");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.label).toBe("1600 Amphitheatre Parkway, Mountain View, CA");
    expect(body.position).toEqual([37.422, -122.084]);
    const sent = new URL(String((fetchSpy.mock.calls[0] as unknown as [URL])[0]));
    expect(sent.searchParams.get("boundary.country")).toBe("US");
    expect(response.headers.get("Cache-Control")).toContain("s-maxage");
  });

  it("searches another country's map inside that country", async () => {
    process.env.ORS_API_KEY = "test-key";
    const fetchSpy = vi.fn(async () => Response.json(orsMatch("Marienplatz, München, Germany", 48.137, 11.575)));
    vi.stubGlobal("fetch", fetchSpy);
    expect((await call("Marienplatz München", "de")).status).toBe(200);
    expect(new URL(String((fetchSpy.mock.calls[0] as unknown as [URL])[0])).searchParams.get("boundary.country")).toBe("DE");
  });

  it("picks the match in the city that was typed when several fit", async () => {
    process.env.ORS_API_KEY = "test-key";
    const features = ["350 5th Avenue, Troy, NY, USA", "350 5th Avenue, New York, NY, USA"].map((label, i) => ({
      geometry: { coordinates: [-73.98 - i, 40.7 + i] },
      properties: { label, country_a: "USA", confidence: 1 },
    }));
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ features })));
    expect((await (await call("350 5th Ave, New York")).json()).label).toBe("350 5th Avenue, New York, NY");
  });

  it("says when nothing fits, instead of guessing", async () => {
    process.env.ORS_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(orsMatch("Somewhere", 1, 1, 0.2))));
    const response = await call("asdfghjkl");
    expect(response.status).toBe(404);
    expect((await response.json()).error).toContain("couldn't find");
  });

  it("asks for a ZIP code when address search isn't set up", async () => {
    const response = await call("Bethesda, MD");
    expect(response.status).toBe(503);
  });

  it("passes on a busy address service as a friendly error", async () => {
    process.env.ORS_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    const response = await call("Bethesda, MD");
    expect(response.status).toBe(429);
    expect((await response.json()).error).toContain("ZIP code");
  });
});

describe("looksLikeAddress", () => {
  it.each(["1600 Amphitheatre Pkwy", "123 Main St, Springfield", "Main St, Springfield", "4-12 Elm Road", "12B Baker Street"])("is true for %j", (text) => {
    expect(looksLikeAddress(text)).toBe(true);
  });

  it.each(["San Jose", "22202", "Tesla Supercharger", "  ", "I-95"])("is false for %j", (text) => {
    expect(looksLikeAddress(text)).toBe(false);
  });
});

describe("parseZip", () => {
  it("extracts the 5-digit ZIP", () => {
    expect(parseZip("22202")).toBe("22202");
    expect(parseZip("22202-4512")).toBe("22202");
    expect(parseZip("Arlington 22202")).toBeNull();
  });
});
