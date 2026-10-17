// Safe to import in the browser: no data, just recognizes ZIP-shaped searches.

export type Place = {
  label: string;
  position: [number, number];
  // Set when what was typed looked like a misspelled place name and this is the place we think
  // was meant ("woodbrige" → Woodbridge, VA); the map offers to search the exact text instead.
  correctedFrom?: string;
};

// A street address rather than a city or station name: it starts with a house number
// ("1600 Amphitheatre Pkwy") or has a comma ("Main St, Springfield"). Map search looks those up.
export function looksLikeAddress(query: string): boolean {
  const text = query.trim();
  return !parseZip(text) && (/^\d+[a-z]?(-\d+)?\s+\S/i.test(text) || text.includes(","));
}

// Accepts "22202" and ZIP+4 "22202-4512"; returns the 5-digit ZIP or null.
export function parseZip(query: string): string | null {
  const match = query.trim().match(/^(\d{5})(?:-\d{4})?$/);
  return match ? match[1] : null;
}
