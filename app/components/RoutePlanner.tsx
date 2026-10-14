"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { CategoryId } from "@/lib/places";
import { RESERVE_PCT, START_PCT, STOP_AT_PCT, type PlannedStop } from "@/lib/routePlanner";
import type { LatLng } from "@/lib/stations";
import { EMPTY_VEHICLE, evModelById, KM_PER_MILE, OTHER_MAKE, plugFor, restoreVehicle, type VehicleChoice } from "@/lib/vehicles";
import VehiclePicker from "./VehiclePicker";

// Leaflet touches `window`, so only the map is client-only and loads after the results.
const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div className="route-map" aria-hidden="true" />,
});

type Stop = PlannedStop & { nearby: Record<CategoryId, number> | null };

type TripResult = {
  from: { label: string; position: LatLng };
  to: { label: string; position: LatLng };
  distanceKm: number;
  durationS: number;
  path: LatLng[];
  stops: Stop[];
  arrivePct: number | null;
  stuckAtKm: number | null;
};

const MY_LOCATION = "Your location";
const SAVED_VEHICLE_KEY = "routeVehicle";

function readSavedVehicle(): VehicleChoice {
  try {
    return restoreVehicle(JSON.parse(window.localStorage.getItem(SAVED_VEHICLE_KEY) ?? "{}"));
  } catch {
    return EMPTY_VEHICLE;
  }
}

function saveVehicle(vehicle: VehicleChoice) {
  try {
    window.localStorage.setItem(SAVED_VEHICLE_KEY, JSON.stringify(vehicle));
  } catch {
    // Storage blocked: the driver picks their car again next time.
  }
}
const miles = (km: number) => Math.round(km / KM_PER_MILE);

function hoursAndMinutes(seconds: number) {
  const total = Math.round(seconds / 60);
  const hours = Math.floor(total / 60);
  return hours ? `${hours} h ${total % 60} min` : `${total} min`;
}

function nearbyLine(nearby: Record<CategoryId, number>) {
  const parts = [
    nearby.food ? `${nearby.food} ${nearby.food === 1 ? "place" : "places"} to eat` : null,
    nearby.coffee ? `${nearby.coffee} coffee ${nearby.coffee === 1 ? "shop" : "shops"}` : null,
    nearby.grocery ? `${nearby.grocery} ${nearby.grocery === 1 ? "store" : "stores"}` : null,
    nearby.shops ? `${nearby.shops} ${nearby.shops === 1 ? "shop" : "shops"}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export default function RoutePlanner({ configured }: { configured: boolean }) {
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  // "Use my location": the phone's position, and the address we showed for it in "Starting from".
  // Planning uses the position as long as the box still shows that address.
  const [myPosition, setMyPosition] = useState<LatLng | null>(null);
  const [myAddress, setMyAddress] = useState<string | null>(null);
  const locateRequest = useRef(0);
  // How the start reads in the results ("Your location" from the server becomes the address).
  const [startLabel, setStartLabel] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<VehicleChoice>(EMPTY_VEHICLE);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TripResult | null>(null);
  // After a trip is planned the form folds away, so the map and stops come first.
  const [editing, setEditing] = useState(true);
  const resultsRef = useRef<HTMLDivElement>(null);
  const startedFromUrl = useRef(false);

  function locateMe() {
    setError(null);
    if (!window.isSecureContext || !("geolocation" in navigator)) {
      setError("Your browser can't share your location here. Type a city, address or ZIP code instead.");
      return;
    }
    const request = ++locateRequest.current;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        // About 100 m is precise enough for a route start.
        const position: LatLng = [Math.round(coords.latitude * 1000) / 1000, Math.round(coords.longitude * 1000) / 1000];
        let address = MY_LOCATION;
        try {
          const response = await fetch(`/api/nearest-address?lat=${position[0]}&lon=${position[1]}`);
          const label = response.ok ? (await response.json()).label : null;
          if (typeof label === "string" && label) address = label;
        } catch {
          // Offline or lookup failed: the box says "Your location" and planning still uses the position.
        }
        // The driver started typing an address meanwhile: keep what they typed.
        if (request !== locateRequest.current) return;
        setMyPosition(position);
        setMyAddress(address);
        setFromText(address);
        setLocating(false);
      },
      (problem) => {
        if (request !== locateRequest.current) return;
        setError(
          problem.code === problem.PERMISSION_DENIED
            ? "Location is turned off for this site. Allow it in your browser or phone settings, or type an address."
            : "We couldn't get your location. Type a city, address or ZIP code instead.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  async function plan(query: URLSearchParams) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/route-plan?${query}`);
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setResult(null);
        setError(body?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setResult(body as TripResult);
      setEditing(false);
      // Show the map and stops from the top, below the sticky header (scroll-margin-top in CSS).
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ block: "start" });
        resultsRef.current?.focus({ preventScroll: true });
      });
    } catch {
      setError("You seem to be offline. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const plug = plugFor(vehicle);
    const missing =
      !vehicle.make || (vehicle.make !== OTHER_MAKE && !vehicle.modelId)
        ? "Choose your car's year, make and model, or pick “My car isn't listed”."
        : !vehicle.rangeMi
          ? "Enter your car's range when full."
          : !plug
            ? "Choose your car's charging port."
            : null;
    if (missing || !plug) {
      setError(missing);
      return;
    }
    saveVehicle(vehicle);
    const fromMyLocation = Boolean(myPosition) && fromText === myAddress;
    const from = fromMyLocation && myPosition ? myPosition.join(",") : fromText.trim();
    setStartLabel(fromMyLocation ? myAddress : null);
    const query = new URLSearchParams({ from, to: toText.trim(), range: vehicle.rangeMi, plug });
    if (vehicle.modelId) query.set("car", String(vehicle.modelId));
    if (vehicle.port) query.set("port", vehicle.port);
    if (plug === "nacs" && vehicle.ccsAdapter) query.set("adapter", "1");
    // Keep typed trips in the address bar so they can be shared or reopened (never the visitor's location).
    if (!fromMyLocation) window.history.replaceState(null, "", `/route-planner?${query}`);
    plan(query);
  }

  // Fill the form once on arrival, from a shared trip link (/route-planner?from=…&to=…&car=…) or
  // from a tap on "Plan my trip" before the page's script had loaded (the form then submits as a
  // plain link with the same fields), and otherwise with the car this device used last time.
  useEffect(() => {
    if (startedFromUrl.current || !configured) return;
    startedFromUrl.current = true;
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from")?.trim() ?? "";
    const to = params.get("to")?.trim() ?? "";
    const car = Number(params.get("car")) || null;
    const linked = restoreVehicle({
      modelId: car,
      port: params.get("port") ?? "",
      rangeMi: params.get("range") ?? "",
      make: car ? "" : (params.get("make") ?? OTHER_MAKE),
      ccsAdapter: params.get("adapter") === "1",
    });
    const plug = plugFor(linked);
    const usable = from && to && plug && linked.rangeMi;
    // A one-time sync with the URL and this device's storage, which only exist in the browser.
    /* eslint-disable react-hooks/set-state-in-effect */
    setVehicle(usable ? linked : readSavedVehicle());
    if (from) setFromText(from);
    if (to) setToText(to);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!usable) return;
    const query = new URLSearchParams({ from, to, range: linked.rangeMi, plug });
    if (plug === "nacs" && linked.ccsAdapter) query.set("adapter", "1");
    plan(query);
  }, [configured]);

  const mapStops = useMemo(
    () =>
      result?.stops.map((stop) => ({
        position: [stop.station.lat, stop.station.lon] as LatLng,
        name: stop.station.name,
        href: stop.station.href,
        otherNetwork: stop.station.network !== null,
      })) ?? [],
    [result],
  );

  if (!configured) {
    return (
      <div className="form-card">
        <p className="page-sub">The route planner is coming soon. Meanwhile, find Superchargers on the map.</p>
        <Link href="/map" className="action-button primary">Open the map</Link>
      </div>
    );
  }

  const totalChargeMin = result?.stops.reduce((sum, stop) => sum + stop.chargeMin, 0) ?? 0;
  const otherNetworkStops = result?.stops.filter((stop) => stop.station.network !== null).length ?? 0;

  const carModel = vehicle.modelId ? evModelById(vehicle.modelId) : null;
  const carLabel = carModel ? `${carModel.year} ${carModel.make} ${carModel.model}` : `${vehicle.rangeMi}-mile EV`;

  return (
    <>
      {result && !editing ? (
        <div className="form-card trip-bar">
          <p className="trip-bar-text">
            <strong>
              {startLabel ?? result.from.label} → {result.to.label}
            </strong>
            <span>{carLabel}</span>
          </p>
          <button type="button" className="action-button secondary" onClick={() => setEditing(true)}>
            Change trip
          </button>
        </div>
      ) : (
        // method/action let the button work even before the page's script loads (see the effect above).
        <form className="form-card route-form" method="get" action="/route-planner" onSubmit={onSubmit}>
          <div className="field">
            <div className="field-label-row">
              <label htmlFor="route-from">Starting from</label>
              <button type="button" className="text-button" onClick={locateMe} disabled={locating}>
                {locating ? "Finding you…" : "Use my location"}
              </button>
            </div>
            <input
              id="route-from"
              name="from"
              value={fromText}
              onChange={(event) => {
                setFromText(event.target.value);
                setMyPosition(null);
                // A location lookup still on its way shouldn't overwrite what's being typed.
                locateRequest.current++;
                setLocating(false);
              }}
              placeholder="City, address or ZIP code"
              autoComplete="street-address"
              required
            />
          </div>

          <label className="field">
            <span>Going to</span>
            <input name="to" value={toText} onChange={(event) => setToText(event.target.value)} placeholder="City, address or ZIP code" required />
          </label>

          <VehiclePicker value={vehicle} onChange={setVehicle} />
          <p className="login-note">
            We plan as if you leave with {START_PCT}% and stop to charge when you&apos;re down to about {RESERVE_PCT}–{STOP_AT_PCT}%. Ranges
            are official estimates for each model.
          </p>

          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button type="submit" className="action-button primary" disabled={loading || locating}>
            {loading ? "Planning your trip…" : "Plan my trip"}
          </button>
        </form>
      )}

      {result ? (
        <div ref={resultsRef} tabIndex={-1} className="route-results" aria-live="polite">
          <RouteMap path={result.path} from={result.from.position} to={result.to.position} stops={mapStops} />

          <p className="route-summary">
            {miles(result.distanceKm)} mi · {hoursAndMinutes(result.durationS)} driving
            {result.stops.length ? ` · ${result.stops.length} charging ${result.stops.length === 1 ? "stop" : "stops"} (about ${totalChargeMin} min)` : ""}
            {otherNetworkStops ? `, ${otherNetworkStops} on another network` : ""}
          </p>
          {result.stuckAtKm !== null ? (
            <p className="form-error" role="alert">
              There&apos;s no fast charger your car can plug into within reach after mile {miles(result.stuckAtKm)}.
              {plugFor(vehicle) === "nacs" && !vehicle.ccsAdapter
                ? " If you carry a CCS adapter, tap Change trip, tick that box and plan again: other networks' chargers can fill the gap."
                : " Plan a stop at a slower charger near there, or choose a different route."}
            </p>
          ) : result.stops.length === 0 ? (
            <p className="form-success">No charging stop needed: you&apos;ll arrive with about {result.arrivePct}%.</p>
          ) : null}

          <ol className="route-stops">
            <li className="route-point">
              <span className="route-marker start" aria-hidden="true" />
              <span>
                <strong>Start</strong> · {startLabel ?? result.from.label} with {START_PCT}%
              </span>
            </li>
            {result.stops.map((stop, index) => {
              const nearby = stop.nearby ? nearbyLine(stop.nearby) : null;
              const other = stop.station.network !== null;
              return (
                <li key={stop.station.id} className={`route-stop${other ? " other-network" : ""}`}>
                  <span className={`route-stop-pin${other ? " other" : ""}`} aria-hidden="true">
                    {index + 1}
                  </span>
                  <div className="route-stop-card form-card">
                    <span className="route-stop-label">
                      Stop {index + 1} · mile {miles(stop.atKm)}
                      {stop.detourKm >= 0.8 ? ` · ${miles(stop.detourKm) || "<1"} mi off the route` : ""}
                    </span>
                    {other ? (
                      <>
                        <span className="network-badge other">{stop.station.network} · not a Tesla Supercharger</span>
                        <span className="route-stop-name">{stop.station.name}</span>
                      </>
                    ) : (
                      <>
                        <span className="network-badge">Tesla Supercharger</span>
                        <Link href={stop.station.href} className="route-stop-name">{stop.station.name}</Link>
                      </>
                    )}
                    <span className="station-sub">
                      {[stop.station.label, stop.station.stalls ? `${stop.station.stalls} stalls` : null, stop.station.maxKw ? `up to ${stop.station.maxKw} kW` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="route-charge">
                      Arrive with about {stop.arrivePct}% · charge to {stop.departPct}%{stop.chargeMin ? ` (about ${stop.chargeMin} min)` : ""}
                    </span>
                    {other ? (
                      <span className="route-nearby">
                        Used because no Supercharger is in reach here. Check the {stop.station.network} app for plugs and prices.{" "}
                        <a href={stop.station.href} target="_blank" rel="noreferrer">Directions</a>
                      </span>
                    ) : nearby ? (
                      <span className="route-nearby">
                        While you charge: {nearby}. <Link href={stop.station.href}>See what&apos;s nearby</Link>
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
            {result.arrivePct !== null ? (
              <li className="route-point">
                <span className="route-marker end" aria-hidden="true" />
                <span>
                  <strong>Arrive</strong> · {result.to.label} with about {result.arrivePct}%
                </span>
              </li>
            ) : null}
          </ol>

          <p className="login-note">
            Estimates only. Check your car&apos;s own trip planner before you go. Not every Supercharger is open to non-Tesla EVs; check the
            Tesla app.
          </p>
        </div>
      ) : null}
    </>
  );
}
