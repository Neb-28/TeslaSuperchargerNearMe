// Client-safe shape of a paid listing (PRD `featured_listings`): the #1 Featured spot or one of
// the #2 and #3 Sponsored spots in a station's category.
import type { CategoryId } from "./places";

export type FeaturedStatus = "pending" | "live" | "paused" | "rejected";

// Up to three paid spots per station and category, one live business each.
export type SponsorSlot = 1 | 2 | 3;
export const SPONSOR_SLOTS: readonly SponsorSlot[] = [1, 2, 3];
export const isSponsorSlot = (value: unknown): value is SponsorSlot => value === 1 || value === 2 || value === 3;

export const SLOT_LABELS: Record<SponsorSlot, string> = { 1: "#1 Featured", 2: "#2 Sponsored", 3: "#3 Sponsored" };

export type FeaturedListing = {
  id: string;
  stationId: string;
  category: CategoryId;
  slot: SponsorSlot;
  businessName: string;
  kind: string; // type line, e.g. "Wood-fired pizza, salads"
  offerText: string; // max 50 characters (PRD)
  ctaLabel: string;
  ctaUrl: string;
  address: string | null; // only needed when the business isn't in our nearby list
  // Known when the business matched a place on our nearby list; used for the Directions button.
  distanceM: number | null;
  lat: number | null;
  lon: number | null;
  contactName: string;
  contactEmail: string;
  phone: string | null;
  status: FeaturedStatus;
  source: "business" | "admin";
  createdAt: string;
  updatedAt: string;
};
