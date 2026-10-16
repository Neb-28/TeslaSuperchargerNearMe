// Writes a data snapshot with one station (or one station's places) per line. Git then stores a
// nightly refresh as the few lines that changed instead of a new copy of a one-line file.
//
// When nothing but the timestamps would change, the file is left alone, so a quiet night
// makes no commit and no deploy, and dates like the sitemap's keep meaning "last changed".
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export function writeData(file, data, listKey) {
  const list = data[listKey];
  const entries = Array.isArray(list)
    ? list.map((item) => JSON.stringify(item))
    : Object.entries(list).map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`);
  const head = JSON.stringify({ ...data, [listKey]: null }).replace(/null}$/, "");
  const [open, close] = Array.isArray(list) ? ["[", "]"] : ["{", "}"];
  const text = `${head}${open}\n${entries.join(",\n")}\n${close}}\n`;
  const withoutTimestamps = (value) => value.replace(/"(fetchedAt|checkedAt)":("[^"]*"|null),?/g, "");
  if (existsSync(file) && withoutTimestamps(readFileSync(file, "utf8")) === withoutTimestamps(text)) return false;
  writeFileSync(file, text);
  return true;
}
