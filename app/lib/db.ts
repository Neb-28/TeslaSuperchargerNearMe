// Server-only Postgres connection (Supabase, through the transaction pooler in DATABASE_URL).
// The pooler doesn't support prepared statements, hence `prepare: false`.
import postgres from "postgres";

let client: postgres.Sql | null = null;

export function db() {
  if (!process.env.DATABASE_URL) return null;
  client ??= postgres(process.env.DATABASE_URL, { prepare: false, max: 3, idle_timeout: 20 });
  return client;
}
