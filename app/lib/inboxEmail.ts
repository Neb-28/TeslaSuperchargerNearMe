// Emails our inbox (CONTACT_EMAIL) through Resend, the same account and verified domain that send
// sign-in emails: Contact page messages, Get featured requests and new station photos. Reply goes
// straight to the sender. Server-only.
import type { NewContactMessage } from "./contactForm";
import { SLOT_LABELS, type FeaturedListing } from "./featured";
import { categoryLabel } from "./places";
import { absoluteUrl, CONTACT_EMAIL } from "./site";
import type { BlurStatus, StationPhoto } from "./stationPhotoForm";

const FROM = "Tesla Supercharger Near Me <no-reply@teslasuperchargernearme.com>";

// Plain text only, so nothing a visitor types can turn into HTML in our inbox. Lines that are
// null are left out. Returns false when email isn't set up (no RESEND_API_KEY) or Resend refuses it.
// `form` names the email in logs; the subject can't, since it carries the visitor's name.
async function sendToInbox({ form, subject, replyTo, lines }: { form: string; subject: string; replyTo: string; lines: (string | null)[] }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [CONTACT_EMAIL],
      reply_to: replyTo,
      subject,
      text: lines.filter((line) => line !== null).join("\n"),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    console.error("Inbox email failed", form, response.status, await response.text().catch(() => ""));
    return false;
  }
  return true;
}

export function emailContactMessage(message: NewContactMessage) {
  const name = [message.firstName, message.lastName].filter(Boolean).join(" ");
  return sendToInbox({
    form: "contact",
    subject: `Contact form: ${name}`,
    replyTo: message.email,
    lines: [
      `Name: ${name}`,
      `Email: ${message.email}`,
      message.phone ? `Phone: ${message.phone}` : null,
      "",
      message.message,
      "",
      "Sent from the Contact page. Reply to this email to answer them.",
    ],
  });
}

export function emailFeaturedRequest(listing: FeaturedListing, station: { name: string; href: string }) {
  return sendToInbox({
    form: "get-featured",
    subject: `Get featured request: ${listing.businessName} (${SLOT_LABELS[listing.slot]}) at ${station.name}`,
    replyTo: listing.contactEmail,
    lines: [
      `Business: ${listing.businessName}`,
      `Type of business: ${listing.kind}`,
      `Spot: ${SLOT_LABELS[listing.slot]} in ${categoryLabel(listing.category)}`,
      `Station: ${station.name}`,
      `Station page: ${absoluteUrl(station.href)}`,
      listing.distanceM != null ? `Distance from the station: ${listing.distanceM} m` : null,
      listing.address ? `Address (not on our nearby list, check the distance): ${listing.address}` : null,
      "",
      `Offer: ${listing.offerText}`,
      `Button: ${listing.ctaLabel} -> ${listing.ctaUrl}`,
      "",
      `Contact: ${listing.contactName}`,
      `Email: ${listing.contactEmail}`,
      listing.phone ? `Phone: ${listing.phone}` : null,
      "",
      `Review it on ${absoluteUrl("/admin")}. Reply to this email to answer them with the price and payment link.`,
    ],
  });
}

const BLUR_NOTES: Record<BlurStatus, string> = {
  blurred: "Faces and license plates were blurred automatically",
  none_found: "No faces or license plates were found to blur",
  skipped: "Not blurred: GOOGLE_VISION_API_KEY isn't set. Check for faces and plates before approving",
  failed: "Not blurred: the blur check failed. Check for faces and plates before approving",
};

export function emailNewPhoto(photo: StationPhoto, station: { name: string; href: string }) {
  return sendToInbox({
    form: "station-photo",
    subject: `New station photo at ${station.name}`,
    replyTo: photo.email,
    lines: [
      `Station: ${station.name}`,
      `Station page: ${absoluteUrl(station.href)}`,
      photo.caption ? `Caption: ${photo.caption}` : "No caption",
      `${BLUR_NOTES[photo.blurStatus]}${photo.blurredAreas ? ` (${photo.blurredAreas} area${photo.blurredAreas === 1 ? "" : "s"})` : ""}.`,
      `From: ${photo.email}`,
      "",
      `Review it on ${absoluteUrl("/admin")}. It stays hidden until you approve it.`,
    ],
  });
}
