import { describe, expect, it } from "vitest";
import type { CategoryId, Place } from "@/lib/places";
import { placesForStation } from "@/lib/placesData";
import { stationAbout, type AboutInput, type AboutParagraph } from "@/lib/stationAbout";
import { isWorldStation, nearestOtherSupercharger, superchargers, worldStations } from "@/lib/superchargers";

const text = (paragraphs: AboutParagraph[]) =>
  paragraphs.map((paragraph) => paragraph.map((segment) => (typeof segment === "string" ? segment : segment.text)).join("")).join("\n");

function place(name: string, category: CategoryId, distanceM: number, kind = "Restaurant"): Place {
  return { name, kind, category, distanceM, walkMin: Math.max(1, Math.round(distanceM / 80)), lat: 0, lon: 0 };
}

const noPlaces = (): Record<CategoryId, Place[]> => ({ food: [], coffee: [], grocery: [], bars: [], shops: [], chargers: [] });

function input(overrides: Partial<AboutInput> = {}, station: Partial<AboutInput["station"]> = {}): AboutInput {
  return {
    station: { id: "n1", street: "100 Main Street", cityLabel: "Austin, TX", nearLabel: null, stalls: 12, maxKw: 250, ccs: false, ...station },
    places: noPlaces(),
    nearest: null,
    city: null,
    metric: false,
    isUs: true,
    ...overrides,
  };
}

describe("station About text", () => {
  it("states the address, stalls, power and connector", () => {
    const about = text(stationAbout(input()));
    expect(about).toContain("This Tesla Supercharger at 100 Main Street in Austin, TX has 12 stalls that charge at up to 250 kW");
    expect(about).toContain("NACS");
  });

  it("says '10 or more' when a category is full, since the import keeps at most 10", () => {
    const places = noPlaces();
    places.food = Array.from({ length: 10 }, (_, index) => place(`Diner ${index}`, "food", 100 + index * 10));
    expect(text(stationAbout(input({ places })))).toContain("10 or more places to eat");
  });

  it("names the closest places, nearest first", () => {
    const places = noPlaces();
    places.food = [place("Taco Stand", "food", 90, "Fast food"), place("Bistro", "food", 300), place("Noodles", "food", 500)];
    places.coffee = [place("Bean", "coffee", 160, "Café")];
    const about = text(stationAbout(input({ places })));
    expect(about).toContain("Taco Stand, Bistro and Noodles");
    expect(about).toContain("The closest is Taco Stand (fast food), a 1-minute walk away.");
    expect(about).toContain("For coffee, Bean is a 2-minute walk away.");
  });

  it("suggests bringing snacks when nothing is within walking distance", () => {
    expect(text(stationAbout(input()))).toContain("bringing snacks and drinks");
  });

  it("links the nearest Supercharger and the city page", () => {
    const paragraphs = stationAbout(
      input({ nearest: { name: "Round Rock, TX", href: "/supercharger/tx/round-rock/x", miles: 14.2 }, city: { name: "Austin", href: "/supercharger/tx/austin", count: 9 } }),
    );
    const links = paragraphs.flat().filter((segment) => typeof segment !== "string");
    expect(links).toEqual([
      { text: "Round Rock, TX", href: "/supercharger/tx/round-rock/x" },
      { text: "all 9 Superchargers in Austin", href: "/supercharger/tx/austin" },
    ]);
    expect(text(paragraphs)).toContain("about 14 miles away");
  });

  it("uses kilometers for metric countries", () => {
    const about = text(stationAbout(input({ metric: true, isUs: false, nearest: { name: "Lyon", href: "/x", miles: 10 } }, { plug: "CCS2" })));
    expect(about).toContain("about 16 km away");
    expect(about).toContain("CCS2 connectors");
  });

  it("mentions Magic Dock only for US stations with a CCS connector", () => {
    expect(text(stationAbout(input({}, { ccs: true })))).toContain("Magic Dock");
    expect(text(stationAbout(input({ isUs: false }, { ccs: true, plug: "CCS2" })))).not.toContain("Magic Dock");
  });

  it("doesn't repeat the city when the street already ends with it", () => {
    expect(text(stationAbout(input({}, { street: "7 Dongping North Road, Chuanshan District, Suining", cityLabel: "Suining, China" })))).toContain(
      "This Tesla Supercharger at 7 Dongping North Road, Chuanshan District, Suining, China has",
    );
    expect(text(stationAbout(input({}, { street: "42170 Big Bear Lake", cityLabel: "Big Bear Lake, CA" })))).toContain(
      "at 42170 Big Bear Lake in Big Bear Lake, CA",
    );
  });

  it("handles 'near' streets and stations without stall or power data", () => {
    expect(text(stationAbout(input({}, { street: "near Jiading Auto City", cityLabel: "Shanghai, China" })))).toContain(
      "This Tesla Supercharger near Jiading Auto City in Shanghai, China",
    );
    expect(text(stationAbout(input({}, { street: null, cityLabel: null, nearLabel: "Chandler, AZ", stalls: null, maxKw: null })))).toContain(
      "near Chandler, AZ is listed in OpenStreetMap, but its stall count and charging speed aren't recorded yet.",
    );
  });

  it("writes clean text for every real station", () => {
    for (const station of [...superchargers, ...worldStations]) {
      const about = text(
        stationAbout({ station, places: placesForStation(station.id), nearest: null, city: null, metric: isWorldStation(station), isUs: !isWorldStation(station) }),
      );
      expect(about, station.id).not.toMatch(/\b(undefined|null|NaN)\b|\bat at\b|\s{2}/);
    }
  });

  it("finds a different station as the nearest Supercharger", () => {
    const station = superchargers[0];
    const nearest = nearestOtherSupercharger(station)!;
    expect(nearest.station.id).not.toBe(station.id);
    expect(nearest.miles).toBeGreaterThan(0);
  });
});
