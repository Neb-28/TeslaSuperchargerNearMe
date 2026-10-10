import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

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

      <SiteFooter />
    </div>
  );
}
