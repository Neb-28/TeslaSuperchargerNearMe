import type { Metadata } from "next";
import Link from "next/link";
import GetFeaturedForm from "@/components/GetFeaturedForm";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { CATEGORIES, isCategoryId, type CategoryId } from "@/lib/places";
import { placesForStation } from "@/lib/placesData";
import { getStationBySlug, stationHref } from "@/lib/superchargers";

export const metadata: Metadata = {
  title: "Get featured near a Supercharger",
  robots: { index: false, follow: true },
};

export default async function GetFeaturedPage({ searchParams }: PageProps<"/business/get-featured">) {
  const params = await searchParams;
  const station = typeof params.station === "string" ? getStationBySlug(params.station) : null;
  const category: CategoryId = isCategoryId(params.category) ? params.category : "food";

  if (!station) {
    return (
      <div className="app-shell">
        <SiteHeader backHref="/map" />
        <main id="main" className="content-page">
          <h1 className="page-title">Get featured</h1>
          <p className="page-sub">Open the Supercharger near your business and tap Get featured under Nearby.</p>
          <Link href="/map" className="action-button primary">Find the station</Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const places = placesForStation(station.id);
  const suggestions = Object.fromEntries(CATEGORIES.map(({ id }) => [id, places[id].map((place) => place.name)])) as Record<CategoryId, string[]>;
  const href = stationHref(station);

  return (
    <div className="app-shell">
      <SiteHeader backHref={href} />
      <main id="main" className="content-page">
        <h1 className="page-title">Take the #1 spot at {station.name}</h1>
        <p className="page-sub">
          Drivers spend 20–40 minutes here while they charge. Your business shows first in its category, with your offer and a button.
        </p>
        <GetFeaturedForm stationSlug={station.slug} stationName={station.name} stationHref={href} initialCategory={category} suggestions={suggestions} />
      </main>
      <SiteFooter />
    </div>
  );
}
