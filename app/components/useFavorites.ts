"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseFavorites, readFavoritesRaw, subscribeFavorites } from "@/lib/favorites";

export function useFavorites() {
  const raw = useSyncExternalStore(subscribeFavorites, readFavoritesRaw, () => "[]");
  return useMemo(() => parseFavorites(raw), [raw]);
}
