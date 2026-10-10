// Password login for /admin. The password lives in ADMIN_PASSWORD (.env.local); the cookie holds
// an HMAC of it, so changing the password signs everyone out.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "admin_session";

function sessionToken() {
  const password = process.env.ADMIN_PASSWORD;
  return password ? createHmac("sha256", password).update("tsnm-admin-session-v1").digest("hex") : null;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export async function isAdmin() {
  const token = sessionToken();
  const cookie = (await cookies()).get(COOKIE)?.value;
  return Boolean(token && cookie && safeEqual(cookie, token));
}

export async function logIn(password: string) {
  const token = sessionToken();
  if (!token || !safeEqual(password, process.env.ADMIN_PASSWORD!)) return false;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: 60 * 60 * 12,
  });
  return true;
}

export async function logOut() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}
