import { countryPins, getCountry, snapshotDate, stationPins, worldSnapshotDate } from "@/lib/superchargers";

// GET /api/stations → { updatedAt, pins: [[lat, lon, stalls, kw, name, href], ...] }
// Every US Supercharger in one cacheable response; the map filters and sorts on the device.
// GET /api/stations?country=germany → that country's stations instead (pins carry a 7th field
// with search words). An unknown or missing country gives the US list, exactly as before.
export function GET(request?: Request) {
  const slug = request ? new URL(request.url).searchParams.get("country") : null;
  const country = slug ? getCountry(slug) : null;
  return Response.json(
    country ? { updatedAt: worldSnapshotDate, pins: countryPins(country.slug) } : { updatedAt: snapshotDate, pins: stationPins() },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
