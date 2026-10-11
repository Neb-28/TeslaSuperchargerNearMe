"use client";

import Link from "next/link";
import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { menuGroups, menuSmallLinks } from "./navLinks";

// The ☰ button and the menu panel it opens: full height, sliding in from the right over a dimmed
// page, with large buttons in groups. Closes on ✕, Escape, a tap outside, or choosing a link.
export default function MenuButton({ variant }: { variant: "mobile" | "desktop" }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    // The page behind the menu shouldn't scroll while it's open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  // Escape closes; Tab stays inside the menu while it's open.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>("button, a") ?? [])];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="icon-button"
        onClick={() => setOpen(true)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open
        ? createPortal(
            <div className="drawer-backdrop" onClick={close}>
              <div
                ref={panelRef}
                className="drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={onKeyDown}
              >
                <div className="drawer-header">
                  <h2 id={titleId} className="drawer-title">Menu</h2>
                  <button type="button" className="drawer-close" aria-label="Close menu" onClick={close}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>

                <nav className="drawer-body" aria-labelledby={titleId}>
                  {menuGroups(variant).map((group, index) => (
                    <Fragment key={index}>
                      {index > 0 ? <hr className="drawer-divider" /> : null}
                      {group.map((link) => (
                        <Link key={link.href} href={link.href} className="drawer-link" onClick={() => setOpen(false)}>
                          {link.label}
                        </Link>
                      ))}
                    </Fragment>
                  ))}
                  {menuSmallLinks.map((link) => (
                    <Link key={link.href} href={link.href} className="drawer-small-link" onClick={() => setOpen(false)}>
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
