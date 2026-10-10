import { geocodeZip } from "@/lib/geocode";
import { parseZip } from "@/lib/zipQuery";

// GET /api/geocode?q=22202 → { label, position: [lat, lon] }
// Only US ZIP codes for now; city and address search needs a place-search provider.
export function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (!parseZip(query)) {
    return Response.json({ error: "Enter a 5-digit US ZIP code." }, { status: 400 });
  }

  const place = geocodeZip(query);
  if (!place) {
    return Response.json({ error: "ZIP code not found." }, { status: 404 });
  }

  // ZIP centers only change with a new Census release, so let browsers and the CDN cache them.
  return Response.json(place, {
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" },
  });
}
