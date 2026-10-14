// Server-only: builds a station's "Nearby" lists (paid spots first, then free places by walk time).
import type { FeaturedListing } from "./featured";
import { liveFeaturedForStation } from "./featuredStore";
import { orderListings } from "./listingOrder";
import { CATEGORIES, type CategoryId, type Place } from "./places";
import { placesForStation } from "./placesData";

// What visitors may see of a featured listing: never the business's contact details.
// The street address is the business's public location (used for Directions), not a contact detail.
export type PublicFeatured = Pick<
  FeaturedListing,
  "id" | "slot" | "businessName" | "kind" | "offerText" | "ctaLabel" | "ctaUrl" | "address" | "distanceM" | "lat" | "lon"
>;

export type PublicListing =
  | { type: "featured"; rank: number; featured: PublicFeatured }
  | { type: "place"; rank: number; place: Place };

export type NearbyCategory = { id: CategoryId; label: string; listings: PublicListing[] };

export function toPublic({ id, slot, businessName, kind, offerText, ctaLabel, ctaUrl, address, distanceM, lat, lon }: FeaturedListing): PublicFeatured {
  return { id, slot, businessName, kind, offerText, ctaLabel, ctaUrl, address, distanceM, lat, lon };
}

export async function nearbyCategory(stationId: string, category: CategoryId, featured?: FeaturedListing[]): Promise<PublicListing[]> {
  const live = featured ?? (await liveFeaturedForStation(stationId));
  const places = placesForStation(stationId)[category];
  return orderListings(places, live.filter((listing) => listing.category === category)).map((listing) =>
    listing.type === "featured" ? { ...listing, featured: toPublic(listing.featured) } : listing,
  );
}

export async function nearbyForStation(stationId: string): Promise<NearbyCategory[]> {
  const featured = await liveFeaturedForStation(stationId);
  return Promise.all(
    CATEGORIES.map(async ({ id, label }) => ({ id, label, listings: await nearbyCategory(stationId, id, featured) })),
  );
}
