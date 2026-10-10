"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const adClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

// A full-width AdSense display unit, edge to edge on phones like ChargeFinder's station ad.
// Its size comes from CSS (.station-ad), so the box is reserved before the ad arrives.
// Google decides what fills it: one large ad, or a grid of product ads.
// Ads load last: the AdSense script, the heaviest thing on the page, is only fetched once the
// box is about to scroll into view, and then only when the browser is idle, so it never delays
// the station details above it.
export default function AdSlot({ slot }: { slot?: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);
  const [near, setNear] = useState(false);
  const live = Boolean(adClient && slot);

  useEffect(() => {
    const frame = frameRef.current;
    if (!live || !frame) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setNear(true);
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [live]);

  useEffect(() => {
    if (!near || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blockers make this throw; the reserved box just stays empty.
    }
  }, [near]);

  if (!live && process.env.NODE_ENV === "production") return null;

  return (
    <aside className="ad-section" aria-label="Advertisement">
      {/* AdSense allows only "Advertisements" or "Sponsored links" as a label. */}
      <span className="ad-label">Sponsored links</span>
      <div ref={frameRef} className="ad-frame">
        {live ? (
          <>
            {near ? (
              <Script
                id="adsbygoogle-js"
                src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`}
                strategy="lazyOnload"
                crossOrigin="anonymous"
              />
            ) : null}
            {/* No data-ad-format: AdSense then uses the exact size set in CSS. */}
            <ins className="adsbygoogle station-ad" data-ad-client={adClient} data-ad-slot={slot} />
          </>
        ) : (
          <div className="ad-placeholder">Ad space · full width × 250</div>
        )}
      </div>
    </aside>
  );
}
