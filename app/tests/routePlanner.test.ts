import { describe, expect, it } from "vitest";
import { chargeMinutes, planTrip, stationsAlongRoute, type RouteStation } from "@/lib/routePlanner";
import type { LatLng } from "@/lib/stations";
import { KM_PER_MILE } from "@/lib/vehicles";

// A straight east-west road along the equator: 1° of longitude ≈ 111.2 km.
const KM_PER_DEG = 111.195;
const road = (km: number): LatLng[] => Array.from({ length: Math.ceil(km) + 1 }, (_, i) => [0, Math.min(i, km) / KM_PER_DEG]);
const station = (id: string, atKm: number, offKm = 0, maxKw = 250): RouteStation => ({
  id,
  name: `Station ${id}`,
  href: `/supercharger/x/y/${id}`,
  network: null,
  label: null,
  lat: offKm / KM_PER_DEG,
  lon: atKm / KM_PER_DEG,
  stalls: 8,
  maxKw,
});

// Another network's fast charger (Electrify America, EVgo…).
const other = (id: string, atKm: number, maxKw = 350): RouteStation => ({ ...station(id, atKm, 0, maxKw), network: "Electrify America" });

describe("stationsAlongRoute", () => {
  it("finds stations near the road with their distance along it", () => {
    const found = stationsAlongRoute(road(300), 300, [station("a", 100, 2), station("far", 150, 30)]);
    expect(found.map((item) => item.station.id)).toEqual(["a"]);
    expect(found[0].atKm).toBeCloseTo(100, 0);
    expect(found[0].detourKm).toBeCloseTo(2, 0);
  });
});

describe("planTrip", () => {
  // A 400 km car leaving with 80%: 280 km before hitting the 10% reserve; the 10–15% band is 260–280 km.
  const trip = (km: number, stations: RouteStation[]) => planTrip({ path: road(km), totalKm: km, stations, rangeKm: 400 });

  it("a 350-mile car first stops after 227–245 miles (80% down to 15–10%)", () => {
    const miles = 600;
    const everyTenMiles = Array.from({ length: 60 }, (_, i) => station(`m${i * 10}`, i * 10 * KM_PER_MILE));
    const plan = planTrip({ path: road(miles * KM_PER_MILE), totalKm: miles * KM_PER_MILE, stations: everyTenMiles, rangeKm: 350 * KM_PER_MILE });
    const firstStopMi = plan.stops[0].atKm / KM_PER_MILE;
    expect(firstStopMi).toBeGreaterThanOrEqual(227.5);
    expect(firstStopMi).toBeLessThanOrEqual(245);
    for (const stop of plan.stops) expect(stop.arrivePct).toBeLessThanOrEqual(15);
  });

  it("needs no stop when the charge covers the trip", () => {
    const plan = trip(200, [station("a", 100)]);
    expect(plan.stops).toEqual([]);
    expect(plan.arrivePct).toBe(30); // leaves with 80%, uses 50%
    expect(plan.stuckAtKm).toBeNull();
  });

  it("stops when the battery is down to 10–15%", () => {
    const stations = [100, 200, 265, 275, 450, 520, 540, 700].map((km) => station(`s${km}`, km));
    const plan = trip(800, stations);
    expect(plan.stops.map((stop) => stop.station.id)).toEqual(["s275", "s540"]);
    for (const stop of plan.stops) {
      expect(stop.arrivePct).toBeGreaterThanOrEqual(10);
      expect(stop.arrivePct).toBeLessThanOrEqual(15);
    }
    expect(plan.arrivePct).toBe(15);
  });

  it("prefers a faster charger within the 10–15% band", () => {
    const plan = trip(500, [station("slow", 275, 0, 72), station("fast", 262, 0, 250)]);
    expect(plan.stops[0].station.id).toBe("fast");
  });

  it("stops earlier when no station is in the band", () => {
    const plan = trip(500, [station("a", 100), station("b", 200)]);
    expect(plan.stops.map((stop) => stop.station.id)).toEqual(["b"]);
    expect(plan.stops[0].arrivePct).toBe(30);
  });

  it("counts the detour to a station off the route", () => {
    const plan = trip(500, [station("off", 268, 4)]);
    expect(plan.stops[0].arrivePct).toBe(12); // 80% − (268 + 4 km) / 400 km
  });

  it("charges only what the last stretch needs", () => {
    const plan = trip(470, [station("a", 270)]);
    expect(plan.stops[0].departPct).toBe(65); // 200 km = 50% + 10% reserve + 5% cushion
    expect(plan.arrivePct).toBe(15);
  });

  it("goes a little past 80% to save a whole stop", () => {
    // From s270 the destination needs 85% (280 km = 70% + 10% reserve + 5% cushion): one stop, not two.
    const plan = trip(550, [270, 450].map((km) => station(`s${km}`, km)));
    expect(plan.stops.map((stop) => stop.station.id)).toEqual(["s270"]);
    expect(plan.stops[0].departPct).toBe(85);
  });

  it("charges past 80% before a long gap instead of stopping early again and again", () => {
    // Stations close together, then nothing for 325 km. s40 is just down the road from s45.
    const plan = trip(600, [6, 22, 40, 45, 370].map((km) => station(`s${km}`, km)));
    expect(plan.stops.map((stop) => stop.station.id)).toEqual(["s45", "s370"]);
    expect(plan.stops[0].departPct).toBe(92); // 325 km = 81.25% + 10% reserve, rounded up
    expect(plan.arrivePct).toBeGreaterThanOrEqual(10);
  });

  it("doesn't top up a full battery just down the road", () => {
    const plan = trip(1200, [275, 290].map((km) => station(`s${km}`, km)));
    expect(plan.stops.map((stop) => stop.station.id)).toEqual(["s275"]);
    expect(plan.stuckAtKm).toBeCloseTo(275 + 360, 0);
  });

  it("uses Superchargers whenever they can make the trip, even when another network is faster", () => {
    const stations = [station("t270", 270), other("o275", 275), station("t540", 540), other("o545", 545)];
    const plan = trip(800, stations);
    expect(plan.stops.map((stop) => stop.station.id)).toEqual(["t270", "t540"]);
  });

  it("uses another network only where Superchargers can't bridge the gap", () => {
    // From t270 even a full battery (360 km) can't reach t700; o450 bridges the gap.
    const plan = trip(900, [station("t270", 270), other("o450", 450), station("t700", 700)]);
    expect(plan.stops.map((stop) => stop.station.id)).toEqual(["t270", "o450", "t700"]);
    expect(plan.stops[1].station.network).toBe("Electrify America");
    expect(plan.arrivePct).toBeGreaterThanOrEqual(10);
  });

  it("stops at an earlier Supercharger rather than another network when Superchargers can carry on", () => {
    // No Supercharger in the 10–15% band, but t200 → t480 works on Superchargers alone.
    const plan = trip(700, [station("t200", 200), other("o270", 270), station("t480", 480)]);
    expect(plan.stops.map((stop) => stop.station.id)).toEqual(["t200", "t480"]);
  });

  it("doesn't stop at a Supercharger with lots of charge left when another network is in the band", () => {
    // t40 could reach the destination on a 98% charge, but stopping there with 70% left makes no sense.
    const plan = trip(380, [station("t40", 40), other("o270", 270)]);
    expect(plan.stops.map((stop) => stop.station.id)).toEqual(["o270"]);
  });

  it("keeps the Supercharger when another network is only just down the road", () => {
    // Neither gets the car across the gap to t600; o120 is only 20 km past t100.
    const plan = trip(900, [station("t100", 100), other("o120", 120), station("t600", 600)]);
    expect(plan.stops.map((stop) => stop.station.id)).toEqual(["t100"]);
    expect(plan.stuckAtKm).toBeCloseTo(100 + 360, 0);
  });

  it("reports where the car can't reach another station", () => {
    const plan = trip(900, [station("a", 250)]);
    expect(plan.stops.map((stop) => stop.station.id)).toEqual(["a"]);
    expect(plan.stops[0].departPct).toBe(100); // charges full before the gap it can't cross
    expect(plan.arrivePct).toBeNull();
    expect(plan.stuckAtKm).toBeCloseTo(250 + 360, 0);
  });
});

describe("chargeMinutes", () => {
  it("scales with the charge added and the charger speed", () => {
    expect(chargeMinutes(10, 80, 250)).toBe(25);
    expect(chargeMinutes(10, 80, 72)).toBe(45);
    expect(chargeMinutes(45, 80, 250)).toBe(15);
    expect(chargeMinutes(80, 80, 250)).toBe(0);
  });
});
