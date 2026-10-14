"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { applyForFeatured, type ApplyState } from "@/app/business/get-featured/actions";
import { SLOT_LABELS, SPONSOR_SLOTS, type SponsorSlot } from "@/lib/featured";
import { OFFER_MAX } from "@/lib/featuredValidation";
import type { PublicFeatured } from "@/lib/nearby";
import { CATEGORIES, type CategoryId, type Place } from "@/lib/places";
import { PREVIEW_EXAMPLES } from "@/lib/previewExamples";
import { authConfigured } from "@/lib/supabase/env";
import AdPreview, { type AdDraft } from "./AdPreview";

type GetFeaturedFormProps = {
  stationSlug: string;
  stationName: string;
  stationHref: string;
  initialCategory: CategoryId;
  // Spots already held by a live business, per category.
  takenSlots: Record<CategoryId, SponsorSlot[]>;
  // The station's free places per category: offered as business name suggestions, and listed in
  // the live preview with the station's live paid listings.
  places: Record<CategoryId, Place[]>;
  liveSponsors: Record<CategoryId, PublicFeatured[]>;
  stationLat: number;
  stationLon: number;
  metric: boolean;
};

const DRAFT_FIELDS: (keyof AdDraft)[] = ["businessName", "kind", "offerText", "ctaLabel", "ctaUrl", "address"];

const SLOT_NOTES: Record<SponsorSlot, string> = {
  1: "The big gold card at the very top of the list.",
  2: "A sponsored card right below #1.",
  3: "A sponsored card right below #2.",
};

const firstFree = (taken: SponsorSlot[]) => SPONSOR_SLOTS.find((slot) => !taken.includes(slot)) ?? 1;

export default function GetFeaturedForm({
  stationSlug,
  stationName,
  stationHref,
  initialCategory,
  takenSlots,
  places,
  liveSponsors,
  stationLat,
  stationLon,
  metric,
}: GetFeaturedFormProps) {
  const [state, formAction, pending] = useActionState<ApplyState, FormData>(applyForFeatured, { status: "idle" });
  const [category, setCategory] = useState<CategoryId>(initialCategory);
  const [slot, setSlot] = useState<SponsorSlot>(firstFree(takenSlots[initialCategory]));
  const [offerLength, setOfferLength] = useState(0);
  const errors = state.status === "error" ? state.errors : {};
  // React empties the form after each submit; refill it with what was sent so nothing is lost.
  const sent = state.status === "error" ? state.values : {};
  const value = (name: string, fallback = "") => sent[name] ?? fallback;
  const [draft, setDraft] = useState<AdDraft>({ businessName: "", kind: "", offerText: "", ctaLabel: "", ctaUrl: "", address: "" });

  // The form's fields stay uncontrolled; every keystroke in an ad field also updates the preview.
  const updateDraft = (event: FormEvent<HTMLFormElement>) => {
    const field = event.target as HTMLInputElement;
    if (DRAFT_FIELDS.includes(field.name as keyof AdDraft)) setDraft((current) => ({ ...current, [field.name]: field.value }));
  };

  return (
    <div className="featured-builder">
      <div>{state.status === "sent" ? sentCard() : formCard()}</div>
      {/* Desktop: beside the form, in view while the business scrolls. Phones: after the form. */}
      <aside id="listing-preview" className="featured-builder-preview" aria-label="Preview of your listing">
        <AdPreview
          draft={draft}
          category={category}
          slot={slot}
          stationName={stationName}
          stationLat={stationLat}
          stationLon={stationLon}
          metric={metric}
          places={places[category]}
          liveSponsors={liveSponsors[category]}
        />
      </aside>
    </div>
  );

  function sentCard() {
    if (state.status !== "sent") return null;
    return (
      <div className="form-card" role="status">
        <h2 className="section-title">Thanks, we got your request</h2>
        <p className="page-sub">
          You asked for the {SLOT_LABELS[slot]} spot in {CATEGORIES.find((item) => item.id === category)?.label} at {stationName}.
        </p>
        <ol className="location-steps">
          <li>We&apos;ll email {state.email || "you"} with the price and a secure link to pay by card.</li>
          <li>After payment we review the listing, usually within one business day.</li>
          <li>Your listing goes live at the top of the list, labeled Sponsored.</li>
        </ol>
        {authConfigured ? (
          <p className="login-note">
            Track your request any time in your <Link href="/business/dashboard">business dashboard</Link>: sign in with{" "}
            {state.email || "the email you used"}.
          </p>
        ) : null}
        <Link href={stationHref} className="action-button secondary">Back to the station</Link>
      </div>
    );
  }

  function formCard() {
    const error = (name: keyof typeof errors) =>
      errors[name] ? (
        <span className="field-error" id={`${name}-error`}>
          {errors[name]}
        </span>
      ) : null;
    const describedBy = (name: keyof typeof errors) => (errors[name] ? `${name}-error` : undefined);

    return (
      <form action={formAction} className="form-card" onChange={updateDraft} noValidate>
        <input type="hidden" name="stationSlug" value={stationSlug} />
        {/* Honeypot for bots; hidden from people and screen readers. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="honeypot" aria-hidden="true" />
        {/* Phones show the preview below the form; desktop has it beside the form already. */}
        <a href="#listing-preview" className="preview-jump mobile-only">
          See how your listing will look ↓
        </a>

        <label className="field">
          <span>Category</span>
          <select
            name="category"
            defaultValue={value("category", initialCategory)}
            onChange={(event) => {
              const next = event.target.value as CategoryId;
              setCategory(next);
              if (takenSlots[next].includes(slot)) setSlot(firstFree(takenSlots[next]));
            }}
            aria-describedby={describedBy("category")}
          >
            {CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          {error("category")}
        </label>

        <fieldset className="spot-picker" aria-describedby={describedBy("slot")}>
          <legend>Which spot?</legend>
          {SPONSOR_SLOTS.map((option) => {
            // When every spot is taken the business can still apply; we offer the next one that opens.
            const taken = takenSlots[category].includes(option) && takenSlots[category].length < SPONSOR_SLOTS.length;
            return (
              <label key={option} className={`spot-option${taken ? " is-taken" : ""}`}>
                <input type="radio" name="slot" value={option} checked={slot === option} disabled={taken} onChange={() => setSlot(option)} />
                <span className="spot-option-copy">
                  <span className="spot-option-title">
                    {SLOT_LABELS[option]}
                    {taken ? <span className="spot-taken">Taken</span> : null}
                  </span>
                  <span className="spot-option-note">{SLOT_NOTES[option]}</span>
                </span>
              </label>
            );
          })}
          {takenSlots[category].length === SPONSOR_SLOTS.length ? (
            <p className="login-note">All three spots are taken right now. Apply anyway and we&apos;ll offer you the next one that opens.</p>
          ) : null}
          {error("slot")}
        </fieldset>

        <label className="field">
          <span>Business name</span>
          <input name="businessName" defaultValue={value("businessName")} list="nearby-businesses" maxLength={80} required aria-invalid={Boolean(errors.businessName)} aria-describedby={describedBy("businessName")} />
          <datalist id="nearby-businesses">
            {[...new Set(places[category].map((place) => place.name))].map((name) => (
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
            <input name="ctaLabel" defaultValue={value("ctaLabel")} maxLength={24} placeholder={PREVIEW_EXAMPLES[category][1].ctaLabel} required aria-invalid={Boolean(errors.ctaLabel)} aria-describedby={describedBy("ctaLabel")} />
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
          {pending ? "Sending…" : `Request the ${SLOT_LABELS[slot]} spot`}
        </button>
        <p className="smallprint">Featured listings are paid monthly and labeled Sponsored. We&apos;ll confirm the price before you pay.</p>
      </form>
    );
  }
}
