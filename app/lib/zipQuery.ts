// Safe to import in the browser: no data, just recognizes ZIP-shaped searches.

export type Place = {
  label: string;
  position: [number, number];
};

// Accepts "22202" and ZIP+4 "22202-4512"; returns the 5-digit ZIP or null.
export function parseZip(query: string): string | null {
  const match = query.trim().match(/^(\d{5})(?:-\d{4})?$/);
  return match ? match[1] : null;
}
