export const SITE_NAME = "TeslaSuperchargerNearMe";

// The canonical address of the site. Canonical links (metadataBase in app/layout.tsx), the
// sitemap and structured data all point here; next.config.ts sends the *.vercel.app address to it.
export const SITE_URL = "https://teslasuperchargernearme.com";

// Shown on the About, Contact and Privacy pages.
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "info@greenstartech.io";

const bareHost = (host: string | undefined) => host?.replace(/^www\./, "").toLowerCase();

// Only the live site may be indexed. On Vercel that means a production deployment served on our
// real domain: previews, staging and the *.vercel.app address (which is public even before the
// domain is connected) all tell search engines to stay away, so Google never sees a duplicate.
export const isIndexable = process.env.VERCEL_ENV
  ? process.env.VERCEL_ENV === "production" && bareHost(process.env.VERCEL_PROJECT_PRODUCTION_URL) === bareHost(new URL(SITE_URL).host)
  : process.env.NODE_ENV === "production";

export function absoluteUrl(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
