// Server-only storage for station photo records (the files themselves are in lib/photoStorage.ts).
// Like contact messages (lib/contactMessages.ts), they live in the Postgres `station_photos` table
// when DATABASE_URL is set, and otherwise (or when PHOTO_STORE_PATH is set, in tests) in a
// git-ignored JSON file.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";
import { photoUrl } from "./photoStorage";
import type { NewStationPhoto, PhotoStatus, PublicPhoto, StationPhoto } from "./stationPhotoForm";

// At most this many photos show on a station page, newest first.
const PHOTOS_PER_STATION = 24;

function storedInDatabase() {
  return !process.env.PHOTO_STORE_PATH && Boolean(db());
}

function storePath() {
  return process.env.PHOTO_STORE_PATH ?? path.join(process.cwd(), "data", "station-photos.json");
}

async function readAll(): Promise<StationPhoto[]> {
  try {
    return JSON.parse(await readFile(storePath(), "utf8")) as StationPhoto[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeAll(photos: StationPhoto[]) {
  await mkdir(path.dirname(storePath()), { recursive: true });
  await writeFile(storePath(), JSON.stringify(photos, null, 2));
}

type Row = {
  id: string;
  station_id: string;
  photo_path: string;
  thumb_path: string;
  width: number;
  height: number;
  caption: string | null;
  email: string;
  ip_hash: string;
  blur_status: StationPhoto["blurStatus"];
  blurred_areas: number;
  status: PhotoStatus;
  created_at: Date;
  reviewed_at: Date | null;
};

function fromRow(row: Row): StationPhoto {
  return {
    id: row.id,
    stationId: row.station_id,
    photoPath: row.photo_path,
    thumbPath: row.thumb_path,
    width: row.width,
    height: row.height,
    caption: row.caption,
    email: row.email,
    ipHash: row.ip_hash,
    blurStatus: row.blur_status,
    blurredAreas: row.blurred_areas,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
  };
}

const newestFirst = (a: StationPhoto, b: StationPhoto) => b.createdAt.localeCompare(a.createdAt);

export function toPublicPhoto(photo: StationPhoto): PublicPhoto {
  return {
    id: photo.id,
    url: photoUrl(photo.photoPath),
    thumbUrl: photoUrl(photo.thumbPath),
    width: photo.width,
    height: photo.height,
    caption: photo.caption,
    createdAt: photo.createdAt,
  };
}

export async function createPhoto(input: NewStationPhoto) {
  if (storedInDatabase()) {
    const [row] = await db()!<Row[]>`
      insert into station_photos ${db()!({
        station_id: input.stationId,
        photo_path: input.photoPath,
        thumb_path: input.thumbPath,
        width: input.width,
        height: input.height,
        caption: input.caption,
        email: input.email,
        ip_hash: input.ipHash,
        blur_status: input.blurStatus,
        blurred_areas: input.blurredAreas,
      })}
      returning *`;
    return fromRow(row);
  }

  const photos = await readAll();
  const photo: StationPhoto = { ...input, id: randomUUID(), status: "pending", createdAt: new Date().toISOString(), reviewedAt: null };
  photos.push(photo);
  await writeAll(photos);
  return photo;
}

// Uploads in the last 24 hours from this email address or this network address, for the daily limits.
export async function recentUploads({ email, ipHash }: { email: string; ipHash: string }) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (storedInDatabase()) {
    const [counts] = await db()!<{ by_email: number; by_ip: number }[]>`
      select
        count(*) filter (where lower(email) = lower(${email}))::int as by_email,
        count(*) filter (where ip_hash = ${ipHash})::int as by_ip
      from station_photos
      where created_at > ${since} and (lower(email) = lower(${email}) or ip_hash = ${ipHash})`;
    return { byEmail: counts.by_email, byIp: counts.by_ip };
  }
  const recent = (await readAll()).filter((photo) => new Date(photo.createdAt) > since);
  return {
    byEmail: recent.filter((photo) => photo.email.toLowerCase() === email.toLowerCase()).length,
    byIp: recent.filter((photo) => photo.ipHash === ipHash).length,
  };
}

// A station's approved photos, newest first. Station pages must load even if the database is
// unreachable, so a failed lookup means "no photos" (and is logged).
export async function approvedPhotosForStation(stationId: string): Promise<StationPhoto[]> {
  if (storedInDatabase()) {
    try {
      const rows = await db()!<Row[]>`
        select * from station_photos
        where station_id = ${stationId} and status = 'approved'
        order by created_at desc
        limit ${PHOTOS_PER_STATION}`;
      return rows.map(fromRow);
    } catch (error) {
      console.error("Station photos lookup failed", error);
      return [];
    }
  }
  return (await readAll())
    .filter((photo) => photo.stationId === stationId && photo.status === "approved")
    .sort(newestFirst)
    .slice(0, PHOTOS_PER_STATION);
}

// For /admin: every photo with this status, newest first (approved: the latest `limit`).
export async function listPhotos(status: PhotoStatus, limit = 100) {
  if (storedInDatabase()) {
    return (await db()!<Row[]>`select * from station_photos where status = ${status} order by created_at desc limit ${limit}`).map(fromRow);
  }
  return (await readAll()).filter((photo) => photo.status === status).sort(newestFirst).slice(0, limit);
}

export async function getPhoto(id: string) {
  if (storedInDatabase()) {
    const [row] = await db()!<Row[]>`select * from station_photos where id::text = ${id}`;
    return row ? fromRow(row) : null;
  }
  return (await readAll()).find((photo) => photo.id === id) ?? null;
}

export async function setPhotoStatus(id: string, status: PhotoStatus) {
  if (storedInDatabase()) {
    const [row] = await db()!<Row[]>`
      update station_photos set status = ${status}, reviewed_at = now()
      where id::text = ${id}
      returning *`;
    return row ? fromRow(row) : null;
  }
  const photos = await readAll();
  const photo = photos.find((item) => item.id === id);
  if (!photo) return null;
  Object.assign(photo, { status, reviewedAt: new Date().toISOString() });
  await writeAll(photos);
  return photo;
}

export async function deletePhotoRecord(id: string) {
  if (storedInDatabase()) {
    await db()!`delete from station_photos where id::text = ${id}`;
    return;
  }
  await writeAll((await readAll()).filter((photo) => photo.id !== id));
}
