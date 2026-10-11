// Electric cars and their official EPA range, for the route planner's Year → Make → Model picker.
// Source: US EPA / DOE fueleconomy.gov vehicle data (public domain), written to data/ev-models.json.
//
// Usage: node scripts/import-ev-models.mjs   (downloads ~2 MB; needs `unzip`, standard on macOS and Linux)
// Run again when new model years come out.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SOURCE = "https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip";
const FIRST_YEAR = 2012; // older EVs are rare on the road and can't use Superchargers

// Small CSV reader: quoted fields may contain commas and doubled quotes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') {
        field += char;
      } else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const dir = mkdtempSync(path.join(tmpdir(), "epa-"));
try {
  const response = await fetch(SOURCE, { headers: { "User-Agent": "TeslaSuperchargerNearMe import" } });
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const zipPath = path.join(dir, "vehicles.csv.zip");
  writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));
  const csv = execFileSync("unzip", ["-p", zipPath, "vehicles.csv"], { maxBuffer: 200 * 1024 * 1024 }).toString("utf8");

  const [header, ...rows] = parseCsv(csv);
  const col = Object.fromEntries(header.map((name, index) => [name, index]));
  const models = rows
    .filter((row) => row[col.atvType] === "EV" && Number(row[col.year]) >= FIRST_YEAR && Number(row[col.range]) > 0)
    .map((row) => [Number(row[col.id]), Number(row[col.year]), row[col.make].trim(), row[col.model].replace(/\s+/g, " ").trim(), Number(row[col.range])])
    .sort((a, b) => b[1] - a[1] || a[2].localeCompare(b[2]) || a[3].localeCompare(b[3]) || b[4] - a[4]);

  const out = new URL("../data/ev-models.json", import.meta.url);
  writeFileSync(
    out,
    JSON.stringify({
      source: "US EPA, fueleconomy.gov",
      fetchedAt: new Date().toISOString().slice(0, 10),
      // [EPA id, model year, make, model, EPA range in miles]
      models,
    }),
  );
  console.log(`Wrote ${models.length} electric models (${models.at(-1)[1]}–${models[0][1]}) to data/ev-models.json`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
