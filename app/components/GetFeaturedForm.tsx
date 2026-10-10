"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { applyForFeatured, type ApplyState } from "@/app/business/get-featured/actions";
import { OFFER_MAX } from "@/lib/featuredValidation";
import { CATEGORIES, type CategoryId } from "@/lib/places";

type GetFeaturedFormProps = {
  stationSlug: string;
  stationName: string;
  stationHref: string;
  initialCategory: CategoryId;
  // Names of places near the station, per category, offered as suggestions.
  suggestions: Record<CategoryId, string[]>;
};

export default function GetFeaturedForm({ stationSlug, stationName, stationHref, initialCategory, suggestions }: GetFeaturedFormProps) {
  const [state, formAction, pending] = useActionState<ApplyState, FormData>(applyForFeatured, { status: "idle" });
  const [category, setCategory] = useState<CategoryId>(initialCategory);
  const [offerLength, setOfferLength] = useState(0);
  const errors = state.status === "error" ? state.errors : {};
  // React empties the form after each submit; refill it with what was sent so nothing is lost.
  const sent = state.status === "error" ? state.values : {};
  const value = (name: string, fallback = "") => sent[name] ?? fallback;

  if (state.status === "sent") {
    return (
      <div className="form-card" role="status">
        <h2 className="section-title">Thanks, we got your request</h2>
        <p className="page-sub">
          You asked for the #1 Featured spot in {CATEGORIES.find((item) => item.id === category)?.label} at {stationName}.
        </p>
        <ol className="location-steps">
          <li>We&apos;ll email {state.email || "you"} with the price and a secure link to pay by card.</li>
          <li>After payment we review the listing, usually within one business day.</li>
          <li>Your listing goes live at the top of the list, labeled Sponsored.</li>
        </ol>
        <Link href={stationHref} className="action-button secondary">Back to the station</Link>
      </div>
    );
  }

  const error = (name: keyof typeof errors) =>
    errors[name] ? (
      <span className="field-error" id={`${name}-error`}>
        {errors[name]}
      </span>
    ) : null;
  const describedBy = (name: keyof typeof errors) => (errors[name] ? `${name}-error` : undefined);

  return (
    <form action={formAction} className="form-card" noValidate>
      <input type="hidden" name="stationSlug" value={stationSlug} />
      {/* Honeypot for bots; hidden from people and screen readers. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="honeypot" aria-hidden="true" />

      <label className="field">
        <span>Category</span>
        <select name="category" defaultValue={value("category", initialCategory)} onChange={(event) => setCategory(event.target.value as CategoryId)} aria-describedby={describedBy("category")}>
          {CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        {error("category")}
      </label>

      <label className="field">
        <span>Business name</span>
        <input name="businessName" defaultValue={value("businessName")} list="nearby-businesses" maxLength={80} required aria-invalid={Boolean(errors.businessName)} aria-describedby={describedBy("businessName")} />
        <datalist id="nearby-businesses">
          {suggestions[category].map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {error("businessName")}
      </label>

      <label className="field">
        <span>Street address <em>(only if your business isn&apos;t in the suggestions)</em></span>
        <input name="address" defaultValue={value("address")} autoComplete="street-address" aria-invalid={Boolean(errors.address)} aria-describedby={describedBy("address")} />
        {error("address")}
      </label>

      <label className="field">
        <span>Type of business</span>
        <input name="kind" defaultValue={value("kind")} maxLength={60} placeholder="Wood-fired pizza, salads" required aria-invalid={Boolean(errors.kind)} aria-describedby={describedBy("kind")} />
        {error("kind")}
      </label>

      <label className="field">
        <span>
          Offer for EV drivers <em>({offerLength || value("offerText").length}/{OFFER_MAX})</em>
        </span>
        <input
          name="offerText"
          maxLength={OFFER_MAX}
          placeholder="10% off while you charge"
          required
          defaultValue={value("offerText")}
          onChange={(event) => setOfferLength(event.target.value.length)}
          aria-invalid={Boolean(errors.offerText)}
          aria-describedby={describedBy("offerText")}
        />
        {error("offerText")}
      </label>

      <div className="field-row">
        <label className="field">
          <span>Button label</span>
          <input name="ctaLabel" defaultValue={value("ctaLabel")} maxLength={24} placeholder="Claim offer" required aria-invalid={Boolean(errors.ctaLabel)} aria-describedby={describedBy("ctaLabel")} />
          {error("ctaLabel")}
        </label>
        <label className="field">
          <span>Button link</span>
          <input name="ctaUrl" defaultValue={value("ctaUrl")} type="url" placeholder="https://" required aria-invalid={Boolean(errors.ctaUrl)} aria-describedby={describedBy("ctaUrl")} />
          {error("ctaUrl")}
        </label>
      </div>

      <label className="field">
        <span>Your name</span>
        <input name="contactName" defaultValue={value("contactName")} autoComplete="name" required aria-invalid={Boolean(errors.contactName)} aria-describedby={describedBy("contactName")} />
        {error("contactName")}
      </label>

      <div className="field-row">
        <label className="field">
          <span>Email</span>
          <input name="contactEmail" defaultValue={value("contactEmail")} type="email" autoComplete="email" required aria-invalid={Boolean(errors.contactEmail)} aria-describedby={describedBy("contactEmail")} />
          {error("contactEmail")}
        </label>
        <label className="field">
          <span>Phone <em>(optional)</em></span>
          <input name="phone" defaultValue={value("phone")} type="tel" autoComplete="tel" />
        </label>
      </div>

      <label className="check-field">
        <input type="checkbox" name="owner" value="yes" defaultChecked={value("owner") === "yes"} aria-invalid={Boolean(errors.owner)} aria-describedby={describedBy("owner")} />
        <span>I own or manage this business.</span>
      </label>
      {error("owner")}

      <button type="submit" className="action-button primary" disabled={pending}>
        {pending ? "Sending…" : "Request the #1 spot"}
      </button>
      <p className="smallprint">Featured listings are paid monthly and labeled Sponsored. We&apos;ll confirm the price before you pay.</p>
    </form>
  );
}
