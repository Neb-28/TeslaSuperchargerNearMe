"use client";

import Link from "next/link";
import { useState } from "react";
import type { NearbyCategory, PublicListing } from "@/lib/nearby";
import type { CategoryId } from "@/lib/places";

type NearbySectionProps = {
  stationSlug: string;
  stationLat: number;
  stationLon: number;
  categories: NearbyCategory[];
};

function formatDistance(meters: number) {
  const feet = meters * 3.28084;
  return feet < 1000 ? `${Math.round(feet / 10) * 10} ft` : `${(meters / 1609.34).toFixed(1)} mi`;
}

export default function NearbySection({ stationSlug, stationLat, stationLon, categories }: NearbySectionProps) {
  const firstWithPlaces = categories.find((category) => category.listings.length)?.id ?? categories[0].id;
  const [selected, setSelected] = useState<CategoryId>(firstWithPlaces);
  const current = categories.find((category) => category.id === selected)!;
  const driving = selected === "chargers";

  const directions = (lat: number, lon: number) =>
    `https://www.google.com/maps/dir/?api=1&origin=${stationLat},${stationLon}&destination=${lat},${lon}&travelmode=${driving ? "driving" : "walking"}`;

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
                <FeaturedCard
                  listing={listing}
                  directionsHref={listing.featured.lat != null && listing.featured.lon != null ? directions(listing.featured.lat, listing.featured.lon) : null}
                />
              ) : <PlaceRow listing={listing} driving={driving} href={directions(listing.place.lat, listing.place.lon)} />}
            </li>
          ))}
        </ol>
      )}

      <div className="get-featured-banner">
        <h3 className="banner-title">Own a business near this station?</h3>
        <p className="banner-copy">EV drivers wait here 20–40 minutes, steps from your door. Take the #1 spot in {current.label}.</p>
        <Link className="banner-button" href={`/business/get-featured?station=${stationSlug}&category=${selected}`}>
          Get featured
        </Link>
      </div>
    </section>
  );
}

function FeaturedCard({ listing, directionsHref }: { listing: Extract<PublicListing, { type: "featured" }>; directionsHref: string | null }) {
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

function PlaceRow({ listing, driving, href }: { listing: Extract<PublicListing, { type: "place" }>; driving: boolean; href: string }) {
  const { place } = listing;
  return (
    <a className="nearby-row" href={href} target="_blank" rel="noreferrer" aria-label={`${place.name}, ${place.kind}, ${formatDistance(place.distanceM)} away. Directions`}>
      <span className="rank-badge" aria-hidden="true">#{listing.rank}</span>
      <span className="nearby-row-copy">
        <span className="nearby-row-name">{place.name}</span>
        <span className="nearby-row-meta">
          {place.kind}
          {driving ? "" : ` · ${place.walkMin} min walk`}
        </span>
      </span>
      <span className="nearby-row-distance">{formatDistance(place.distanceM)}</span>
    </a>
  );
}
