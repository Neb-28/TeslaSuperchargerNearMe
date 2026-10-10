import { describe, expect, it } from "vitest";
import { validateFeaturedForm } from "@/lib/featuredValidation";

const nearby = new Set(["greenline deli"]);
const options = { requireOwnerConfirmation: true, isNearbyPlace: (name: string) => nearby.has(name.toLowerCase()) };

function form(overrides: Record<string, string | null> = {}) {
  const values: Record<string, string | null> = {
    stationSlug: "potomac-town-place-n12944744239",
    category: "food",
    businessName: "Greenline Deli",
    kind: "Sandwiches to go",
    offerText: "Free cookie with any sandwich",
    ctaLabel: "Order ahead",
    ctaUrl: "https://greenline.example/order",
    address: "",
    contactName: "Alex Kim",
    contactEmail: "alex@greenline.example",
    phone: "",
    owner: "yes",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== null) data.set(key, value);
  return data;
}

describe("Get featured form validation", () => {
  it("accepts a complete form for a business on the nearby list", () => {
    const result = validateFeaturedForm(form(), options);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.values).toMatchObject({ businessName: "Greenline Deli", address: null, phone: null });
  });

  it("limits the offer to 50 characters (PRD)", () => {
    const result = validateFeaturedForm(form({ offerText: "x".repeat(51) }), options);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.offerText).toMatch(/50/);
  });

  it("requires an https link for the button", () => {
    for (const ctaUrl of ["http://greenline.example", "greenline.example", "javascript:alert(1)"]) {
      const result = validateFeaturedForm(form({ ctaUrl }), options);
      expect(result.ok).toBe(false);
    }
  });

  it("asks for an address when the business isn't on the nearby list", () => {
    const missing = validateFeaturedForm(form({ businessName: "Brand New Bakery" }), options);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.address).toBeTruthy();

    const given = validateFeaturedForm(form({ businessName: "Brand New Bakery", address: "12 Main St, Woodbridge, VA" }), options);
    expect(given.ok).toBe(true);
  });

  it("requires owners to confirm, but not admins", () => {
    expect(validateFeaturedForm(form({ owner: null }), options).ok).toBe(false);
    expect(validateFeaturedForm(form({ owner: null }), { ...options, requireOwnerConfirmation: false }).ok).toBe(true);
  });

  it("rejects an unknown category and a bad email", () => {
    const result = validateFeaturedForm(form({ category: "casinos", contactEmail: "not-an-email" }), options);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["category", "contactEmail"]);
  });
});
