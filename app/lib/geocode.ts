// Server-only: imports the ~900 KB ZIP table, so never import this from a client component.
// ZIP centers come from the US Census Bureau ZCTA Gazetteer (see scripts/build-zip-centroids.mjs).
import centroids from "@/data/zip-centroids.json";
import { parseZip, type Place } from "./zipQuery";

const zipCentroids = centroids as unknown as Record<string, [number, number]>;

export function geocodeZip(query: string): Place | null {
  const zip = parseZip(query);
  if (!zip) return null;
  const position = zipCentroids[zip];
  return position ? { label: zip, position } : null;
}
