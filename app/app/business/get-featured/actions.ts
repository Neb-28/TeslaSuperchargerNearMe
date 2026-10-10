"use server";

import { createFeatured } from "@/lib/featuredStore";
import { validateFeaturedForm, type FeaturedFormErrors } from "@/lib/featuredValidation";
import { placesForStation } from "@/lib/placesData";
import { getStationBySlug } from "@/lib/superchargers";

export type ApplyState =
  | { status: "idle" }
  // `values` lets the form refill itself: React clears form fields after every submit.
  | { status: "error"; errors: FeaturedFormErrors; values: Record<string, string> }
  | { status: "sent"; email: string };

function submitted(form: FormData) {
  const values: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string" && key !== "website") values[key] = value;
  });
  return values;
}

// Business sign-up (PRD "Get featured" steps 1–2). Step 3, paying by card through Stripe
// Checkout, plugs in here once Stripe keys exist; until then applications wait as "pending"
// and we follow up by email. An admin approves before anything goes live (step 4).
export async function applyForFeatured(_previous: ApplyState, form: FormData): Promise<ApplyState> {
  // Bots fill every field, people never see this one.
  if (String(form.get("website") ?? "")) return { status: "sent", email: "" };

  const station = getStationBySlug(String(form.get("stationSlug") ?? ""));
  if (!station) return { status: "error", errors: { stationSlug: "Choose a station." }, values: submitted(form) };

  const category = String(form.get("category"));
  const nearby = placesForStation(station.id)[category as keyof ReturnType<typeof placesForStation>] ?? [];
  const match = (name: string) => nearby.find((place) => place.name.toLowerCase() === name.trim().toLowerCase());

  const result = validateFeaturedForm(form, { requireOwnerConfirmation: true, isNearbyPlace: (name) => Boolean(match(name)) });
  if (!result.ok) return { status: "error", errors: result.errors, values: submitted(form) };

  const place = match(result.values.businessName);
  await createFeatured({
    stationId: station.id,
    category: result.values.category,
    businessName: result.values.businessName,
    kind: result.values.kind,
    offerText: result.values.offerText,
    ctaLabel: result.values.ctaLabel,
    ctaUrl: result.values.ctaUrl,
    address: result.values.address,
    distanceM: place?.distanceM ?? null,
    lat: place?.lat ?? null,
    lon: place?.lon ?? null,
    contactName: result.values.contactName,
    contactEmail: result.values.contactEmail,
    phone: result.values.phone,
    source: "business",
  });
  return { status: "sent", email: result.values.contactEmail };
}
