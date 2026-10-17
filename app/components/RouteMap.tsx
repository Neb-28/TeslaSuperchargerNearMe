"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import type { LatLng } from "@/lib/stations";

const tileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

// Literal values of the design tokens (Leaflet draws on canvas/SVG, not with CSS variables).
const ACCENT = "#CC1A21";
const INK = "#171A1C";
const SURFACE = "#FFFFFF";

type RouteMapProps = {
  path: LatLng[];
  from: LatLng;
  to: LatLng;
  stops: { position: LatLng; name: string; href: string; otherNetwork: boolean }[];
};

export default function RouteMap({ path, from, to, stops }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, { zoomControl: false, scrollWheelZoom: false });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer(tileUrl, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Route &copy; <a href="https://openrouteservice.org/">openrouteservice.org</a> by HeiGIT',
      maxZoom: 19,
    }).addTo(map);

    const line = L.polyline(path, { color: ACCENT, weight: 5, opacity: 0.85 }).addTo(map);
    L.circleMarker(from, { radius: 8, color: SURFACE, weight: 3, fillColor: INK, fillOpacity: 1 }).bindTooltip("Start").addTo(map);
    L.circleMarker(to, { radius: 8, color: SURFACE, weight: 3, fillColor: ACCENT, fillOpacity: 1 }).bindTooltip("Destination").addTo(map);

    stops.forEach((stop, index) => {
      const pinClass = stop.otherNetwork ? "route-stop-pin other" : "route-stop-pin";
      const icon = L.divIcon({ className: "", html: `<span class="${pinClass}">${index + 1}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] });
      const kind = stop.otherNetwork ? "other network" : "Tesla Supercharger";
      const marker = L.marker(stop.position, { icon, title: `Stop ${index + 1} (${kind}): ${stop.name}`, keyboard: true }).addTo(map);
      const link = document.createElement("a");
      link.href = stop.href;
      link.textContent = stop.name;
      if (stop.otherNetwork) link.target = "_blank";
      marker.bindPopup(link);
    });

    map.fitBounds(line.getBounds(), { padding: [24, 24] });
    return () => {
      map.remove();
    };
  }, [path, from, to, stops]);

  return (
    <>
      <div ref={containerRef} className="route-map" role="region" aria-label="Map of your route and charging stops" />
      <ul className="route-legend">
        <li>
          <span className="route-stop-pin small" aria-hidden="true" /> Tesla Supercharger
        </li>
        {stops.some((stop) => stop.otherNetwork) ? (
          <li>
            <span className="route-stop-pin small other" aria-hidden="true" /> Other network
          </li>
        ) : null}
      </ul>
    </>
  );
}
