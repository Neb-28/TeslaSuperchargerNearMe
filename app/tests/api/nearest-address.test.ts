import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/nearest-address/route";

const call = (query: string) => GET(new Request(`https://example.com/api/nearest-address${query}`));

describe("GET /api/nearest-address", () => {
  beforeEach(() => {
    process.env.ORS_API_KEY = "test-key";
  });
  afterEach(() => {
    delete process.env.ORS_API_KEY;
    vi.unstubAllGlobals();
  });

  it("rejects a missing or impossible location without calling anything", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect((await call("")).status).toBe(400);
    expect((await call("?lat=95&lon=10")).status).toBe(400);
    expect((await call("?lat=abc&lon=10")).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the nearest street address, never cached", async () => {
    const fetchSpy = vi.fn(async () => Response.json({ features: [{ properties: { label: "1600 Pennsylvania Avenue NW, Washington, DC, USA" } }] }));
    vi.stubGlobal("fetch", fetchSpy);
    const response = await call("?lat=38.898&lon=-77.037");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ label: "1600 Pennsylvania Avenue NW, Washington, DC, USA" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const url = new URL(String((fetchSpy.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe("/geocode/reverse");
    expect(url.searchParams.get("point.lat")).toBe("38.898");
    expect(url.searchParams.get("layers")).toBe("address,street,locality,county");
  });

  it("says when lookups aren't set up or the service is busy", async () => {
    delete process.env.ORS_API_KEY;
    expect((await call("?lat=38.9&lon=-77")).status).toBe(503);
    process.env.ORS_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    expect((await call("?lat=38.9&lon=-77")).status).toBe(429);
  });
});
