import type { Metadata } from "next";
import Link from "next/link";
import { adminConfigured, isAdmin } from "@/lib/adminAuth";
import { SLOT_LABELS, SPONSOR_SLOTS, type FeaturedListing, type FeaturedStatus } from "@/lib/featured";
import { listFeatured } from "@/lib/featuredStore";
import { CATEGORIES, categoryLabel } from "@/lib/places";
import { getStationById, stationHref } from "@/lib/superchargers";
import { addListingAction, deleteAction, loginAction, logoutAction, setSlotAction, setStatusAction } from "./actions";

export const metadata: Metadata = {
  title: "Admin — Featured listings",
  robots: { index: false, follow: false },
};


const GROUPS: { status: FeaturedStatus; title: string; empty: string }[] = [
  { status: "pending", title: "Waiting for review", empty: "No new applications." },
  { status: "live", title: "Live", empty: "No live featured listings." },
  { status: "paused", title: "Paused", empty: "Nothing paused." },
  { status: "rejected", title: "Rejected", empty: "Nothing rejected." },
];

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const params = await searchParams;
  const message = typeof params.msg === "string" ? params.msg : null;
  const error = typeof params.err === "string" ? params.err : null;

  if (!adminConfigured()) {
    return (
      <AdminShell>
        <h1 className="page-title">Admin</h1>
        <p className="page-sub">Admin is switched off. Set ADMIN_PASSWORD in .env.local and restart the site.</p>
      </AdminShell>
    );
  }

  if (!(await isAdmin())) {
    return (
      <AdminShell>
        <h1 className="page-title">Admin sign in</h1>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <form action={loginAction} className="form-card">
          <label className="field">
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit" className="action-button primary">Sign in</button>
        </form>
      </AdminShell>
    );
  }

  const listings = await listFeatured();

  return (
    <AdminShell>
      <div className="admin-head">
        <h1 className="page-title">Featured listings</h1>
        <form action={logoutAction}>
          <button type="submit" className="text-button">Sign out</button>
        </form>
      </div>
      {message ? <p className="form-success" role="status">{message}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {GROUPS.map((group) => {
        const items = listings.filter((listing) => listing.status === group.status);
        return (
          <section key={group.status} className="admin-group" aria-labelledby={`group-${group.status}`}>
            <h2 id={`group-${group.status}`} className="section-title">
              {group.title} <span className="admin-count">{items.length}</span>
            </h2>
            {items.length === 0 ? <p className="page-sub">{group.empty}</p> : items.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </section>
        );
      })}

      <section className="admin-group" aria-labelledby="add-title">
        <h2 id="add-title" className="section-title">Add a featured listing</h2>
        <p className="page-sub">For businesses that signed up with us directly. It goes live right away.</p>
        <form action={addListingAction} className="form-card">
          <label className="field">
            <span>Station page address</span>
            <input name="stationSlug" required placeholder="/supercharger/va/woodbridge/potomac-town-place-n12944744239" />
          </label>
          <label className="field">
            <span>Category</span>
            <select name="category" required defaultValue="food">
              {CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>{category.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Spot</span>
            <select name="slot" required defaultValue="1">
              {SPONSOR_SLOTS.map((slot) => (
                <option key={slot} value={slot}>{SLOT_LABELS[slot]}</option>
              ))}
            </select>
          </label>
          <FeaturedFields />
          <button type="submit" className="action-button primary">Add and publish</button>
        </form>
      </section>
    </AdminShell>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand-link brand-mark">TeslaSuperchargerNearMe admin</Link>
        </div>
      </header>
      <main id="main" className="content-page">{children}</main>
    </div>
  );
}

function FeaturedFields() {
  return (
    <>
      <label className="field">
        <span>Business name</span>
        <input name="businessName" required maxLength={80} />
      </label>
      <label className="field">
        <span>Type of business</span>
        <input name="kind" required maxLength={60} placeholder="Wood-fired pizza, salads" />
      </label>
      <label className="field">
        <span>Offer for EV drivers (up to 50 characters)</span>
        <input name="offerText" required maxLength={50} placeholder="10% off while you charge" />
      </label>
      <label className="field">
        <span>Button label</span>
        <input name="ctaLabel" required maxLength={24} placeholder="Claim offer" />
      </label>
      <label className="field">
        <span>Button link</span>
        <input name="ctaUrl" type="url" required placeholder="https://" />
      </label>
      <label className="field">
        <span>Street address (if not on the nearby list)</span>
        <input name="address" autoComplete="street-address" />
      </label>
      <label className="field">
        <span>Contact name</span>
        <input name="contactName" required autoComplete="name" />
      </label>
      <label className="field">
        <span>Contact email</span>
        <input name="contactEmail" type="email" required autoComplete="email" />
      </label>
      <label className="field">
        <span>Phone (optional)</span>
        <input name="phone" type="tel" autoComplete="tel" />
      </label>
    </>
  );
}

function ListingCard({ listing }: { listing: FeaturedListing }) {
  const station = getStationById(listing.stationId);
  const actions: { status: FeaturedStatus; label: string }[] = [
    { status: "live", label: "Make live" },
    { status: "paused", label: "Pause" },
    { status: "rejected", label: "Reject" },
  ];

  return (
    <article className="admin-card">
      <div className="admin-card-head">
        <strong>{listing.businessName}</strong>
        <span className="admin-source">
          {SLOT_LABELS[listing.slot]} · {listing.source === "admin" ? "Added by us" : "Business application"}
        </span>
      </div>
      <p className="admin-line">
        {categoryLabel(listing.category)} at{" "}
        {station ? <Link href={stationHref(station)}>{station.name}</Link> : listing.stationId}
        {listing.distanceM != null ? ` · ${listing.distanceM} m away` : listing.address ? ` · ${listing.address} (check distance)` : ""}
      </p>
      <p className="admin-line">{listing.kind} · “{listing.offerText}” · {listing.ctaLabel} → {listing.ctaUrl}</p>
      <p className="admin-line">
        {listing.contactName} · <a href={`mailto:${listing.contactEmail}`}>{listing.contactEmail}</a>
        {listing.phone ? ` · ${listing.phone}` : ""} · applied {listing.createdAt.slice(0, 10)}
      </p>
      <div className="admin-actions">
        {actions
          .filter((action) => action.status !== listing.status)
          .map((action) => (
            <form key={action.status} action={setStatusAction}>
              <input type="hidden" name="id" value={listing.id} />
              <input type="hidden" name="status" value={action.status} />
              <button type="submit" className={`location-button ${action.status === "live" ? "primary" : "secondary"}`}>{action.label}</button>
            </form>
          ))}
        <form action={setSlotAction} className="admin-slot-form">
          <input type="hidden" name="id" value={listing.id} />
          <label className="sr-only" htmlFor={`slot-${listing.id}`}>Spot for {listing.businessName}</label>
          <select id={`slot-${listing.id}`} name="slot" defaultValue={listing.slot}>
            {SPONSOR_SLOTS.map((slot) => (
              <option key={slot} value={slot}>{SLOT_LABELS[slot]}</option>
            ))}
          </select>
          <button type="submit" className="location-button secondary">Move</button>
        </form>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={listing.id} />
          <button type="submit" className="location-button secondary">Delete</button>
        </form>
      </div>
    </article>
  );
}
