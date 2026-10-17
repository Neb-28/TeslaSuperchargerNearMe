import { getCountry } from "@/lib/superchargers";
import { suggest } from "@/lib/suggest";

// GET /api/suggest?q=woodbrige → { suggestions: [{ kind, label, detail, country, position | slug }] }
// Suggestions while typing in a search box, from our own places (no geocoder call). ?country=canada
// (a country slug) puts that country's places first; without it, US places come first.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q") ?? "";
  const countrySlug = params.get("country");
  const country = countrySlug && getCountry(countrySlug) ? countrySlug : null;
  if (query.length > 80) return Response.json({ suggestions: [] }, { status: 400 });

  // The places only change with the nightly data refresh: let browsers and the CDN cache answers.
  return Response.json({ suggestions: suggest(query, country) }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}
