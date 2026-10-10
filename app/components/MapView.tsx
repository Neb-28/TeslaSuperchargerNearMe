"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { pinFromTuple, type Pin, type PinTuple } from "@/lib/pins";
import { DEFAULT_CENTER, milesBetween } from "@/lib/stations";
import { parseZip, type Place } from "@/lib/zipQuery";
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
  // Set when the page opens on a ZIP search or a station's "View larger map" (looked up on the server).
  initialPlace: Place | null;
  // The nearest stations to the starting point, so the list is in the server-rendered HTML.
  initialNearby: Pin[];
  // Station to highlight when opened from its "View larger map" link.
  highlightHref: string | null;
  near: boolean;
  focusSearch: boolean;
};

function zipNotFound(zip: string) {
  return `We couldn't find ZIP code ${zip}. Check it and try again.`;
}

function formatMiles(miles: number) {
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles).toLocaleString("en-US")} mi`;
}

export default function MapView({ initialQuery, initialPlace, initialNearby, highlightHref, near, focusSearch }: MapViewProps) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(initialQuery);
  const initialZip = parseZip(initialQuery);
  // `query` filters by station name (names include the city); a ZIP search sets `place` instead.
  const [query, setQuery] = useState(initialZip ? "" : initialQuery.trim());
  const [place, setPlace] = useState<Place | null>(initialPlace);
  const [placeCount, setPlaceCount] = useState(initialPlace ? 1 : 0);
  const [searchError, setSearchError] = useState<string | null>(initialZip && !initialPlace ? zipNotFound(initialZip) : null);
  // Every US Supercharger, loaded once from our own API (never from Overpass).
  const [allPins, setAllPins] = useState<Pin[] | null>(null);
  // "Near me" starts the location request as soon as the map opens.
  const geo = useGeolocation(near);
  const userPos = geo.position;
  const [manualRecenter, setManualRecenter] = useState(0);
  const recenter = geo.fixCount + manualRecenter + placeCount;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stations")
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
  }, []);

  const needle = query.toLowerCase();
  const matchingPins = useMemo(() => {
    const source = allPins ?? initialNearby;
    return needle ? source.filter((pin) => pin.name.toLowerCase().includes(needle)) : source;
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
    window.history.replaceState(null, "", trimmed ? `/map?q=${encodeURIComponent(trimmed)}` : "/map");
    setSearchError(null);

    const zip = parseZip(trimmed);
    if (!zip) {
      setPlace(null);
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

  return (
    <main id="main" className="map-layout">
      <div className="map-toolbar">
        <form action="/map" method="get" role="search" className="map-search" onSubmit={handleSearch}>
          <label htmlFor="map-search" className="sr-only">Search city, ZIP code or station</label>
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
            placeholder="Search city, ZIP code or station"
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
            const isNearest = index === 0 && showNearest && !needle;
            const sub = [formatMiles(station.miles), station.stalls ? `${station.stalls} stalls` : null, station.kw ? `${station.kw} kW` : null]
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
                    </span>
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
          <Link href="/privacy" className="footer-link">Privacy</Link>
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
