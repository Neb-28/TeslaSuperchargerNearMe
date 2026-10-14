import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "@/components/ContactForm";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact TeslaSuperchargerNearMe: questions, feedback, business and media inquiries.",
  alternates: { canonical: "/contact" },
};

const TOPICS = [
  {
    title: "Customer Support",
    body: "Questions about a station, the map or your account? Send us a message and we'll get back to you within a few business days.",
  },
  {
    title: "Feedback and Suggestions",
    body: "We value your feedback and are continuously working to improve the site. Your input is crucial in shaping what we build next.",
  },
  {
    title: "Media Inquiries",
    body: `For media-related questions or press inquiries, please contact us at ${CONTACT_EMAIL}.`,
  },
];

export default function ContactPage() {
  return (
    <div className="app-shell">
      <SiteHeader backHref="/" />
      <main id="main" className="contact-page">
        <section className="contact-intro" aria-labelledby="contact-title">
          <h1 id="contact-title" className="contact-title">Contact Us</h1>
          <p className="contact-lead">Email, or complete the form to learn how TeslaSuperchargerNearMe can help you or your business.</p>
          <p className="contact-detail">
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
          <p className="contact-detail">
            <Link href="/business/get-featured" className="contact-link">Advertise your business</Link>
          </p>
        </section>

        <div className="contact-form-col">
          <ContactForm />
        </div>

        <ul className="contact-topics">
          {TOPICS.map((topic) => (
            <li key={topic.title}>
              <h2>{topic.title}</h2>
              <p>{topic.body}</p>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
