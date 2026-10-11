"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

// Favorites stay on this device after signing out; they're still in the account too.
export async function signOut() {
  await (await createSupabaseServer()).auth.signOut();
  redirect("/");
}
