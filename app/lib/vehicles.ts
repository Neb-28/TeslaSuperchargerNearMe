// The route planner's vehicles: every electric model in the EPA's fueleconomy.gov data with its
// official range (data/ev-models.json, refreshed by scripts/import-ev-models.mjs).
import data from "@/data/ev-models.json";

export type EvModel = { id: number; year: number; make: string; model: string; rangeMi: number };

export const EV_MODELS: EvModel[] = (data.models as [number, number, string, string, number][]).map(([id, year, make, model, rangeMi]) => ({
  id,
  year,
  make,
  model,
  rangeMi,
}));

export const MODEL_YEARS = [...new Set(EV_MODELS.map((item) => item.year))].sort((a, b) => b - a);

export function makesFor(year: number) {
  return [...new Set(EV_MODELS.filter((item) => item.year === year).map((item) => item.make))].sort((a, b) => a.localeCompare(b));
}

export function modelsFor(year: number, make: string) {
  return EV_MODELS.filter((item) => item.year === year && item.make === make).sort((a, b) => a.model.localeCompare(b.model) || b.rangeMi - a.rangeMi);
}

export function evModelById(id: number) {
  return EV_MODELS.find((item) => item.id === id) ?? null;
}

// The charging port decides which chargers a car can use. The EPA data doesn't say which port a
// car has, so drivers of non-Tesla cars choose it. Teslas always have NACS.
// - nacs: every Supercharger; other networks' NACS plugs (CCS plugs too with a CCS adapter)
// - ccs-adapter: CCS port plus a NACS adapter: every Supercharger and every CCS charger
// - ccs: CCS only: Superchargers with a CCS connector (Magic Dock) and every CCS charger
export type Plug = "nacs" | "ccs-adapter" | "ccs";

export const PORT_OPTIONS: { id: string; label: string; plug: Plug }[] = [
  { id: "nacs", label: "NACS port (same plug as Tesla)", plug: "nacs" },
  { id: "adapter", label: "CCS port, with a NACS adapter", plug: "ccs-adapter" },
  { id: "ccs", label: "CCS port, no adapter", plug: "ccs" },
];

export const isPlug = (value: unknown): value is Plug => value === "nacs" || value === "ccs-adapter" || value === "ccs";

// ---------- The route planner's car choice ----------

export const OTHER_MAKE = "other";

export type VehicleChoice = {
  year: number | null;
  make: string; // "" until chosen; OTHER_MAKE when the car isn't listed
  modelId: number | null; // EPA id
  port: string; // PORT_OPTIONS id; unused for Teslas
  rangeMi: string;
  ccsAdapter: boolean; // NACS cars carrying a CCS adapter can also use other networks' CCS chargers
};

export const EMPTY_VEHICLE: VehicleChoice = { year: null, make: "", modelId: null, port: "", rangeMi: "", ccsAdapter: false };

// The plug decides which Superchargers the car can use; Teslas always have NACS.
export function plugFor(choice: VehicleChoice): Plug | null {
  if (choice.make === "Tesla") return "nacs";
  return PORT_OPTIONS.find((option) => option.id === choice.port)?.plug ?? null;
}

// A choice restored from a link or this device, checked against the current EPA list.
export function restoreVehicle(saved: Partial<VehicleChoice> & { modelId?: number | null }): VehicleChoice {
  const model = saved.modelId ? evModelById(Number(saved.modelId)) : null;
  const port = PORT_OPTIONS.some((option) => option.id === saved.port) ? String(saved.port) : "";
  const rangeMi = /^\d{2,3}$/.test(String(saved.rangeMi ?? "")) ? String(saved.rangeMi) : "";
  const ccsAdapter = saved.ccsAdapter === true;
  if (model) return { year: model.year, make: model.make, modelId: model.id, port, rangeMi: rangeMi || String(model.rangeMi), ccsAdapter };
  if (saved.make === OTHER_MAKE) return { ...EMPTY_VEHICLE, make: OTHER_MAKE, port, rangeMi, ccsAdapter };
  return EMPTY_VEHICLE;
}

export const RANGE_MIN_MI = 40;
export const RANGE_MAX_MI = 700;
export const KM_PER_MILE = 1.609344;
