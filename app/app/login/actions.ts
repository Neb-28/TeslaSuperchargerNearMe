"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/authRedirect";
import { SITE_URL } from "@/lib/site";
import { authConfigured } from "@/lib/supabase/env";
import { createSupabaseServer } from "@/lib/supabase/server";

export type LoginState =
  | { step: "email"; email?: string; error?: string }
  | { step: "code"; email: string; error?: string; resent?: boolean };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendCode(email: string, next: string) {
  const origin = (await headers()).get("origin") ?? SITE_URL;
  const supabase = await createSupabaseServer();
  // The email has a 6-digit code and a link; either signs in. New emails get an account.
  return supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
}

// One action for both steps, so the form also works without JavaScript.
export async function signIn(previous: LoginState, form: FormData): Promise<LoginState> {
  const intent = String(form.get("intent") ?? "send");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(form.get("next"));

  if (!authConfigured) return { step: "email", email, error: "Sign-in isn't available right now. Please try again later." };
  if (intent === "restart") return { step: "email", email };

  if (intent === "verify") {
    const token = String(form.get("code") ?? "").replace(/\s/g, "");
    if (!/^\d{6,10}$/.test(token)) return { step: "code", email, error: "Enter the code from the email." };
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) return { step: "code", email, error: "That code is wrong or has expired. Check the email, or send a new code." };
    redirect(next);
  }

  // "send" and "resend"
  if (!EMAIL.test(email)) return { step: "email", email, error: "Enter a valid email address." };
  const { error } = await sendCode(email, next);
  if (error) {
    const message = error.status === 429 ? "Too many tries. Wait a minute, then send a new code." : "We couldn't send the email. Please try again.";
    return previous.step === "code" ? { step: "code", email, error: message } : { step: "email", email, error: message };
  }
  return { step: "code", email, resent: intent === "resend" };
}
