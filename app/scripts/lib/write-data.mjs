// Writes a data snapshot with one station (or one station's places) per line. Git then stores a
// nightly refresh as the few lines that changed instead of a new copy of a one-line file.
import { writeFileSync } from "node:fs";

export function writeData(file, data, listKey) {
  const list = data[listKey];
  const entries = Array.isArray(list)
    ? list.map((item) => JSON.stringify(item))
    : Object.entries(list).map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`);
  const head = JSON.stringify({ ...data, [listKey]: null }).replace(/null}$/, "");
  const [open, close] = Array.isArray(list) ? ["[", "]"] : ["{", "}"];
  writeFileSync(file, `${head}${open}\n${entries.join(",\n")}\n${close}}\n`);
}
