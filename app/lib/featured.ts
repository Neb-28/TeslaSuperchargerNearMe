// Client-safe shape of a paid #1 Featured listing (PRD `featured_listings`).
import type { CategoryId } from "./places";

export type FeaturedStatus = "pending" | "live" | "paused" | "rejected";

export type FeaturedListing = {
  id: string;
  stationId: string;
  category: CategoryId;
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
