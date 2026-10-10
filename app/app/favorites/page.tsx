import type { Metadata } from "next";
import FavoritesList from "@/components/FavoritesList";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Favorites",
  // Saved stations live on each visitor's device; there's nothing here for search engines.
  robots: { index: false, follow: true },
};

export default function FavoritesPage() {
  return (
    <div className="app-shell">
      <SiteHeader backHref="/" />
      <main id="main" className="content-page">
        <h1 className="page-title">Favorites</h1>
        <p className="page-sub">Stations you save are kept on this device.</p>
        <FavoritesList />
      </main>
      <SiteFooter />
    </div>
  );
}
