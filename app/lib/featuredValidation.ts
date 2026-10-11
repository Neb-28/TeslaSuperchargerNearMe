// Validates the "Get featured" form (business sign-up) and the admin "Add listing" form.
import { isSponsorSlot, type SponsorSlot } from "./featured";
import { isCategoryId, type CategoryId } from "./places";

export type FeaturedFormValues = {
  stationSlug: string;
  category: CategoryId;
  slot: SponsorSlot;
  businessName: string;
  kind: string;
  offerText: string;
  ctaLabel: string;
  ctaUrl: string;
  address: string | null;
  contactName: string;
  contactEmail: string;
  phone: string | null;
};

export type FeaturedFormErrors = Partial<Record<keyof FeaturedFormValues | "owner", string>>;

export type ValidationResult = { ok: true; values: FeaturedFormValues } | { ok: false; errors: FeaturedFormErrors };

export const OFFER_MAX = 50; // PRD: offer text max 50 characters

function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function validateFeaturedForm(
  form: FormData,
  options: { requireOwnerConfirmation: boolean; isNearbyPlace: (name: string) => boolean },
): ValidationResult {
  const errors: FeaturedFormErrors = {};
  const category = text(form, "category");
  const businessName = text(form, "businessName");
  const ctaUrl = text(form, "ctaUrl");
  const contactEmail = text(form, "contactEmail");
  const address = text(form, "address");
  const offerText = text(form, "offerText");

  if (!text(form, "stationSlug")) errors.stationSlug = "Choose a station.";
  if (!isCategoryId(category)) errors.category = "Choose a category.";
  // Older forms send no spot: that's the #1 Featured spot.
  const slot = Number(text(form, "slot") || 1);
  if (!isSponsorSlot(slot)) errors.slot = "Choose a spot.";
  if (businessName.length < 2 || businessName.length > 80) errors.businessName = "Enter your business name.";
  if (text(form, "kind").length < 2 || text(form, "kind").length > 60) errors.kind = "Describe your business in a few words (up to 60 characters).";
  if (offerText.length < 3) errors.offerText = "Add an offer for EV drivers.";
  else if (offerText.length > OFFER_MAX) errors.offerText = `Keep the offer to ${OFFER_MAX} characters or fewer.`;
  if (text(form, "ctaLabel").length < 2 || text(form, "ctaLabel").length > 24) errors.ctaLabel = "Add a short button label (up to 24 characters).";

  try {
    const url = new URL(ctaUrl);
    if (url.protocol !== "https:") throw new Error();
  } catch {
    errors.ctaUrl = "Enter a web address starting with https://";
  }

  if (text(form, "contactName").length < 2) errors.contactName = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail)) errors.contactEmail = "Enter a valid email address.";
  // Businesses already on our nearby list have a known distance; anyone else gives an address
  // so we can check they're within walking distance (PRD sign-up step 1).
  if (businessName && !options.isNearbyPlace(businessName) && address.length < 5) {
    errors.address = "Your business isn't on our nearby list yet, so add its street address.";
  }
  if (options.requireOwnerConfirmation && form.get("owner") !== "yes") errors.owner = "Confirm that you own or manage this business.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    values: {
      stationSlug: text(form, "stationSlug"),
      category: category as CategoryId,
      slot: slot as SponsorSlot,
      businessName,
      kind: text(form, "kind"),
      offerText,
      ctaLabel: text(form, "ctaLabel"),
      ctaUrl,
      address: address || null,
      contactName: text(form, "contactName"),
      contactEmail,
      phone: text(form, "phone") || null,
    },
  };
}
