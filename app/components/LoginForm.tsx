"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/app/login/actions";

export default function LoginForm({ next, linkFailed }: { next: string; linkFailed: boolean }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    signIn,
    linkFailed ? { step: "email", error: "That sign-in link didn't work or has expired. Enter your email to get a new code." } : { step: "email" },
  );

  if (state.step === "code") {
    return (
      <form action={formAction} className="form-card">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="email" value={state.email} />
        <p className="login-note" role="status">
          {state.resent ? "We sent a new code to " : "We sent a code to "}
          <strong>{state.email}</strong>. Enter it below, or tap the link in the email.
        </p>
        <label className="field">
          <span>Code</span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={12}
            required
            autoFocus
            aria-invalid={Boolean(state.error)}
            aria-describedby={state.error ? "code-error" : undefined}
          />
          {state.error ? <span className="field-error" id="code-error">{state.error}</span> : null}
        </label>
        <button type="submit" name="intent" value="verify" className="action-button primary" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
        <div className="login-links">
          <button type="submit" name="intent" value="resend" className="text-button" formNoValidate disabled={pending}>
            Send a new code
          </button>
          <button type="submit" name="intent" value="restart" className="text-button" formNoValidate disabled={pending}>
            Use a different email
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={formAction} className="form-card">
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "email-error" : undefined}
        />
        {state.error ? <span className="field-error" id="email-error">{state.error}</span> : null}
      </label>
      <button type="submit" name="intent" value="send" className="action-button primary" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in code"}
      </button>
      <p className="login-note">No password needed. New here? Entering your email creates your account.</p>
    </form>
  );
}
