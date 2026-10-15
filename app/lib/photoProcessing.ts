// Server-only: turns an uploaded photo into what we store. It turns the photo upright, shrinks it
// to at most 1600 px, blurs faces and license plates (lib/photoBlur.ts), and saves it as WebP plus
// a thumbnail. Re-encoding drops all metadata: GPS location, time taken, camera.
import sharp from "sharp";
import { blurConfigured, findBlurAreas, type Box } from "./photoBlur";
import type { BlurStatus } from "./stationPhotoForm";

const PHOTO_EDGE = 1600;
const THUMB_EDGE = 480;
// Smaller than this on the short side isn't worth showing.
const MIN_EDGE = 300;
const FORMATS = new Set(["jpeg", "png", "webp"]);

export class PhotoError extends Error {}

export type ProcessedPhoto = {
  photo: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
  blurStatus: BlurStatus;
  blurredAreas: number;
};

async function blur(image: Buffer, areas: Box[]) {
  const patches = await Promise.all(
    areas.map(async (area) => ({
      // Strong enough that a face or plate can't be read, scaled to the size of the area.
      input: await sharp(image).extract(area).blur(Math.max(8, Math.min(area.width, area.height) / 4)).toBuffer(),
      left: area.left,
      top: area.top,
    })),
  );
  return patches.length ? sharp(image).composite(patches).toBuffer() : image;
}

export async function processPhoto(upload: Buffer): Promise<ProcessedPhoto> {
  let format: string | undefined;
  try {
    format = (await sharp(upload).metadata()).format;
  } catch {
    throw new PhotoError("That file isn't a photo we can read. Try a JPEG or PNG.");
  }
  if (!format || !FORMATS.has(format)) throw new PhotoError("That file isn't a photo we can read. Try a JPEG or PNG.");

  // Upright and resized, as a high-quality JPEG: what Vision looks at and what we blur.
  const { data: base, info } = await sharp(upload)
    .rotate()
    .resize(PHOTO_EDGE, PHOTO_EDGE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 90 })
    .toBuffer({ resolveWithObject: true });
  if (Math.min(info.width, info.height) < MIN_EDGE) throw new PhotoError("That photo is too small. Use one at least 300 pixels on each side.");

  let areas: Box[] = [];
  let blurStatus: BlurStatus = "skipped";
  if (blurConfigured()) {
    try {
      areas = await findBlurAreas(base, info.width, info.height);
      blurStatus = areas.length ? "blurred" : "none_found";
    } catch (error) {
      // The photo still goes to review; /admin marks it so faces and plates get checked by eye.
      console.error("Photo blur check failed", error instanceof Error ? error.message : error);
      blurStatus = "failed";
    }
  }

  const blurred = await blur(base, areas);
  const photo = await sharp(blurred).webp({ quality: 80 }).toBuffer();
  const thumb = await sharp(blurred).resize(THUMB_EDGE, THUMB_EDGE, { fit: "inside" }).webp({ quality: 75 }).toBuffer();
  return { photo, thumb, width: info.width, height: info.height, blurStatus, blurredAreas: areas.length };
}
