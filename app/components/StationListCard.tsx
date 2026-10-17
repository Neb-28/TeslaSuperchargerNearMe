import Link from "next/link";
import type { Supercharger } from "@/lib/superchargers";
import { listName, stationHref } from "@/lib/superchargers";

// One station in a city, state or town list; town pages add how far away it is.
export default function StationListCard({ station, distance }: { station: Supercharger; distance?: string }) {
  const meta = [station.stalls ? `${station.stalls} stalls` : null, station.maxKw ? `up to ${station.maxKw} kW` : null].filter(Boolean).join(" · ");
  return (
    <Link href={stationHref(station)} className="station-row">
      <span className="station-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      </span>
      <span className="station-meta">
        <span className="station-name">{listName(station)}</span>{" "}
        <span className="station-sub">{[distance ?? null, station.address ?? (station.nearLabel ? `Near ${station.nearLabel}` : null), meta].filter(Boolean).join(" · ")}</span>
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="row-chevron" aria-hidden="true">
        <path d="m9 5 7 7-7 7" />
      </svg>
    </Link>
  );
}
