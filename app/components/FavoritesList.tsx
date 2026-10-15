"use client";

import Link from "next/link";
import { writeFavorites } from "@/lib/favorites";
import { useFavorites } from "./useFavorites";

export default function FavoritesList() {
  const favorites = useFavorites();

  if (favorites.length === 0) {
    return (
      <div className="empty-state">
        <p>No saved stations yet. Open a station and tap Save to keep it here.</p>
        <Link href="/map" className="action-button primary">Find a Supercharger</Link>
      </div>
    );
  }

  return (
    <ul className="favorites-list">
      {favorites.map((station) => (
        <li key={station.id} className="favorite-row">
          <Link href={station.href} className="favorite-link">
            <span className="station-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
              </svg>
            </span>
            <span className="station-meta">
              <span className="station-name">{station.name}</span>{" "}
              <span className="station-sub">{station.address}</span>
            </span>
          </Link>
          <button
            type="button"
            className="remove-button"
            aria-label={`Remove ${station.name} from favorites`}
            onClick={() => writeFavorites(favorites.filter((item) => item.id !== station.id))}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}
