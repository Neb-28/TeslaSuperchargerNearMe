import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/geocode/route";
import { parseZip } from "@/lib/zipQuery";

function call(query?: string) {
  const url = new URL("http://localhost/api/geocode");
  if (query !== undefined) url.searchParams.set("q", query);
  return GET(new Request(url));
}

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

  it.each([undefined, "", "Arlington", "2220", "222022", "22202abc"])("returns 400 for %j", async (query) => {
    const response = await call(query);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBeTruthy();
  });
});

describe("parseZip", () => {
  it("extracts the 5-digit ZIP", () => {
    expect(parseZip("22202")).toBe("22202");
    expect(parseZip("22202-4512")).toBe("22202");
    expect(parseZip("Arlington 22202")).toBeNull();
  });
});
