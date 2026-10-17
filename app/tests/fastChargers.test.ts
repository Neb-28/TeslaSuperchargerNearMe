import { describe, expect, it } from "vitest";
import { fastChargersNear, NEARBY_CHARGER_MILES } from "@/lib/fastChargers";
import { cityCenter, getCity } from "@/lib/superchargers";

describe("other fast chargers on city and town pages", () => {
  const woodbridge = getCity("va", "woodbridge")!;
  const chargers = fastChargersNear(cityCenter(woodbridge));

  it("list chargers within 10 miles, nearest first", () => {
    expect(chargers.length).toBeGreaterThan(0);
    expect(chargers.length).toBeLessThanOrEqual(8);
    const miles = chargers.map((charger) => charger.miles);
    expect(miles).toEqual([...miles].sort((a, b) => a - b));
    expect(Math.max(...miles)).toBeLessThanOrEqual(NEARBY_CHARGER_MILES);
  });

  it("leave out Tesla sites and link to directions", () => {
    for (const charger of chargers) {
      expect(charger.name).not.toMatch(/tesla/i);
      expect(charger.href).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\//);
      expect(charger.plugs).toMatch(/^(CCS|NACS|CCS and NACS)$/);
    }
  });

  it("find nothing far from any charger", () => {
    expect(fastChargersNear([0, -150])).toEqual([]);
  });
});
