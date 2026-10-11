// Server-only storage for #1 Featured listings.
// With DATABASE_URL set (production, and local dev against Supabase) listings live in the Postgres
// `featured_listings` table. Without it, or when FEATURED_STORE_PATH is set (tests), they live in
// a JSON file (data/featured-listings.json, git-ignored), since hosts like Vercel can't write to disk.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";
import type { FeaturedListing, FeaturedStatus } from "./featured";

export type NewFeatured = Omit<FeaturedListing, "id" | "status" | "createdAt" | "updatedAt">;

export class SlotTakenError extends Error {}

const slotTaken = (holder: { businessName: string }) => new SlotTakenError(`${holder.businessName} already holds this #1 spot. Pause it first.`);

function storedInDatabase() {
  return !process.env.FEATURED_STORE_PATH && Boolean(db());
}

// ---------- JSON file ----------

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

// PRD: one featured business per category per station.
function liveHolder(listings: FeaturedListing[], candidate: Pick<FeaturedListing, "id" | "stationId" | "category">) {
  return listings.find(
    (listing) =>
      listing.id !== candidate.id && listing.status === "live" && listing.stationId === candidate.stationId && listing.category === candidate.category,
  );
}

// ---------- Postgres ----------

type Row = {
  id: string;
  station_id: string;
  category: FeaturedListing["category"];
  business_name: string;
  kind: string;
  offer_text: string;
  cta_label: string;
  cta_url: string;
  address: string | null;
  distance_m: number | null;
  lat: number | null;
  lon: number | null;
  contact_name: string;
  contact_email: string;
  phone: string | null;
  status: FeaturedStatus;
  source: FeaturedListing["source"];
  created_at: Date;
  updated_at: Date;
};

function fromRow(row: Row): FeaturedListing {
  return {
    id: row.id,
    stationId: row.station_id,
    category: row.category,
    businessName: row.business_name,
    kind: row.kind,
    offerText: row.offer_text,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    address: row.address,
    distanceM: row.distance_m,
    lat: row.lat,
    lon: row.lon,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    phone: row.phone,
    status: row.status,
    source: row.source,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function liveHolderInDb(candidate: Pick<FeaturedListing, "stationId" | "category"> & { id?: string }) {
  const [row] = await db()!<Row[]>`
    select * from featured_listings
    where status = 'live' and station_id = ${candidate.stationId} and category = ${candidate.category}
      and id::text <> ${candidate.id ?? ""}
    limit 1`;
  return row ? fromRow(row) : null;
}

// The database's own one-live-per-slot index (featured_one_live_per_slot) backs up the check above.
function isSlotConflict(error: unknown) {
  return (error as { code?: string }).code === "23505";
}

// ---------- Shared API ----------

export async function listFeatured() {
  if (storedInDatabase()) return (await db()!<Row[]>`select * from featured_listings order by created_at`).map(fromRow);
  return (await readAll()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// A business's own applications and listings, newest first (business dashboard). The email is the
// one the visitor proved they own by signing in with it.
export async function listFeaturedForEmail(email: string) {
  if (storedInDatabase()) {
    return (await db()!<Row[]>`select * from featured_listings where lower(contact_email) = lower(${email}) order by created_at desc`).map(fromRow);
  }
  return (await readAll())
    .filter((listing) => listing.contactEmail.toLowerCase() === email.toLowerCase())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// The live listing per category for one station (at most one each). Station pages must load even
// if the database is unreachable, so a failed lookup means "no featured listing" (and is logged).
export async function liveFeaturedForStation(stationId: string) {
  if (storedInDatabase()) {
    try {
      return (await db()!<Row[]>`select * from featured_listings where status = 'live' and station_id = ${stationId}`).map(fromRow);
    } catch (error) {
      console.error("Featured listings lookup failed", error);
      return [];
    }
  }
  return (await readAll()).filter((listing) => listing.stationId === stationId && listing.status === "live");
}

export async function createFeatured(input: NewFeatured, status: FeaturedStatus = "pending") {
  if (storedInDatabase()) {
    if (status === "live") {
      const holder = await liveHolderInDb(input);
      if (holder) throw slotTaken(holder);
    }
    try {
      const [row] = await db()!<Row[]>`
        insert into featured_listings ${db()!({
          station_id: input.stationId,
          category: input.category,
          business_name: input.businessName,
          kind: input.kind,
          offer_text: input.offerText,
          cta_label: input.ctaLabel,
          cta_url: input.ctaUrl,
          address: input.address,
          distance_m: input.distanceM,
          lat: input.lat,
          lon: input.lon,
          contact_name: input.contactName,
          contact_email: input.contactEmail,
          phone: input.phone,
          status,
          source: input.source,
        })}
        returning *`;
      return fromRow(row);
    } catch (error) {
      if (isSlotConflict(error)) throw new SlotTakenError("Another business already holds this #1 spot. Pause it first.");
      throw error;
    }
  }

  const listings = await readAll();
  const now = new Date().toISOString();
  const listing: FeaturedListing = { ...input, id: randomUUID(), status, createdAt: now, updatedAt: now };
  const holder = status === "live" ? liveHolder(listings, listing) : undefined;
  if (holder) throw slotTaken(holder);
  listings.push(listing);
  await writeAll(listings);
  return listing;
}

export async function setFeaturedStatus(id: string, status: FeaturedStatus) {
  if (storedInDatabase()) {
    const [current] = await db()!<Row[]>`select * from featured_listings where id::text = ${id}`;
    if (!current) return null;
    if (status === "live") {
      const holder = await liveHolderInDb(fromRow(current));
      if (holder) throw slotTaken(holder);
    }
    try {
      const [row] = await db()!<Row[]>`update featured_listings set status = ${status}, updated_at = now() where id::text = ${id} returning *`;
      return row ? fromRow(row) : null;
    } catch (error) {
      if (isSlotConflict(error)) throw new SlotTakenError("Another business already holds this #1 spot. Pause it first.");
      throw error;
    }
  }

  const listings = await readAll();
  const listing = listings.find((item) => item.id === id);
  if (!listing) return null;
  const holder = status === "live" ? liveHolder(listings, listing) : undefined;
  if (holder) throw slotTaken(holder);
  listing.status = status;
  listing.updatedAt = new Date().toISOString();
  await writeAll(listings);
  return listing;
}

export async function deleteFeatured(id: string) {
  if (storedInDatabase()) {
    await db()!`delete from featured_listings where id::text = ${id}`;
    return;
  }
  const listings = await readAll();
  await writeAll(listings.filter((item) => item.id !== id));
}
