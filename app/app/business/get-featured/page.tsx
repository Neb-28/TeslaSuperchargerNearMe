import type { Metadata } from "next";
import Link from "next/link";
import GetFeaturedForm from "@/components/GetFeaturedForm";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import type { SponsorSlot } from "@/lib/featured";
import { liveFeaturedForStation } from "@/lib/featuredStore";
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
  // Spots already held by a live business, per category, so the form can show them as taken.
  const live = await liveFeaturedForStation(station.id);
  const takenSlots = Object.fromEntries(
    CATEGORIES.map(({ id }) => [id, live.filter((listing) => listing.category === id).map((listing) => listing.slot)]),
  ) as Record<CategoryId, SponsorSlot[]>;
  const suggestions = Object.fromEntries(CATEGORIES.map(({ id }) => [id, places[id].map((place) => place.name)])) as Record<CategoryId, string[]>;
  const href = stationHref(station);

  return (
    <div className="app-shell">
      <SiteHeader backHref={href} />
      <main id="main" className="content-page">
        <h1 className="page-title">Get a sponsored spot at {station.name}</h1>
        <p className="page-sub">
          Drivers spend 20–40 minutes here while they charge. Up to three businesses per category show above every free listing,
          with your offer and a button: the #1 Featured spot first, then #2 and #3 Sponsored.
        </p>
        <GetFeaturedForm
          stationSlug={station.slug}
          stationName={station.name}
          stationHref={href}
          initialCategory={category}
          suggestions={suggestions}
          takenSlots={takenSlots}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
