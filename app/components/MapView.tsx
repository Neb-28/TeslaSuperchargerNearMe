"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { isClosedPin, pinFromTuple, pinMatches, type Pin, type PinTuple } from "@/lib/pins";
import { DEFAULT_CENTER, milesBetween } from "@/lib/stations";
import { looksLikeAddress, parseZip, type Place } from "@/lib/zipQuery";
import LocationCard from "./LocationCard";
import { useGeolocation } from "./useGeolocation";

// Leaflet touches `window`, so only the map canvas is client-only; the search and
// station list around it are server-rendered.
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="map-surface" aria-hidden="true" />,
});

const LIST_LIMIT = 25;

type MapViewProps = {
  initialQuery: string;
  // Set when the page opens on a ZIP, address or place search, or a station's "View larger map"
  // (looked up on the server).
  initialPlace: Place | null;
  // initialPlace is where initialQuery was found (an address or place), not a name filter.
  searchedPlace?: boolean;
  // The server couldn't find the address or place in initialQuery.
  initialError?: string | null;
  // The nearest stations to the starting point, so the list is in the server-rendered HTML.
  initialNearby: Pin[];
  // Station to highlight when opened from its "View larger map" link.
  highlightHref: string | null;
  near: boolean;
  focusSearch: boolean;
  // Set outside the US: only that country's stations are loaded, ZIP lookup is off and the map
  // starts on initialPlace (its busiest city). Null means the US map, exactly as before.
  country?: { slug: string; code: string | null } | null;
};

function zipNotFound(zip: string) {
  return `We couldn't find ZIP code ${zip}. Check it and try again.`;
}

function formatMiles(miles: number) {
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles).toLocaleString("en-US")} mi`;
}

// Kilometres outside the US and the UK.
function formatDistance(miles: number, countryCode: string | null | undefined) {
  if (!countryCode || countryCode === "GB") return formatMiles(miles);
  const km = miles * 1.609344;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString("en-US")} km`;
}

// Accent- and case-insensitive, so "munchen" and "Munich" both find München.
function placeNotFound(text: string) {
  return `We couldn't find “${text}”. Try adding the city, or use a ZIP code.`;
}

export default function MapView({ initialQuery, initialPlace, initialNearby, highlightHref, near, focusSearch, country = null, searchedPlace = false, initialError = null }: MapViewProps) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(initialQuery);
  // ZIP codes are US-only; elsewhere five digits are just part of a search.
  const initialZip = country ? null : parseZip(initialQuery);
  const countryPlace = country ? initialPlace : null;
  // `query` filters by station name (names include the city); a ZIP, address or place search sets
  // `place` instead.
  const [query, setQuery] = useState(initialZip || searchedPlace ? "" : initialQuery.trim());
  const [place, setPlace] = useState<Place | null>(initialPlace);
  const [placeCount, setPlaceCount] = useState(initialPlace ? 1 : 0);
  const [searchError, setSearchError] = useState<string | null>(initialError ?? (initialZip && !initialPlace ? zipNotFound(initialZip) : null));
  // Every US Supercharger, loaded once from our own API (never from Overpass).
  const [allPins, setAllPins] = useState<Pin[] | null>(null);
  // "Near me" starts the location request as soon as the map opens.
  const geo = useGeolocation(near);
  const userPos = geo.position;
  const [manualRecenter, setManualRecenter] = useState(0);
  const recenter = geo.fixCount + manualRecenter + placeCount;

  useEffect(() => {
    let cancelled = false;
    fetch(country ? `/api/stations?country=${country.slug}` : "/api/stations")
      .then((response) => response.json() as Promise<{ pins: PinTuple[] }>)
      .then(({ pins }) => {
        if (!cancelled) setAllPins(pins.map(pinFromTuple));
      })
      .catch(() => {
        // Keep the server-rendered nearby list; the map just shows those.
      });
    return () => {
      cancelled = true;
    };
  }, [country]);

  const needle = query.toLowerCase();
  const matchingPins = useMemo(() => {
    const source = allPins ?? initialNearby;
    if (!needle) return source;
    // Pins outside the US also match on their city, region and country names.
    return source.filter((pin) => pinMatches(pin, needle));
  }, [allPins, initialNearby, needle]);

  const nearby = useMemo(() => {
    const origin = place?.position ?? userPos ?? DEFAULT_CENTER;
    return matchingPins
      .map((pin) => ({ ...pin, miles: milesBetween(origin, [pin.lat, pin.lon]) }))
      .sort((a, b) => a.miles - b.miles)
      .slice(0, LIST_LIMIT);
  }, [matchingPins, place, userPos]);

  useEffect(() => {
    if (focusSearch) searchRef.current?.focus();
  }, [focusSearch]);

  async function applySearch(value: string) {
    const trimmed = value.trim();
    const countryParam = country ? `country=${country.slug}` : "";
    window.history.replaceState(null, "", trimmed ? `/map?q=${encodeURIComponent(trimmed)}${countryParam ? `&${countryParam}` : ""}` : `/map${countryParam ? `?${countryParam}` : ""}`);
    setSearchError(null);

    const zip = country ? null : parseZip(trimmed);
    // An address, or a name no station matches (a city without a Supercharger, a landmark, a
    // business): look the place up and list the stations nearest to it, like "Near me".
    const lookUp = !zip && trimmed && (looksLikeAddress(trimmed) || !(allPins ?? initialNearby).some((pin) => pinMatches(pin, trimmed)));
    if (lookUp) {
      setQuery("");
      try {
        const near = userPos ? `&near=${userPos[0].toFixed(3)},${userPos[1].toFixed(3)}` : "";
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}${country?.code ? `&country=${country.code}` : ""}${near}`);
        if (!response.ok) throw new Error(String(response.status));
        setPlace((await response.json()) as Place);
        setPlaceCount((count) => count + 1);
      } catch {
        setPlace(countryPlace);
        setSearchError(placeNotFound(trimmed));
      }
      return;
    }
    if (!zip) {
      setPlace(countryPlace);
      setQuery(trimmed);
      return;
    }

    setQuery("");
    try {
      const response = await fetch(`/api/geocode?q=${zip}`);
      if (!response.ok) throw new Error(String(response.status));
      setPlace((await response.json()) as Place);
      setPlaceCount((count) => count + 1);
    } catch {
      setPlace(null);
      setSearchError(zipNotFound(zip));
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void applySearch(draft);
    searchRef.current?.blur();
  }

  function clearSearch() {
    setDraft("");
    void applySearch("");
  }

  function centerOnMe() {
    setPlace(null); // distances go back to being from the visitor, not the searched place
    if (geo.status === "located") setManualRecenter((count) => count + 1);
    else geo.request();
  }

  function searchInstead() {
    geo.dismiss();
    searchRef.current?.focus();
  }

  const total = needle ? matchingPins.length : nearby.length;
  const noun = total === 1 ? "Supercharger" : "Superchargers";
  // Only say "near you" once we actually know where the visitor is.
  const where = place ? `near ${place.label}` : geo.status === "located" ? "near you" : "in this area";
  const title = needle ? `${total} ${noun} matching “${query}”` : `${total} ${noun} ${where}`;
  const showNearest = place !== null || geo.status === "located";
  // "Nearest" goes to the closest station drivers can use, not a temporarily closed one.
  const nearestIndex = nearby.findIndex((pin) => !isClosedPin(pin));

  return (
    <main id="main" className="map-layout">
      <div className="map-toolbar">
        <form action="/map" method="get" role="search" className="map-search" onSubmit={handleSearch}>
          <label htmlFor="map-search" className="sr-only">Search an address, city or ZIP code</label>
          <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={searchRef}
            id="map-search"
            name="q"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Search an address, city or ZIP code"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </form>
      </div>

      <section className="sheet" aria-labelledby="sheet-title">
        <div className="sheet-grab" aria-hidden="true" />
        <h1 id="sheet-title" className="sheet-title" aria-live="polite">{title}</h1>

        <LocationCard status={geo.status} onRequest={geo.request} onDismiss={geo.dismiss} onSearchInstead={searchInstead} />

        {searchError ? <p className="sheet-status" role="status">{searchError}</p> : null}

        {needle && total === 0 ? (
          <p className="sheet-status">
            No Superchargers match that search.{" "}
            <button type="button" className="text-button" onClick={clearSearch}>Clear search</button>
          </p>
        ) : null}

        <ul className="station-list">
          {nearby.map((station, index) => {
            const isNearest = index === nearestIndex && showNearest && !needle;
            const sub = [formatDistance(station.miles, country?.code), station.stalls ? `${station.stalls} stalls` : null, station.kw ? `${station.kw} kW` : null]
              .filter(Boolean)
              .join(" · ");

            return (
              <li key={station.href}>
                <Link href={station.href} className={`station-row${station.href === highlightHref ? " is-highlighted" : ""}`}>
                  <span className="station-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
                    </svg>
                  </span>
                  <span className="station-meta">
                    <span className="station-name">
                      {station.name}
                      {isNearest ? <span className="nearest-badge">Nearest</span> : null}
                    </span>{" "}
                    <span className="station-sub">{sub}</span>
                  </span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="row-chevron" aria-hidden="true">
                    <path d="m9 5 7 7-7 7" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="sheet-note">
          Map data © OpenStreetMap contributors · Not affiliated with Tesla, Inc. ·{" "}
          <Link href="/privacy" className="footer-link">Privacy</Link> ·{" "}
          <Link href="/terms" className="footer-link">Terms</Link>
        </p>
      </section>

      <div className="map-canvas">
        <LeafletMap
          pins={matchingPins}
          nearby={nearby}
          highlightHref={highlightHref}
          userPos={userPos}
          searchPos={place?.position ?? null}
          recenter={recenter}
          fitKey={needle}
          onOpenStation={(href) => router.push(href)}
        />
        <button type="button" aria-label="Center on my location" className="center-button" onClick={centerOnMe}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21 3 3 10.5l7.5 3L13.5 21 21 3z" />
          </svg>
        </button>
      </div>
    </main>
  );
}
