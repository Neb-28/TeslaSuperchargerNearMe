import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { cityHref, getCity } from "@/lib/superchargers";
import { allTowns, getTown, NEAR_MILES, townDescription, townsInState, townTitle } from "@/lib/towns";

describe("town pages", () => {
  const towns = allTowns();

  it("never take the URL of a city page", () => {
    for (const town of towns) expect(getCity(town.state, town.slug)).toBeNull();
  });

  it("skip towns whose city page is spelled differently", () => {
    expect(getTown("id", "boise-city")).toBeNull(); // the Census "Boise City" is the Boise page
  });

  it("list the nearest stations, nearest first, with the count within 10 miles in the title", () => {
    const town = getTown("va", "dale-city")!;
    expect(town.label).toBe("Dale City, VA");
    expect(townTitle(town)).toBe(`Tesla Superchargers near Dale City, VA (${town.within} within ${NEAR_MILES} miles)`);
    const miles = town.nearest.map((item) => item.miles);
    expect(miles).toEqual([...miles].sort((a, b) => a - b));
    expect(town.nearest.filter((item) => item.miles <= NEAR_MILES).length).toBe(Math.min(town.within, town.nearest.length));
    expect(townDescription(town)).toContain("Dale City, VA");
  });

  it("give the nearest distance when no station is within 10 miles", () => {
    const far = towns.find((town) => town.within === 0)!;
    expect(townTitle(far)).toMatch(/\(nearest \d+ miles away\)$/);
    expect(far.nearest.length).toBeGreaterThan(0);
  });

  it("have a Census name without the kind of place", () => {
    for (const town of towns) expect(town.name).not.toMatch(/ (CDP|city|town|village|borough|\(balance\))$/);
  });

  it("are listed on their state page and in the sitemap", () => {
    expect(townsInState("va").some((town) => town.slug === "lake-ridge")).toBe(true);
    const urls = new Set(sitemap().map((entry) => entry.url));
    for (const town of towns.slice(0, 50)) expect([...urls].some((url) => url.endsWith(cityHref(town.state, town.slug)))).toBe(true);
  });
});
