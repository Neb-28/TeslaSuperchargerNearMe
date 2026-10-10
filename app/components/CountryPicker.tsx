"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

export type CountryOption = { slug: string; code: string | null; name: string; count: number };

type CountryPickerProps = {
  current: CountryOption;
  options: CountryOption[];
  // The page the choice applies to: "/" (home) or "/map".
  basePath: "/" | "/map";
};

const US_SLUG = "united-states";

// Flag emoji from a two-letter code (two regional-indicator symbols); no image files.
function flag(code: string | null) {
  return code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : "🌐";
}

// Small round flag button (emoji plus the two-letter code, since flag emoji don't render on
// Windows). Each option is a plain link, e.g. /?country=germany, so it also works before
// JavaScript loads; the United States is the page without a country.
export default function CountryPicker({ current, options, basePath }: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLAnchorElement>('[aria-current="true"]')?.focus();

    function onKeyDown(event: KeyboardEvent) {
      const links = [...(listRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [])];
      const index = links.indexOf(document.activeElement as HTMLAnchorElement);
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        links[Math.min(index + 1, links.length - 1)]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        links[Math.max(index - 1, 0)]?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const hrefFor = (slug: string) => (slug === US_SLUG ? basePath : `${basePath}?country=${slug}`);
  // Home is a prebuilt page per country that only differs by ?country= (see next.config.ts), which
  // the in-app router can't tell apart, so home switches with a normal page load (from the CDN).
  const OptionLink = basePath === "/" ? "a" : Link;

  return (
    <div ref={wrapRef} className="country-picker">
      <button
        ref={buttonRef}
        type="button"
        className="country-picker-button"
        aria-label={`Country: ${current.name}. Change country`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="country-picker-flag" aria-hidden="true">{flag(current.code)}</span>
        <span className="country-picker-code" aria-hidden="true">{current.code}</span>
      </button>

      <div id={menuId} className="country-picker-panel" hidden={!open}>
        <p className="country-picker-title">Choose a country</p>
        <ul ref={listRef}>
          {options.map((option) => (
            <li key={option.slug}>
              <OptionLink
                href={hrefFor(option.slug)}
                className="country-picker-link"
                aria-current={option.slug === current.slug}
                onClick={() => setOpen(false)}
              >
                <span className="country-picker-chip" aria-hidden="true">
                  {flag(option.code)} <span>{option.code}</span>
                </span>
                <span className="country-picker-name">{option.name}</span>
                <span className="country-picker-count">{option.count.toLocaleString("en-US")}</span>
              </OptionLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
