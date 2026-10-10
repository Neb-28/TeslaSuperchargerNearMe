"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const adClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

// A full-width AdSense display unit, edge to edge on phones like ChargeFinder's station ad.
// Its size comes from CSS (.station-ad), so the box is reserved before the ad arrives.
// Google decides what fills it: one large ad, or a grid of product ads.
export default function AdSlot({ slot }: { slot?: string }) {
  const pushed = useRef(false);
  const live = Boolean(adClient && slot);

  useEffect(() => {
    if (!live || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blockers make this throw; the reserved box just stays empty.
    }
  }, [live]);

  if (!live && process.env.NODE_ENV === "production") return null;

  return (
    <aside className="ad-section" aria-label="Advertisement">
      {/* AdSense allows only "Advertisements" or "Sponsored links" as a label. */}
      <span className="ad-label">Sponsored links</span>
      <div className="ad-frame">
        {live ? (
          <>
            <Script
              id="adsbygoogle-js"
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`}
              strategy="afterInteractive"
              crossOrigin="anonymous"
            />
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
