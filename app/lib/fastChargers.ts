// Server-only: other networks' DC fast chargers in the US and Canada (data/fast-chargers.json,
// from scripts/import-fast-chargers.mjs), used by the route planner where Superchargers can't reach
// and listed on city and town pages.
import data from "@/data/fast-chargers.json";
import type { RouteStation } from "./routePlanner";
import { milesBetween, type LatLng } from "./stations";

const CCS = 1;
const NACS = 2;

type Row = [id: number, name: string, network: string, lat: number, lon: number, ports: number | null, maxKw: number | null, connectors: number, label: string | null];

// How networks are written in the source data → how drivers know them.
const NETWORK_NAMES: Record<string, string> = {
  "ChargePoint Network": "ChargePoint",
  "eVgo Network": "EVgo",
  "Blink Network": "Blink",
  "Non-Networked": "Independent charger",
  RED_E: "Red E",
  FORD_CHARGE: "Ford Charge",
  BCHYDRO: "BC Hydro",
  RIVIAN_ADVENTURE: "Rivian Adventure Network",
  SHELL_RECHARGE: "Shell Recharge",
  CHARGELAB: "ChargeLab",
  WALMART: "Walmart",
  FPLEV: "FPL EVolution",
  VIALYNK: "Vialynk",
  EVGATEWAY: "EVgateway",
  BP_PULSE: "bp pulse",
  MERCEDES_BENZ: "Mercedes-Benz Charging",
  CHARGESMART_EV: "ChargeSmart EV",
  UNIVERSAL: "Universal EV Chargers",
  APPLEGREEN: "Applegreen Electric",
  ZEFNET: "ZEF Energy",
  NOODOE: "Noodoe",
  SYNERGEV: "SynergEV",
  EVOLV_CHARGING: "Evolv Charging",
  "7CHARGE": "7Charge",
  IN_CHARGE: "In-Charge",
  COUCHE_TARD: "Couche-Tard",
  CIRCLE_K: "Circle K",
  QUICKCHARGE: "QuickCharge",
  EVRANGE: "EVRange",
  NAYAX_ENERGY: "Nayax Energy",
  ON_THE_RUN_EV: "On the Run EV",
  ELECTRIC_ERA: "Electric Era",
  KWIK_CHARGE: "Kwik Charge",
  RACETRAC: "RaceTrac",
};

// Rare networks not listed above: "DIRT_ROAD" → "Dirt Road"; short codes like "FCN" stay as they are.
export function networkName(raw: string) {
  return (
    NETWORK_NAMES[raw] ??
    raw
      .split("_")
      .map((word) => (word.length > 3 && word === word.toUpperCase() ? word[0] + word.slice(1).toLowerCase() : word))
      .join(" ")
  );
}

const rows = (data as unknown as { stations: Row[] }).stations;

const toRouteStation = ([id, name, network, lat, lon, ports, maxKw, , label]: Row): RouteStation => ({
  id: `afdc-${id}`,
  name,
  // No station page of ours: link straight to directions.
  href: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
  network: networkName(network),
  label,
  lat,
  lon,
  stalls: ports,
  maxKw,
});

const withCcs = rows.filter((row) => row[7] & CCS).map(toRouteStation);
const withNacs = rows.filter((row) => row[7] & NACS).map(toRouteStation);
const everyCharger = rows.map(toRouteStation);

// Chargers a car can plug into: CCS plugs need a CCS port (or a NACS car's CCS adapter); NACS
// plugs need a NACS port (or a CCS car's NACS adapter).
export function otherChargersFor(plug: "nacs" | "ccs-adapter" | "ccs", ccsAdapter: boolean) {
  if (plug === "ccs") return withCcs;
  if (plug === "ccs-adapter") return everyCharger;
  return ccsAdapter ? everyCharger : withNacs;
}

export const NEARBY_CHARGER_MILES = 10;

export type NearbyCharger = RouteStation & { plugs: string; miles: number };

const plugNames = (connectors: number) => [connectors & CCS ? "CCS" : null, connectors & NACS ? "NACS" : null].filter(Boolean).join(" and ");

// Some Canadian rows are named after Tesla sites ("Tesla - 12511 - Jasper AB"); our Supercharger
// list already covers those.
const listable = rows.filter((row) => !/tesla/i.test(row[1]));

/** Other networks' fast chargers within 10 miles of a point, nearest first. */
export function fastChargersNear(point: LatLng, limit = 8): NearbyCharger[] {
  const near: NearbyCharger[] = [];
  for (const row of listable) {
    // A degree of latitude is about 69 miles; skip far chargers before the exact distance.
    if (Math.abs(row[3] - point[0]) > NEARBY_CHARGER_MILES / 69) continue;
    const miles = milesBetween(point, [row[3], row[4]]);
    if (miles <= NEARBY_CHARGER_MILES) near.push({ ...toRouteStation(row), plugs: plugNames(row[7]), miles });
  }
  return near.sort((a, b) => a.miles - b.miles).slice(0, limit);
}
