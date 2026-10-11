import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { loginHref } from "@/lib/authRedirect";
import { CONTACT_EMAIL } from "@/lib/site";
import { currentUser } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect(loginHref("/account"));

  return (
    <div className="app-shell">
      <SiteHeader backHref="/" />
      <main id="main" className="content-page">
        <h1 className="page-title">Your account</h1>
        <p className="page-sub">
          Signed in as <strong>{user.email}</strong>
        </p>

        <section className="form-card">
          <h2 className="section-title">Favorites</h2>
          <p className="page-sub">Stations you save sync to every phone and computer where you sign in.</p>
          <Link href="/favorites" className="action-button secondary">See your favorites</Link>
        </section>

        <section className="form-card">
          <h2 className="section-title">For businesses</h2>
          <p className="page-sub">See your #1 Featured applications and whether each listing is live.</p>
          <Link href="/business/dashboard" className="action-button secondary">Open business dashboard</Link>
        </section>

        <form action={signOut}>
          <button type="submit" className="action-button secondary wide">Sign out</button>
        </form>
        <p className="login-note">
          To delete your account and saved favorites, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
