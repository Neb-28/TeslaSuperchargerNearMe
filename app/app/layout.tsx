import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import { BRAND_NAME } from "@/components/BrandName";
import { isIndexable, SITE_NAME, SITE_URL } from "@/lib/site";
import FavoritesSync from "@/components/FavoritesSync";
import HistoryTracker from "@/components/HistoryTracker";

const displayFont = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const bodyFont = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export const metadata: Metadata = {
  // Every canonical tag and share URL resolves against https://teslasuperchargernearme.com.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Tesla Supercharger Near Me – Find the Closest Supercharger",
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    "Find the closest Tesla Supercharger, see how many stalls and how fast it charges, and what's within walking distance while you charge. Every US Supercharger on one map.",
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_US" },
  // Shared links show the large preview card (app/opengraph-image.tsx, or a station's own).
  twitter: { card: "summary_large_image" },
  // Previews, staging and local dev must never be indexed (see lib/site.ts).
  ...(isIndexable ? {} : { robots: { index: false, follow: false } }),
  // Lets AdSense confirm we own the site on every page.
  ...(adsenseClient ? { other: { "google-adsense-account": adsenseClient } } : {}),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a href="#main" className="skip-link">Skip to content</a>
        <HistoryTracker />
        <FavoritesSync />
        {children}
      </body>
    </html>
  );
}
