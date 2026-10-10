import { snapshotDate, stationPins } from "@/lib/superchargers";

// GET /api/stations → { updatedAt, pins: [[lat, lon, stalls, kw, name, href], ...] }
// Every US Supercharger in one cacheable response; the map filters and sorts on the device.
export function GET() {
  return Response.json(
    { updatedAt: snapshotDate, pins: stationPins() },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
