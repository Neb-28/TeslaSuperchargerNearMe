import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { loginHref } from "@/lib/authRedirect";
import { SLOT_LABELS, type FeaturedStatus } from "@/lib/featured";
import { listFeaturedForEmail } from "@/lib/featuredStore";
import { CATEGORIES } from "@/lib/places";
import { CONTACT_EMAIL } from "@/lib/site";
import { currentUser } from "@/lib/supabase/server";
import { getStationById, stationHref } from "@/lib/superchargers";

export const metadata: Metadata = {
  title: "Business dashboard",
  robots: { index: false, follow: false },
};

const STATUS: Record<FeaturedStatus, { label: string; note: string }> = {
  pending: { label: "Waiting for review", note: "We'll email you with the price and a secure link to pay. After payment we review it, usually within one business day." },
  live: { label: "Live", note: "Shown above the free listings in its category at this station, labeled Sponsored." },
  paused: { label: "Paused", note: "Not shown right now. Email us to turn it back on." },
  rejected: { label: "Not approved", note: "Email us if you'd like to know why or apply again with changes." },
};

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function BusinessDashboardPage() {
  const user = await currentUser();
  if (!user?.email) redirect(loginHref("/business/dashboard"));

  const listings = await listFeaturedForEmail(user.email);

  return (
    <div className="app-shell">
      <SiteHeader backHref="/account" />
      <main id="main" className="content-page">
        <h1 className="page-title">Business dashboard</h1>
        <p className="page-sub">
          #1 Featured requests made with <strong>{user.email}</strong>.
        </p>

        {listings.length === 0 ? (
          <div className="form-card">
            <p className="page-sub">
              No requests for this email yet. If you applied with a different email, sign in with that one instead.
            </p>
            <Link href="/business/get-featured" className="action-button primary">Get featured near a Supercharger</Link>
          </div>
        ) : (
          <ul className="dashboard-list">
            {listings.map((listing) => {
              const station = getStationById(listing.stationId);
              const status = STATUS[listing.status];
              return (
                <li key={listing.id} className="form-card">
                  <span className={`status-pill status-${listing.status}`}>{status.label}</span>
                  <h2 className="section-title">{listing.businessName}</h2>
                  <dl className="dashboard-facts">
                    <div>
                      <dt>Station</dt>
                      <dd>{station ? <Link href={stationHref(station)}>{station.name}</Link> : "Station no longer listed"}</dd>
                    </div>
                    <div>
                      <dt>Spot</dt>
                      <dd>{SLOT_LABELS[listing.slot]}</dd>
                    </div>
                    <div>
                      <dt>Category</dt>
                      <dd>{CATEGORIES.find((item) => item.id === listing.category)?.label ?? listing.category}</dd>
                    </div>
                    <div>
                      <dt>Offer</dt>
                      <dd>{listing.offerText}</dd>
                    </div>
                    <div>
                      <dt>Requested</dt>
                      <dd>{dateFormat.format(new Date(listing.createdAt))}</dd>
                    </div>
                  </dl>
                  <p className="login-note">{status.note}</p>
                </li>
              );
            })}
          </ul>
        )}

        <p className="login-note">
          Questions or changes to a listing: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
