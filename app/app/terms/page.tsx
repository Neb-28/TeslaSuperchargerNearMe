import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms for using TeslaSuperchargerNearMe, operated by Green Star Tech.",
  alternates: { canonical: "/terms" },
};

// Green Star Tech's Terms of Use (supplied by the owner). Update EFFECTIVE_DATE with every change.
const EFFECTIVE_DATE = "October 14, 2026";
const SITE_HOST = new URL(SITE_URL).host;

export default function TermsPage() {
  const email = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

  return (
    <div className="app-shell">
      <SiteHeader backHref="/" />
      <main id="main" className="content-page legal-page">
        <h1 className="page-title">Terms of Use</h1>
        <p className="page-sub">
          <strong>Green Star Tech</strong> · {SITE_HOST}
          <br />
          Effective date: {EFFECTIVE_DATE}
        </p>

        <h2>1. Agreement to These Terms</h2>
        <p>
          These Terms of Use (the &ldquo;Terms&rdquo;) are an agreement between you and Green Star Tech (&ldquo;Green Star Tech,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). They govern your use of <Link href="/">{SITE_HOST}</Link> (the
          &ldquo;Service&rdquo;). The Service helps electric vehicle drivers find charging locations nearby and discover businesses, shops
          and experiences close to those locations.
        </p>
        <p>
          By accessing or using the Service, you agree to these Terms and to our <Link href="/privacy">Privacy Policy</Link>, whether or
          not you create an account. If you do not agree, do not use the Service.
        </p>
        <p>
          We may update these Terms from time to time. We will post the new version with a new effective date and, for material changes,
          notify you by email or through the Service. Changes apply from the date they are posted unless we say otherwise. If you keep
          using the Service after a change takes effect, you accept the updated Terms.
        </p>

        <h2>2. Eligibility and Accounts</h2>
        <p>
          You must be at least 18 years old, or the age of majority where you live, to create an account. Some features work without an
          account.
        </p>
        <p>
          You sign in using your email address. You agree to give us accurate information, keep your email account secure, and not share
          your sign-in links or codes. You are responsible for activity under your account. Tell us right away at {email} if you think
          someone has accessed your account without permission.
        </p>

        <h2>3. Acceptable Use</h2>
        <p>You agree not to, and not to help anyone else:</p>
        <ul>
          <li>Scrape, copy or redistribute the Service or its data, by automated or manual means, without our written permission.</li>
          <li>Use bots, crawlers or other automated tools that send more requests than a person could reasonably make with a normal browser.</li>
          <li>Overload, disrupt or interfere with the Service or the servers that run it.</li>
          <li>Try to break into, test the security of, or bypass any access controls or usage limits on the Service.</li>
          <li>Upload viruses, malware or deliberately false data.</li>
          <li>Collect other users&apos; personal information.</li>
          <li>Send spam or use the Service for unsolicited advertising.</li>
          <li>Impersonate anyone, misstate your affiliation with any person or business, or hide your identity to commit fraud.</li>
          <li>Use the Service for anything illegal or in a way that violates others&apos; rights.</li>
          <li>Access the Service other than through the interfaces we provide.</li>
        </ul>

        <h2>4. Charging and Business Information</h2>
        <p>
          Charger locations, availability, pricing, connector types and opening hours come from third parties and can change without
          notice. We do our best to keep this information current, but we do not guarantee that it is accurate, complete or up to date.
          Always confirm details with the charging network or business before relying on them, and plan your trip with enough range to
          reach an alternative.
        </p>
        <p>Do not use the Service in a way that distracts you while driving. Follow all traffic laws and road conditions.</p>
        <p>
          Businesses, shops and experiences shown in the Service are independent of Green Star Tech. We do not control, endorse or
          guarantee their products, services, prices or conduct. Any purchase or booking you make is between you and that business.
        </p>

        <h2 id="photos">5. Photos You Upload</h2>
        <p>
          You can add photos of charging stations to the Service. When you upload a photo, you confirm that you took it or have the right
          to share it, and that it doesn&apos;t break the law or anyone else&apos;s rights.
        </p>
        <p>
          You keep ownership of your photo. You give Green Star Tech a worldwide, non-exclusive, royalty-free license to store, show, resize,
          crop and blur it on the Service, for as long as it is published there.
        </p>
        <p>
          We review photos before they appear and may decline or remove any photo at any time. We remove location and camera details from
          every photo and automatically blur faces and license plates we detect, but we can&apos;t promise to catch every one, so please
          don&apos;t upload photos where people or license plates are the subject. To ask us to remove a photo you uploaded, email {email}.
        </p>

        <h2>6. Your License to Use the Service</h2>
        <p>
          If you follow these Terms, we give you a personal, limited, non-exclusive, non-transferable and revocable license to use the
          Service for your own non-commercial purposes.
        </p>
        <p>This license is not a sale. We keep all rights not expressly granted to you.</p>

        <h2>7. Our Intellectual Property</h2>
        <p>
          The Service and everything in it, including software, design, text, graphics, logos and data compilations, belongs to Green Star
          Tech or its licensors and is protected by law. You may not copy, sell, modify, distribute or create derivative works from it
          without our written permission.
        </p>
        <p>
          <strong>Feedback.</strong> If you send us ideas or suggestions, you agree we may use them freely, without any obligation or
          payment to you.
        </p>
        <p>
          <strong>Trademarks.</strong> Green Star Tech is an independent service and is not affiliated with, endorsed by or sponsored by
          Tesla, Inc. &ldquo;Tesla&rdquo; and &ldquo;Supercharger&rdquo; are trademarks of their respective owners and are used only to
          describe the charging locations the Service helps you find. Other names and logos shown in the Service belong to their owners.
        </p>

        <h2>8. Privacy and Security</h2>
        <p>
          Our <Link href="/privacy">Privacy Policy</Link> explains how we collect, use and share your personal information. Please read it.
        </p>
        <p>
          We use reasonable measures to protect your information, but no system is completely secure, and we cannot guarantee that
          unauthorized parties will never get access to it.
        </p>

        <h2>9. Third-Party Links, Advertisers and Businesses</h2>
        <p>
          The Service may include links, ads, offers or content from charging networks, advertisers, businesses and other websites we do
          not own or control. We do not endorse them and are not responsible for their content, products, services or privacy practices.
          Your dealings with them, including payment, delivery and warranties, are solely between you and them, and their own terms apply.
        </p>

        <h2>10. Changes, Suspension and Termination</h2>
        <p>
          We may change, add or remove features, set usage limits, or stop offering the Service, at any time. We may suspend or end your
          access if you break these Terms, if required by law, or to protect the Service or other users. Where reasonable, we will give you
          notice.
        </p>
        <p>
          You may stop using the Service and ask us to delete your account at any time by emailing {email}. Sections that by their nature
          should continue, including intellectual property, disclaimers, limitation of liability, indemnity and governing law, survive
          termination.
        </p>

        <h2>11. Disclaimers and Limitation of Liability</h2>
        <p>
          <strong>No warranties.</strong> The Service is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; To the fullest extent
          the law allows, we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose,
          accuracy and non-infringement. We do not promise that the Service will be uninterrupted, error-free or secure, or that any charger
          or business will be available, working or as described.
        </p>
        <p>
          <strong>Limit on liability.</strong> To the fullest extent the law allows, Green Star Tech and its owners, employees and partners
          will not be liable for any indirect, incidental, special, consequential or punitive damages, or for lost profits, lost data,
          missed trips, towing, or vehicle or battery issues, arising from your use of the Service or reliance on its information. Our total
          liability for any claim relating to the Service is limited to the greater of the amount you paid us in the 12 months before the
          claim or US $100.
        </p>
        <p>
          Some places do not allow certain warranty exclusions or liability limits, so some of the above may not apply to you. Nothing in
          these Terms limits liability that cannot be limited by law, such as for death or personal injury caused by negligence, or for
          fraud.
        </p>

        <h2>12. Indemnity</h2>
        <p>
          To the extent the law allows, you agree to defend, indemnify and hold harmless Green Star Tech and its owners, employees,
          contractors and partners from claims, losses, damages and costs, including reasonable legal fees, arising from: your use of the
          Service; your breach of these Terms; your violation of any law or anyone else&apos;s rights; or anyone else&apos;s use of your
          account.
        </p>

        <h2>13. Governing Law and Disputes</h2>
        <p>
          These Terms are governed by the laws of the Commonwealth of Virginia, USA, without regard to its conflict-of-law rules. Any
          dispute will be handled in the state or federal courts located in Virginia, and you and we consent to those courts.
        </p>
        <p>Before filing a claim, please email us at {email} so we can try to resolve it informally within 30 days.</p>
        <p>
          <strong>Consumers outside the US.</strong> If you live in the European Economic Area, the United Kingdom, Canada or Australia,
          you keep the protections of the mandatory consumer laws where you live, and you may bring claims in your local courts where those
          laws allow. Nothing in these Terms limits any consumer guarantees you have under the Australian Consumer Law.
        </p>

        <h2>14. General Terms and Contact</h2>
        <p>
          These Terms and our Privacy Policy are the entire agreement between you and Green Star Tech about the Service. If any part is
          found unenforceable, the rest stays in effect. If we do not enforce a term right away, we have not waived it. You may not
          transfer your rights under these Terms; we may transfer ours, for example in a merger or sale of the business.
        </p>
        <p>Questions or complaints about these Terms? Contact us:</p>
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
