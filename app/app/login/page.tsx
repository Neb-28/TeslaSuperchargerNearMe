import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { safeNext } from "@/lib/authRedirect";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await currentUser()) redirect(next);

  return (
    <div className="app-shell">
      <SiteHeader backHref="/" />
      <main id="main" className="content-page">
        <h1 className="page-title">Sign in</h1>
        <p className="page-sub">
          Optional: everything on the site works without an account. Signing in keeps your favorite stations on every device, and lets
          businesses track their Featured listing.
        </p>
        <LoginForm next={next} linkFailed={params.error === "link"} />
        <p className="login-note">
          We only use your email to sign you in. See our <Link href="/privacy">privacy policy</Link>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
