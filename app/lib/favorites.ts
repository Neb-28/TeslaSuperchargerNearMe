// Favorites live on the device (PRD: "Favorites saved on device"), so there is no account.

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
