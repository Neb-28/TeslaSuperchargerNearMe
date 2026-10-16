// Server-only: turns what a visitor typed (a ZIP code, a street address, a city or place name)
// into a point, for "Superchargers near …" on the map.
import { geocodeZip } from "./geocode";
import { routingConfigured, searchAddress, type AddressMatch } from "./openRouteService";
import type { LatLng } from "./stations";
import { parseZip, type Place } from "./zipQuery";

// Below this, the geocoder is guessing (it returns something for any text).
const MIN_CONFIDENCE = 0.5;

// Several equally good matches ("350 5th Ave, New York" is also a street in Troy, NY): take the
// one whose label has what was typed after the first comma ("New York").
function bestMatch(matches: AddressMatch[], query: string) {
  const parts = query.split(",").slice(1).map((part) => part.trim().toLowerCase()).filter(Boolean);
  const top = Math.max(...matches.map((match) => match.confidence));
  const score = (match: AddressMatch) => parts.filter((part) => match.label.toLowerCase().includes(part)).length;
  return matches.filter((match) => match.confidence >= top - 0.1).reduce((best, match) => (score(match) > score(best) ? match : best));
}

// `country` is the ISO code of the map being searched ("US" for the US map, "DE" for Germany's);
// the search stays inside it, since that map only lists that country's stations. `near` (the
// visitor's location, when known) favors the closer of two same-named places.
export async function findPlace(text: string, country = "US", near?: LatLng): Promise<Place | null> {
  const query = text.trim();
  if (!query) return null;
  // ZIP codes come from our own table: instant, and no call to the geocoder.
  if (country === "US" && parseZip(query)) return geocodeZip(query);
  if (!routingConfigured()) return null;

  const matches = await searchAddress(query, near, country);
  if (!matches.length) return null;
  const best = bestMatch(matches, query);
  if (best.confidence < MIN_CONFIDENCE) return null;
  // "1600 Amphitheatre Parkway, Mountain View, CA, USA": the country is obvious from the map.
  const label = best.label.replace(/, (USA|United States)$/, "");
  return { label, position: best.position };
}
