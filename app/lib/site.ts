export const SITE_NAME = "TeslaSuperchargerNearMe";

// Absolute URLs (canonical links, sitemap, structured data) are built from this.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://teslasuperchargernearme.com").replace(/\/+$/, "");

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
