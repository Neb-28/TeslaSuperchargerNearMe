import { findPlace } from "@/lib/findPlace";
import { routingConfigured, RoutingError } from "@/lib/openRouteService";
import { parseZip } from "@/lib/zipQuery";

// GET /api/geocode?q=22202 → { label, position: [lat, lon] }
// Also takes a street address or a place name (?q=1600 Amphitheatre Pkwy, Mountain View), looked
// up with openrouteservice and kept inside the map's country (?country=DE, default US).
// US ZIP codes come from our own table.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const country = /^[A-Za-z]{2}$/.test(params.get("country") ?? "") ? params.get("country")!.toUpperCase() : "US";
  // ?near=lat,lon: the visitor's location, so "Main St" finds the one nearby.
  const near = params.get("near")?.split(",").map(Number);
  const nearPoint = near?.length === 2 && near.every(Number.isFinite) ? ([near[0], near[1]] as [number, number]) : undefined;

  if (!query || query.length > 200) {
    return Response.json({ error: "Enter an address, city or ZIP code." }, { status: 400 });
  }
  const zip = country === "US" ? parseZip(query) : null;
  if (!zip && !routingConfigured()) {
    return Response.json({ error: "Address search isn't available right now. Try a ZIP code." }, { status: 503 });
  }

  try {
    const place = await findPlace(query, country, nearPoint);
    if (!place) {
      return Response.json(
        { error: zip ? "ZIP code not found." : "We couldn't find that address. Try adding the city, or use a ZIP code." },
        { status: 404 },
      );
    }
    // A place's position doesn't change from one day to the next: let browsers and the CDN cache it.
    return Response.json(place, {
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" },
    });
  } catch (error) {
    const status = error instanceof RoutingError ? error.status : 502;
    return Response.json({ error: "Address search isn't available right now. Try a ZIP code." }, { status });
  }
}
