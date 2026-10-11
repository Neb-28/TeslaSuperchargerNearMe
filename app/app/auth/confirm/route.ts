import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/authRedirect";
import { authConfigured } from "@/lib/supabase/env";
import { createSupabaseServer } from "@/lib/supabase/server";

// The address the visitor used. request.nextUrl can hold the server's own bind address
// (0.0.0.0 when testing on a phone over Wi-Fi); Vercel always sends the real host.
function siteOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return host ? `${protocol}://${host}` : request.nextUrl.origin;
}

// Where the link in the sign-in email lands. Supabase sends either ?code= (link opened in the
// same browser that asked for it) or ?token_hash=&type= (email template using {{ .TokenHash }}).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = siteOrigin(request);
  const next = safeNext(params.get("next"));
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  if (authConfigured && (code || (tokenHash && type))) {
    const supabase = await createSupabaseServer();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  const login = new URL("/login", origin);
  login.searchParams.set("error", "link");
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
