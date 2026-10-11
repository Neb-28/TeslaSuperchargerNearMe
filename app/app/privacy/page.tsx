import type { Metadata } from "next";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How TeslaSuperchargerNearMe uses location, cookies and advertising.",
};

// Draft written from what the site actually does today; have a lawyer review it before launch.
// Update "Last updated" and the sections below whenever data handling changes (leads, analytics...).
const LAST_UPDATED = "October 10, 2026";

export default function PrivacyPage() {
  return (
    <div className="app-shell">
      <SiteHeader backHref="/" />
      <main id="main" className="content-page legal-page">
        <h1 className="page-title">Privacy policy</h1>
        <p className="page-sub">Last updated {LAST_UPDATED}</p>

        <p>
          TeslaSuperchargerNearMe helps EV drivers find Superchargers and places nearby. This page explains what information the site
          uses, why, and the choices you have. We are not affiliated with Tesla, Inc.
        </p>

        <h2>Your location</h2>
        <p>
          We only ask for your location when you tap <strong>Near me</strong> or the center-on-me button. Your browser shares it with
          this page, which uses it on your device to sort stations by distance. We don&apos;t send your exact location to our servers
          and we don&apos;t store it. You can turn location access off at any time in your browser or phone settings.
        </p>
        <p>
          The one exception is <strong>Use my location</strong> in the route planner: your approximate location (rounded to about 100 m) is
          sent to our server and to openrouteservice to show you the nearest street address and work out the driving route. We
          don&apos;t store it, and those answers are never cached.
        </p>

        <h2>Searches and saved stations</h2>
        <ul>
          <li>When you search for a ZIP code, it is sent to our server to look up the area. We don&apos;t link searches to you.</li>
          <li>
            Stations you save with <strong>Save</strong> are kept in your browser on this device. If you sign in, they are also saved
            to your account so they appear on your other devices.
          </li>
          <li>Like most websites, our hosting provider keeps short-lived technical logs (such as IP address and pages requested) for security and reliability.</li>
        </ul>

        <h2>Advertising and cookies</h2>
        <p>We show ads from Google AdSense to keep the site free. Ads are labeled &ldquo;Sponsored links&rdquo;.</p>
        <ul>
          <li>
            Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website or other websites.
          </li>
          <li>
            Google&apos;s use of advertising cookies enables it and its partners to serve ads to you based on your visit to this site
            and/or other sites on the Internet. Learn more about{" "}
            <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">
              how Google uses information from sites that use its services
            </a>
            .
          </li>
          <li>
            You can opt out of personalized advertising in{" "}
            <a href="https://www.google.com/settings/ads" target="_blank" rel="noreferrer">Google Ads Settings</a>, or opt out of some
            third-party vendors&apos; use of cookies for personalized advertising at{" "}
            <a href="https://www.aboutads.info/choices/" target="_blank" rel="noreferrer">www.aboutads.info</a>.
          </li>
          <li>
            Visitors in the European Economic Area, the UK and Switzerland, and in US states with privacy laws, are asked for their
            choices about cookies and personalized ads before they are used, and can change those choices later.
          </li>
        </ul>

        <h2>Sponsored listings</h2>
        <p>
          Businesses can pay to appear first in a category near a station. These listings are labeled &ldquo;#1 FEATURED&rdquo; and
          &ldquo;Sponsored&rdquo;. Links in them go to the business&apos;s own website, which has its own privacy policy.
        </p>

        <h2>Accounts (optional)</h2>
        <p>
          You can use the whole site without an account. If you choose to sign in, we use your email address only to send you sign-in
          codes and to identify your account. We store your email and the stations you save. Sign-in is handled by our database
          provider, Supabase, and uses a cookie to keep you signed in. Businesses that sign in see the Featured requests made with
          their email. To delete your account and saved stations, email us at the address below.
        </p>

        <h2>Businesses that apply to be featured</h2>
        <p>
          If you apply for a featured listing, we collect your business details, name, email and (optionally) phone number. We use them
          to review your listing, arrange payment and contact you about it. We don&apos;t sell this information. Your email and phone
          are never shown on the site.
        </p>

        <h2>Maps, directions and other services</h2>
        <ul>
          <li>Map images are loaded from a map tile provider, which receives your IP address when your browser requests them.</li>
          <li>Map and place data come from OpenStreetMap contributors.</li>
          <li>Directions open Google Maps, which has its own privacy policy.</li>
          <li>
            We use{" "}
            <a href="https://sentry.io/privacy/" target="_blank" rel="noreferrer">
              Sentry
            </a>{" "}
            to find and fix errors. When something goes wrong, and for a sample of page loads, Sentry receives technical details such as the
            page, your browser and device type, and your IP address. For a sample of visits, and for visits where an error happens, Sentry
            also records a replay of the page layout and your clicks. All text and anything you type are masked in these replays, and
            images aren&apos;t recorded.
          </li>
          <li>
            The route planner sends the start and destination you enter to{" "}
            <a href="https://openrouteservice.org/privacy-policy/" target="_blank" rel="noreferrer">openrouteservice</a> (HeiGIT, Germany)
            to find addresses and driving routes.
          </li>
        </ul>

        <h2>Children</h2>
        <p>This site is not directed at children under 13, and we don&apos;t knowingly collect information from them.</p>

        <h2>Changes and contact</h2>
        <p>
          We&apos;ll update this page when our practices change and show the new date at the top. Questions or requests about your
          information: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
