"use client";

import { useEffect } from "react";
import { authConfigured, hasAuthCookie } from "@/lib/supabase/env";

// Syncs favorites for signed-in visitors. Everyone else never downloads the Supabase code:
// it only loads when a session cookie is present.
export default function FavoritesSync() {
  useEffect(() => {
    if (!authConfigured || !hasAuthCookie(document.cookie)) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    import("@/lib/favoritesSync").then(({ startFavoritesSync }) => {
      if (!cancelled) stop = startFavoritesSync();
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return null;
}
