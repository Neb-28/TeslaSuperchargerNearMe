"use client";

import type { GeoStatus } from "./useGeolocation";

// Websites can't open phone settings or flip the toggle themselves, so when location
// is blocked we show the exact steps for the visitor's device instead.
function enableSteps(): string[] {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

  if (isIOS && /CriOS|FxiOS|EdgiOS/.test(ua)) {
    return [
      "Open the Settings app and tap your browser (under Apps on newer iPhones).",
      "Tap Location and choose While Using the App.",
      "Come back here. We'll find you automatically.",
    ];
  }
  if (isIOS) {
    return [
      "Open the Settings app → Privacy & Security → Location Services, and make sure it's on.",
      "In the same list, tap Safari Websites and choose While Using the App.",
      "Back in Safari, tap the page menu in the address bar → Website Settings → Location → Allow.",
    ];
  }
  if (/Android/.test(ua)) {
    return [
      "Swipe down from the top of the screen and make sure Location is on.",
      "In your browser, tap the icon to the left of the web address → Permissions → Location → Allow.",
      "Come back here. We'll find you automatically.",
    ];
  }
  if (/Firefox/.test(ua)) {
    return ["Click the location icon in the address bar and remove the Blocked setting.", "Then tap Try again."];
  }
  if (/Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) {
    return ["In the menu bar, choose Safari → Settings for This Website → Location → Allow.", "Then tap Try again."];
  }
  return [
    "Click the icon to the left of the web address → Site settings → Location → Allow.",
    /Mac/.test(ua) ? "On a Mac, also check System Settings → Privacy & Security → Location Services for your browser." : "Make sure location is on in your computer's privacy settings.",
    "Then tap Try again.",
  ];
}

type LocationCardProps = {
  status: GeoStatus;
  onRequest: () => void;
  onDismiss: () => void;
  onSearchInstead: () => void;
};

export default function LocationCard({ status, onRequest, onDismiss, onSearchInstead }: LocationCardProps) {
  if (status === "idle" || status === "located") return null;

  if (status === "checking" || status === "locating") {
    return <p className="sheet-status" role="status">Finding your location…</p>;
  }

  const content = {
    asking: {
      title: "Allow location to find the nearest Supercharger",
      body: "Your browser is asking to share your location. Choose Allow and we'll sort stations by how far they are from you. It stays on your device; we never save it.",
      primary: "Use my location",
      secondary: "Not now",
    },
    dismissed: {
      title: "Location wasn't shared",
      body: "Tap Use my location and choose Allow when your browser asks, so we can find the Superchargers closest to you.",
      primary: "Use my location",
      secondary: "Search instead",
    },
    denied: {
      title: "Location is turned off for this site",
      body: "Your browser won't let us ask again, so it has to be turned on in settings:",
      primary: "Try again",
      secondary: "Search instead",
    },
    unavailable: {
      title: "We couldn't find your location",
      body: "Make sure Location (GPS) is on for your device, then try again.",
      primary: "Try again",
      secondary: "Search instead",
    },
    insecure: {
      title: "Location needs a secure connection",
      body: "Browsers only share location with https sites. Search for a city, place or address instead.",
      primary: null,
      secondary: "Search instead",
    },
  }[status];

  return (
    <div className="location-card" role="status" aria-live="polite">
      <div className="location-card-top">
        <span className="location-card-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 3 3 10.5l7.5 3L13.5 21 21 3z" />
          </svg>
        </span>
        <div>
          <h2 className="location-card-title">{content.title}</h2>
          <p className="location-card-body">{content.body}</p>
        </div>
      </div>

      {status === "denied" ? (
        <ol className="location-steps">
          {enableSteps().map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}

      <div className="location-card-actions">
        {content.primary ? (
          <button type="button" className="location-button primary" onClick={onRequest}>
            {content.primary}
          </button>
        ) : null}
        <button type="button" className="location-button secondary" onClick={status === "asking" ? onDismiss : onSearchInstead}>
          {content.secondary}
        </button>
      </div>
    </div>
  );
}
