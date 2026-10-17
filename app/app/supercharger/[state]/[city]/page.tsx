import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import MapLinkLabel from "@/components/MapLinkLabel";
import OtherFastChargers from "@/components/OtherFastChargers";
import SiteFooter from "@/components/SiteFooter";
import SideRails from "@/components/SideRails";
import SiteHeader from "@/components/SiteHeader";
import StationListCard from "@/components/StationListCard";
import { unitFor } from "@/lib/distance";
import { fastChargersNear } from "@/lib/fastChargers";
import { absoluteUrl } from "@/lib/site";
import { areaName, cityCenter, cityHref, countryPhrase, getCity, nearbyCities, stateHref, stationHref, stationTitle } from "@/lib/superchargers";
import { getTown, townDescription, townTitle } from "@/lib/towns";
import { stateName } from "@/lib/usStates";
import TownPage from "./TownPage";

type CityPageProps = PageProps<"/supercharger/[state]/[city]">;

function plural(count: number, word: string) {
  return `${count.toLocaleString("en-US")} ${word}${count === 1 ? "" : "s"}`;
}

// Built the first time someone visits, then served from the CDN until the next deploy (the
// station data ships with each deploy).
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { state, city: citySlug } = await params;
  const city = getCity(state, citySlug);
  if (!city) {
    // No Supercharger in this town: the "near" page, at the URL its city page would have.
    const town = getTown(state, citySlug);
    return town ? { title: townTitle(town), description: townDescription(town), alternates: { canonical: cityHref(town.state, town.slug) } } : {};
  }
  const count = city.stations.length;
  return {
    title: `Tesla Superchargers in ${city.label} (${plural(count, "station")})`,
    description: `${plural(count, "Tesla Supercharger station")} in ${city.label}${city.stalls ? ` with ${plural(city.stalls, "stall")}` : ""}. Addresses, charging speed, directions and places to eat or shop within walking distance.`,
    alternates: { canonical: cityHref(city.state, city.city) },
  };
}

export default async function CityPage({ params }: CityPageProps) {
  const { state, city: citySlug } = await params;
  const city = getCity(state, citySlug);
  if (!city) {
    const town = getTown(state, citySlug);
    if (!town) notFound();
    return <TownPage town={town} />;
  }

  const count = city.stations.length;
  const fastest = Math.max(0, ...city.stations.map((station) => station.maxKw ?? 0));
  const nearOnly = city.stations.filter((station) => !station.cityLabel).length;
  const others = nearbyCities(city);
  const unit = unitFor(city.state);
  const chargers = fastChargersNear(cityCenter(city), unit);
  const href = cityHref(city.state, city.city);

  return (
    <div className="app-shell">
      <SideRails layout="content" />
      <SiteHeader backHref={stateHref(city.state)} />
      <main id="main" className="content-page">
        <Breadcrumbs
          items={[
            { name: "Home", href: "/" },
            { name: areaName(city.state, stateName), href: stateHref(city.state) },
            { name: city.name, href },
          ]}
        />
        <h1 className="page-title">Tesla Superchargers in {city.label}</h1>
        <p className="page-sub">
          {count === 1 ? "There is " : "There are "}
          {plural(count, "Tesla Supercharger station")} {nearOnly === count ? "near" : "in"} {city.label}
          {city.stalls ? ` with ${plural(city.stalls, "charging stall")} in total` : ""}
          {fastest ? `, charging at up to ${fastest} kW` : ""}. Open a station for directions and for places to eat, grab coffee or shop
          within a short walk while you charge.
        </p>
        <Link href={`/map?station=${city.stations[0].slug}`} className="action-button primary">
          <MapLinkLabel>See them on the map</MapLinkLabel>
        </Link>

        <ul className="station-list content-card">
          {city.stations.map((station) => (
            <li key={station.id}>
              <StationListCard station={station} />
            </li>
          ))}
        </ul>

        <OtherFastChargers place={city.name} chargers={chargers} unit={unit} />

        {others.length ? (
          <section aria-labelledby="other-cities" className="link-section">
            <h2 id="other-cities" className="section-title">Other cities in {countryPhrase(areaName(city.state, stateName))}</h2>
            <ul className="link-chips">
              {others.map((item) => (
                <li key={item.city}>
                  <Link href={cityHref(item.state, item.city)} className="link-chip">
                    {item.name} <span>{item.stations.length}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={stateHref(city.state)} className="footer-link">All Superchargers in {countryPhrase(areaName(city.state, stateName))}</Link>
          </section>
        ) : null}

        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `Tesla Superchargers in ${city.label}`,
            numberOfItems: count,
            itemListElement: city.stations.map((station, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: absoluteUrl(stationHref(station)),
              name: stationTitle(station),
            })),
          }}
        />
      </main>
      <SiteFooter osmCredit dataCredit chargersCredit={chargers.length > 0} />
    </div>
  );
}
