import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/stations/[id]/photos/route";
import { UPLOADS_PER_EMAIL_PER_DAY } from "@/lib/stationPhotoForm";
import { approvedPhotosForStation, listPhotos, setPhotoStatus } from "@/lib/stationPhotos";
import { superchargers } from "@/lib/superchargers";

// Keep test photos out of the real local store and out of Supabase.
const dir = mkdtempSync(path.join(tmpdir(), "photos-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const station = superchargers[0];

// A photo with detail in it (blurring visibly changes it) and a GPS location in its metadata.
async function testPhoto(width = 800, height = 600) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let index = 0; index < pixels.length; index++) pixels[index] = (index * 37) % 256;
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .withExif({ IFD0: { Make: "TestCam" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "38/1 39/1 0/1" } })
    .jpeg()
    .toBuffer();
}

async function upload(fields: Record<string, string>, photo?: Buffer, stationId = station.id, headers: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  if (photo) form.set("photo", new Blob([new Uint8Array(photo)], { type: "image/jpeg" }), "photo.jpg");
  const request = new Request(`http://localhost/api/stations/${stationId}/photos`, { method: "POST", body: form, headers });
  return POST(request, { params: Promise.resolve({ id: stationId }) });
}

const valid = { email: "driver@example.com", caption: "Stalls are  behind\nthe Starbucks", consent: "yes" };
let run = 0;

describe("POST /api/stations/[id]/photos", () => {
  beforeEach(() => {
    run += 1;
    process.env.PHOTO_STORE_PATH = path.join(dir, `photos-${run}.json`);
    process.env.PHOTO_FILES_DIR = path.join(dir, `files-${run}`);
    delete process.env.GOOGLE_VISION_API_KEY;
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    delete process.env.PHOTO_STORE_PATH;
    delete process.env.PHOTO_FILES_DIR;
    delete process.env.GOOGLE_VISION_API_KEY;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("saves a photo as pending: hidden from the station page until approved", async () => {
    const response = await upload(valid, await testPhoto());
    expect(response.status).toBe(201);

    const [photo] = await listPhotos("pending");
    expect(photo).toMatchObject({
      stationId: station.id,
      caption: "Stalls are behind the Starbucks",
      email: "driver@example.com",
      width: 800,
      height: 600,
      blurStatus: "skipped",
      status: "pending",
    });
    expect(await approvedPhotosForStation(station.id)).toEqual([]);

    await setPhotoStatus(photo.id, "approved");
    expect((await approvedPhotosForStation(station.id)).map((item) => item.id)).toEqual([photo.id]);
  });

  it("stores a resized WebP and a thumbnail, with the GPS location and camera removed", async () => {
    await upload(valid, await testPhoto(3200, 2400));
    const [photo] = await listPhotos("pending");
    const files = process.env.PHOTO_FILES_DIR!;
    expect(readdirSync(path.join(files, station.id)).sort()).toEqual(
      [path.basename(photo.photoPath), path.basename(photo.thumbPath)].sort(),
    );

    const full = await sharp(path.join(files, photo.photoPath)).metadata();
    expect(full).toMatchObject({ format: "webp", width: 1600, height: 1200 });
    expect(full.exif).toBeUndefined();
    const thumb = await sharp(path.join(files, photo.thumbPath)).metadata();
    expect(thumb).toMatchObject({ format: "webp", width: 480, height: 360 });
  });

  it("blurs the faces Vision finds", async () => {
    process.env.GOOGLE_VISION_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        responses: [{ faceAnnotations: [{ boundingPoly: { vertices: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 220 }, { x: 100, y: 220 }] } }] }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect((await upload(valid, await testPhoto())).status).toBe(201);
    const [photo] = await listPhotos("pending");
    expect(photo).toMatchObject({ blurStatus: "blurred", blurredAreas: 1 });

    // The key travels in a header, never in the URL.
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://vision.googleapis.com/v1/images:annotate");
    expect((init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe("test-key");
  });

  it("still saves the photo, marked for a closer look, when the blur check fails", async () => {
    process.env.GOOGLE_VISION_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("quota", { status: 429 })));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await upload(valid, await testPhoto())).status).toBe(201);
    expect((await listPhotos("pending"))[0]).toMatchObject({ blurStatus: "failed", blurredAreas: 0 });
  });

  it("asks for an email, the consent and a photo", async () => {
    const response = await upload({ email: "nope", caption: "", consent: "" });
    expect(response.status).toBe(400);
    expect((await response.json()).errors).toEqual({
      email: "Enter your email address.",
      consent: "Confirm that you took this photo.",
      photo: "Choose a photo.",
    });
    expect(await listPhotos("pending")).toEqual([]);
  });

  it("refuses a caption over 120 characters", async () => {
    const response = await upload({ ...valid, caption: "x".repeat(121) }, await testPhoto());
    expect(response.status).toBe(400);
    expect((await response.json()).errors.caption).toBe("Keep it under 120 characters.");
  });

  it("refuses a file that isn't a photo", async () => {
    const response = await upload(valid, Buffer.from("not an image at all"));
    expect(response.status).toBe(400);
    expect((await response.json()).errors.photo).toBe("That file isn't a photo we can read. Try a JPEG or PNG.");
  });

  it("refuses a photo that's too small to be useful", async () => {
    const response = await upload(valid, await testPhoto(200, 150));
    expect(response.status).toBe(400);
    expect((await response.json()).errors.photo).toMatch(/too small/);
  });

  it("answers 404 for an unknown station", async () => {
    const response = await upload(valid, await testPhoto(), "no-such-station");
    expect(response.status).toBe(404);
  });

  it("quietly drops bot submissions", async () => {
    const response = await upload({ ...valid, website: "https://spam.example" }, await testPhoto());
    expect(response.status).toBe(201);
    expect(await listPhotos("pending")).toEqual([]);
  });

  it(`stops after ${UPLOADS_PER_EMAIL_PER_DAY} photos from one email in a day`, async () => {
    const photo = await testPhoto();
    for (let count = 0; count < UPLOADS_PER_EMAIL_PER_DAY; count++) {
      // A different network address each time, so only the email limit applies.
      expect((await upload(valid, photo, station.id, { "x-forwarded-for": `10.0.0.${count}` })).status).toBe(201);
    }
    const response = await upload({ ...valid, email: "DRIVER@example.com" }, photo, station.id, { "x-forwarded-for": "10.0.0.99" });
    expect(response.status).toBe(429);
  });

  it("answers 503 when photo storage isn't set up", async () => {
    delete process.env.PHOTO_FILES_DIR;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      expect((await upload(valid, await testPhoto())).status).toBe(503);
    } finally {
      if (key) process.env.SUPABASE_SERVICE_ROLE_KEY = key;
    }
  });
});
