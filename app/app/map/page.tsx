import type { Metadata } from "next";
import MapView from "@/components/MapView";
import SiteHeader from "@/components/SiteHeader";
import { geocodeZip } from "@/lib/geocode";
import { DEFAULT_CENTER } from "@/lib/stations";
import { getStationBySlug, nearestStations, stationHref, toPin } from "@/lib/superchargers";
import type { Place } from "@/lib/zipQuery";

export const metadata: Metadata = {
  title: "Superchargers near me — map",
};

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const near = params.near === "1";
  const focusSearch = params.search === "1";

  // "View larger map" on a station page opens /map?station=<slug>, centered on that station.
  const station = typeof params.station === "string" ? getStationBySlug(params.station) : null;
  const place: Place | null = station
    ? { label: station.cityLabel ?? station.name, position: [station.lat, station.lon] }
    : geocodeZip(query);
  const initialNearby = nearestStations(place?.position ?? DEFAULT_CENTER).map(({ station: item }) => toPin(item));

  return (
    <div className="app-shell map-shell">
      <SiteHeader backHref={station ? stationHref(station) : "/"} />
      {/* Keyed so following a link like "Near me" while already on the map starts fresh. */}
      <MapView
        key={`${query}|${near}|${focusSearch}|${station?.slug ?? ""}`}
        initialQuery={station ? "" : query}
        initialPlace={place}
        initialNearby={initialNearby}
        highlightHref={station ? stationHref(station) : null}
        near={near}
        focusSearch={focusSearch}
      />
    </div>
  );
}
