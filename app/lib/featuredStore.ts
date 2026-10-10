// Server-only storage for #1 Featured listings.
// For now this is a JSON file (data/featured-listings.json, git-ignored) so the whole flow works
// locally. Production needs the Postgres `featured_listings` table from the PRD: hosts like
// Vercel can't write to disk. Swap the bodies of these functions; the signatures stay.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FeaturedListing, FeaturedStatus } from "./featured";

function storePath() {
  return process.env.FEATURED_STORE_PATH ?? path.join(process.cwd(), "data", "featured-listings.json");
}

async function readAll(): Promise<FeaturedListing[]> {
  try {
    return JSON.parse(await readFile(storePath(), "utf8")) as FeaturedListing[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeAll(listings: FeaturedListing[]) {
  await mkdir(path.dirname(storePath()), { recursive: true });
  await writeFile(storePath(), JSON.stringify(listings, null, 2));
}

export async function listFeatured() {
  return (await readAll()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// The live listing per category for one station (at most one each, enforced in setStatus).
export async function liveFeaturedForStation(stationId: string) {
  return (await readAll()).filter((listing) => listing.stationId === stationId && listing.status === "live");
}

export type NewFeatured = Omit<FeaturedListing, "id" | "status" | "createdAt" | "updatedAt">;

export async function createFeatured(input: NewFeatured, status: FeaturedStatus = "pending") {
  const listings = await readAll();
  const now = new Date().toISOString();
  const listing: FeaturedListing = { ...input, id: randomUUID(), status, createdAt: now, updatedAt: now };
  if (status === "live") assertSlotFree(listings, listing);
  listings.push(listing);
  await writeAll(listings);
  return listing;
}

export class SlotTakenError extends Error {}

// PRD: one featured business per category per station.
function assertSlotFree(listings: FeaturedListing[], candidate: FeaturedListing) {
  const holder = listings.find(
    (listing) =>
      listing.id !== candidate.id &&
      listing.status === "live" &&
      listing.stationId === candidate.stationId &&
      listing.category === candidate.category,
  );
  if (holder) throw new SlotTakenError(`${holder.businessName} already holds this #1 spot. Pause it first.`);
}

export async function setFeaturedStatus(id: string, status: FeaturedStatus) {
  const listings = await readAll();
  const listing = listings.find((item) => item.id === id);
  if (!listing) return null;
  if (status === "live") assertSlotFree(listings, listing);
  listing.status = status;
  listing.updatedAt = new Date().toISOString();
  await writeAll(listings);
  return listing;
}

export async function deleteFeatured(id: string) {
  const listings = await readAll();
  await writeAll(listings.filter((item) => item.id !== id));
}
