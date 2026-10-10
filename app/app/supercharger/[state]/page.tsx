import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import StationListCard from "@/components/StationListCard";
import { absoluteUrl } from "@/lib/site";
import { cityHref, citiesInState, stateHref, statesWithStations } from "@/lib/superchargers";
import { stateName, US_STATES } from "@/lib/usStates";

type StatePageProps = PageProps<"/supercharger/[state]">;

function plural(count: number, word: string) {
  return `${count.toLocaleString("en-US")} ${word}${count === 1 ? "" : "s"}`;
}

function summary(state: string) {
  if (!US_STATES[state]) return null;
  const totals = statesWithStations().find((item) => item.state === state);
  return totals ? { ...totals, cities: citiesInState(state) } : null;
}

export async function generateMetadata({ params }: StatePageProps): Promise<Metadata> {
  const { state } = await params;
  const data = summary(state);
  if (!data) return {};
  return {
    title: `Tesla Superchargers in ${stateName(state)} (${plural(data.count, "station")})`,
    description: `All ${plural(data.count, "Tesla Supercharger station")} in ${stateName(state)} across ${plural(data.cities.length, "city")}, with stall counts, charging speed, directions and what's within walking distance.`,
    alternates: { canonical: stateHref(state) },
  };
}

export default async function StatePage({ params }: StatePageProps) {
  const { state } = await params;
  const data = summary(state);
  if (!data) notFound();

  const name = stateName(state);
  const biggest = data.cities
    .flatMap((city) => city.stations)
    .sort((a, b) => (b.stalls ?? 0) - (a.stalls ?? 0))
    .slice(0, 5);

  return (
    <div className="app-shell">
      <SiteHeader backHref="/" />
      <main id="main" className="content-page">
        <Breadcrumbs
          items={[
            { name: "Home", href: "/" },
            { name, href: stateHref(state) },
          ]}
        />
        <h1 className="page-title">Tesla Superchargers in {name}</h1>
        <p className="page-sub">
          {name} has {plural(data.count, "Supercharger station")}
          {data.stalls ? ` and ${plural(data.stalls, "charging stall")}` : ""} across {plural(data.cities.length, "city")} and town
          {data.cities.length === 1 ? "" : "s"}. Pick a city to see each station&apos;s address, charging speed and what&apos;s within
          walking distance.
        </p>

        <section aria-labelledby="cities-title" className="link-section">
          <h2 id="cities-title" className="section-title">Cities with Superchargers</h2>
          <ul className="link-chips">
            {data.cities.map((city) => (
              <li key={city.city}>
                <Link href={cityHref(city.state, city.city)} className="link-chip">
                  {city.name} <span>{city.stations.length}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {biggest.length ? (
          <section aria-labelledby="biggest-title" className="link-section">
            <h2 id="biggest-title" className="section-title">Largest stations in {name}</h2>
            <ul className="station-list content-card">
              {biggest.map((station) => (
                <li key={station.id}>
                  <StationListCard station={station} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `Tesla Supercharger cities in ${name}`,
            numberOfItems: data.cities.length,
            itemListElement: data.cities.map((city, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: absoluteUrl(cityHref(city.state, city.city)),
              name: `Tesla Superchargers in ${city.label}`,
            })),
          }}
        />
      </main>
      <SiteFooter osmCredit />
    </div>
  );
}
