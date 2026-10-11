import { describe, expect, it } from "vitest";
import { EMPTY_VEHICLE, EV_MODELS, makesFor, MODEL_YEARS, modelsFor, OTHER_MAKE, plugFor, restoreVehicle } from "@/lib/vehicles";

describe("EV models (EPA fueleconomy.gov)", () => {
  it("has recent years, newest first, with a range for every model", () => {
    expect(MODEL_YEARS[0]).toBeGreaterThanOrEqual(2026);
    expect(MODEL_YEARS).toEqual([...MODEL_YEARS].sort((a, b) => b - a));
    expect(EV_MODELS.every((item) => item.rangeMi > 0)).toBe(true);
  });

  it("narrows by year, then make", () => {
    expect(makesFor(2025)).toContain("Tesla");
    const models = modelsFor(2025, "Tesla");
    expect(models.length).toBeGreaterThan(5);
    expect(models.every((item) => item.year === 2025 && item.make === "Tesla")).toBe(true);
    expect(models.find((item) => item.model === "Model 3 Long Range AWD")?.rangeMi).toBe(346);
  });
});

describe("the car choice", () => {
  const model3 = modelsFor(2025, "Tesla").find((item) => item.model === "Model 3 Long Range AWD")!;
  const ioniq = modelsFor(2025, "Hyundai")[0];

  it("Teslas always use NACS; other cars need a port", () => {
    expect(plugFor(restoreVehicle({ modelId: model3.id }))).toBe("nacs");
    expect(plugFor(restoreVehicle({ modelId: ioniq.id }))).toBeNull();
    expect(plugFor(restoreVehicle({ modelId: ioniq.id, port: "adapter" }))).toBe("ccs-adapter");
    expect(plugFor(restoreVehicle({ modelId: ioniq.id, port: "ccs" }))).toBe("ccs");
  });

  it("restores a saved car with its EPA range, or the driver's own", () => {
    expect(restoreVehicle({ modelId: model3.id })).toMatchObject({ year: 2025, make: "Tesla", rangeMi: "346" });
    expect(restoreVehicle({ modelId: model3.id, rangeMi: "320" }).rangeMi).toBe("320");
  });

  it("keeps cars that aren't listed, and drops anything unknown", () => {
    expect(restoreVehicle({ make: OTHER_MAKE, rangeMi: "250", port: "ccs" })).toMatchObject({ make: OTHER_MAKE, rangeMi: "250", port: "ccs" });
    expect(restoreVehicle({ modelId: 1 })).toEqual(EMPTY_VEHICLE);
    expect(restoreVehicle({ modelId: model3.id, port: "garden-hose" }).port).toBe("");
  });
});
