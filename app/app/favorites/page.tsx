import type { Metadata } from "next";
import FavoritesList from "@/components/FavoritesList";
import FavoritesSyncNote from "@/components/FavoritesSyncNote";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Favorites",
  // Saved stations are personal (on the device, or synced to an account); nothing for search engines.
  robots: { index: false, follow: true },
};

export default function FavoritesPage() {
  return (
    <div className="app-shell">
      <SiteHeader backHref="/" />
      <main id="main" className="content-page">
        <h1 className="page-title">Favorites</h1>
        <FavoritesSyncNote />
        <FavoritesList />
      </main>
      <SiteFooter />
    </div>
  );
}
