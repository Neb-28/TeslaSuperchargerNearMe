"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin, logIn, logOut } from "@/lib/adminAuth";
import { deleteContactMessage } from "@/lib/contactMessages";
import { isSponsorSlot, SLOT_LABELS, type FeaturedStatus } from "@/lib/featured";
import { createFeatured, deleteFeatured, setFeaturedStatus, SlotTakenError, updateFeatured } from "@/lib/featuredStore";
import { validateFeaturedForm } from "@/lib/featuredValidation";
import { deletePhotoFiles } from "@/lib/photoStorage";
import { deletePhotoRecord, getPhoto, setPhotoStatus } from "@/lib/stationPhotos";
import { getStationById, getStationBySlug, stationHref } from "@/lib/superchargers";

// Every action checks the session itself; a page check alone wouldn't protect a forged POST.
async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin");
}

function done(message: string, kind: "msg" | "err" = "msg"): never {
  revalidatePath("/admin");
  redirect(`/admin?${kind}=${encodeURIComponent(message)}`);
}

export async function loginAction(form: FormData) {
  const ok = await logIn(String(form.get("password") ?? ""));
  redirect(ok ? "/admin" : "/admin?err=Wrong%20password");
}

export async function logoutAction() {
  await logOut();
  redirect("/admin");
}

const STATUSES: FeaturedStatus[] = ["pending", "live", "paused", "rejected"];

export async function setStatusAction(form: FormData) {
  await requireAdmin();
  const status = String(form.get("status")) as FeaturedStatus;
  if (!STATUSES.includes(status)) done("Unknown status.", "err");
  try {
    const listing = await setFeaturedStatus(String(form.get("id")), status);
    if (!listing) done("That listing no longer exists.", "err");
    revalidatePath("/supercharger/[state]/[city]/[slug]", "page");
    done(`${listing.businessName} is now ${status}.`);
  } catch (error) {
    if (error instanceof SlotTakenError) done(error.message, "err");
    throw error;
  }
}

// Move a listing to another spot (#1 Featured, #2 or #3 Sponsored). A live listing can only move
// to a free spot.
export async function setSlotAction(form: FormData) {
  await requireAdmin();
  const slot = Number(form.get("slot"));
  if (!isSponsorSlot(slot)) done("Unknown spot.", "err");
  try {
    const listing = await updateFeatured(String(form.get("id")), { slot });
    if (!listing) done("That listing no longer exists.", "err");
    revalidatePath("/supercharger/[state]/[city]/[slug]", "page");
    done(`${listing.businessName} is now in the ${SLOT_LABELS[slot]} spot.`);
  } catch (error) {
    if (error instanceof SlotTakenError) done(error.message, "err");
    throw error;
  }
}

export async function deleteAction(form: FormData) {
  await requireAdmin();
  await deleteFeatured(String(form.get("id")));
  revalidatePath("/supercharger/[state]/[city]/[slug]", "page");
  done("Listing deleted.");
}

export async function deleteMessageAction(form: FormData) {
  await requireAdmin();
  await deleteContactMessage(String(form.get("id")));
  done("Message deleted.");
}

// "We can also add it on our end": admin-created listings go live straight away.
export async function addListingAction(form: FormData) {
  await requireAdmin();
  const slugInput = String(form.get("stationSlug") ?? "").trim();
  // Accept a full station URL as well as a bare slug.
  const slug = slugInput.split("/").filter(Boolean).pop() ?? "";
  const station = getStationBySlug(slug);
  if (!station) done("Station not found. Paste the station page's address.", "err");
  form.set("stationSlug", slug);

  const category = String(form.get("category"));
  // Loaded only here: the places data is about 18 MB, and importing it at the top made every
  // admin page start (sign-in included) parse it first.
  const { placesForStation } = await import("@/lib/placesData");
  const nearby = placesForStation(station.id)[category as keyof ReturnType<typeof placesForStation>] ?? [];
  const match = (name: string) => nearby.find((place) => place.name.toLowerCase() === name.trim().toLowerCase());
  const result = validateFeaturedForm(form, { requireOwnerConfirmation: false, isNearbyPlace: (name) => Boolean(match(name)) });
  if (!result.ok) done(Object.values(result.errors).join(" "), "err");

  const place = match(result.values.businessName);
  try {
    await createFeatured(
      {
        stationId: station.id,
        category: result.values.category,
        slot: result.values.slot,
        businessName: result.values.businessName,
        kind: result.values.kind,
        offerText: result.values.offerText,
        ctaLabel: result.values.ctaLabel,
        ctaUrl: result.values.ctaUrl,
        address: result.values.address,
        distanceM: place?.distanceM ?? null,
        lat: place?.lat ?? null,
        lon: place?.lon ?? null,
        contactName: result.values.contactName,
        contactEmail: result.values.contactEmail,
        phone: result.values.phone,
        source: "admin",
      },
      "live",
    );
  } catch (error) {
    if (error instanceof SlotTakenError) done(error.message, "err");
    throw error;
  }
  revalidatePath(stationHref(station));
  done(`${result.values.businessName} is live on ${station.name}.`);
}

// ---------- Station photos ----------

// A station page shows a photo change right away, not at the next deploy.
function refreshStation(stationId: string) {
  const station = getStationById(stationId);
  if (station) revalidatePath(stationHref(station));
}

export async function approvePhotoAction(form: FormData) {
  await requireAdmin();
  const photo = await setPhotoStatus(String(form.get("id")), "approved");
  if (!photo) done("That photo no longer exists.", "err");
  refreshStation(photo.stationId);
  done("Photo approved. It's on the station page now.");
}

// Rejecting a pending photo and deleting an approved one are the same: record and files go.
export async function deletePhotoAction(form: FormData) {
  await requireAdmin();
  const photo = await getPhoto(String(form.get("id")));
  if (!photo) done("That photo no longer exists.", "err");
  await deletePhotoFiles([photo.photoPath, photo.thumbPath]);
  await deletePhotoRecord(photo.id);
  refreshStation(photo.stationId);
  done(photo.status === "pending" ? "Photo rejected and deleted." : "Photo deleted.");
}
