"use client";

import { useEffect, useState } from "react";

// Uses the phone's share sheet when there is one; otherwise copies the link.
export default function ShareButton({ title }: { title: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function share() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, text: `${title} Supercharger`, url });
        return;
      } catch (error) {
        // Closing the share sheet is not an error worth showing.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  const label = status === "copied" ? "Copied" : status === "failed" ? "Can't copy" : "Share";

  return (
    <button type="button" className="station-action secondary compact" onClick={share} aria-label={status === "idle" ? "Share this station" : label}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {status === "copied" ? (
          <path d="m5 12 5 5 9-10" />
        ) : (
          <>
            <path d="M12 3v12" />
            <path d="m7 8 5-5 5 5" />
            <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
          </>
        )}
      </svg>
      <span className="action-label" aria-live="polite">{label}</span>
    </button>
  );
}
