import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/stations/[id]/places/route";
import { createFeatured, deleteFeatured, listFeatured, setFeaturedStatus, SlotTakenError, updateFeatured, type NewFeatured } from "@/lib/featuredStore";
import { superchargers } from "@/lib/superchargers";

// Keep test listings out of the real local store.
const dir = mkdtempSync(path.join(tmpdir(), "featured-"));
process.env.FEATURED_STORE_PATH = path.join(dir, "featured.json");
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const station = superchargers[0];

function newListing(overrides: Partial<NewFeatured> = {}): NewFeatured {
  return {
    stationId: station.id,
    category: "food",
    slot: 1,
    businessName: "Test Diner",
    kind: "Burgers",
    offerText: "Free fries with any burger",
    ctaLabel: "See menu",
    ctaUrl: "https://example.com/menu",
    address: null,
    distanceM: 250,
    lat: station.lat,
    lon: station.lon,
    contactName: "Pat",
    contactEmail: "owner@example.com",
    phone: "555-0100",
    source: "admin",
    ...overrides,
  };
}

function call(id: string, category?: string) {
  const url = new URL(`http://localhost/api/stations/${id}/places`);
  if (category) url.searchParams.set("category", category);
  return GET(new Request(url), { params: Promise.resolve({ id }) });
}

beforeEach(async () => {
  for (const listing of await listFeatured()) await deleteFeatured(listing.id);
});

describe("GET /api/stations/[id]/places", () => {
  it("returns 404 for an unknown station", async () => {
    expect((await call("n0", "food")).status).toBe(404);
  });

  it.each([undefined, "pizza", ""])("returns 400 for category %j", async (category) => {
    expect((await call(station.id, category)).status).toBe(400);
  });

  it("returns free places in walk-time order when nothing is featured", async () => {
    const body = await (await call(station.id, "food")).json();
    expect(body.category).toBe("food");
    const ranks = body.listings.map((listing: { rank: number }) => listing.rank);
    expect(ranks).toEqual(ranks.map((_: number, index: number) => index + 1));
    const walks = body.listings.map((listing: { place: { walkMin: number } }) => listing.place.walkMin);
    expect(walks).toEqual([...walks].sort((a, b) => a - b));
  });

  it("puts the live featured listing first, labeled as featured", async () => {
    await createFeatured(newListing(), "live");
    const body = await (await call(station.id, "food")).json();
    expect(body.listings[0]).toMatchObject({ type: "featured", rank: 1, featured: { businessName: "Test Diner" } });
    expect(body.listings.slice(1).every((listing: { type: string }) => listing.type === "place")).toBe(true);
  });

  it("never exposes the business's contact details", async () => {
    await createFeatured(newListing(), "live");
    const text = await (await call(station.id, "food")).text();
    expect(text).not.toContain("owner@example.com");
    expect(text).not.toContain("555-0100");
    expect(text).not.toContain("Pat");
  });

  it("doesn't show pending applications", async () => {
    await createFeatured(newListing({ source: "business" }));
    const body = await (await call(station.id, "food")).json();
    expect(body.listings.some((listing: { type: string }) => listing.type === "featured")).toBe(false);
  });

  it("keeps featured listings to their own category", async () => {
    await createFeatured(newListing(), "live");
    const body = await (await call(station.id, "coffee")).json();
    expect(body.listings.some((listing: { type: string }) => listing.type === "featured")).toBe(false);
  });
});

describe("featured listing store", () => {
  it("allows only one live listing per station and category", async () => {
    await createFeatured(newListing(), "live");
    await expect(createFeatured(newListing({ businessName: "Rival Diner" }), "live")).rejects.toBeInstanceOf(SlotTakenError);
    const waiting = await createFeatured(newListing({ businessName: "Rival Diner" }));
    await expect(setFeaturedStatus(waiting.id, "live")).rejects.toBeInstanceOf(SlotTakenError);
  });

  it("frees the slot when the live listing is paused", async () => {
    const first = await createFeatured(newListing(), "live");
    const second = await createFeatured(newListing({ businessName: "Rival Diner" }));
    await setFeaturedStatus(first.id, "paused");
    await expect(setFeaturedStatus(second.id, "live")).resolves.toMatchObject({ status: "live" });
  });

  it("lets three businesses share a category, one per spot", async () => {
    await createFeatured(newListing(), "live");
    await expect(createFeatured(newListing({ slot: 2, businessName: "Second Diner" }), "live")).resolves.toMatchObject({ slot: 2 });
    await expect(createFeatured(newListing({ slot: 3, businessName: "Third Diner" }), "live")).resolves.toMatchObject({ slot: 3 });
    await expect(createFeatured(newListing({ slot: 3, businessName: "Fourth Diner" }), "live")).rejects.toBeInstanceOf(SlotTakenError);

    const body = await (await call(station.id, "food")).json();
    expect(body.listings.slice(0, 4).map((listing: { rank: number; type: string; featured?: { businessName: string; slot: number } }) => [listing.rank, listing.type, listing.featured?.businessName, listing.featured?.slot])).toEqual([
      [1, "featured", "Test Diner", 1],
      [2, "featured", "Second Diner", 2],
      [3, "featured", "Third Diner", 3],
      [4, "place", undefined, undefined],
    ]);
  });

  it("moves a live listing only to a free spot", async () => {
    await createFeatured(newListing(), "live");
    const second = await createFeatured(newListing({ slot: 2, businessName: "Second Diner" }), "live");
    await expect(updateFeatured(second.id, { slot: 1 })).rejects.toBeInstanceOf(SlotTakenError);
    await expect(updateFeatured(second.id, { slot: 3 })).resolves.toMatchObject({ slot: 3, status: "live" });
  });

  it("lets different categories each have a live listing", async () => {
    await createFeatured(newListing(), "live");
    await expect(createFeatured(newListing({ category: "coffee", businessName: "Bean Bar" }), "live")).resolves.toMatchObject({ status: "live" });
  });
});
