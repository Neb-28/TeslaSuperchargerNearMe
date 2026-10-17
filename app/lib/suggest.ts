// Server-only: search suggestions while a visitor types, from our own places (no geocoder call):
// cities with Superchargers, towns near one, US states, countries, and stations (by street).
// Typos are forgiven ("woodbrige" → Woodbridge, VA), so the list also answers "did you mean".
import type { LatLng } from "./stations";
import { allCities, allWorldCities, cityCenter, countries, ENGLISH_NAMES, getCountry, superchargers, worldStations } from "./superchargers";
import { allTowns } from "./towns";
import { US_STATES } from "./usStates";

export type SuggestionKind = "city" | "town" | "state" | "country" | "station";

export type Suggestion = {
  kind: SuggestionKind;
  label: string; // "Woodbridge, VA"
  detail: string; // "5 Superchargers"
  country: string | null; // the country slug outside the US ("canada"), null in the US
  position?: LatLng; // places: where the map centers
  slug?: string; // stations: /map?station=<slug>
};

type Entry = Suggestion & {
  names: string[]; // folded place names, spaces removed: ["munchen", "munich"]
  full: string[]; // folded labels: ["munchen germany", "munich germany"]
  words: string[];
  weight: number; // bigger first among equally good matches
};

const LIMIT = 6;
const MAX_STATIONS = 2; // so places still show when a city's stations also match
const MIN_FUZZY_LENGTH = 4;
const AWAY = 0.25; // other countries' places count a quarter, so famous ones still come up

// What people type for a few big cities.
const NICKNAMES: Record<string, string[]> = { "ny/new-york": ["NYC"], "ca/san-francisco": ["SF"], "dc/washington": ["DC"] };

/** Lowercase, no accents or punctuation: "Montréal, QC" → "montreal qc". */
export function fold(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const plural = (count: number, word: string) => `${count.toLocaleString("en-US")} ${word}${count === 1 ? "" : "s"}`;

// `aliases` are other names for the place ("Munich" for München); the label's other words (state,
// country) still apply to them: "munich germany".
function entry(suggestion: Suggestion, name: string, weight: number, aliases: string[] = []): Entry {
  const label = fold(suggestion.label);
  const rest = label.startsWith(fold(name)) ? label.slice(fold(name).length) : "";
  const full = [label, ...aliases.map((alias) => `${fold(alias)}${rest}`)];
  return { ...suggestion, names: [name, ...aliases].map((item) => fold(item).replace(/ /g, "")), full, words: [...new Set(full.join(" ").split(" "))], weight };
}

let index: Entry[] | null = null;

// Built on the first request, then kept for the life of the server instance.
function entries() {
  if (index) return index;
  const list: Entry[] = [];

  const usByState = Map.groupBy(superchargers, (station) => station.state);
  for (const [code, name] of Object.entries(US_STATES)) {
    const stations = usByState.get(code);
    if (!stations?.length) continue;
    list.push(entry({ kind: "state", label: name, detail: `State · ${plural(stations.length, "Supercharger")}`, country: null, position: cityCenter({ stations }) }, name, 1_000_000 + stations.length));
  }
  for (const country of countries) {
    list.push(entry({ kind: "country", label: country.name, detail: `Country · ${plural(country.count, "Supercharger")}`, country: country.slug }, country.name, 900_000 + country.count));
  }
  for (const city of [...allCities(), ...allWorldCities()]) {
    const world = getCountry(city.state);
    list.push(
      entry(
        { kind: "city", label: city.label, detail: plural(city.stations.length, "Supercharger"), country: world ? world.slug : null, position: cityCenter(city) },
        city.name,
        100_000 + city.stations.length * 1_000 + city.stalls,
        [ENGLISH_NAMES[city.name], ...(NICKNAMES[`${city.state}/${city.city}`] ?? [])].filter((alias): alias is string => Boolean(alias)),
      ),
    );
  }
  for (const town of allTowns()) {
    const near = town.within
      ? `${plural(town.within, "Supercharger")} nearby`
      : `nearest Supercharger ${Math.round(town.unit === "km" ? town.nearest[0].miles * 1.609344 : town.nearest[0].miles)} ${town.unit === "km" ? "km" : "mi"}`;
    list.push(entry({ kind: "town", label: town.label, detail: `Town · ${near}`, country: town.world ? town.state : null, position: [town.lat, town.lon] }, town.name, town.population / 10));
  }
  for (const station of [...superchargers, ...worldStations]) {
    const world = getCountry(station.state);
    const detail = [station.stalls ? `${station.stalls} stalls` : null, station.maxKw ? `up to ${station.maxKw} kW` : null].filter(Boolean).join(" · ");
    list.push(entry({ kind: "station", label: station.name, detail: `Supercharger${detail ? ` · ${detail}` : ""}`, country: world ? world.slug : null, slug: station.slug }, station.street ?? station.name, 1 + (station.stalls ?? 0)));
  }
  index = list;
  return list;
}

/** Optimal string alignment distance (Levenshtein plus swapped neighbors), stopping past `max`. */
function editDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous2: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], previous2[j - 2] + 1);
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    previous2 = previous;
    previous = row;
  }
  return previous[b.length];
}

const allowedTypos = (length: number) => (length >= 8 ? 2 : length >= MIN_FUZZY_LENGTH ? 1 : 0);

// 0: a label starts with what was typed. 1: every typed word starts a word of the label.
// 2: a place name with a typo or two (2 + typos/10), also across words ("san fransisco").
// Null: no match.
function rank(item: Entry, query: string, tokens: string[]) {
  if (item.full.some((label) => label.startsWith(query))) return 0;
  if (tokens.every((token) => item.words.some((word) => word.startsWith(token)))) return 1;
  if (item.kind === "station") return null;
  // The first k typed words are the (misspelled) name; the rest ("va") must start a label word.
  let best = Infinity;
  for (let k = tokens.length; k >= 1; k--) {
    const head = tokens.slice(0, k).join("");
    const typos = allowedTypos(head.length);
    if (!typos) break;
    if (!tokens.slice(k).every((token) => item.words.some((word) => word.startsWith(token)))) continue;
    for (const name of item.names) {
      // The whole name, or its start while the visitor is still typing.
      const start = name.slice(0, head.length);
      const distance = Math.min(editDistance(head, name, typos), editDistance(head, start, typos), editDistance(head, name.slice(0, head.length + 1), typos));
      if (distance <= typos) best = Math.min(best, distance);
    }
  }
  return best === Infinity ? null : 2 + best / 10;
}

// Every place and station matching what was typed, best first.
function ranked(text: string, country: string | null) {
  const query = fold(text);
  if (query.length < 2 || query.length > 80) return [];
  const tokens = query.split(" ");
  const matches: { item: Entry; score: number }[] = [];
  for (const item of entries()) {
    // Stations only match by their street or name words once a few letters are typed.
    if (item.kind === "station" && query.length < 3) continue;
    const score = rank(item, query, tokens);
    if (score !== null) matches.push({ item, score });
  }
  const weight = (item: Entry) => item.weight * (item.country === country ? 1 : AWAY);
  return matches.sort((a, b) => Math.floor(a.score) - Math.floor(b.score) || a.score - b.score || weight(b.item) - weight(a.item));
}

/** Up to six suggestions for what was typed. `country` (a slug) puts that country's places first. */
export function suggest(text: string, country: string | null = null): Suggestion[] {
  const matches = ranked(text, country);
  const seen = new Set<string>();
  const result: Suggestion[] = [];
  let stations = 0;
  for (const { item } of matches) {
    const key = `${item.kind === "station" ? "s" : "p"}|${item.full[0]}|${item.country ?? ""}`;
    if (seen.has(key) || (item.kind === "station" && stations === MAX_STATIONS)) continue;
    seen.add(key);
    if (item.kind === "station") stations++;
    const { kind, label, detail, country: itemCountry, position, slug } = item;
    result.push(position ? { kind, label, detail, country: itemCountry, position } : { kind, label, detail, country: itemCountry, slug });
    if (result.length === LIMIT) break;
  }
  return result;
}

/** A place whose label is exactly what was typed ("Dale City, VA"), so it needs no geocoder. */
export function exactPlace(text: string, country: string | null) {
  const query = fold(text);
  if (!query) return null;
  const match = entries().find((item) => item.kind !== "station" && item.kind !== "country" && item.position && item.full[0] === query && item.country === country);
  return match?.position ? { label: match.label, position: match.position } : null;
}

/** A place to show instead when what was typed is a misspelled place name ("woodbrige" →
 * Woodbridge, VA): only when no place starts with or contains the typed words. */
export function correction(text: string, country: string | null) {
  if (/\d/.test(text)) return null; // addresses and ZIP codes are the geocoder's job
  const best = ranked(text, country).find(({ item }) => item.kind !== "station");
  if (!best || best.score < 2 || !best.item.position) return null;
  return { label: best.item.label, position: best.item.position };
}
