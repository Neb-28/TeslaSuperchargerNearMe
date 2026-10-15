import { createHmac, randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { emailNewPhoto } from "@/lib/inboxEmail";
import { PhotoError, processPhoto } from "@/lib/photoProcessing";
import { deletePhotoFiles, photoStorageConfigured, savePhotoFiles } from "@/lib/photoStorage";
import {
  UPLOAD_MAX_BYTES,
  UPLOADS_PER_EMAIL_PER_DAY,
  UPLOADS_PER_IP_PER_DAY,
  validatePhotoFields,
  type PhotoFormErrors,
} from "@/lib/stationPhotoForm";
import { createPhoto, recentUploads } from "@/lib/stationPhotos";
import { getStationById, stationHref } from "@/lib/superchargers";

// POST /api/stations/[id]/photos (multipart form): photo (file), caption, email, consent=yes.
// Saves the photo as pending; it shows on the station page once an admin approves it on /admin.
// → 201 { ok: true } | 4xx/5xx { errors: { photo?, caption?, email?, consent?, form? } }

const fail = (errors: PhotoFormErrors, status: number) => Response.json({ errors }, { status });

// The daily limit counts uploads per network address without storing the address itself: a keyed
// hash, so the stored value can't be turned back into an IP. Any server-only secret works as the key.
function ipHash(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
  return createHmac("sha256", process.env.ADMIN_PASSWORD || "station-photos").update(ip).digest("hex");
}

export async function POST(request: Request, context: RouteContext<"/api/stations/[id]/photos">) {
  const { id } = await context.params;
  const station = getStationById(id);
  if (!station) return fail({ form: "Station not found." }, 404);
  if (!photoStorageConfigured()) return fail({ form: "Photo uploads aren't available yet." }, 503);

  // The form fields add a little on top of the photo itself.
  if (Number(request.headers.get("content-length") ?? 0) > UPLOAD_MAX_BYTES + 64 * 1024) {
    return fail({ photo: "That photo is too large. Try another one." }, 413);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail({ form: "We couldn't read your upload. Please try again." }, 400);
  }

  // Bots fill every field, people never see this one.
  if (String(form.get("website") ?? "")) return Response.json({ ok: true }, { status: 201 });

  const result = validatePhotoFields(form);
  const file = form.get("photo");
  const tooLarge = file instanceof File && file.size > UPLOAD_MAX_BYTES;
  const errors: PhotoFormErrors = result.ok ? {} : { ...result.errors };
  if (!(file instanceof File) || file.size === 0) errors.photo = "Choose a photo.";
  else if (tooLarge) errors.photo = "That photo is too large. Try another one.";
  if (!result.ok || Object.keys(errors).length) return fail(errors, tooLarge ? 413 : 400);

  const hash = ipHash(request);
  const recent = await recentUploads({ email: result.values.email, ipHash: hash });
  if (recent.byEmail >= UPLOADS_PER_EMAIL_PER_DAY || recent.byIp >= UPLOADS_PER_IP_PER_DAY) {
    return fail({ form: "You've sent the most photos we take in one day. Please try again tomorrow." }, 429);
  }

  let processed;
  try {
    processed = await processPhoto(Buffer.from(await (file as File).arrayBuffer()));
  } catch (error) {
    if (error instanceof PhotoError) return fail({ photo: error.message }, 400);
    throw error;
  }

  // Random names: nobody can guess the address of a photo that isn't approved yet.
  const name = randomUUID();
  const photoPath = `${station.id}/${name}.webp`;
  const thumbPath = `${station.id}/${name}-thumb.webp`;
  await savePhotoFiles([
    { path: photoPath, data: processed.photo },
    { path: thumbPath, data: processed.thumb },
  ]);

  let photo;
  try {
    photo = await createPhoto({
      stationId: station.id,
      photoPath,
      thumbPath,
      width: processed.width,
      height: processed.height,
      caption: result.values.caption,
      email: result.values.email,
      ipHash: hash,
      blurStatus: processed.blurStatus,
      blurredAreas: processed.blurredAreas,
    });
  } catch (error) {
    // No record means nobody could ever review or remove these files.
    await deletePhotoFiles([photoPath, thumbPath]).catch(() => {});
    throw error;
  }

  // The photo is saved for /admin, so a failed email only gets logged.
  await emailNewPhoto(photo, { name: station.name, href: stationHref(station) }).catch((error) => {
    console.error("Station photo email failed", error);
    Sentry.captureException(error, { tags: { form: "station-photo", step: "email" } });
  });
  Sentry.logger.info(Sentry.logger.fmt`Station photo uploaded for ${station.id}`, {
    "station.id": station.id,
    "photo.blur_status": processed.blurStatus,
    "photo.blurred_areas": processed.blurredAreas,
  });
  return Response.json({ ok: true }, { status: 201 });
}
