"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { photoMonth, type PublicPhoto } from "@/lib/stationPhotoForm";

type StationPhotosProps = {
  photos: PublicPhoto[];
  addHref: string;
  // Describes the station in each photo's alt text, e.g. "Tesla Supercharger at 565 Compass Pt Plz, Leesburg, VA".
  label: string;
};

const altText = (label: string, photo: PublicPhoto, index: number) =>
  `${label}, driver photo ${index + 1}${photo.caption ? `: ${photo.caption}` : ""}`;

// Station page "Photos": approved driver photos in a sideways-scrolling strip, after an "Add photo"
// tile. The strip is in the server-rendered HTML (each thumbnail links to the full photo, so it
// works without JavaScript); with JavaScript a tap opens a full-screen viewer that swipes between photos.
export default function StationPhotos({ photos, addHref, label }: StationPhotosProps) {
  const viewer = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [viewing, setViewing] = useState(false);

  const show = (target: number) => {
    const element = track.current;
    if (!element) return;
    const next = Math.max(0, Math.min(photos.length - 1, target));
    element.scrollTo({ left: next * element.clientWidth, behavior: "smooth" });
  };

  const open = (target: number) => {
    const dialog = viewer.current;
    if (!dialog) return;
    setIndex(target);
    setViewing(true);
    dialog.showModal();
    document.documentElement.classList.add("viewer-open");
    // Jump straight to the tapped photo once the viewer has its width.
    requestAnimationFrame(() => {
      if (track.current) track.current.scrollLeft = target * track.current.clientWidth;
    });
  };

  useEffect(() => () => document.documentElement.classList.remove("viewer-open"), []);

  // Arrow keys move between photos. Listened for on the whole page: when Next or Previous hides
  // at the last or first photo, focus can leave the viewer.
  useEffect(() => {
    if (!viewing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") show(index + 1);
      if (event.key === "ArrowLeft") show(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <section className="photos-card" aria-labelledby="photos-title">
      <h2 id="photos-title" className="photos-title">Photos</h2>
      <ul className="photo-strip">
        <li>
          <Link href={addHref} className="photo-add">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            Add photo
          </Link>
        </li>
        {photos.length === 0 ? (
          <li className="photo-empty-item">
            <Link href={addHref} className="photo-empty">
              No photos of this station yet.
              <span>Charging here? Add the first one.</span>
            </Link>
          </li>
        ) : (
          photos.map((photo, position) => (
            <li key={photo.id}>
              <a
                href={photo.url}
                className="photo-thumb"
                onClick={(event) => {
                  event.preventDefault();
                  open(position);
                }}
              >
                {/* Plain img: the files are already resized WebP on Supabase's CDN, so next/image would only add a second copy and cost. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.thumbUrl} alt={altText(label, photo, position)} width={176} height={132} loading={position < 3 ? "eager" : "lazy"} decoding="async" />
              </a>
            </li>
          ))
        )}
      </ul>

      {photos.length ? (
        <dialog
          ref={viewer}
          className="photo-viewer"
          aria-label="Station photos"
          onClose={() => {
            setViewing(false);
            document.documentElement.classList.remove("viewer-open");
          }}
        >
          <div className="photo-viewer-bar">
            <span aria-live="polite">
              {index + 1} of {photos.length}
            </span>
            <button type="button" className="photo-viewer-button" aria-label="Close photos" onClick={() => viewer.current?.close()}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div
            ref={track}
            className="photo-viewer-track"
            onScroll={(event) => {
              const element = event.currentTarget;
              setIndex(Math.round(element.scrollLeft / Math.max(1, element.clientWidth)));
            }}
          >
            {photos.map((photo, position) => (
              <figure key={photo.id} className="photo-slide">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={altText(label, photo, position)} width={photo.width} height={photo.height} loading="lazy" decoding="async" />
                <figcaption>
                  {photo.caption ? <span className="photo-caption">{photo.caption}</span> : null}
                  <span className="photo-credit">Driver photo · {photoMonth(photo.createdAt)}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <button type="button" className="photo-viewer-button photo-viewer-prev" aria-label="Previous photo" disabled={index === 0} onClick={() => show(index - 1)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <button type="button" className="photo-viewer-button photo-viewer-next" aria-label="Next photo" disabled={index === photos.length - 1} onClick={() => show(index + 1)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </dialog>
      ) : null}
    </section>
  );
}
