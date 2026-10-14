"use client";

import Link from "next/link";
import { useState } from "react";
import type { NearbyCategory, PublicFeatured, PublicListing } from "@/lib/nearby";
import type { CategoryId } from "@/lib/places";

type NearbySectionProps = {
  stationSlug: string;
  stationLat: number;
  stationLon: number;
  categories: NearbyCategory[];
  // Stations outside the US and UK show metres and kilometres.
  metric?: boolean;
};

// Google Maps directions from the station: walking, or driving to other chargers.
export function directionsUrl(station: { lat: number; lon: number }, destination: string, driving: boolean) {
  return `https://www.google.com/maps/dir/?api=1&origin=${station.lat},${station.lon}&destination=${destination}&travelmode=${driving ? "driving" : "walking"}`;
}

// A paid listing's destination: its map location when it's on our nearby list, otherwise the
// street address the business gave us.
export function featuredDestination(featured: Pick<PublicFeatured, "lat" | "lon" | "address">) {
  if (featured.lat != null && featured.lon != null) return `${featured.lat},${featured.lon}`;
  return featured.address ? encodeURIComponent(featured.address) : null;
}

function formatDistance(meters: number, metric = false) {
  if (metric) return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
  const feet = meters * 3.28084;
  return feet < 1000 ? `${Math.round(feet / 10) * 10} ft` : `${(meters / 1609.34).toFixed(1)} mi`;
}

export default function NearbySection({ stationSlug, stationLat, stationLon, categories, metric = false }: NearbySectionProps) {
  const firstWithPlaces = categories.find((category) => category.listings.length)?.id ?? categories[0].id;
  const [selected, setSelected] = useState<CategoryId>(firstWithPlaces);
  const current = categories.find((category) => category.id === selected)!;
  const driving = selected === "chargers";

  const station = { lat: stationLat, lon: stationLon };
  const directions = (lat: number, lon: number) => directionsUrl(station, `${lat},${lon}`, driving);
  const featuredDirections = ({ featured }: Extract<PublicListing, { type: "featured" }>) => {
    const destination = featuredDestination(featured);
    return destination ? directionsUrl(station, destination, driving) : null;
  };

  return (
    <section className="nearby-card" aria-labelledby="nearby-title">
      <div>
        <h2 id="nearby-title" className="nearby-title">Nearby</h2>
        <p className="nearby-sub">{driving ? "Other charging stations within about a mile." : "Everything here is a short walk from the stalls."}</p>
      </div>

      <div className="nearby-chips" role="group" aria-label="Nearby categories">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`category-chip${category.id === selected ? " active" : ""}`}
            aria-pressed={category.id === selected}
            onClick={() => setSelected(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>

      {selected === "bars" ? (
        <p className="note-box">You&apos;ll be driving after this. Look for food and zero-proof options, or pick up a bottle for home.</p>
      ) : null}

      {current.listings.length === 0 ? (
        <p className="nearby-empty">Nothing in this category within a short walk yet.</p>
      ) : (
        <ol className="nearby-list">
          {current.listings.map((listing) => (
            <li key={listing.type === "featured" ? `f-${listing.featured.id}` : `p-${listing.place.name}-${listing.place.distanceM}`}>
              {listing.type === "featured" ? (
                listing.featured.slot === 1 ? (
                  <FeaturedCard listing={listing} directionsHref={featuredDirections(listing)} />
                ) : (
                  <SponsoredCard listing={listing} directionsHref={featuredDirections(listing)} />
                )
              ) : <PlaceRow listing={listing} driving={driving} metric={metric} href={directions(listing.place.lat, listing.place.lon)} />}
            </li>
          ))}
        </ol>
      )}

      <div className="get-featured-banner">
        <h3 className="banner-title">Own a business near this station?</h3>
        <p className="banner-copy">EV drivers wait here 20–40 minutes, steps from your door. Get a sponsored spot at the top of {current.label}.</p>
        <Link className="banner-button" href={`/business/get-featured?station=${stationSlug}&category=${selected}`}>
          Get featured
        </Link>
      </div>
    </section>
  );
}

export function FeaturedCard({ listing, directionsHref }: { listing: Extract<PublicListing, { type: "featured" }>; directionsHref: string | null }) {
  const { featured } = listing;
  return (
    <article className="featured-card">
      <div className="featured-top">
        <span className="featured-badge">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="m12 2 3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8L12 2z" />
          </svg>
          #1 FEATURED
        </span>
        <span className="featured-tag">Sponsored</span>
      </div>
      <div className="featured-copy">
        <h3>{featured.businessName}</h3>
        <p>{featured.kind}</p>
        {featured.distanceM != null ? <p className="featured-walk">{Math.max(1, Math.round(featured.distanceM / 80))} min walk</p> : null}
      </div>
      <div className="offer-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7A4E00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 12 12 20l-8-8V4h8l8 8z" />
          <circle cx="8.5" cy="8.5" r="1.5" />
        </svg>
        {featured.offerText}
      </div>
      <div className={`featured-actions${directionsHref ? "" : " single"}`}>
        {/* rel="sponsored" tells search engines this is a paid link. */}
        <a className="gold-button" href={featured.ctaUrl} target="_blank" rel="sponsored noopener noreferrer">
          {featured.ctaLabel}
        </a>
        {directionsHref ? (
          <a className="light-button" href={directionsHref} target="_blank" rel="noreferrer">
            Directions
          </a>
        ) : null}
      </div>
    </article>
  );
}

// The #2 and #3 Sponsored spots: smaller than the #1 card, still clearly marked as paid. The #2
// spot shares the #1 card's gold background.
export function SponsoredCard({ listing, directionsHref }: { listing: Extract<PublicListing, { type: "featured" }>; directionsHref: string | null }) {
  const { featured } = listing;
  return (
    <article className={`sponsored-card${featured.slot === 2 ? " is-highlighted" : ""}`}>
      <div className="sponsored-top">
        <span className="sponsored-badge">#{listing.rank} SPONSORED</span>
      </div>
      <h3 className="sponsored-name">{featured.businessName}</h3>
      <p className="sponsored-meta">
        {featured.kind}
        {featured.distanceM != null ? ` · ${Math.max(1, Math.round(featured.distanceM / 80))} min walk` : ""}
      </p>
      <p className="sponsored-offer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 12 12 20l-8-8V4h8l8 8z" />
          <circle cx="8.5" cy="8.5" r="1.5" />
        </svg>
        {featured.offerText}
      </p>
      <div className="sponsored-actions">
        {/* rel="sponsored" tells search engines this is a paid link. */}
        <a className="sponsored-button" href={featured.ctaUrl} target="_blank" rel="sponsored noopener noreferrer">
          {featured.ctaLabel}
        </a>
        {directionsHref ? (
          <a className="sponsored-link" href={directionsHref} target="_blank" rel="noreferrer">
            Directions
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function PlaceRow({ listing, driving, metric, href }: { listing: Extract<PublicListing, { type: "place" }>; driving: boolean; metric: boolean; href: string }) {
  const { place } = listing;
  return (
    <a className="nearby-row" href={href} target="_blank" rel="noreferrer" aria-label={`${place.name}, ${place.kind}, ${formatDistance(place.distanceM, metric)} away. Directions`}>
      <span className="rank-badge" aria-hidden="true">#{listing.rank}</span>
      <span className="nearby-row-copy">
        <span className="nearby-row-name">{place.name}</span>
        <span className="nearby-row-meta">
          {place.kind}
          {driving ? "" : ` · ${place.walkMin} min walk`}
        </span>
      </span>
      <span className="nearby-row-distance">{formatDistance(place.distanceM, metric)}</span>
    </a>
  );
}
