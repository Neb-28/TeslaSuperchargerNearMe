"use client";

import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type Ref } from "react";
import type { Suggestion } from "@/lib/suggest";

// A search box that suggests cities, towns, states, countries and stations while the visitor
// types (from /api/suggest, which forgives typos). Arrow keys move through the list, Enter or a tap
// picks one; Enter with nothing highlighted submits the form as before, and without JavaScript
// it's a plain search box.
type SearchSuggestProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "defaultValue"> & {
  id: string;
  country: string | null; // the map's country slug, so its places come first
  onPick: (suggestion: Suggestion) => void;
  value?: string; // controlled (the map); uncontrolled when left out (the home page)
  onValueChange?: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
};

const DEBOUNCE_MS = 120;
const cache = new Map<string, Suggestion[]>();

/** Where a suggestion opens the map. */
export function suggestionHref(suggestion: Suggestion) {
  if (suggestion.kind === "station") return `/map?station=${suggestion.slug}`;
  if (suggestion.kind === "country") return `/map?country=${suggestion.country}`;
  return `/map?q=${encodeURIComponent(suggestion.label)}${suggestion.country ? `&country=${suggestion.country}` : ""}`;
}

function KindIcon({ kind }: { kind: Suggestion["kind"] }) {
  return (
    <span className={`suggest-icon${kind === "station" ? " is-station" : ""}`} aria-hidden="true">
      {kind === "station" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </svg>
      )}
    </span>
  );
}

export default function SearchSuggest({ id, country, onPick, value, onValueChange, inputRef, ...inputProps }: SearchSuggestProps) {
  const [ownValue, setOwnValue] = useState("");
  const text = value ?? ownValue;
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const typed = useRef(false); // only suggest after the visitor types, not when the text is set for them

  useEffect(() => {
    const query = text.trim();
    if (!typed.current || query.length < 2) {
      const timer = window.setTimeout(() => setItems([]), 0);
      return () => window.clearTimeout(timer);
    }
    const key = `${country ?? ""}|${query.toLowerCase()}`;
    const controller = new AbortController();
    const timer = window.setTimeout(
      async () => {
        try {
          let found = cache.get(key);
          if (!found) {
            const response = await fetch(`/api/suggest?q=${encodeURIComponent(query)}${country ? `&country=${country}` : ""}`, { signal: controller.signal });
            found = response.ok ? ((await response.json()) as { suggestions: Suggestion[] }).suggestions : [];
            cache.set(key, found);
          }
          setItems(found);
          setActive(-1);
        } catch {
          // Aborted by the next keystroke, or offline: keep the box working without suggestions.
        }
      },
      cache.has(key) ? 0 : DEBOUNCE_MS,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [text, country]);

  const showing = open && items.length > 0;

  function change(next: string) {
    typed.current = true;
    if (value === undefined) setOwnValue(next);
    onValueChange?.(next);
    setOpen(true);
  }

  function pick(suggestion: Suggestion) {
    typed.current = false;
    if (value === undefined) setOwnValue(suggestion.label);
    onValueChange?.(suggestion.label);
    setOpen(false);
    setItems([]);
    onPick(suggestion);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showing) return;
    // -1 is the box itself (nothing highlighted); the arrows cycle through it and the list.
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1 === items.length ? -1 : current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current === -1 ? items.length - 1 : current - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      pick(items[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <>
      <input
        {...inputProps}
        ref={inputRef}
        id={id}
        value={text}
        onChange={(event) => change(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showing}
        aria-controls={listId}
        aria-activedescendant={showing && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
      />
      <ul id={listId} role="listbox" aria-label="Suggestions" className="suggest-list" hidden={!showing}>
        {items.map((item, index) => (
          <li
            key={`${item.kind}|${item.label}|${item.country ?? ""}`}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            className={`suggest-option${index === active ? " is-active" : ""}`}
            // Keep focus in the box, so the tap or click lands before the list closes.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(item)}
          >
            <KindIcon kind={item.kind} />
            <span className="suggest-text">
              <span className="suggest-label">{item.label}</span>
              <span className="suggest-detail">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <span className="sr-only" role="status">
        {showing ? `${items.length} suggestion${items.length === 1 ? "" : "s"}. Use the up and down arrows to choose.` : ""}
      </span>
    </>
  );
}
