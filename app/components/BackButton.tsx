"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { canGoBackInApp } from "@/lib/navHistory";

// A real link to `fallbackHref` (works without JavaScript and when the visitor
// landed here from Google); returns to the previous page when there is one in-app.
export default function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const cameFromThisSite = (() => {
      try {
        return document.referrer !== "" && new URL(document.referrer).origin === window.location.origin;
      } catch {
        return false;
      }
    })();

    if (canGoBackInApp() || (cameFromThisSite && window.history.length > 1)) {
      event.preventDefault();
      router.back();
    }
  }

  return (
    <Link href={fallbackHref} onClick={handleClick} aria-label="Back" className="icon-button">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </Link>
  );
}
