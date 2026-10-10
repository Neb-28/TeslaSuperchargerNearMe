// Builds data/zip-centroids.json from the US Census Bureau ZCTA Gazetteer file (public domain).
// Download: https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_zcta_national.zip
// Usage: node scripts/build-zip-centroids.mjs path/to/2025_Gaz_zcta_national.txt
import { readFileSync, writeFileSync } from "node:fs";

const [source] = process.argv.slice(2);
if (!source) {
  console.error("Usage: node scripts/build-zip-centroids.mjs <gazetteer .txt file>");
  process.exit(1);
}

const [header, ...rows] = readFileSync(source, "utf8").trim().split("\n");
const columns = header.trim().split("|");
const zipCol = columns.indexOf("GEOID");
const latCol = columns.indexOf("INTPTLAT");
const lonCol = columns.indexOf("INTPTLONG");

const centroids = {};
for (const row of rows) {
  const cells = row.trim().split("|");
  // 4 decimals is about 11 m, plenty for "stations near this ZIP".
  centroids[cells[zipCol]] = [Number(Number(cells[latCol]).toFixed(4)), Number(Number(cells[lonCol]).toFixed(4))];
}

writeFileSync(new URL("../data/zip-centroids.json", import.meta.url), JSON.stringify(centroids));
console.log(`Wrote ${Object.keys(centroids).length} ZIP codes`);
