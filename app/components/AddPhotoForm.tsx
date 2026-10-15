"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CAPTION_MAX, PICK_MAX_BYTES, UPLOAD_EDGE, UPLOAD_MAX_BYTES, validatePhotoFields, type PhotoFormErrors } from "@/lib/stationPhotoForm";

type AddPhotoFormProps = {
  stationId: string;
  stationName: string;
  stationHref: string;
  // Only promise blurring when the server will actually do it.
  blurOn: boolean;
};

const UNREADABLE = "We couldn't read this photo. Try a JPEG or PNG.";

// Shrinks the photo on the phone before sending: at most UPLOAD_EDGE px, as a JPEG. That keeps the
// upload small on mobile data, turns iPhone HEIC photos into JPEGs, and drops the photo's
// metadata (the server re-encodes it again anyway).
async function preparePhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, UPLOAD_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (blob) return blob;
  } catch {
    // Browsers without createImageBitmap support for this file: send it as it is if we can.
  }
  if ((file.type === "image/jpeg" || file.type === "image/png") && file.size <= UPLOAD_MAX_BYTES) return file;
  throw new Error(UNREADABLE);
}

export default function AddPhotoForm({ stationId, stationName, stationHref, blurOn }: AddPhotoFormProps) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<PhotoFormErrors>({});
  const [captionLength, setCaptionLength] = useState(0);
  // The "Take a photo / Choose from your photos" menu under the photo box (phones).
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  // The menu closes on Escape or a tap anywhere else.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    const onPointer = (event: PointerEvent) => {
      if (!picker.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);

  // Phones get the two choices; computers rarely have a useful camera, so the file picker opens straight away.
  function openPicker() {
    if (window.matchMedia("(pointer: coarse)").matches) setMenuOpen((open) => !open);
    else libraryInput.current?.click();
  }

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Picking the same file again should still trigger a change.
    event.target.value = "";
    setMenuOpen(false);
    if (file) void acceptPhoto(file);
  }

  async function acceptPhoto(file: File) {
    if (file.size > PICK_MAX_BYTES) {
      setErrors({ photo: "That photo is larger than 20 MB. Try another one." });
      return;
    }
    setPreparing(true);
    setErrors({});
    try {
      const prepared = await preparePhoto(file);
      setPhoto(prepared);
      setPreview(URL.createObjectURL(prepared));
    } catch {
      setErrors({ photo: UNREADABLE });
    } finally {
      setPreparing(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    // Every problem at once, with the server's own rules.
    const checked = validatePhotoFields(data);
    const found: PhotoFormErrors = checked.ok ? {} : { ...checked.errors };
    if (!photo) found.photo = "Choose a photo.";
    if (!photo || Object.keys(found).length) {
      setErrors(found);
      return;
    }
    data.set("photo", photo, "photo.jpg");
    setSending(true);
    setErrors({});
    try {
      const response = await fetch(`/api/stations/${encodeURIComponent(stationId)}/photos`, { method: "POST", body: data });
      if (response.ok) {
        setSent(true);
        return;
      }
      const body = (await response.json().catch(() => ({}))) as { errors?: PhotoFormErrors };
      setErrors(body.errors ?? { form: "Something went wrong. Please try again." });
    } catch {
      setErrors({ form: "We couldn't send your photo. Check your connection and try again." });
    } finally {
      setSending(false);
    }
  }

  function another() {
    setSent(false);
    setPhoto(null);
    setPreview(null);
    setCaptionLength(0);
    form.current?.reset();
  }

  if (sent) {
    return (
      <div className="form-card" role="status">
        <h2 className="photos-title">Thanks for the photo</h2>
        <p className="page-sub">We&apos;ll add it to {stationName} after a quick check, usually within a day or two.</p>
        <Link href={stationHref} className="action-button primary">Back to the station</Link>
        <button type="button" className="action-button secondary" onClick={another}>Add another photo</button>
      </div>
    );
  }

  const error = (name: keyof PhotoFormErrors) =>
    errors[name] ? (
      <span className="field-error" id={`photo-${name}-error`}>
        {errors[name]}
      </span>
    ) : null;
  const describedBy = (name: keyof PhotoFormErrors) => (errors[name] ? `photo-${name}-error` : undefined);

  return (
    <form ref={form} className="form-card" onSubmit={submit} noValidate>
      {/* Honeypot for bots; hidden from people and screen readers. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="honeypot" aria-hidden="true" />

      <div className="photo-picker" ref={picker}>
        {/* One box to tap (or drop a photo on, on a computer); it shows the photo once picked. */}
        <button
          type="button"
          className={`photo-dropzone${preview ? " has-photo" : ""}${dragging ? " is-dragging" : ""}`}
          onClick={openPicker}
          disabled={preparing || sending}
          aria-expanded={menuOpen}
          aria-controls="photo-source-menu"
          aria-describedby={describedBy("photo")}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) void acceptPhoto(file);
          }}
        >
          {preview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="The photo you picked" className="photo-preview" />
              <span className="photo-change">Change photo</span>
            </>
          ) : (
            <>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              <span className="photo-dropzone-title">{preparing ? "Getting your photo ready…" : "Tap to add a photo"}</span>
              <span className="photo-dropzone-sub">JPG, PNG or iPhone photos, up to 20 MB</span>
            </>
          )}
        </button>

        {/* The inputs have no name: the form sends the shrunk copy, not the original file. */}
        <div id="photo-source-menu" className="photo-source-menu" hidden={!menuOpen}>
          <label className="photo-source">
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick} disabled={preparing || sending} />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            Take a photo
          </label>
          <label className="photo-source">
            <input ref={libraryInput} type="file" accept="image/*" className="sr-only" onChange={pick} disabled={preparing || sending} />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-4.5-4.5L6 21" />
            </svg>
            Choose from your photos
          </label>
        </div>
        {error("photo")}
        {blurOn ? <p className="smallprint">We blur faces and license plates automatically.</p> : null}
      </div>

      <label className="field">
        <span>
          Description <em>(optional)</em>
        </span>
        <textarea
          name="caption"
          rows={3}
          maxLength={CAPTION_MAX}
          placeholder="Stalls are on the 2nd floor of the parking garage, near the mall entrance."
          onChange={(event) => setCaptionLength(event.target.value.length)}
          aria-invalid={Boolean(errors.caption)}
          aria-describedby={errors.caption ? "photo-caption-error" : "photo-caption-count"}
        />
        <span className="field-count" id="photo-caption-count">
          {captionLength}/{CAPTION_MAX}
        </span>
        {error("caption")}
      </label>

      <label className="field">
        <span>Your email</span>
        <input name="email" type="email" autoComplete="email" required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "photo-email-error" : "photo-email-help"} />
        <span className="field-help" id="photo-email-help">Only used if we have a question about your photo. Never shown on the site.</span>
        {error("email")}
      </label>

      <label className="check-field">
        <input type="checkbox" name="consent" value="yes" aria-invalid={Boolean(errors.consent)} aria-describedby={describedBy("consent")} />
        <span>
          I took this photo, and TeslaSuperchargerNearMe.com may show it on this site (<Link href="/terms#photos">Terms</Link>).
        </span>
      </label>
      {error("consent")}

      {errors.form ? (
        <p className="form-error" role="alert">
          {errors.form}
        </p>
      ) : null}

      <button type="submit" className="action-button primary" disabled={sending || preparing}>
        {sending ? "Sending…" : "Send photo"}
      </button>
      <p className="smallprint">Photos appear on the station page after a quick check.</p>
    </form>
  );
}
