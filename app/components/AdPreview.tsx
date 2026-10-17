"use client";

import { useEffect, useRef } from "react";
import { SPONSOR_SLOTS, type SponsorSlot } from "@/lib/featured";
import { orderListings } from "@/lib/listingOrder";
import type { PublicFeatured, PublicListing } from "@/lib/nearby";
import { CATEGORIES, type CategoryId, type Place } from "@/lib/places";
import { PREVIEW_EXAMPLES } from "@/lib/previewExamples";
import { directionsUrl, FeaturedCard, featuredDestination, PlaceRow, SponsoredCard } from "./NearbySection";

export type AdDraft = { businessName: string; kind: string; offerText: string; ctaLabel: string; ctaUrl: string; address: string };

type AdPreviewProps = {
  draft: AdDraft;
  category: CategoryId;
  slot: SponsorSlot;
  stationName: string;
  stationLat: number;
  stationLon: number;
  metric: boolean;
  // The station's free places in this category, and the paid listings already live there.
  places: Place[];
  liveSponsors: PublicFeatured[];
};

// How many free places to show under the paid ones; enough to show the ad sits above them.
const FREE_SHOWN = 4;

// A live preview of the business's listing on the station page, built from the same cards and the
// same order rule as the real Nearby list. Purely visual: hidden from screen readers and not focusable.
export default function AdPreview({ draft, category, slot, stationName, stationLat, stationLon, metric, places, liveSponsors }: AdPreviewProps) {
  const screenRef = useRef<HTMLDivElement>(null);
  const yoursRef = useRef<HTMLLIElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Desktop's phone has a fixed height: scroll its screen just enough to show all of their listing
  // below the pinned header (its top stays in view if it's taller than the screen). On phones the
  // preview is as tall as its content, so this leaves it at the top.
  useEffect(() => {
    const screen = screenRef.current;
    const card = yoursRef.current;
    if (!screen || !card) return;
    // Measured on screen, since the phone's content is drawn smaller (CSS zoom).
    const box = card.getBoundingClientRect();
    const top = box.top - screen.getBoundingClientRect().top + screen.scrollTop;
    const bottom = top + box.height;
    const margin = 16;
    const header = barRef.current?.getBoundingClientRect().height ?? 0;
    screen.scrollTo({ top: Math.max(0, Math.min(top - header - margin, bottom + margin - screen.clientHeight)) });
  });

  const driving = category === "chargers";
  const match = places.find((place) => place.name.trim().toLowerCase() === draft.businessName.trim().toLowerCase());
  const yours: PublicFeatured = {
    id: "preview",
    slot,
    businessName: draft.businessName.trim() || "Your business",
    kind: draft.kind.trim() || "Type of business",
    offerText: draft.offerText.trim() || "Your offer for EV drivers",
    // Until they type a label, the button reads like the #1 example for this category ("See menu"...).
    ctaLabel: draft.ctaLabel.trim() || PREVIEW_EXAMPLES[category][1].ctaLabel,
    ctaUrl: "#",
    address: draft.address.trim() || null,
    distanceM: match?.distanceM ?? null,
    lat: match?.lat ?? null,
    lon: match?.lon ?? null,
  };
  // The full lineup, like a station with all three spots sold: theirs in the spot they picked (in
  // place of the current holder when every spot is taken), real businesses in the spots they hold,
  // and made-up examples a short walk away in the rest.
  const paid = SPONSOR_SLOTS.map((spot): PublicFeatured => {
    if (spot === slot) return yours;
    const holder = liveSponsors.find((listing) => listing.slot === spot);
    if (holder) return holder;
    const example = PREVIEW_EXAMPLES[category][spot];
    return { ...example, id: `example-${spot}`, slot: spot, ctaUrl: "#", address: null, distanceM: 60, lat: stationLat, lon: stationLon };
  }).map((listing) => ({ ...listing, status: "live" as const }));
  const listings: PublicListing[] = orderListings(places, paid);
  const lastPaid = listings.filter((listing) => listing.type === "featured").length;
  const shown = listings.slice(0, lastPaid + FREE_SHOWN);

  const station = { lat: stationLat, lon: stationLon };
  const directions = (lat: number, lon: number) => directionsUrl(station, `${lat},${lon}`, driving);
  // Their listing always shows Directions: on the station page it leads to the place on our nearby
  // list, or to the street address they give (which the form asks for when it isn't on the list).
  const featuredDirections = (featured: PublicFeatured) => {
    const destination = featuredDestination(featured);
    if (destination) return directionsUrl(station, destination, driving);
    return featured.id === "preview" ? "#" : null;
  };

  const nearby = (
    <section className="nearby-card ad-preview-nearby">
      <div>
        <p className="nearby-title">Nearby</p>
        <p className="nearby-sub">{driving ? "Other charging stations within about a mile." : "Everything here is a short walk from the stalls."}</p>
      </div>
      <div className="nearby-chips">
        {CATEGORIES.map((item) => (
          <span key={item.id} className={`category-chip${item.id === category ? " active" : ""}`}>
            {item.label}
          </span>
        ))}
      </div>
      <ol className="nearby-list">
        {shown.map((listing) => {
          const isYours = listing.type === "featured" && listing.featured.id === "preview";
          return (
            <li
              key={listing.type === "featured" ? `f-${listing.featured.id}` : `p-${listing.place.name}-${listing.place.distanceM}`}
              className={isYours ? "ad-preview-yours" : undefined}
              ref={isYours ? yoursRef : undefined}
            >
              {listing.type === "featured" ? (
                listing.featured.slot === 1 ? (
                  <FeaturedCard listing={listing} directionsHref={featuredDirections(listing.featured)} />
                ) : (
                  <SponsoredCard listing={listing} directionsHref={featuredDirections(listing.featured)} />
                )
              ) : (
                <PlaceRow listing={listing} driving={driving} metric={metric} href={directions(listing.place.lat, listing.place.lon)} />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );

  return (
    <div className="ad-preview">
      <p className="ad-preview-caption">Live preview · other sponsored spots show examples</p>
      <div className="ad-preview-phone" aria-hidden="true" inert>
        <div className="ad-preview-screen" ref={screenRef}>
          <div className="ad-preview-content">
            <div className="ad-preview-bar" ref={barRef}>
              <span className="brand-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
                </svg>
              </span>
              <span className="ad-preview-brand">Tesla Supercharger Near Me</span>
            </div>
            <div className="ad-preview-body">
              <p className="ad-preview-station">{stationName}</p>
              {nearby}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
