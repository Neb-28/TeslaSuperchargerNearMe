// Server-side Supabase client for the signed-in pages, server actions and route handlers.
// Never call this from the CDN-cached pages (home, states, cities, stations): reading cookies
// would make them render per request.
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { authConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies; proxy.ts keeps the session fresh instead.
        }
      },
    },
  });
}

// The signed-in user, checked with Supabase Auth (not just read from the cookie), or null.
export async function currentUser(): Promise<User | null> {
  if (!authConfigured) return null;
  const { data } = await (await createSupabaseServer()).auth.getUser();
  return data.user;
}
