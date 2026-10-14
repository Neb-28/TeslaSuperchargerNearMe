// The listing order rule (PRD "Featured listing rules"):
// - Live paid listings always come first in their category: the #1 Featured spot, then the #2 and
//   #3 Sponsored spots (at most one live business per spot).
// - Free places follow, sorted by walking time (then distance, then name).
// - Everything is numbered in order: free places start right after the paid ones, or at #1.
// - A free place that is one of the paid businesses isn't listed twice.
import type { FeaturedListing } from "./featured";
import type { Place } from "./places";

// Generic so the Get featured preview can order a draft listing the same way.
type Orderable = Pick<FeaturedListing, "status" | "slot" | "businessName">;

export type Listing<F extends Orderable = FeaturedListing> =
  | { type: "featured"; rank: number; featured: F }
  | { type: "place"; rank: number; place: Place };

export function orderListings<F extends Orderable>(places: Place[], featured: readonly F[]): Listing<F>[] {
  const live = featured.filter((listing) => listing.status === "live").sort((a, b) => a.slot - b.slot);
  const paidNames = new Set(live.map((listing) => listing.businessName.trim().toLowerCase()));

  const free = places
    .filter((place) => !paidNames.has(place.name.trim().toLowerCase()))
    .sort((a, b) => a.walkMin - b.walkMin || a.distanceM - b.distanceM || a.name.localeCompare(b.name));

  const listings: Listing<F>[] = live.map((listing, index) => ({ type: "featured", rank: index + 1, featured: listing }));
  for (const place of free) listings.push({ type: "place", rank: listings.length + 1, place });
  return listings;
}
