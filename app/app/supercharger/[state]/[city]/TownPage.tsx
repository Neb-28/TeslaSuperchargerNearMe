import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import OtherFastChargers from "@/components/OtherFastChargers";
import SiteFooter from "@/components/SiteFooter";
import SideRails from "@/components/SideRails";
import SiteHeader from "@/components/SiteHeader";
import StationListCard from "@/components/StationListCard";
import { fastChargersNear } from "@/lib/fastChargers";
import { absoluteUrl } from "@/lib/site";
import { cityHref, stateHref, stationHref, stationTitle } from "@/lib/superchargers";
import { milesText, NEAR_MILES, nearbyCityPages, nearbyTowns, type TownSummary } from "@/lib/towns";
import { stateName } from "@/lib/usStates";

// "Tesla Superchargers near Dale City, VA": a sizable town without a Supercharger of its own,
// with the nearest stations and how far away they are.
export default function TownPage({ town }: { town: TownSummary }) {
  const href = cityHref(town.state, town.slug);
  const [closest] = town.nearest;
  const cities = nearbyCityPages(town);
  const towns = nearbyTowns(town);
  const chargers = fastChargersNear([town.lat, town.lon]);

  return (
    <div className="app-shell">
      <SideRails layout="content" />
      <SiteHeader backHref={stateHref(town.state)} />
      <main id="main" className="content-page">
        <Breadcrumbs
          items={[
            { name: "Home", href: "/" },
            { name: stateName(town.state), href: stateHref(town.state) },
            { name: town.name, href },
          ]}
        />
        <h1 className="page-title">Tesla Superchargers near {town.label}</h1>
        <p className="page-sub">
          {town.name} has no Supercharger of its own.{" "}
          {town.within
            ? `There ${town.within === 1 ? "is 1 Tesla Supercharger station" : `are ${town.within} Tesla Supercharger stations`} within ${NEAR_MILES} miles. `
            : ""}
          The closest is {closest.station.name}, {milesText(closest.miles)} away
          {closest.station.stalls ? ` with ${closest.station.stalls} stalls` : ""}. Distances are in a straight line from the center of{" "}
          {town.name}. Open a station for directions and for places to eat, grab coffee or shop within a short walk while you charge.
        </p>
        <Link href={`/map?station=${closest.station.slug}`} className="action-button primary">
          See them on the map
        </Link>

        <ul className="station-list content-card">
          {town.nearest.map(({ station, miles }) => (
            <li key={station.id}>
              <StationListCard station={station} distance={`${milesText(miles).replace("miles", "mi")} away`} />
            </li>
          ))}
        </ul>

        <OtherFastChargers place={town.name} chargers={chargers} />

        {cities.length ? (
          <section aria-labelledby="nearby-cities" className="link-section">
            <h2 id="nearby-cities" className="section-title">Cities with Superchargers nearby</h2>
            <ul className="link-chips">
              {cities.map((item) => (
                <li key={item.city}>
                  <Link href={cityHref(item.state, item.city)} className="link-chip">
                    {item.name} <span>{item.stations.length}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {towns.length ? (
          <section aria-labelledby="nearby-towns" className="link-section">
            <h2 id="nearby-towns" className="section-title">Towns nearby</h2>
            <ul className="link-chips">
              {towns.map((item) => (
                <li key={item.slug}>
                  <Link href={cityHref(item.state, item.slug)} className="link-chip">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={stateHref(town.state)} className="footer-link">All Superchargers in {stateName(town.state)}</Link>
          </section>
        ) : null}

        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `Tesla Superchargers near ${town.label}`,
            numberOfItems: town.nearest.length,
            itemListElement: town.nearest.map(({ station }, index) => ({
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
