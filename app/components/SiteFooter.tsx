import Link from "next/link";

export default function SiteFooter({ osmCredit = false }: { osmCredit?: boolean }) {
  return (
    <footer className="footer-note">
      {osmCredit ? <div>Map data © OpenStreetMap contributors</div> : null}
      <div>Not affiliated with Tesla, Inc.</div>
      <div>
        <Link href="/privacy" className="footer-link">Privacy policy</Link>
      </div>
    </footer>
  );
}
