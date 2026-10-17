import { describe, expect, it } from "vitest";
import { approximateLocation } from "@/lib/approximateLocation";

const vercel = (values: Record<string, string>) => new Headers(values);
const losAngeles = {
  "x-vercel-ip-latitude": "34.0544",
  "x-vercel-ip-longitude": "-118.2441",
  "x-vercel-ip-city": "Los%20Angeles",
  "x-vercel-ip-country": "US",
  "x-vercel-ip-country-region": "CA",
};

describe("approximate location from Vercel's IP headers", () => {
  it("reads the city, region, country and position", () => {
    expect(approximateLocation(vercel(losAngeles))).toEqual({ city: "Los Angeles", region: "CA", countryCode: "US", position: [34.0544, -118.2441] });
  });

  it("decodes accented city names", () => {
    const munich = approximateLocation(vercel({ ...losAngeles, "x-vercel-ip-city": "M%C3%BCnchen", "x-vercel-ip-country": "DE", "x-vercel-ip-country-region": "BY" }));
    expect(munich?.city).toBe("München");
  });

  it("gives nothing without headers (local development, other hosts)", () => {
    expect(approximateLocation(new Headers())).toBeNull();
  });

  it("gives nothing when a part is missing or malformed", () => {
    for (const broken of [
      { "x-vercel-ip-latitude": "" },
      { "x-vercel-ip-latitude": "abc" },
      { "x-vercel-ip-latitude": "123" },
      { "x-vercel-ip-longitude": "-200" },
      { "x-vercel-ip-city": "" },
      { "x-vercel-ip-city": "%E0%A4%A" }, // broken encoding
      { "x-vercel-ip-city": "x".repeat(61) },
      { "x-vercel-ip-country": "USA" },
    ]) {
      expect(approximateLocation(vercel({ ...losAngeles, ...broken })), JSON.stringify(broken)).toBeNull();
    }
  });

  it("drops a region that doesn't look like a code, keeping the rest", () => {
    expect(approximateLocation(vercel({ ...losAngeles, "x-vercel-ip-country-region": "<script>" }))?.region).toBeNull();
  });
});
