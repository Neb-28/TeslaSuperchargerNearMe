import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "About TeslaSuperchargerNearMe: a free locator for Tesla Superchargers and the places within walking distance, where the data comes from, and how the site is supported.",
};

export default function AboutPage() {
  return (
    <div className="app-shell">
      <SiteHeader backHref="/" />
      <main id="main" className="content-page legal-page">
        <h1 className="page-title">About</h1>

        <p>
          TeslaSuperchargerNearMe is a free locator for Tesla Supercharger stations. Search by city, ZIP code or station, or use your
          current location. Every station page shows the address, how many stalls are installed, the fastest charging speed, and the
          food, coffee and shops within walking distance while you charge.
        </p>

        <h2>Where the data comes from</h2>
        <p>
          US stations and all nearby places come from{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>{" "}
          contributors. Stations outside the US come from{" "}
          <a href="https://supercharge.info" target="_blank" rel="noreferrer">
            supercharge.info
          </a>
          . We refresh our listings regularly. Map data © OpenStreetMap contributors.
        </p>

        <h2>An honest note on availability</h2>
        <p>
          We show installed capacity: the number of stalls and the maximum charging speed at each station. Live stall-by-stall
          availability isn&apos;t published by any public data source, so we don&apos;t show it.
        </p>

        <h2>Not affiliated with Tesla</h2>
        <p>
          This site is not affiliated with, endorsed by, or connected to Tesla, Inc. Tesla and Supercharger are trademarks of Tesla,
          Inc.
        </p>

        <h2>How the site is supported</h2>
        <p>
          The site is free to use. It is supported by advertising and by businesses near stations that pay to be featured; those
          listings are always labeled &ldquo;Sponsored&rdquo;. <Link href="/contact">Contact us</Link> at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> for corrections, business inquiries or questions.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
