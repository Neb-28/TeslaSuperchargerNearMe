import { nearestAddress, RoutingError, routingConfigured } from "@/lib/openRouteService";

// GET /api/nearest-address?lat=38.898&lon=-77.037 → { label: "1600 Pennsylvania Avenue NW, Washington, DC, USA" }
// For the route planner's "Use my location": shows the visitor where the trip starts. The position
// is the visitor's own, so answers are never cached or stored.
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));

  if (!params.get("lat") || !params.get("lon") || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json({ error: "Send a valid location." }, { status: 400, headers: NO_STORE });
  }
  if (!routingConfigured()) return Response.json({ error: "Address lookup isn't available yet." }, { status: 503, headers: NO_STORE });

  try {
    return Response.json({ label: await nearestAddress([lat, lon]) }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof RoutingError) return Response.json({ error: error.message }, { status: error.status, headers: NO_STORE });
    throw error;
  }
}
