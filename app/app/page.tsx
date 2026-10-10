import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { allCities, cityHref, stateHref, statesWithStations, superchargers } from "@/lib/superchargers";
import { stateName, US_STATES } from "@/lib/usStates";

// The title and description come from the root layout's defaults.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const states = statesWithStations()
  .filter(({ state }) => US_STATES[state])
  .sort((a, b) => stateName(a.state).localeCompare(stateName(b.state)));
const popularCities = allCities()
  .sort((a, b) => b.stations.length - a.stations.length || a.label.localeCompare(b.label))
  .slice(0, 12);

// Short, factual answers to what people searching "Supercharger near me" ask (PRD: Home SEO).
const faqs = [
  {
    question: "How do I find the closest Tesla Supercharger?",
    answer:
      "Tap Near me and allow location. We list the nearest Superchargers by distance with their stall count and charging speed. You can also search a city or ZIP code.",
  },
  {
    question: "Can non-Tesla EVs use Superchargers?",
    answer:
      "Many Superchargers are open to other EVs that have a NACS (Tesla-style) port or an approved adapter, and some have a built-in CCS adapter. Check the Tesla app for a specific station before you go.",
  },
  {
    question: "How long does Supercharging take?",
    answer:
      "Most drivers stop for about 20 to 40 minutes, depending on the car, battery level and the station's speed. That's why each station page shows places to eat, grab coffee or shop within a short walk.",
  },
  {
    question: "How much does it cost to charge?",
    answer: "Prices vary by station and time of day. The Tesla app shows the current rate before you plug in.",
  },
  {
    question: "Is this site run by Tesla?",
    answer: "No. TeslaSuperchargerNearMe is an independent guide and is not affiliated with Tesla, Inc. Station locations come from OpenStreetMap.",
  },
];

export default function HomePage() {
  return (
    <div className="app-shell">
      <SiteHeader />

      <main id="main" className="home-page">
        <div className="hero-mark" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#14211C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
          </svg>
        </div>

        <h1 className="home-title">Find a Supercharger near you</h1>

        <p className="home-sub">For every EV, Tesla or not. See open stalls and what&apos;s nearby.</p>

        {/* A plain GET form, so search works before (or without) JavaScript. */}
        <form action="/map" method="get" role="search" className="search-shell">
          <label htmlFor="home-search" className="sr-only">Search city, ZIP code or station</label>
          <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input id="home-search" name="q" type="search" enterKeyHint="search" placeholder="Search city, ZIP code or station" autoComplete="off" />
        </form>

        <div className="primary-grid">
          <Link href="/map?near=1" className="action-button primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21 3 3 10.5l7.5 3L13.5 21 21 3z" />
            </svg>
            Near me
          </Link>

          <Link href="/map" className="action-button secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B6E5B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
              <path d="M9 4v14M15 6v14" />
            </svg>
            Map
          </Link>

          <Link href="/favorites" className="action-button secondary wide">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#0B6E5B" aria-hidden="true">
              <path d="m12 2 3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8L12 2z" />
            </svg>
            Favorites
          </Link>
        </div>
      </main>

      <div className="home-more">
        <section aria-labelledby="states-title" className="link-section">
          <h2 id="states-title" className="section-title">Superchargers by state</h2>
          <p className="page-sub">{superchargers.length.toLocaleString("en-US")} Tesla Supercharger stations across the US.</p>
          <ul className="link-chips">
            {states.map(({ state, count }) => (
              <li key={state}>
                <Link href={stateHref(state)} className="link-chip">
                  {stateName(state)} <span>{count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="cities-title" className="link-section">
          <h2 id="cities-title" className="section-title">Popular cities</h2>
          <ul className="link-chips">
            {popularCities.map((city) => (
              <li key={`${city.state}/${city.city}`}>
                <Link href={cityHref(city.state, city.city)} className="link-chip">
                  {city.label} <span>{city.stations.length}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faq-title" className="link-section faq">
          <h2 id="faq-title" className="section-title">Questions drivers ask</h2>
          {faqs.map((faq) => (
            <details key={faq.question} className="faq-item">
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </section>
      </div>

      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_URL }} />

      <SiteFooter />
    </div>
  );
}
