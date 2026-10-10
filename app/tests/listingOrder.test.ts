import { describe, expect, it } from "vitest";
import type { FeaturedListing } from "@/lib/featured";
import { orderListings } from "@/lib/listingOrder";
import { walkMinutes, type Place } from "@/lib/places";

function place(name: string, distanceM: number): Place {
  return { name, kind: "Restaurant", category: "food", distanceM, walkMin: walkMinutes(distanceM), lat: 0, lon: 0 };
}

function featured(overrides: Partial<FeaturedListing> = {}): FeaturedListing {
  return {
    id: "f1",
    stationId: "n1",
    category: "food",
    businessName: "Hearth & Ember Kitchen",
    kind: "Wood-fired pizza",
    offerText: "10% off for EV drivers",
    ctaLabel: "Claim offer",
    ctaUrl: "https://example.com",
    address: null,
    distanceM: 500,
    lat: null,
    lon: null,
    contactName: "Sam",
    contactEmail: "sam@example.com",
    phone: null,
    status: "live",
    source: "business",
    createdAt: "2026-10-10T00:00:00Z",
    updatedAt: "2026-10-10T00:00:00Z",
    ...overrides,
  };
}

const places = [place("Cedar Grill", 480), place("Greenline Deli", 160), place("Lucky Noodle Bar", 320)];

describe("listing order rule", () => {
  it("puts a live featured listing first, even when it's the farthest walk", () => {
    const result = orderListings(places, featured({ distanceM: 590 }));
    expect(result[0]).toMatchObject({ type: "featured", rank: 1 });
  });

  it("sorts free places by walking time and numbers them from #2 after a featured listing", () => {
    const result = orderListings(places, featured());
    expect(result.slice(1).map((item) => (item.type === "place" ? [item.rank, item.place.name] : null))).toEqual([
      [2, "Greenline Deli"],
      [3, "Lucky Noodle Bar"],
      [4, "Cedar Grill"],
    ]);
  });

  it("numbers free places from #1 when there is no featured listing", () => {
    const result = orderListings(places, null);
    expect(result[0]).toMatchObject({ type: "place", rank: 1, place: { name: "Greenline Deli" } });
    expect(result).toHaveLength(3);
  });

  it.each(["pending", "paused", "rejected"] as const)("ignores a %s featured listing", (status) => {
    const result = orderListings(places, featured({ status }));
    expect(result.every((item) => item.type === "place")).toBe(true);
    expect(result[0].rank).toBe(1);
  });

  it("doesn't list the featured business twice", () => {
    const result = orderListings([...places, place("Hearth & Ember Kitchen", 200)], featured());
    expect(result.filter((item) => item.type === "place" && item.place.name === "Hearth & Ember Kitchen")).toHaveLength(0);
    expect(result).toHaveLength(4);
  });

  it("breaks walking-time ties by distance, then name", () => {
    const tied = [place("B Cafe", 170), place("A Cafe", 170), place("C Cafe", 130)];
    expect(orderListings(tied, null).map((item) => (item.type === "place" ? item.place.name : ""))).toEqual(["C Cafe", "A Cafe", "B Cafe"]);
  });

  it("doesn't change the input list", () => {
    const input = [...places];
    orderListings(input, featured());
    expect(input.map((item) => item.name)).toEqual(places.map((item) => item.name));
  });
});
