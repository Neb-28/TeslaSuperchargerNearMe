// Browser-only: keeps a signed-in visitor's favorites in their account (Supabase `favorites`,
// readable and writable only by its owner). Loaded on demand by components/FavoritesSync.tsx.
import { createBrowserClient } from "@supabase/ssr";
import { parseFavorites, planFavoritesSync, readFavoritesRaw, subscribeFavorites, writeFavorites, type FavoriteStation } from "./favorites";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase/env";

const SYNCED_KEY = "favoritesSynced";

type Row = { station_id: string; name: string; address: string | null; href: string };

function readSynced(userId: string): Set<string> {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SYNCED_KEY) ?? "null");
    return saved?.userId === userId && Array.isArray(saved.ids) ? new Set(saved.ids) : new Set();
  } catch {
    return new Set();
  }
}

function writeSynced(userId: string, ids: string[]) {
  try {
    window.localStorage.setItem(SYNCED_KEY, JSON.stringify({ userId, ids }));
  } catch {
    // Storage blocked: the next visit treats this device as new and merges both sides.
  }
}

export function startFavoritesSync() {
  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let userId: string | null = null;
  let writing = false;
  let queue = Promise.resolve();

  async function sync(uid: string) {
    const { data, error } = await supabase.from("favorites").select("station_id, name, address, href").order("created_at");
    if (error || uid !== userId) return;
    const remote: FavoriteStation[] = (data as Row[]).map((row) => ({ id: row.station_id, name: row.name, address: row.address ?? "", href: row.href }));
    const local = parseFavorites(readFavoritesRaw());
    const plan = planFavoritesSync(local, remote, readSynced(uid));

    if (plan.upload.length) {
      const rows = plan.upload.map((item) => ({ user_id: uid, station_id: item.id, name: item.name, address: item.address || null, href: item.href }));
      const { error: uploadError } = await supabase.from("favorites").upsert(rows, { onConflict: "user_id,station_id", ignoreDuplicates: true });
      if (uploadError) return; // try again on the next change or visit
    }
    if (plan.remove.length) {
      const { error: removeError } = await supabase.from("favorites").delete().eq("user_id", uid).in("station_id", plan.remove);
      if (removeError) return;
    }

    writeSynced(uid, plan.merged.map((item) => item.id));
    const changed = plan.merged.length !== local.length || plan.merged.some((item, index) => item.id !== local[index]?.id);
    if (changed) {
      writing = true;
      writeFavorites(plan.merged);
      writing = false;
    }
  }

  // One sync at a time, in order.
  const schedule = () => {
    const uid = userId;
    if (uid) queue = queue.then(() => sync(uid)).catch(() => {});
  };

  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    const uid = session?.user.id ?? null;
    if (uid === userId) return;
    userId = uid;
    // Supabase asks not to call it from inside this callback; run on the next tick.
    setTimeout(schedule, 0);
  });
  const unsubscribe = subscribeFavorites(() => {
    if (!writing) schedule();
  });
  // Pick up changes made on other devices when the visitor comes back to this tab.
  const onVisible = () => {
    if (document.visibilityState === "visible") schedule();
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    listener.subscription.unsubscribe();
    unsubscribe();
    document.removeEventListener("visibilitychange", onVisible);
  };
}
