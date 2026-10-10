import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { allCities, allWorldCities, cityHref, countries, snapshotDate, stateHref, statesWithStations, stationHref, superchargers, worldStations } from "@/lib/superchargers";
import { US_STATES } from "@/lib/usStates";

// About 14,000 URLs: home, map, ~52 states, ~2,000 US cities and every US station page, plus
// ~54 countries, ~2,850 cities and ~5,750 stations elsewhere.
// (Google's limit is 50,000 per sitemap; split with generateSitemaps if we ever get close.)
export default function sitemap(): MetadataRoute.Sitemap {
  const updated = snapshotDate ? new Date(snapshotDate) : new Date();

  return [
    { url: absoluteUrl("/"), lastModified: updated, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/map"), lastModified: updated, changeFrequency: "weekly", priority: 0.8 },
    ...statesWithStations()
      .filter(({ state }) => US_STATES[state])
      .map(({ state }) => ({ url: absoluteUrl(stateHref(state)), lastModified: updated, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...allCities().map((city) => ({ url: absoluteUrl(cityHref(city.state, city.city)), lastModified: updated, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...superchargers.map((station) => ({ url: absoluteUrl(stationHref(station)), lastModified: updated, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...countries.map((country) => ({ url: absoluteUrl(stateHref(country.slug)), lastModified: updated, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...allWorldCities().map((city) => ({ url: absoluteUrl(cityHref(city.state, city.city)), lastModified: updated, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...worldStations.map((station) => ({ url: absoluteUrl(stationHref(station)), lastModified: updated, changeFrequency: "weekly" as const, priority: 0.5 })),
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.1 },
  ];
}
