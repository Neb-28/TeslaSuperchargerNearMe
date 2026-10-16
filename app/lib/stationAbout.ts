// "About this Supercharger": a few sentences written from each station's own data (stalls, power,
// what's within walking distance, the nearest other Supercharger), so every station page has
// text of its own instead of only lists. Every fact comes from the snapshots; nothing is guessed.
import type { CategoryId, Place } from "./places";

// A sentence is plain text and links (to other station and city pages).
export type AboutSegment = string | { text: string; href: string };
export type AboutParagraph = AboutSegment[];

export type AboutStation = {
  id: string;
  street: string | null;
  cityLabel: string | null;
  nearLabel: string | null;
  stalls: number | null;
  maxKw: number | null;
  ccs: boolean;
  plug?: string | null;
};

export type AboutInput = {
  station: AboutStation;
  places: Record<CategoryId, Place[]>;
  nearest: { name: string; href: string; miles: number } | null;
  city: { name: string; href: string; count: number } | null;
  // Kilometers outside the US and UK, like the Nearby list.
  metric: boolean;
  // US stations: a CCS connector means a Magic Dock, so other EVs can charge.
  isUs: boolean;
};

// Places are within 600 m (80 m a minute, so an 8-minute walk). Lists hold up to 30 per category
// but OSM's older lists stop at 10, so 10 or more is told as "10 or more", not an exact count.
const WALK_LIMIT_MIN = 8;
const PER_CATEGORY = 10;

// The same station always gets the same wording; neighbouring stations usually differ.
function variant(id: string, salt: string, count: number) {
  let hash = 0;
  for (const char of id + salt) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % count;
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count >= PER_CATEGORY ? `${PER_CATEGORY} or more` : count === 1 ? "one" : count} ${count === 1 ? one : many}`;
}

function minutes(walkMin: number) {
  return `${walkMin}-minute walk`;
}

function list(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function distance(miles: number, metric: boolean) {
  if (metric) {
    const km = miles * 1.609344;
    return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
  }
  return miles < 10 ? `${miles.toFixed(1)} miles` : `${Math.round(miles)} miles`;
}

// Nearest first, one entry per name (chains often have two branches in range).
function distinctNames(places: Place[], limit: number) {
  return [...new Set(places.map((place) => place.name))].slice(0, limit);
}

function where(station: AboutStation) {
  const { street, cityLabel, nearLabel } = station;
  const at = street ? (/^near /i.test(street) ? street : `at ${street}`) : null;
  if (at && cityLabel) {
    // "No. 5676 Cao'an Road, Jiading District, Shanghai" already ends with the city: add only
    // the region or country after it, not "in Shanghai, China" again.
    const [cityName, ...region] = cityLabel.split(", ");
    const repeatsCity = street!.split(",").at(-1)!.trim().toLowerCase() === cityName.toLowerCase();
    if (repeatsCity) return region.length ? `${at}, ${region.join(", ")}` : at;
    return `${at} in ${cityLabel}`;
  }
  if (at && nearLabel) return `${at}, near ${nearLabel}`;
  if (cityLabel) return `in ${cityLabel}`;
  if (nearLabel) return `near ${nearLabel}`;
  return at;
}

function chargingParagraph(station: AboutStation, isUs: boolean): AboutParagraph {
  const { stalls, maxKw } = station;
  const place = where(station);
  const subject = place ? `This Tesla Supercharger ${place}` : "This Tesla Supercharger";
  const plug = station.plug ?? (isUs ? "NACS" : null);
  const connector = plug ? ` through ${plug === "NACS" ? "the NACS (Tesla) connector" : `${plug} connectors`}` : "";

  let first: string;
  if (stalls && maxKw) first = `${subject} has ${stalls} ${stalls === 1 ? "stall" : "stalls"} that charge at up to ${maxKw} kW${connector}.`;
  else if (stalls) first = `${subject} has ${stalls} ${stalls === 1 ? "stall" : "stalls"}${connector}.`;
  else if (maxKw) first = `${subject} charges at up to ${maxKw} kW${connector}.`;
  else return [`${subject} is listed in OpenStreetMap, but its stall count and charging speed aren't recorded yet.`];

  const sentences = [first];
  if (maxKw && maxKw >= 250) {
    sentences.push(
      [
        "Most drivers add the range they need in about 20 to 40 minutes.",
        "A typical stop to top up takes about 20 to 40 minutes.",
      ][variant(station.id, "speed", 2)],
    );
  } else if (maxKw && maxKw >= 120) {
    sentences.push(`Charging tops out at ${maxKw} kW here, below the 250 kW of newer Superchargers, so stops can run a little longer.`);
  } else if (maxKw) {
    sentences.push("That's slower than most Superchargers, so plan for a longer stop.");
  }
  if (isUs && station.ccs) sentences.push("It has Magic Dock adapters, so non-Tesla EVs with a CCS port can charge here too.");
  if (!stalls) sentences.push("OpenStreetMap doesn't list how many stalls it has yet.");
  return [sentences.join(" ")];
}

function walkingParagraph(station: AboutStation, places: Record<CategoryId, Place[]>): AboutParagraph {
  const { food, coffee, grocery, shops, bars } = places;
  const sentences: string[] = [];

  if (food.length) {
    const names = distinctNames(food, 3);
    const closest = food[0];
    if (food.length === 1) {
      sentences.push(`There's one place to eat within an ${WALK_LIMIT_MIN}-minute walk: ${closest.name} (${closest.kind.toLowerCase()}), a ${minutes(closest.walkMin)} from the stalls.`);
    } else if (names.length === food.length) {
      sentences.push(`There are ${food.length} places to eat within an ${WALK_LIMIT_MIN}-minute walk of the stalls: ${list(names)}.`);
      sentences.push(`The closest is ${closest.name} (${closest.kind.toLowerCase()}), a ${minutes(closest.walkMin)} away.`);
    } else {
      sentences.push(
        [
          `While you charge, you can walk to ${plural(food.length, "place")} to eat within about ${WALK_LIMIT_MIN} minutes, including ${list(names)}.`,
          `There are ${plural(food.length, "place")} to eat within an ${WALK_LIMIT_MIN}-minute walk of the stalls, such as ${list(names)}.`,
        ][variant(station.id, "food", 2)],
      );
      sentences.push(`The closest is ${closest.name} (${closest.kind.toLowerCase()}), a ${minutes(closest.walkMin)} away.`);
    }
  }

  if (coffee.length) {
    const [cafe] = coffee;
    const others = coffee.length > 1 ? `, one of ${plural(coffee.length, "café")} nearby` : "";
    sentences.push(`For coffee, ${cafe.name} is a ${minutes(cafe.walkMin)} away${others}.`);
  }

  if (grocery.length) {
    const [store] = grocery;
    sentences.push(`${store.name} (${store.kind.toLowerCase()}) is a ${minutes(store.walkMin)} away if you need snacks or drinks.`);
  }

  const extras = [shops.length ? plural(shops.length, "shop") : null, bars.length ? plural(bars.length, "bar or pub", "bars and pubs") : null].filter(Boolean);
  if (extras.length) sentences.push(`${sentences.length ? "You'll also find" : "Within a short walk you'll find"} ${list(extras as string[])} nearby.`);

  if (!sentences.length) {
    return [
      `We haven't found any restaurants, cafés or shops within an ${WALK_LIMIT_MIN}-minute walk in OpenStreetMap, so it's worth bringing snacks and drinks for the stop.`,
    ];
  }
  return [sentences.join(" ")];
}

function areaParagraph({ nearest, city, places, metric }: AboutInput): AboutParagraph | null {
  const segments: AboutSegment[] = [];

  if (nearest) {
    segments.push("The nearest other Supercharger is ", { text: nearest.name, href: nearest.href }, `, about ${distance(nearest.miles, metric)} away in a straight line.`);
  }

  const chargers = places.chargers;
  if (chargers.length) {
    const fast = chargers.filter((charger) => /dc fast/i.test(charger.kind)).length;
    const fastNote = !fast ? "" : chargers.length === 1 ? " (a DC fast charger)" : fast === 1 ? ", one of them a DC fast charger" : `, ${fast >= PER_CATEGORY ? "10 or more" : fast} of them DC fast chargers`;
    const count = chargers.length === 1 ? "one other EV charging station" : `${plural(chargers.length, "other EV charging station")}`;
    segments.push(`${segments.length ? " " : ""}There ${chargers.length === 1 ? "is" : "are"} also ${count} within about ${metric ? "1.5 km" : "a mile"}${fastNote}.`);
  }

  if (city && city.count > 1) {
    segments.push(`${segments.length ? " " : ""}See `, { text: `${city.count === 2 ? "both" : `all ${city.count}`} Superchargers in ${city.name}`, href: city.href }, ".");
  }

  return segments.length ? segments : null;
}

export function stationAbout(input: AboutInput): AboutParagraph[] {
  const area = areaParagraph(input);
  const paragraphs = [chargingParagraph(input.station, input.isUs), walkingParagraph(input.station, input.places), ...(area ? [area] : [])];
  // OSM addresses sometimes carry stray spaces ("9  Minzhi Road").
  const tidy = (value: string) => value.replace(/\s{2,}/g, " ");
  return paragraphs.map((paragraph) => paragraph.map((segment) => (typeof segment === "string" ? tidy(segment) : { ...segment, text: tidy(segment.text) })));
}

