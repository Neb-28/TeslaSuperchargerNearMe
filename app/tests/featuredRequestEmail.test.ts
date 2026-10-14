import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const request = {
  stationSlug: "potomac-town-place-n12944744239",
  category: "food",
  slot: "1",
  businessName: "Sam's Test Diner",
  kind: "Burgers and shakes",
  offerText: "10% off while you charge",
  ctaLabel: "Claim offer",
  ctaUrl: "https://example.com",
  address: "123 Example Street, Woodbridge, VA",
  contactName: "Sam Lee",
  contactEmail: "sam@example.com",
  phone: "555 0100",
  owner: "yes",
};

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe("Get featured request email", () => {
  beforeEach(() => {
    process.env.FEATURED_STORE_PATH = path.join(mkdtempSync(path.join(tmpdir(), "featured-")), "listings.json");
    process.env.RESEND_API_KEY = "re_test";
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("emails our inbox with the request, with Reply going to the business", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "email_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { applyForFeatured } = await import("@/app/business/get-featured/actions");
    const { CONTACT_EMAIL } = await import("@/lib/site");

    expect(await applyForFeatured({ status: "idle" }, form(request))).toEqual({ status: "sent", email: "sam@example.com" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ to: [CONTACT_EMAIL], reply_to: "sam@example.com" });
    expect(body.subject).toContain("Sam's Test Diner (#1 Featured)");
    expect(body.text).toContain("Offer: 10% off while you charge");
    expect(body.text).toContain("Phone: 555 0100");
  });

  it("still takes the request when the email can't be sent", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const { applyForFeatured } = await import("@/app/business/get-featured/actions");
    const { listFeatured } = await import("@/lib/featuredStore");

    expect((await applyForFeatured({ status: "idle" }, form(request))).status).toBe("sent");
    expect(await listFeatured()).toHaveLength(1);
  });
});
