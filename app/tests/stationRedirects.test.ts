import { describe, expect, it } from "vitest";
import stationRedirects from "@/data/station-redirects.json";
import { getStationById, getStationBySlug, listName, replacementForSlug, superchargers, worldStations } from "@/lib/superchargers";

const redirects = (stationRedirects as { redirects: Record<string, string> }).redirects;

describe("removed stations", () => {
  it("each point at a station that is still listed", () => {
    for (const [from, to] of Object.entries(redirects)) {
      expect(getStationById(to), `${from} -> ${to}`).not.toBeNull();
    }
  });

  it("are not listed any more", () => {
    for (const from of Object.keys(redirects)) expect(getStationById(from), from).toBeNull();
  });

  it("send an old page address to the station they were redirected to", () => {
    const [from, to] = Object.entries(redirects)[0];
    expect(replacementForSlug(`any-street-${from}`)?.id).toBe(to);
  });
});

describe("station slugs", () => {
  it("find a station whose slug changed by the id at the end", () => {
    const station = superchargers[0];
    expect(getStationBySlug(`old-street-name-${station.id}`)).toBeNull();
    expect(replacementForSlug(`old-street-name-${station.id}`)).toBe(station);
  });

  it("work for stations outside the US too", () => {
    const station = worldStations[0];
    expect(replacementForSlug(`renamed-${station.id}`)).toBe(station);
  });

  it("find nothing for an address without a station id", () => {
    expect(replacementForSlug("does-not-exist")).toBeNull();
    expect(replacementForSlug("street-n999999999999999")).toBeNull();
  });

  it("are unique across the US and the rest of the world", () => {
    const slugs = [...superchargers, ...worldStations].map((station) => station.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("temporarily closed stations", () => {
  it("stay listed, labeled in lists and on the map", () => {
    const closed = [...superchargers, ...worldStations].filter((station) => station.temporarilyClosed);
    expect(closed.length).toBeGreaterThan(0);
    for (const station of closed) expect(listName(station)).toBe(`${station.name} · Temporarily closed`);
  });

  it("leave open stations' names alone", () => {
    const open = superchargers.find((station) => !station.temporarilyClosed)!;
    expect(listName(open)).toBe(open.name);
  });
});
