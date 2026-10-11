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
    slot: 1,
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
    const result = orderListings(places, [featured({ distanceM: 590 })]);
    expect(result[0]).toMatchObject({ type: "featured", rank: 1 });
  });

  it("sorts free places by walking time and numbers them from #2 after a featured listing", () => {
    const result = orderListings(places, [featured()]);
    expect(result.slice(1).map((item) => (item.type === "place" ? [item.rank, item.place.name] : null))).toEqual([
      [2, "Greenline Deli"],
      [3, "Lucky Noodle Bar"],
      [4, "Cedar Grill"],
    ]);
  });

  it("numbers free places from #1 when there is no featured listing", () => {
    const result = orderListings(places, []);
    expect(result[0]).toMatchObject({ type: "place", rank: 1, place: { name: "Greenline Deli" } });
    expect(result).toHaveLength(3);
  });

  it.each(["pending", "paused", "rejected"] as const)("ignores a %s featured listing", (status) => {
    const result = orderListings(places, [featured({ status })]);
    expect(result.every((item) => item.type === "place")).toBe(true);
    expect(result[0].rank).toBe(1);
  });

  it("doesn't list the featured business twice", () => {
    const result = orderListings([...places, place("Hearth & Ember Kitchen", 200)], [featured()]);
    expect(result.filter((item) => item.type === "place" && item.place.name === "Hearth & Ember Kitchen")).toHaveLength(0);
    expect(result).toHaveLength(4);
  });

  it("breaks walking-time ties by distance, then name", () => {
    const tied = [place("B Cafe", 170), place("A Cafe", 170), place("C Cafe", 130)];
    expect(orderListings(tied, []).map((item) => (item.type === "place" ? item.place.name : ""))).toEqual(["C Cafe", "A Cafe", "B Cafe"]);
  });

  it("puts #1 Featured, then #2 and #3 Sponsored, above every free place", () => {
    const paid = [
      featured({ id: "s3", slot: 3, businessName: "Third Tacos", distanceM: 100 }),
      featured({ id: "s1", slot: 1 }),
      featured({ id: "s2", slot: 2, businessName: "Second Sushi", distanceM: 590 }),
    ];
    const result = orderListings(places, paid);
    expect(result.map((item) => [item.rank, item.type === "featured" ? item.featured.businessName : item.place.name])).toEqual([
      [1, "Hearth & Ember Kitchen"],
      [2, "Second Sushi"],
      [3, "Third Tacos"],
      [4, "Greenline Deli"],
      [5, "Lucky Noodle Bar"],
      [6, "Cedar Grill"],
    ]);
  });

  it("closes up the numbering when a spot is empty", () => {
    // Only #2 and #3 are sold: they're numbered 1 and 2, and free places follow from 3.
    const result = orderListings(places, [featured({ id: "s2", slot: 2 }), featured({ id: "s3", slot: 3, businessName: "Third Tacos" })]);
    expect(result.slice(0, 3).map((item) => [item.rank, item.type])).toEqual([
      [1, "featured"],
      [2, "featured"],
      [3, "place"],
    ]);
  });

  it("doesn't list any paid business twice", () => {
    const withPaidPlaces = [...places, place("Second Sushi", 120), place("Hearth & Ember Kitchen", 200)];
    const result = orderListings(withPaidPlaces, [featured(), featured({ id: "s2", slot: 2, businessName: "Second Sushi" })]);
    expect(result.filter((item) => item.type === "place").map((item) => (item.type === "place" ? item.place.name : ""))).toEqual([
      "Greenline Deli",
      "Lucky Noodle Bar",
      "Cedar Grill",
    ]);
  });

  it("doesn't change the input list", () => {
    const input = [...places];
    orderListings(input, [featured()]);
    expect(input.map((item) => item.name)).toEqual(places.map((item) => item.name));
  });
});
