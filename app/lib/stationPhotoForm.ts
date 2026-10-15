// Station photo uploads: the fields' limits and validation. Shared by the upload page (browser)
// and the API route, so it must not import anything server-only.
export const CAPTION_MAX = 120;
// What a visitor may pick on their phone. The page shrinks it to at most UPLOAD_EDGE px (as a
// JPEG) before sending, which keeps uploads well under the server's limit.
export const PICK_MAX_BYTES = 20 * 1024 * 1024;
export const UPLOAD_EDGE = 2048;
// What the server accepts (Vercel functions take request bodies up to 4.5 MB).
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
// Daily limits, per email address and per network address.
export const UPLOADS_PER_EMAIL_PER_DAY = 5;
export const UPLOADS_PER_IP_PER_DAY = 10;

// Rejected photos are deleted outright, so these are the only two states.
export type PhotoStatus = "pending" | "approved";
export type BlurStatus = "blurred" | "none_found" | "skipped" | "failed";

export type StationPhoto = {
  id: string;
  stationId: string;
  photoPath: string;
  thumbPath: string;
  width: number;
  height: number;
  caption: string | null;
  email: string;
  ipHash: string;
  blurStatus: BlurStatus;
  blurredAreas: number;
  status: PhotoStatus;
  createdAt: string;
  reviewedAt: string | null;
};

export type NewStationPhoto = Omit<StationPhoto, "id" | "status" | "createdAt" | "reviewedAt">;

// What visitors may see of a photo: never the uploader's email or network address.
export type PublicPhoto = { id: string; url: string; thumbUrl: string; width: number; height: number; caption: string | null; createdAt: string };

export type PhotoFormErrors = Partial<Record<"photo" | "caption" | "email" | "consent" | "form", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePhotoFields(form: FormData): { ok: true; values: { caption: string | null; email: string } } | { ok: false; errors: PhotoFormErrors } {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  // One line of text: newlines and runs of spaces become single spaces.
  const caption = text("caption").replace(/\s+/g, " ");
  const email = text("email");
  const errors: PhotoFormErrors = {};

  if (caption.length > CAPTION_MAX) errors.caption = `Keep it under ${CAPTION_MAX} characters.`;
  if (!EMAIL.test(email) || email.length > 254) errors.email = "Enter your email address.";
  if (form.get("consent") !== "yes") errors.consent = "Confirm that you took this photo.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, values: { caption: caption || null, email } };
}

// "Oct 2026", for "Driver photo · Oct 2026".
export function photoMonth(createdAt: string) {
  return new Date(createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
