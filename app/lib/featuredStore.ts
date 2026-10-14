// Server-only storage for paid listings: the #1 Featured and #2/#3 Sponsored spots.
// With DATABASE_URL set (production, and local dev against Supabase) listings live in the Postgres
// `featured_listings` table. Without it, or when FEATURED_STORE_PATH is set (tests), they live in
// a JSON file (data/featured-listings.json, git-ignored), since hosts like Vercel can't write to disk.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as Sentry from "@sentry/nextjs";
import { db } from "./db";
import { SLOT_LABELS, type FeaturedListing, type FeaturedStatus, type SponsorSlot } from "./featured";

export type NewFeatured = Omit<FeaturedListing, "id" | "status" | "createdAt" | "updatedAt">;

export class SlotTakenError extends Error {}

const slotTaken = (holder: { businessName: string; slot: SponsorSlot }) =>
  new SlotTakenError(`${holder.businessName} already holds the ${SLOT_LABELS[holder.slot]} spot. Pause it first, or choose another spot.`);

function storedInDatabase() {
  return !process.env.FEATURED_STORE_PATH && Boolean(db());
}

// ---------- JSON file ----------

function storePath() {
  return process.env.FEATURED_STORE_PATH ?? path.join(process.cwd(), "data", "featured-listings.json");
}

async function readAll(): Promise<FeaturedListing[]> {
  try {
    const listings = JSON.parse(await readFile(storePath(), "utf8")) as FeaturedListing[];
    // Listings saved before there were three spots held the #1 spot.
    return listings.map((listing) => ({ ...listing, slot: listing.slot ?? 1 }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeAll(listings: FeaturedListing[]) {
  await mkdir(path.dirname(storePath()), { recursive: true });
  await writeFile(storePath(), JSON.stringify(listings, null, 2));
}

// PRD: one live business per spot (#1, #2, #3) in each station's category.
type SpotOf = Pick<FeaturedListing, "stationId" | "category" | "slot"> & { id?: string };

function liveHolder(listings: FeaturedListing[], candidate: SpotOf) {
  return listings.find(
    (listing) =>
      listing.id !== candidate.id &&
      listing.status === "live" &&
      listing.stationId === candidate.stationId &&
      listing.category === candidate.category &&
      listing.slot === candidate.slot,
  );
}

// ---------- Postgres ----------

type Row = {
  id: string;
  station_id: string;
  category: FeaturedListing["category"];
  slot: SponsorSlot;
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
    slot: row.slot,
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

async function liveHolderInDb(candidate: SpotOf) {
  const [row] = await db()!<Row[]>`
    select * from featured_listings
    where status = 'live' and station_id = ${candidate.stationId} and category = ${candidate.category}
      and slot = ${candidate.slot} and id::text <> ${candidate.id ?? ""}
    limit 1`;
  return row ? fromRow(row) : null;
}

// The database's own one-live-per-spot index (featured_one_live_per_slot) backs up the check above.
function isSlotConflict(error: unknown) {
  return (error as { code?: string }).code === "23505";
}

const raceLost = () => new SlotTakenError("Another business just took that spot. Pause it first, or choose another spot.");

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

// The live paid listings for one station (at most one per spot in each category). Station pages
// must load even if the database is unreachable, so a failed lookup means "no paid listings" (and
// is logged).
export async function liveFeaturedForStation(stationId: string) {
  if (storedInDatabase()) {
    try {
      return (await db()!<Row[]>`select * from featured_listings where status = 'live' and station_id = ${stationId}`).map(fromRow);
    } catch (error) {
      console.error("Featured listings lookup failed", error);
      Sentry.captureException(error, { tags: { lookup: "live-featured", "station.id": stationId } });
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
          slot: input.slot,
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
      if (isSlotConflict(error)) throw raceLost();
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

// Change a listing's status, its spot, or both. Going live (or moving while live) needs the spot
// to be free.
export async function updateFeatured(id: string, changes: { status?: FeaturedStatus; slot?: SponsorSlot }) {
  if (storedInDatabase()) {
    const [current] = await db()!<Row[]>`select * from featured_listings where id::text = ${id}`;
    if (!current) return null;
    const next = { ...fromRow(current), ...changes };
    if (next.status === "live") {
      const holder = await liveHolderInDb(next);
      if (holder) throw slotTaken(holder);
    }
    try {
      const [row] = await db()!<Row[]>`
        update featured_listings set status = ${next.status}, slot = ${next.slot}, updated_at = now()
        where id::text = ${id} returning *`;
      return row ? fromRow(row) : null;
    } catch (error) {
      if (isSlotConflict(error)) throw raceLost();
      throw error;
    }
  }

  const listings = await readAll();
  const listing = listings.find((item) => item.id === id);
  if (!listing) return null;
  const next = { ...listing, ...changes };
  const holder = next.status === "live" ? liveHolder(listings, next) : undefined;
  if (holder) throw slotTaken(holder);
  Object.assign(listing, changes, { updatedAt: new Date().toISOString() });
  await writeAll(listings);
  return listing;
}

export function setFeaturedStatus(id: string, status: FeaturedStatus) {
  return updateFeatured(id, { status });
}

export async function deleteFeatured(id: string) {
  if (storedInDatabase()) {
    await db()!`delete from featured_listings where id::text = ${id}`;
    return;
  }
  const listings = await readAll();
  await writeAll(listings.filter((item) => item.id !== id));
}
