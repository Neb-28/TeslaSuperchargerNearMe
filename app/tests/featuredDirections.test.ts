import { describe, expect, it } from "vitest";
import { directionsUrl, featuredDestination } from "@/components/NearbySection";

describe("Directions for paid listings", () => {
  it("goes to the place on our nearby list when we know where it is", () => {
    expect(featuredDestination({ lat: 38.62, lon: -77.29, address: "1 Main St" })).toBe("38.62,-77.29");
  });

  it("goes to the street address the business gave when it isn't on the list", () => {
    expect(featuredDestination({ lat: null, lon: null, address: "123 Main St, Woodbridge, VA" })).toBe("123%20Main%20St%2C%20Woodbridge%2C%20VA");
  });

  it("has no destination without a location or an address", () => {
    expect(featuredDestination({ lat: null, lon: null, address: null })).toBeNull();
  });

  it("builds a walking route from the station, or a driving one to other chargers", () => {
    const station = { lat: 38.6, lon: -77.3 };
    expect(directionsUrl(station, "38.62,-77.29", false)).toBe(
      "https://www.google.com/maps/dir/?api=1&origin=38.6,-77.3&destination=38.62,-77.29&travelmode=walking",
    );
    expect(directionsUrl(station, "38.62,-77.29", true)).toContain("travelmode=driving");
  });
});
