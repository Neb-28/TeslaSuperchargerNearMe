"use client";

import Script from "next/script";
import { useEffect, useRef, useState, type CSSProperties } from "react";

const adClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_RAIL;

type RailWidth = 300 | 160;

// Widest page column each layout uses on desktop (globals.css), and the screen width at which
// a 300×600 or 160×600 ad fits in the empty space beside it with room to spare.
const LAYOUTS = {
  station: { 300: 1920, 160: 1600 }, // .station-layout, 1200 px
  content: { 300: 1480, 160: 1180 }, // .content-page (state and city pages), 720 px
  planner: { 300: 1400, 160: 1100 }, // .content-page on the route planner, 720 px
  home: { 300: 1680, 160: 1320 }, // .home-more (state and city lists on Home), 960 px
};

// Ad height for each width. The route planner and Home are long pages, so their wide rails use
// the tall 300×1050 "portrait" size; everywhere else (and every 160 px rail) it's 600.
const HEIGHTS: Record<keyof typeof LAYOUTS, Record<RailWidth, number>> = {
  station: { 300: 600, 160: 600 },
  content: { 300: 600, 160: 600 },
  planner: { 300: 1050, 160: 600 },
  home: { 300: 1050, 160: 600 },
};

// Desktop only: a tall ad in the empty space left and right of the page. They scroll with the page
// (AdSense allows only one ad that stays on screen while scrolling) and never overlap content:
// below the widths above they aren't shown at all. Rendered in the browser only, so pages keep
// the same server HTML and phones never load them.
export default function SideRails({ layout }: { layout: keyof typeof LAYOUTS }) {
  const [width, setWidth] = useState<RailWidth | null>(null);
  const pushed = useRef(false);
  const live = Boolean(adClient && slot);
  const breakpoints = LAYOUTS[layout];
  const height = width ? HEIGHTS[layout][width] : 600;

  useEffect(() => {
    // One size per visit: an AdSense unit can't change size after it has loaded.
    const fits = ([300, 160] as const).find((size) => window.matchMedia(`(min-width: ${breakpoints[size]}px)`).matches);
    if (!fits) return;
    const frame = requestAnimationFrame(() => setWidth(fits));
    return () => cancelAnimationFrame(frame);
  }, [breakpoints]);

  useEffect(() => {
    if (!live || !width || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blockers make this throw; the reserved boxes just stay empty.
    }
  }, [live, width]);

  if (!width || (!live && process.env.NODE_ENV === "production")) return null;

  return (
    <div className={`side-rails is-${layout}`} data-width={width} style={{ "--rail-w": `${width}px`, "--rail-h": `${height}px` } as CSSProperties}>
      {live ? (
        <Script
          id="adsbygoogle-js"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`}
          strategy="lazyOnload"
          crossOrigin="anonymous"
        />
      ) : null}
      {(["left", "right"] as const).map((side) => (
        <aside key={side} className={`side-rail is-${side}`} aria-label="Advertisement">
          {/* AdSense allows only "Advertisements" or "Sponsored links" as a label. */}
          <span className="ad-label">Sponsored links</span>
          {live ? (
            <ins className="adsbygoogle side-rail-ad" data-ad-client={adClient} data-ad-slot={slot} />
          ) : (
            <div className="ad-placeholder side-rail-ad">Ad space · {width} × {height}</div>
          )}
        </aside>
      ))}
    </div>
  );
}
