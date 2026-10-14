"use server";

import { emailContactMessage } from "@/lib/inboxEmail";
import { validateContactForm, type ContactFormErrors } from "@/lib/contactForm";
import { createContactMessage } from "@/lib/contactMessages";
import { CONTACT_EMAIL } from "@/lib/site";

export type ContactState =
  | { status: "idle" }
  // `values` lets the form refill itself: React clears form fields after every submit.
  | { status: "error"; errors: ContactFormErrors & { form?: string }; values: Record<string, string> }
  | { status: "sent"; firstName: string };

export async function sendContactMessage(_previous: ContactState, form: FormData): Promise<ContactState> {
  // Bots fill every field, people never see this one.
  if (String(form.get("website") ?? "")) return { status: "sent", firstName: "" };

  const values: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string" && key !== "website") values[key] = value;
  });
  const result = validateContactForm(form);
  if (!result.ok) return { status: "error", errors: result.errors, values };

  // Saved for /admin and emailed to our inbox; either one is enough to not lose the message.
  const [saved, emailed] = await Promise.all([
    createContactMessage(result.values).then(
      () => true,
      (error) => {
        console.error("Saving contact message failed", error);
        return false;
      },
    ),
    emailContactMessage(result.values).catch((error) => {
      console.error("Contact email failed", error);
      return false;
    }),
  ]);
  if (!saved && !emailed) {
    return { status: "error", errors: { form: `We couldn't send your message. Please email us at ${CONTACT_EMAIL}.` }, values };
  }
  return { status: "sent", firstName: result.values.firstName };
}
