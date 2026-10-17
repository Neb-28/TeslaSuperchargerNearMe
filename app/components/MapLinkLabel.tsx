"use client";

import { useLinkStatus } from "next/link";

// The label of a link to the map. On a slow connection the map takes a few seconds to arrive,
// so right after the tap the button says it's working instead of looking unresponsive. Both
// labels share one grid cell, so the button keeps its size.
export default function MapLinkLabel({ children }: { children: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className={`pending-label${pending ? " is-pending" : ""}`}>
      <span className="pending-label-idle">{children}</span>
      <span className="pending-label-busy" aria-hidden={!pending}>
        <span className="pending-spinner" aria-hidden="true" />
        Opening the map…
      </span>
    </span>
  );
}
