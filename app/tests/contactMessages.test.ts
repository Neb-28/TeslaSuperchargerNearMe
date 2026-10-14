import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGE_MAX, validateContactForm } from "@/lib/contactForm";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const valid = { firstName: "Sam", lastName: "", email: "sam@example.com", dialCode: "+1", phone: "", message: "The Woodbridge station moved." };

describe("contact form validation", () => {
  it("accepts a first name, email and message", () => {
    const result = validateContactForm(form(valid));
    expect(result).toEqual({
      ok: true,
      values: { firstName: "Sam", lastName: null, email: "sam@example.com", phone: null, message: "The Woodbridge station moved." },
    });
  });

  it("joins the dialing code and the phone number", () => {
    const result = validateContactForm(form({ ...valid, dialCode: "+44", phone: "20 7946 0958" }));
    expect(result.ok && result.values.phone).toBe("+44 20 7946 0958");
  });

  it("falls back to +1 for an unknown dialing code", () => {
    const result = validateContactForm(form({ ...valid, dialCode: "+999", phone: "555 0100" }));
    expect(result.ok && result.values.phone).toBe("+1 555 0100");
  });

  it("names every missing or wrong field", () => {
    const result = validateContactForm(form({ firstName: " ", email: "not-an-email", phone: "call me", message: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["email", "firstName", "message", "phone"]);
  });

  it("caps the message length", () => {
    expect(validateContactForm(form({ ...valid, message: "a".repeat(MESSAGE_MAX) })).ok).toBe(true);
    expect(validateContactForm(form({ ...valid, message: "a".repeat(MESSAGE_MAX + 1) })).ok).toBe(false);
  });
});

describe("contact message store (JSON file)", () => {
  beforeEach(() => {
    process.env.CONTACT_STORE_PATH = path.join(mkdtempSync(path.join(tmpdir(), "contact-")), "messages.json");
  });

  it("saves, lists newest first and deletes", async () => {
    const { createContactMessage, deleteContactMessage, listContactMessages } = await import("@/lib/contactMessages");
    const first = await createContactMessage({ firstName: "Ana", lastName: null, email: "ana@example.com", phone: null, message: "First" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await createContactMessage({ firstName: "Ben", lastName: "Li", email: "ben@example.com", phone: "+1 555 0100", message: "Second" });

    expect((await listContactMessages()).map((message) => message.id)).toEqual([second.id, first.id]);
    await deleteContactMessage(first.id);
    expect((await listContactMessages()).map((message) => message.id)).toEqual([second.id]);
  });
});

describe("sending the contact form", () => {
  beforeEach(() => {
    process.env.CONTACT_STORE_PATH = path.join(mkdtempSync(path.join(tmpdir(), "contact-")), "messages.json");
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("emails the message to our inbox, with Reply going to the sender", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "email_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendContactMessage } = await import("@/app/contact/actions");
    const { CONTACT_EMAIL } = await import("@/lib/site");

    expect(await sendContactMessage({ status: "idle" }, form({ ...valid, lastName: "Lee", phone: "555 0100" }))).toEqual({ status: "sent", firstName: "Sam" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ to: [CONTACT_EMAIL], reply_to: "sam@example.com", subject: "Contact form: Sam Lee" });
    expect(body.text).toContain("Phone: +1 555 0100");
    expect(body.text).toContain(valid.message);
  });

  it("still saves the message when the email can't be sent", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const { sendContactMessage } = await import("@/app/contact/actions");
    const { listContactMessages } = await import("@/lib/contactMessages");

    expect((await sendContactMessage({ status: "idle" }, form(valid))).status).toBe("sent");
    expect(await listContactMessages()).toHaveLength(1);
  });

  it("asks the visitor to email us when the message can be neither saved nor emailed", async () => {
    process.env.CONTACT_STORE_PATH = "/dev/null/not-a-folder/messages.json";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendContactMessage } = await import("@/app/contact/actions");

    const state = await sendContactMessage({ status: "idle" }, form(valid));
    expect(state.status).toBe("error");
    if (state.status === "error") expect(state.errors.form).toMatch(/email us/);
  });

  it("stores a valid message and thanks the sender", async () => {
    const { sendContactMessage } = await import("@/app/contact/actions");
    const { listContactMessages } = await import("@/lib/contactMessages");
    expect(await sendContactMessage({ status: "idle" }, form(valid))).toEqual({ status: "sent", firstName: "Sam" });
    expect(await listContactMessages()).toHaveLength(1);
  });

  it("keeps what was typed when something is wrong", async () => {
    const { sendContactMessage } = await import("@/app/contact/actions");
    const state = await sendContactMessage({ status: "idle" }, form({ ...valid, email: "nope" }));
    expect(state.status).toBe("error");
    if (state.status === "error") expect(state.values.message).toBe(valid.message);
  });

  it("quietly drops bot submissions", async () => {
    const { sendContactMessage } = await import("@/app/contact/actions");
    const { listContactMessages } = await import("@/lib/contactMessages");
    await sendContactMessage({ status: "idle" }, form({ ...valid, website: "spam.example" }));
    expect(await listContactMessages()).toHaveLength(0);
  });
});
