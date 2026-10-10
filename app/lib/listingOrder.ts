// The listing order rule (PRD "Featured listing rules"):
// - A live #1 Featured listing always comes first in its category.
// - Free places follow, sorted by walking time (then distance, then name).
// - Free places are numbered from #2, or from #1 when the category has no featured listing.
// - A free place that is the featured business itself isn't listed twice.
import type { FeaturedListing } from "./featured";
import type { Place } from "./places";

export type Listing =
  | { type: "featured"; rank: number; featured: FeaturedListing }
  | { type: "place"; rank: number; place: Place };

export function orderListings(places: Place[], featured: FeaturedListing | null): Listing[] {
  const live = featured?.status === "live" ? featured : null;
  const featuredName = live?.businessName.trim().toLowerCase();

  const free = places
    .filter((place) => place.name.trim().toLowerCase() !== featuredName)
    .sort((a, b) => a.walkMin - b.walkMin || a.distanceM - b.distanceM || a.name.localeCompare(b.name));

  const listings: Listing[] = live ? [{ type: "featured", rank: 1, featured: live }] : [];
  for (const place of free) listings.push({ type: "place", rank: listings.length + 1, place });
  return listings;
}
