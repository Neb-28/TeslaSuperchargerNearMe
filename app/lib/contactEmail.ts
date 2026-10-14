// Emails each Contact page message to our inbox through Resend (the same account and verified
// domain that send sign-in emails). Reply goes straight to the visitor. Server-only.
import type { NewContactMessage } from "./contactForm";
import { CONTACT_EMAIL } from "./site";

const FROM = "Tesla Supercharger Near Me <no-reply@teslasuperchargernearme.com>";

// Returns false when email isn't set up (no RESEND_API_KEY) or Resend refuses the message.
export async function emailContactMessage(message: NewContactMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const name = [message.firstName, message.lastName].filter(Boolean).join(" ");
  // Plain text only, so nothing a visitor types can turn into HTML in our inbox.
  const text = [
    `Name: ${name}`,
    `Email: ${message.email}`,
    message.phone ? `Phone: ${message.phone}` : null,
    "",
    message.message,
    "",
    "Sent from the Contact page. Reply to this email to answer them.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [CONTACT_EMAIL],
      reply_to: message.email,
      subject: `Contact form: ${name}`,
      text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    console.error("Contact email failed", response.status, await response.text().catch(() => ""));
    return false;
  }
  return true;
}
