// Miles in the US and the UK, kilometres everywhere else. Distances are computed in miles
// (milesBetween) and converted only for display.
export type DistanceUnit = "mi" | "km";

const KM_PER_MILE = 1.609344;

/** A state code (two letters, the US) or a country slug ("united-kingdom", "canada"). */
export function unitFor(state: string): DistanceUnit {
  return state.length === 2 || state === "united-kingdom" ? "mi" : "km";
}

/** "Near" on town pages and for other chargers: 10 miles, or 15 km. */
export function nearRadius(unit: DistanceUnit) {
  return unit === "mi" ? { miles: 10, text: "10 miles" } : { miles: 15 / KM_PER_MILE, text: "15 km" };
}

/** "2.6 miles" or "4.2 km"; whole numbers from 10 up; `short` gives "2.6 mi". */
export function distanceText(miles: number, unit: DistanceUnit, short = false) {
  const value = unit === "km" ? miles * KM_PER_MILE : miles;
  const rounded = value < 10 ? value.toFixed(1) : String(Math.round(value));
  return `${rounded} ${unit === "km" ? "km" : short ? "mi" : "miles"}`;
}
