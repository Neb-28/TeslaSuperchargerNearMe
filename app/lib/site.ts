export const SITE_NAME = "TeslaSuperchargerNearMe";

// Absolute URLs (canonical links, sitemap, structured data) are built from this.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://teslasuperchargernearme.com").replace(/\/+$/, "");

// Only the live site may be indexed: Vercel preview and staging deployments, and local dev,
// tell search engines to stay away so Google never sees a duplicate copy of the site.
export const isIndexable = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : process.env.NODE_ENV === "production";

export function absoluteUrl(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
