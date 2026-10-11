// Where to go after signing in. Only paths on this site, so a crafted link can't send people
// to another site ("//evil.com" and "/\evil.com" are other sites to a browser).
export function safeNext(value: unknown, fallback = "/account") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

export function loginHref(next: string) {
  return `/login?next=${encodeURIComponent(next)}`;
}
