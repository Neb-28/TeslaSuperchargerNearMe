"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import type { Pin } from "@/lib/pins";
import { DEFAULT_CENTER, milesBetween, type LatLng } from "@/lib/stations";

const tileUrl =
  process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

// Below this zoom every station is a small canvas dot (fast for ~3,200 stations);
// at and above it, stations in view get the stall-count pins from the design.
const PIN_ZOOM = 11;
const MAX_PINS = 300;

const boltSvg =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>';

type LeafletMapProps = {
  // Every station to draw.
  pins: Pin[];
  // The list beside the map, nearest first; used for framing.
  nearby: Pin[];
  // Station opened from "View larger map", drawn highlighted.
  highlightHref: string | null;
  userPos: LatLng | null;
  // Center of a searched ZIP code or the highlighted station.
  searchPos: LatLng | null;
  // Bumped each time the map should re-frame on searchPos / the visitor.
  recenter: number;
  // Changes when a name search changes, to frame the matches.
  fitKey: string;
  onOpenStation: (href: string) => void;
};

export default function LeafletMap({ pins, nearby, highlightHref, userPos, searchPos, recenter, fitKey, onOpenStation }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dotsRef = useRef<L.LayerGroup | null>(null);
  const pinLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const searchLayerRef = useRef<L.LayerGroup | null>(null);
  const pinsRef = useRef(pins);
  const highlightRef = useRef(highlightHref);
  const openStationRef = useRef(onOpenStation);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    openStationRef.current = onOpenStation;
    highlightRef.current = highlightHref;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, { zoomControl: false }).setView(searchPos ?? DEFAULT_CENTER, 12);
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const dots = L.layerGroup();
    const pinLayer = L.layerGroup().addTo(map);
    dotsRef.current = dots;
    pinLayerRef.current = pinLayer;
    userLayerRef.current = L.layerGroup().addTo(map);
    searchLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Swap dots for pins (and back) as the visitor zooms, and only build pins that are in view.
    const refresh = () => {
      pinLayer.clearLayers();

      if (map.getZoom() < PIN_ZOOM) {
        if (!map.hasLayer(dots)) dots.addTo(map);
        return;
      }
      if (map.hasLayer(dots)) dots.remove();

      const bounds = map.getBounds().pad(0.2);
      pinsRef.current
        .filter((pin) => bounds.contains([pin.lat, pin.lon]))
        .slice(0, MAX_PINS)
        .forEach((pin) => {
          const selected = pin.href === highlightRef.current;
          const icon = L.divIcon({
            className: "",
            iconSize: [0, 0],
            html: `<div class="map-pin${selected ? " is-selected" : ""}"><span class="pin-pill">${boltSvg}${pin.stalls ?? ""}</span><span class="pin-stem"></span></div>`,
          });
          L.marker([pin.lat, pin.lon], { icon, title: pin.name, keyboard: true, zIndexOffset: selected ? 1000 : 0 })
            .on("click", () => openStationRef.current(pin.href))
            .addTo(pinLayer);
        });
    };
    refreshRef.current = refresh;
    map.on("moveend", refresh);

    // Keeps tiles filling the canvas when the layout switches between phone and desktop.
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // Sets the initial view only; later framing happens in the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild the dot layer when the set of stations changes (data loaded or a name search).
  useEffect(() => {
    const dots = dotsRef.current;
    if (!dots) return;
    pinsRef.current = pins;
    dots.clearLayers();

    const renderer = L.canvas({ padding: 0.5 });
    pins.forEach((pin) => {
      const selected = pin.href === highlightRef.current;
      L.circleMarker([pin.lat, pin.lon], {
        renderer,
        radius: selected ? 8 : 5,
        color: "#FFFFFF",
        weight: 1.5,
        fillColor: selected ? "#14211C" : "#0B6E5B",
        fillOpacity: 1,
      })
        .bindPopup(() => stationPopup(pin, (href) => openStationRef.current(href)))
        .addTo(dots);
    });
    refreshRef.current();
  }, [pins]);

  useEffect(() => {
    const layer = userLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (userPos) {
      L.circleMarker(userPos, { radius: 9, color: "#FFFFFF", weight: 4, fillColor: "#2F6FE4", fillOpacity: 1 })
        .bindPopup("You are here")
        .addTo(layer);
    }
  }, [userPos]);

  useEffect(() => {
    const layer = searchLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    // A highlighted station marks itself; only a searched ZIP needs its own marker.
    if (searchPos && !highlightHref) {
      L.circleMarker(searchPos, { radius: 8, color: "#FFFFFF", weight: 3, fillColor: "#14211C", fillOpacity: 1 })
        .bindPopup("Searched area")
        .addTo(layer);
    }
  }, [searchPos, highlightHref]);

  // After a ZIP search, "View larger map" or locating the visitor, frame that point together
  // with the nearest station. If the nearest is far away, just center on the point.
  useEffect(() => {
    const map = mapRef.current;
    if (recenter === 0 || !map) return;
    const focus = searchPos ?? userPos;
    if (!focus) {
      map.setView(DEFAULT_CENTER, 12);
      return;
    }
    if (highlightHref) {
      map.setView(focus, 13);
      return;
    }
    const nearest = nearby[0];
    if (nearest && milesBetween(focus, [nearest.lat, nearest.lon]) < 50) {
      map.fitBounds(L.latLngBounds([focus, [nearest.lat, nearest.lon]]).pad(0.4), { maxZoom: 14 });
    } else {
      map.setView(focus, 12);
    }
    // Re-frame only when asked to, not every time the list re-sorts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenter]);

  // Frame the matches of a name search ("Woodbridge", "Barstow"...).
  const hasNearby = nearby.length > 0;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitKey || !hasNearby) return;
    map.fitBounds(L.latLngBounds(nearby.map((pin) => [pin.lat, pin.lon] as LatLng)).pad(0.2), { maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, hasNearby]);

  return <div ref={containerRef} className="osm-map" role="region" aria-label="Map of Tesla Superchargers" />;
}

// Zoomed out, dots overlap, so a tap first confirms which station it is.
function stationPopup(pin: Pin, open: (href: string) => void) {
  const wrap = document.createElement("div");
  wrap.className = "map-popup";

  const name = document.createElement("strong");
  name.textContent = pin.name;
  const meta = document.createElement("span");
  meta.textContent = [pin.stalls ? `${pin.stalls} stalls` : null, pin.kw ? `${pin.kw} kW` : null].filter(Boolean).join(" · ");
  const link = document.createElement("a");
  link.href = pin.href;
  link.className = "map-popup-link";
  link.textContent = "View station";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    open(pin.href);
  });

  wrap.append(name, meta, link);
  return wrap;
}
