// Client-safe types and categories for the "Nearby" section. Data lives in lib/placesData.ts (server).

// Order matches scripts/import-places.mjs, which stores each place's category as an index.
export const CATEGORIES = [
  { id: "food", label: "Food & Drink" },
  { id: "coffee", label: "Coffee" },
  { id: "grocery", label: "Grocery" },
  { id: "bars", label: "Bars & Wine" },
  { id: "shops", label: "Shops" },
  { id: "chargers", label: "Other EV chargers" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export function isCategoryId(value: unknown): value is CategoryId {
  return CATEGORIES.some((category) => category.id === value);
}

export function categoryLabel(id: CategoryId) {
  return CATEGORIES.find((category) => category.id === id)!.label;
}

export type Place = {
  name: string;
  kind: string; // "Restaurant", "Café", "DC fast charging"...
  category: CategoryId;
  distanceM: number;
  walkMin: number;
  lat: number;
  lon: number;
};

// PRD: walking time = straight-line distance at 80 m per minute.
export function walkMinutes(distanceM: number) {
  return Math.max(1, Math.round(distanceM / 80));
}
