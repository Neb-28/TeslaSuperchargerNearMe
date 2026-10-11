// Public Supabase project URL and publishable (anon) key. Accounts are optional: without these,
// sign-in shows as unavailable and the rest of the site works as before.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const authConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Supabase keeps the session in cookies named sb-<project>-auth-token (split into .0, .1… when long).
export function hasAuthCookie(cookieHeader: string) {
  return /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/.test(cookieHeader);
}
