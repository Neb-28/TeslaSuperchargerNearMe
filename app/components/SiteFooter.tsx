import Link from "next/link";

// `dataCredit` is for pages showing station details, which are checked against supercharge.info;
// `placesCredit` for pages listing nearby places, which also come from Overture Maps.
export default function SiteFooter({ osmCredit = false, dataCredit = false, placesCredit = false }: { osmCredit?: boolean; dataCredit?: boolean; placesCredit?: boolean }) {
  return (
    <footer className="footer-note">
      {osmCredit ? <div>Map data © OpenStreetMap contributors</div> : null}
      {dataCredit ? <div>Station data: supercharge.info</div> : null}
      {placesCredit ? <div>Places: OpenStreetMap contributors, Overture Maps Foundation</div> : null}
      <div>Not affiliated with Tesla, Inc.</div>
      <nav className="footer-links" aria-label="Site">
        <Link href="/about" className="footer-link">About</Link>
        <Link href="/contact" className="footer-link">Contact</Link>
        <Link href="/privacy" className="footer-link">Privacy policy</Link>
        <Link href="/terms" className="footer-link">Terms of Use</Link>
      </nav>
    </footer>
  );
}
