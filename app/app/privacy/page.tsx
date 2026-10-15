import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What personal information Green Star Tech collects on TeslaSuperchargerNearMe, how we use and share it, and your rights.",
  alternates: { canonical: "/privacy" },
};

// Green Star Tech's privacy policy (supplied by the owner). Update EFFECTIVE_DATE with every change.
const EFFECTIVE_DATE = "October 14, 2026";
const SITE_HOST = new URL(SITE_URL).host;

function Table({ head, rows }: { head: [string, string]; rows: [string, string][] }) {
  return (
    <div className="legal-table-wrap">
      <table className="legal-table">
        <thead>
          <tr>
            <th scope="col">{head[0]}</th>
            <th scope="col">{head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, text]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyPage() {
  const email = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

  return (
    <div className="app-shell">
      <SiteHeader backHref="/" />
      <main id="main" className="content-page legal-page">
        <h1 className="page-title">Privacy Policy</h1>
        <p className="page-sub">
          <strong>Green Star Tech</strong> · {SITE_HOST}
          <br />
          Effective date: {EFFECTIVE_DATE}
        </p>

        <h2>1. Introduction</h2>
        <p>
          Green Star Tech (&ldquo;Green Star Tech,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the website{" "}
          <Link href="/">{SITE_HOST}</Link> (the &ldquo;Services&rdquo;). Our Services help
          electric vehicle drivers find Supercharger and other charging locations near them, and discover nearby businesses, shops and
          experiences to enjoy while they charge.
        </p>
        <p>
          This Privacy Policy explains what personal information we collect, why we collect it, who we share it with, how long we keep it,
          and the choices and rights you have. It applies to information we collect through the Services and through our communications
          with you.
        </p>
        <p>
          By using the Services, you acknowledge that you have read this Privacy Policy. If you do not agree with it, please do not use the
          Services. Some features may not work if you choose not to share certain information with us.
        </p>
        <p>
          This policy does not cover websites, apps or services run by other companies, including businesses listed in our Services, even if
          we link to them.
        </p>

        <h2>2. Information We Collect</h2>
        <p>
          We aim to collect only the information we need to run and improve the Services. &ldquo;Personal information&rdquo; means
          information that identifies you or can reasonably be linked to you. It does not include information that has been de-identified
          or aggregated so it can no longer be tied to you.
        </p>
        <Table
          head={["Category", "Examples"]}
          rows={[
            ["Identifiers", "First and last name, email address, phone number, account ID"],
            ["Location", "Precise location from your device, only if you allow it in your browser or device settings"],
            ["Device and network", "Device type, operating system, screen resolution, browser type, version and language, IP address"],
            ["Usage and activity", "Pages viewed, searches made, clicks, date and time of visits, crash and error logs"],
            [
              "Content you provide",
              "Messages you send us, details businesses give us when they apply for a featured listing, and photos of charging stations you upload (with any description and the email address you give with them)",
            ],
            ["Cookies and similar technologies", "Cookie identifiers, pixel tags, local storage data (see Section 7)"],
          ]}
        />
        <p>We do not collect payment card details. Account sign-in uses your email address (see Section 3).</p>

        <h2>3. How We Collect Information</h2>
        <p>
          <strong>Directly from you.</strong> You give us information when you create an account, sign in, search for chargers or places,
          contact us or apply for a featured listing.
        </p>
        <p>
          <strong>Account sign-in.</strong> You sign in with your email address. Our authentication provider, Supabase, stores your account
          record and verifies your sign-in. Our email provider, Resend, delivers sign-in links or codes and other account emails to you. We
          do not use social media logins.
        </p>
        <p>
          <strong>Automatically.</strong> When you use the Services, we and our service providers automatically collect device, network and
          usage information through server logs, error monitoring, cookies, pixels and local storage.
        </p>
        <p>
          <strong>Location.</strong> If you allow it, the site uses your device&apos;s precise location to show nearby chargers and
          businesses. You can turn off precise location at any time in your device or browser settings; nearby results will then be less accurate.
        </p>

        <h2>4. How We Use Information</h2>
        <p>We use personal information to:</p>
        <ol>
          <li>Provide the Services, including showing chargers, businesses, shops and experiences near you.</li>
          <li>Create and manage your account and send sign-in emails.</li>
          <li>Respond to questions, support requests and problem reports.</li>
          <li>Send service notices, such as changes to your account or to our terms.</li>
          <li>Understand how people use the Services, fix errors and develop new features.</li>
          <li>Show advertising, including ads tailored to your interests, and measure how well ads and campaigns perform.</li>
          <li>
            Keep the Services secure, prevent fraud and abuse, and enforce our <Link href="/terms">Terms of Use</Link>.
          </li>
          <li>Comply with legal obligations and respond to lawful requests.</li>
          <li>For any other purpose we describe when you give us the information, with your consent.</li>
        </ol>

        <h2>5. Legal Bases for Processing (EEA and UK Users)</h2>
        <p>If you are in the European Economic Area or the United Kingdom, we rely on these legal bases under the GDPR and UK GDPR:</p>
        <Table
          head={["Legal basis", "When we rely on it"]}
          rows={[
            ["Contract", "Running your account and providing the features you ask for"],
            ["Consent", "Precise location, non-essential cookies and interest-based advertising"],
            ["Legitimate interests", "Error monitoring, service improvement, security and fraud prevention, balanced against your rights"],
            ["Legal obligation", "Meeting tax, accounting and other legal requirements, and responding to lawful requests"],
          ]}
        />
        <p>Where we rely on consent, you can withdraw it at any time. Withdrawal does not affect processing that happened before you withdrew.</p>

        <h2>6. How We Share Information</h2>
        <p>We do not sell your personal information for money. We share it only as described below.</p>
        <ul>
          <li>
            <strong>Service providers.</strong> Companies that help us run the Services, under contracts that limit how they use your data.
            These include Supabase (database hosting and authentication), Resend (email delivery),{" "}
            <a href="https://sentry.io/privacy/" target="_blank" rel="noreferrer">Sentry</a> (error monitoring),{" "}
            <a href="https://openrouteservice.org/privacy-policy/" target="_blank" rel="noreferrer">openrouteservice</a> (address search and
            driving routes in the route planner),{" "}
            <a href="https://cloud.google.com/terms/cloud-privacy-notice" target="_blank" rel="noreferrer">Google Cloud Vision</a> (finding
            faces and license plates in uploaded photos so we can blur them), our map tile provider and our hosting provider.
          </li>
          <li>
            <strong>Advertising partners.</strong> When ads load, Google and its partners receive device and browser information, such as
            your IP address, and may use cookies to show interest-based ads across websites and apps. Under some US state laws this may
            count as &ldquo;selling&rdquo; or &ldquo;sharing&rdquo; personal information; see Sections 7 and 10 for how to opt out.
          </li>
          <li>
            <strong>Listed businesses.</strong> When you click a link to a business, shop or experience, that business may learn that you came
            from our Services. If you contact a business directly, its own privacy policy applies.
          </li>
          <li>
            <strong>Legal and safety.</strong> We may disclose information if required by law, court order or government request, or to
            protect the rights, safety or property of our users, the public or Green Star Tech.
          </li>
          <li>
            <strong>Business transfers.</strong> If we are involved in a merger, acquisition or sale of assets, your information may be
            transferred as part of that deal.
          </li>
          <li>
            <strong>With your consent.</strong> In any other case where you ask or agree to us sharing it.
          </li>
        </ul>

        <h2>7. Cookies and Similar Technologies</h2>
        <p>Cookies are small files stored on your device. We also use pixel tags and local storage, which work in a similar way.</p>
        <Table
          head={["Type", "What it does"]}
          rows={[
            ["Essential", "Keeps you signed in and makes core features work. The Services cannot work properly without these."],
            ["Functional", "Remembers your choices, such as your saved stations and your vehicle in the route planner."],
            ["Advertising", "Lets us and our partners show ads based on your interests and measure their results."],
          ]}
        />
        <p>
          <strong>Google advertising.</strong> We show ads from Google AdSense. Third-party vendors, including Google, use cookies to serve
          ads based on your prior visits to this website or other websites. Google&apos;s use of advertising cookies enables it and its
          partners to serve ads to you based on your visit to this site and/or other sites on the Internet. Learn more about{" "}
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">
            how Google uses information from sites that use its services
          </a>
          . You can opt out of personalized advertising in{" "}
          <a href="https://www.google.com/settings/ads" target="_blank" rel="noreferrer">Google Ads Settings</a>, or opt out of some
          third-party vendors&apos; use of cookies for personalized advertising at{" "}
          <a href="https://www.aboutads.info/choices/" target="_blank" rel="noreferrer">www.aboutads.info</a>.
        </p>
        <p>
          <strong>Your choices.</strong> You can block or delete cookies in your browser settings, though some features may stop working.
          Local storage is managed separately from cookies, usually by clearing your browser&apos;s site data. Where the law requires it,
          including in the EEA and UK, we ask for your consent before setting non-essential cookies.
        </p>

        <h2>8. Data Retention</h2>
        <p>
          We keep personal information only as long as we need it for the purposes in this policy. Account information is kept while your
          account is active. When you delete your account, we delete or de-identify your personal information within a reasonable time,
          unless we must keep some of it to meet legal obligations, resolve disputes or enforce our agreements. Log and error monitoring data
          is kept for a limited period and then deleted.
        </p>
        <p>
          Before we store a photo you upload, we remove its location, time and camera details. Photos we decline are deleted; published
          photos stay on the Service until we or you remove them. The email address you give with a photo is never shown on the Service; we
          keep it while the photo is stored, in case we have a question about it.
        </p>

        <h2>9. International Data Transfers</h2>
        <p>
          Green Star Tech is based in the United States, and our service providers may process data in the US and other countries. Data
          protection laws there may differ from those where you live. When we transfer personal information from the EEA, UK, Canada or
          Australia, we use appropriate safeguards, such as the European Commission&apos;s Standard Contractual Clauses, the UK
          International Data Transfer Addendum, or other lawful transfer mechanisms.
        </p>

        <h2>10. Your Privacy Rights</h2>
        <p>
          To use any of these rights, email us at {email}. We may need to verify your identity before acting on a request. We will not treat
          you differently for using your rights.
        </p>
        <p>
          <strong>All users.</strong> You can turn off precise location in your device settings and ask us to delete your account.
        </p>
        <p>
          <strong>EEA and UK.</strong> You have the right to access, correct or delete your personal information; to restrict or object to
          processing; to data portability; and to withdraw consent at any time. You may also complain to your local data protection
          authority or, in the UK, the Information Commissioner&apos;s Office.
        </p>
        <p>
          <strong>United States.</strong> Depending on your state (including California, Virginia, Colorado, Connecticut and others), you
          may have the right to know what personal information we hold, to access, correct or delete it, and to opt out of the
          &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; of personal information and of targeted advertising. If we deny your request, you may appeal by replying to our decision. California
          residents may use an authorized agent to make a request.
        </p>
        <p>
          <strong>Canada.</strong> Under PIPEDA and applicable provincial laws, you may access and ask to correct your personal information
          and withdraw consent, subject to legal limits. You may complain to the Office of the Privacy Commissioner of Canada.
        </p>
        <p>
          <strong>Australia.</strong> Under the Privacy Act 1988 and the Australian Privacy Principles, you may access and ask to correct
          your personal information. If you are not satisfied with how we handle a complaint, you may contact the Office of the Australian
          Information Commissioner (OAIC).
        </p>
        <p>We aim to respond within 30 days, or within the time the law in your region requires.</p>

        <h2>11. Children&apos;s Privacy</h2>
        <p>
          The Services are meant for adults and are not directed to children. We do not knowingly collect personal information from children
          under 13, or under 16 in the EEA and UK. If you believe a child has given us personal information, contact us and we will delete
          it.
        </p>

        <h2>12. Security</h2>
        <p>
          We use reasonable technical and organizational measures to protect personal information, including encrypted connections and
          access controls. No method of storage or transmission is completely secure, so we cannot guarantee absolute security. If a breach
          affects your personal information, we will notify you and the authorities where the law requires.
        </p>

        <h2>13. Third-Party Sites and Trademarks</h2>
        <p>
          The Services link to charging networks, businesses and other websites we do not control. Their privacy practices are governed by
          their own policies, which we encourage you to read.
        </p>
        <p>
          Green Star Tech is an independent service. We are not affiliated with, endorsed by, or sponsored by Tesla, Inc. &ldquo;Tesla&rdquo;
          and &ldquo;Supercharger&rdquo; are trademarks of their respective owners and are used only to describe the charging locations our
          Services help you find.
        </p>

        <h2>14. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy as our Services or the law change. The current version will always be posted on our website with
          its effective date. If we make material changes, we will notify you by email or through the Services before they take effect.
        </p>

        <h2>15. Contact Us</h2>
        <p>For questions, requests or complaints about this Privacy Policy or your personal information, contact:</p>
        <p>
          <strong>Green Star Tech</strong>
          <br />
          Email: {email}
          <br />
          Website: <Link href="/">{SITE_HOST}</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
