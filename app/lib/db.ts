// Server-only Postgres connection (Supabase, through the transaction pooler in DATABASE_URL).
// The pooler doesn't support prepared statements, hence `prepare: false`.
import postgres from "postgres";

let client: postgres.Sql | null = null;

export function db() {
  if (!process.env.DATABASE_URL) return null;
  // Serverless functions are paused between requests, and a connection kept open across a pause
  // can die silently; the next query then hangs until the 2-minute statement timeout (admin
  // sign-in "taking forever"). Close idle connections after 2 seconds, so every request starts on
  // a fresh one (about 0.4 s to connect), and give up connecting after 10 seconds.
  client ??= postgres(process.env.DATABASE_URL, { prepare: false, max: 3, idle_timeout: 2, connect_timeout: 10 });
  return client;
}
