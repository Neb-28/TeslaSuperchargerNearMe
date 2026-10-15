// Server-only: station photo files, in the public `station-photos` bucket in Supabase Storage
// (supabase/migrations/20261014000000_station_photos.sql). Uploads and deletes use the service
// role key; visitors load the files straight from Supabase's CDN.
// Moving to another store later (e.g. Cloudflare R2) only means changing this file.
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./supabase/env";

const BUCKET = "station-photos";
// Every file has a new random name, so browsers and the CDN may keep it for a year.
const CACHE_SECONDS = String(365 * 24 * 60 * 60);

// Tests (and local experiments) write files to a folder instead.
const localDir = () => process.env.PHOTO_FILES_DIR;

export function photoStorageConfigured() {
  return Boolean(localDir() || (SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY));
}

function storage() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }).storage.from(BUCKET);
}

export function photoUrl(filePath: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;
}

export async function savePhotoFiles(files: { path: string; data: Buffer }[]) {
  const dir = localDir();
  if (dir) {
    for (const file of files) {
      await mkdir(path.dirname(path.join(dir, file.path)), { recursive: true });
      await writeFile(path.join(dir, file.path), file.data);
    }
    return;
  }
  for (const file of files) {
    const { error } = await storage().upload(file.path, file.data, { contentType: "image/webp", cacheControl: CACHE_SECONDS, upsert: false });
    if (error) throw new Error(`Photo upload to storage failed: ${error.message}`);
  }
}

export async function deletePhotoFiles(paths: string[]) {
  const dir = localDir();
  if (dir) {
    await Promise.all(paths.map((file) => rm(path.join(dir, file), { force: true })));
    return;
  }
  const { error } = await storage().remove(paths);
  if (error) throw new Error(`Deleting photo files failed: ${error.message}`);
}
