// Favorites live on the device (PRD: "Favorites saved on device"). Signed-in visitors also get
// them synced to their account (lib/favoritesSync.ts); the device copy stays the one the UI reads.

export type FavoriteStation = {
  id: string;
  name: string;
  address: string;
  href: string;
};

const STORAGE_KEY = "favoriteStations";
const CHANGE_EVENT = "favorites-change";

export function readFavoritesRaw() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function parseFavorites(raw: string): FavoriteStation[] {
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((item) => item && typeof item.id === "string" && typeof item.href === "string") : [];
  } catch {
    return [];
  }
}

export function writeFavorites(list: FavoriteStation[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage can be blocked (private mode); the toggle then lasts for this page only.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeFavorites(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export type SyncPlan = { merged: FavoriteStation[]; upload: FavoriteStation[]; remove: string[] };

// Three-way merge between this device, the account, and what this device last synced.
// - Saved here since the last sync: kept and uploaded.
// - Removed here since the last sync: removed from the account too.
// - Saved on another device: added here. Removed on another device: removed here.
// The first sync on a device (nothing synced yet) keeps everything from both sides.
export function planFavoritesSync(local: FavoriteStation[], remote: FavoriteStation[], lastSynced: ReadonlySet<string>): SyncPlan {
  const localIds = new Set(local.map((item) => item.id));
  const remoteIds = new Set(remote.map((item) => item.id));
  const removedHere = (id: string) => lastSynced.has(id) && !localIds.has(id);
  const addedHere = (id: string) => !lastSynced.has(id);

  const merged = [
    ...local.filter((item) => remoteIds.has(item.id) || addedHere(item.id)),
    ...remote.filter((item) => !localIds.has(item.id) && !removedHere(item.id)),
  ];
  return {
    merged,
    upload: local.filter((item) => addedHere(item.id) && !remoteIds.has(item.id)),
    remove: remote.filter((item) => removedHere(item.id)).map((item) => item.id),
  };
}
