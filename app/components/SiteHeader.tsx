import Link from "next/link";
import type { ReactNode } from "react";
import BackButton from "./BackButton";
import BrandName, { BRAND_NAME } from "./BrandName";
import MenuButton from "./MenuButton";

type SiteHeaderProps = {
  // Where Back goes when there is no previous in-app page (e.g. a visitor from Google).
  backHref?: string;
  showSearch?: boolean;
  // Station pages turn this off on phones so the name fits on one line.
  showMenu?: boolean;
  // Home and Map only: the flag dropdown for switching country.
  countryPicker?: ReactNode;
};

// Phones: Back on the left, Search and/or Menu on the right.
// Desktop (900 px+): the Menu is replaced by inline links.
export default function SiteHeader({ backHref, showSearch = false, showMenu = true, countryPicker }: SiteHeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className={`brand-wrap${backHref ? " has-back" : ""}`}>
          {backHref ? <BackButton fallbackHref={backHref} /> : null}
          <Link href="/" className="brand-link" aria-label={`${BRAND_NAME} home`}>
            <span className="brand-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#14211C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
              </svg>
            </span>
            <span className="brand-mark"><BrandName /></span>
          </Link>
        </div>

        {/* Desktop: Route planner and Map as icons; account links live in the ☰ menu. */}
        <nav className="desktop-nav" aria-label="Main">
          <Link href="/route-planner" className="icon-button" aria-label="Route planner" title="Route planner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="6" cy="19" r="2.5" />
              <circle cx="18" cy="5" r="2.5" />
              <path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5" />
            </svg>
          </Link>
          <Link href="/map" className="icon-button" aria-label="Map" title="Map">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
              <path d="M9 4v14M15 6v14" />
            </svg>
          </Link>
        </nav>

        <div className="header-actions">
          {countryPicker}
          {showSearch ? (
            <Link href="/map?search=1" aria-label="Search" className="icon-button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </Link>
          ) : null}
          {showMenu ? (
            <span className="mobile-only">
              <MenuButton variant="mobile" />
            </span>
          ) : null}
          <span className="desktop-only">
            <MenuButton variant="desktop" />
          </span>
        </div>
      </div>
    </header>
  );
}
