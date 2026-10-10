"use client";

import { writeFavorites, type FavoriteStation } from "@/lib/favorites";
import { useFavorites } from "./useFavorites";

export default function FavoriteButton({ station }: { station: FavoriteStation }) {
  const favorites = useFavorites();
  const saved = favorites.some((item) => item.id === station.id);

  function toggle() {
    writeFavorites(saved ? favorites.filter((item) => item.id !== station.id) : [...favorites, station]);
  }

  return (
    <button type="button" className="station-action secondary compact" aria-pressed={saved} onClick={toggle}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 2 3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8L12 2z" />
      </svg>
      <span className="action-label">{saved ? "Saved" : "Save"}</span>
    </button>
  );
}
