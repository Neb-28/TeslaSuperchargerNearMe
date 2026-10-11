import type { Metadata } from "next";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact TeslaSuperchargerNearMe: data corrections, business inquiries and privacy questions.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="app-shell">
      <SiteHeader backHref="/" />
      <main id="main" className="content-page legal-page">
        <h1 className="page-title">Contact</h1>

        <p>
          For data corrections, business inquiries or privacy questions, email us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We read every message and aim to reply within a few business days.
        </p>

        <h2>Station data corrections</h2>
        <p>
          Spot a station that moved, closed or has the wrong details? Tell us the station name and what&apos;s wrong and we&apos;ll fix
          it. Corrections to the underlying map are best made directly in{" "}
          <a href="https://www.openstreetmap.org/" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>
          , which improves every map that uses the data, including ours.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
