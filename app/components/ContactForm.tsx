"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { sendContactMessage, type ContactState } from "@/app/contact/actions";
import { DIAL_CODES, MESSAGE_MAX, type ContactFormErrors } from "@/lib/contactForm";

export default function ContactForm() {
  const [state, formAction, pending] = useActionState<ContactState, FormData>(sendContactMessage, { status: "idle" });
  const errors: ContactFormErrors & { form?: string } = state.status === "error" ? state.errors : {};
  // React empties the form after each submit; refill it with what was sent so nothing is lost.
  const sent = state.status === "error" ? state.values : {};
  const value = (name: string, fallback = "") => sent[name] ?? fallback;
  const [messageLength, setMessageLength] = useState(0);

  if (state.status === "sent") {
    return (
      <div className="contact-card" role="status">
        <h2 className="contact-card-title">Thanks{state.firstName ? `, ${state.firstName}` : ""}</h2>
        <p className="contact-card-sub">We got your message and will reply by email within a few business days.</p>
      </div>
    );
  }

  const error = (name: keyof ContactFormErrors) =>
    errors[name] ? (
      <span className="field-error" id={`contact-${name}-error`}>
        {errors[name]}
      </span>
    ) : null;
  const describedBy = (name: keyof ContactFormErrors) => (errors[name] ? `contact-${name}-error` : undefined);

  return (
    <div className="contact-card">
      <h2 className="contact-card-title">Get in Touch</h2>
      <p className="contact-card-sub">You can reach us anytime</p>

      <form action={formAction} className="contact-form" noValidate>
        {/* Honeypot for bots; hidden from people and screen readers. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="honeypot" aria-hidden="true" />

        <div className="contact-row">
          <label className="contact-field">
            <span className="sr-only">First name</span>
            <input name="firstName" defaultValue={value("firstName")} placeholder="First name" autoComplete="given-name" required maxLength={60} aria-invalid={Boolean(errors.firstName)} aria-describedby={describedBy("firstName")} />
            {error("firstName")}
          </label>
          <label className="contact-field">
            <span className="sr-only">Last name</span>
            <input name="lastName" defaultValue={value("lastName")} placeholder="Last name" autoComplete="family-name" maxLength={60} aria-invalid={Boolean(errors.lastName)} aria-describedby={describedBy("lastName")} />
            {error("lastName")}
          </label>
        </div>

        <label className="contact-field">
          <span className="sr-only">Your email</span>
          <span className="contact-input has-icon">
            <svg className="contact-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            <input name="email" type="email" defaultValue={value("email")} placeholder="Your email" autoComplete="email" required aria-invalid={Boolean(errors.email)} aria-describedby={describedBy("email")} />
          </span>
          {error("email")}
        </label>

        <div className="contact-field">
          <div className="contact-phone" data-invalid={errors.phone ? "true" : undefined}>
            <label className="contact-dial">
              <span className="sr-only">Country code</span>
              <select name="dialCode" defaultValue={value("dialCode", "+1")}>
                {DIAL_CODES.map((item) => (
                  <option key={item.code} value={item.code} aria-label={`${item.label} ${item.code}`}>
                    {item.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="contact-phone-number">
              <span className="sr-only">Phone number (optional)</span>
              <input name="phone" type="tel" defaultValue={value("phone")} placeholder="Phone number" autoComplete="tel-national" maxLength={20} aria-invalid={Boolean(errors.phone)} aria-describedby={describedBy("phone")} />
            </label>
          </div>
          {error("phone")}
        </div>

        <label className="contact-field">
          <span className="sr-only">How can we help?</span>
          <span className="contact-message">
            <textarea
              name="message"
              defaultValue={value("message")}
              placeholder="How can we help?"
              required
              maxLength={MESSAGE_MAX}
              rows={4}
              onChange={(event) => setMessageLength(event.target.value.length)}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={describedBy("message") ?? "contact-message-count"}
            />
            <span className="contact-count" id="contact-message-count" aria-live="polite">
              {messageLength || value("message").length}/{MESSAGE_MAX}
            </span>
          </span>
          {error("message")}
        </label>

        {errors.form ? (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        ) : null}
        <button type="submit" className="contact-submit" disabled={pending}>
          {pending ? "Sending…" : "Submit"}
        </button>
        <p className="contact-terms">
          By contacting us, you agree to our <Link href="/terms">Terms of Use</Link> and <Link href="/privacy">Privacy Policy</Link>
        </p>
      </form>
    </div>
  );
}
