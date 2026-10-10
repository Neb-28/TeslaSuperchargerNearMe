import { nearbyCategory } from "@/lib/nearby";
import { isCategoryId } from "@/lib/places";
import { superchargers } from "@/lib/superchargers";

const stationIds = new Set(superchargers.map((station) => station.id));

// GET /api/stations/[id]/places?category=food
// PRD: featured listing first, then free places by walk time.
export async function GET(request: Request, context: RouteContext<"/api/stations/[id]/places">) {
  const { id } = await context.params;
  if (!stationIds.has(id)) return Response.json({ error: "Station not found." }, { status: 404 });

  const category = new URL(request.url).searchParams.get("category");
  if (!isCategoryId(category)) {
    return Response.json({ error: "category must be one of food, coffee, grocery, bars, shops, chargers." }, { status: 400 });
  }

  return Response.json({ stationId: id, category, listings: await nearbyCategory(id, category) });
}
