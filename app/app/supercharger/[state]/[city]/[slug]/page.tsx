import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import AdSlot from "@/components/AdSlot";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import FavoriteButton from "@/components/FavoriteButton";
import NearbySection from "@/components/NearbySection";
import ShareButton from "@/components/ShareButton";
import SiteFooter from "@/components/SiteFooter";
import SideRails from "@/components/SideRails";
import SiteHeader from "@/components/SiteHeader";
import StationPhotos from "@/components/StationPhotos";
import { nearbyForStation } from "@/lib/nearby";
import { placesForStation } from "@/lib/placesData";
import { absoluteUrl } from "@/lib/site";
import { stationAbout } from "@/lib/stationAbout";
import { approvedPhotosForStation, toPublicPhoto } from "@/lib/stationPhotos";
import { areaName, cityHref, getCity, getStationBySlug, isWorldStation, nearestOtherSupercharger, replacementForSlug, stateHref, stationHref, stationTitle } from "@/lib/superchargers";
import { stateName } from "@/lib/usStates";

type StationPageProps = PageProps<"/supercharger/[state]/[city]/[slug]">;

async function loadStation(params: StationPageProps["params"]) {
  const { slug } = await params;
  return getStationBySlug(slug);
}

// Built the first time someone visits, then served from the CDN until the next deploy (the
// station data ships with each deploy). Admin changes to Featured listings and photos refresh station pages.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: StationPageProps): Promise<Metadata> {
  const station = await loadStation(params);
  if (!station) return {};
  return {
    // Street plus city keeps ~3,200 station titles distinct (many stations share a road or city).
    title: stationTitle(station),
    description: `${station.stalls ? `${station.stalls} stalls` : "Tesla Supercharger"}${station.maxKw ? ` up to ${station.maxKw} kW` : ""} at ${station.address ?? station.name}. Directions and places to eat, grab coffee or shop within walking distance while you charge.`,
    alternates: { canonical: stationHref(station) },
  };
}

export default async function StationPage({ params }: StationPageProps) {
  const station = await loadStation(params);
  if (!station) {
    // A station whose slug changed, or one that was removed: send visitors to where it went.
    const replacement = replacementForSlug((await params).slug);
    if (replacement) permanentRedirect(stationHref(replacement));
    notFound();
  }

  // One URL per station: fix a wrong state or city segment with a permanent redirect.
  const { state, city } = await params;
  if (state !== station.state || city !== station.city) permanentRedirect(stationHref(station));

  const { lat, lon } = station;
  const href = stationHref(station);
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
  // Stall labels only; there is no live availability feed yet (PRD: Phase 3 data partner).
  const stallNumbers = Array.from({ length: station.stalls ?? 0 }, (_, index) => index + 1);
  // US stations are NACS; elsewhere the connector comes from the data (CCS2 in Europe, GB/T in China…).
  const plug = station.plug ?? "NACS";
  const power = station.maxKw ? `${station.maxKw} kW ${plug}` : plug;
  const [nearby, photos] = await Promise.all([nearbyForStation(station.id), approvedPhotosForStation(station.id)]);
  const publicPhotos = photos.map(toPublicPhoto);
  const cityInfo = getCity(station.state, station.city);
  const metric = isWorldStation(station) && station.countryCode !== "GB";
  const nearest = nearestOtherSupercharger(station);
  const about = stationAbout({
    station,
    places: placesForStation(station.id),
    nearest: nearest ? { name: nearest.station.name, href: stationHref(nearest.station), miles: nearest.miles } : null,
    city: cityInfo ? { name: cityInfo.name, href: cityHref(cityInfo.state, cityInfo.city), count: cityInfo.stations.length } : null,
    metric,
    isUs: !isWorldStation(station),
  });

  return (
    <div className="app-shell">
      <SideRails layout="station" />
      <SiteHeader backHref="/map" showSearch showMenu={false} />

      <div className="station-layout">
        <section className="station-map-panel" aria-label="Station location map">
          <iframe
            title={`OpenStreetMap showing ${station.name} Supercharger`}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.015}%2C${lat - 0.01}%2C${lon + 0.015}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lon}`}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <Link className="station-map-link" href={`/map?station=${station.slug}`}>
            View larger map
          </Link>
          <p className="station-map-credit">
            &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors
          </p>
        </section>

        <main id="main" className="station-detail-body">
          <section className="station-summary-card">
            {cityInfo ? (
              <Breadcrumbs
                items={[
                  { name: "Home", href: "/" },
                  { name: areaName(station.state, stateName), href: stateHref(station.state) },
                  { name: cityInfo.name, href: cityHref(cityInfo.state, cityInfo.city) },
                  { name: station.street ?? station.name, href },
                ]}
                showCurrent={false}
              />
            ) : null}
            <h1>{station.name}</h1>
            <div className="station-model">Tesla Supercharger</div>
            {station.address ? <div className="station-address">{station.address}</div> : null}
            {station.temporarilyClosed ? (
              <p className="closed-notice">
                <strong>Temporarily closed.</strong> supercharge.info lists this Supercharger as temporarily closed. Check the
                Tesla app before you drive here.
              </p>
            ) : null}

            <div className="station-actions">
              <a className="station-action primary" href={directionsUrl} target="_blank" rel="noreferrer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m3 11 18-8-8 18-2-8-8-2z" />
                </svg>
                Directions
              </a>
              <FavoriteButton station={{ id: station.id, name: station.name, address: station.address ?? "", href }} />
              <ShareButton title={station.name} />
            </div>
          </section>

          <section className="charger-card">
            <div className="charger-headline">
              <h2>Charging points</h2>
              {station.ccs ? (
                <span className="open-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 5 5 9-10" />
                  </svg>
                  OPEN TO ALL EVs
                </span>
              ) : null}
            </div>

            {stallNumbers.length ? (
              <details className="outlet-accordion">
                <summary className="charger-main-row">
                  <span className="charger-copy">{power}</span>
                  <span className="charger-right">
                    <span className="available-count">{stallNumbers.length} stalls</span>
                    <svg className="plug-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0V8zM12 18v4" />
                    </svg>
                    <svg className="outlet-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </summary>

                <ul className="outlet-list" aria-label="Stalls">
                  {stallNumbers.map((number) => (
                    <li key={number} className="outlet-row">
                      <span className="outlet-dot is-unknown" aria-hidden="true" />
                      <span className="outlet-info">
                        <span className="outlet-name">Stall {number}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <div className="charger-main-row is-static">
                <span className="charger-copy">{power}</span>
                <span className="charger-right">
                  <span className="stall-unknown">Stall count not listed</span>
                </span>
              </div>
            )}
            <p className="port-status-note">Live stall availability isn&apos;t available yet. Stall counts come from supercharge.info and OpenStreetMap.</p>
          </section>

          <section className="station-about" aria-labelledby="station-about-title">
            <h2 id="station-about-title">About this Supercharger</h2>
            {about.map((paragraph, index) => (
              <p key={index}>
                {paragraph.map((segment, part) =>
                  typeof segment === "string" ? segment : <Link key={part} href={segment.href}>{segment.text}</Link>,
                )}
              </p>
            ))}
          </section>

          <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_STATION} />

          <StationPhotos photos={publicPhotos} addHref={`${href}/add-photo`} label={`Tesla Supercharger at ${station.address ?? station.name}`} />

          <NearbySection
            stationSlug={station.slug}
            stationLat={lat}
            stationLon={lon}
            categories={nearby}
            metric={metric}
          />

          <SiteFooter osmCredit dataCredit />
        </main>

        {/* Described as a schema.org Place (a charging location), not a LocalBusiness: we don't run it. */}
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Place",
            "@id": absoluteUrl(href),
            name: stationTitle(station),
            url: absoluteUrl(href),
            additionalType: "https://www.wikidata.org/wiki/Q2140665", // electric vehicle charging station
            geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lon },
            ...(station.address
              ? {
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: station.street ?? undefined,
                    addressLocality: station.cityLabel?.replace(/, [A-Z]{2}$/, ""),
                    addressRegion: station.state.toUpperCase(),
                    addressCountry: "US",
                  },
                }
              : {}),
            ...(publicPhotos.length ? { image: publicPhotos.map((photo) => photo.url) } : {}),
            ...(station.stalls
              ? { amenityFeature: { "@type": "LocationFeatureSpecification", name: "Charging stalls", value: station.stalls } }
              : {}),
          }}
        />
      </div>
    </div>
  );
}
