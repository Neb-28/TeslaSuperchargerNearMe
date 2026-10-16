import type { Metadata } from "next";
import CountryPicker from "@/components/CountryPicker";
import MapView from "@/components/MapView";
import SiteHeader from "@/components/SiteHeader";
import { findPlace } from "@/lib/findPlace";
import { geocodeZip } from "@/lib/geocode";
import { pinFromTuple, pinMatches } from "@/lib/pins";
import { DEFAULT_CENTER } from "@/lib/stations";
import { countryOptions, countryPins, getCountry, getStationBySlug, isWorldStation, nearestInCountry, nearestStations, stationHref, stationPins, toPin } from "@/lib/superchargers";
import { looksLikeAddress, parseZip, type Place } from "@/lib/zipQuery";

export const metadata: Metadata = {
  title: "Map of Tesla Superchargers near me",
  description: "Every US Tesla Supercharger on one map. Use your location, an address or a ZIP code to find the closest stations.",
  // Searches and "View larger map" links add query strings; they are all the same page to Google.
  alternates: { canonical: "/map" },
};

const NAME_MATCHES_SHOWN = 100;

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const near = params.near === "1";
  const focusSearch = params.search === "1";

  // "View larger map" on a station page opens /map?station=<slug>, centered on that station.
  const station = typeof params.station === "string" ? getStationBySlug(params.station) : null;
  // Outside the US (?country=germany, or a station abroad) the map opens on that country's
  // busiest city and only shows its stations. Without a country the map is the US map, unchanged.
  const country = station && isWorldStation(station) ? getCountry(station.state) : !station && typeof params.country === "string" ? getCountry(params.country) : null;
  // An address, or text no station name matches (a city without a Supercharger, a landmark):
  // look the place up and list the stations nearest to it. Other text filters station names.
  const text = query.trim();
  const isZip = !country && Boolean(parseZip(text));
  const nameMatches = !station && text && !isZip ? (country ? countryPins(country.slug) : stationPins()).map(pinFromTuple).filter((pin) => pinMatches(pin, text)) : [];
  const lookUp = !station && Boolean(text) && !isZip && (looksLikeAddress(text) || nameMatches.length === 0);
  const found = lookUp ? await findPlace(text, country?.code ?? "US").catch(() => null) : null;
  const place: Place | null = station
    ? { label: station.cityLabel ?? station.nearLabel ?? station.name, position: [station.lat, station.lon] }
    : found
      ? found
      : country
        ? { label: country.cities[0].name, position: country.center }
        : geocodeZip(query);
  // A name search lists its matches (so "San Jose" shows San Jose's stations before the map's full
  // list loads); otherwise the stations nearest to where the map starts.
  const initialNearby =
    !lookUp && nameMatches.length
      ? nameMatches.slice(0, NAME_MATCHES_SHOWN)
      : (country ? nearestInCountry(country.slug, place!.position) : nearestStations(place?.position ?? DEFAULT_CENTER)).map(({ station: item }) => toPin(item));
  const options = countryOptions();
  const current = (country && options.find((option) => option.slug === country.slug)) || options[0];

  return (
    <div className="app-shell map-shell">
      <SiteHeader
        backHref={station ? stationHref(station) : country ? `/?country=${country.slug}` : "/"}
        countryPicker={<CountryPicker current={current} options={options} basePath="/map" />}
      />
      {/* Keyed so following a link like "Near me" while already on the map starts fresh. */}
      <MapView
        key={`${query}|${near}|${focusSearch}|${station?.slug ?? ""}|${country?.slug ?? ""}`}
        initialQuery={station ? "" : query}
        country={country ? { slug: country.slug, code: country.code } : null}
        initialPlace={place}
        searchedPlace={Boolean(found)}
        initialError={lookUp && !found ? `We couldn't find “${text}”. Try adding the city, or use a ZIP code.` : null}
        initialNearby={initialNearby}
        highlightHref={station ? stationHref(station) : null}
        near={near}
        focusSearch={focusSearch}
      />
    </div>
  );
}
