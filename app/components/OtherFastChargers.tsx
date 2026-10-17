import { NEARBY_CHARGER_MILES, type NearbyCharger } from "@/lib/fastChargers";

// Other networks' DC fast chargers near a city or town page, nearest first. We have no page for
// them, so each row opens directions in Google Maps.
export default function OtherFastChargers({ place, chargers }: { place: string; chargers: NearbyCharger[] }) {
  if (!chargers.length) return null;
  return (
    <section aria-labelledby="other-chargers" className="link-section">
      <div>
        <h2 id="other-chargers" className="section-title">Other EV charging stations near {place}</h2>
        <p className="section-sub">
          DC fast chargers from other networks within {NEARBY_CHARGER_MILES} miles. Most Teslas can use CCS chargers with a CCS adapter.
        </p>
      </div>
      <ul className="station-list content-card">
        {chargers.map((charger) => {
          const independent = charger.network === "Independent charger";
          const meta = [
            `${charger.miles.toFixed(1)} mi away`,
            independent ? null : charger.name,
            charger.stalls ? `${charger.stalls} port${charger.stalls === 1 ? "" : "s"}` : null,
            charger.maxKw ? `up to ${charger.maxKw} kW` : null,
            charger.plugs || null,
          ];
          return (
            <li key={charger.id}>
              <a href={charger.href} className="station-row" target="_blank" rel="noopener noreferrer">
                <span className="station-icon is-other" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
                  </svg>
                </span>
                <span className="station-meta">
                  <span className="station-name">{independent ? charger.name : charger.network}</span>{" "}
                  <span className="station-sub">{meta.filter(Boolean).join(" · ")}</span>
                </span>
                <span className="sr-only">(directions in Google Maps, opens in a new tab)</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="row-chevron" aria-hidden="true">
                  <path d="m9 5 7 7-7 7" />
                </svg>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
