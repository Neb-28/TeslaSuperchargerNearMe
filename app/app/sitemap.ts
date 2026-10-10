import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { allCities, cityHref, snapshotDate, stateHref, statesWithStations, stationHref, superchargers } from "@/lib/superchargers";
import { US_STATES } from "@/lib/usStates";

// About 5,300 URLs: home, map, ~52 states, ~2,000 cities and every station page.
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
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.1 },
  ];
}
