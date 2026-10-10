import Link from "next/link";

// `dataCredit` is for pages showing stations outside the US, which come from supercharge.info.
export default function SiteFooter({ osmCredit = false, dataCredit = false }: { osmCredit?: boolean; dataCredit?: boolean }) {
  return (
    <footer className="footer-note">
      {osmCredit ? <div>Map data © OpenStreetMap contributors</div> : null}
      {dataCredit ? <div>Station data: supercharge.info</div> : null}
      <div>Not affiliated with Tesla, Inc.</div>
      <div>
        <Link href="/privacy" className="footer-link">Privacy policy</Link>
      </div>
    </footer>
  );
}
