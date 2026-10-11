import type { MetadataRoute } from "next";
import { isIndexable, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Staging, preview deployments and local dev: keep every crawler out.
  if (!isIndexable) return { rules: { userAgent: "*", disallow: "/" } };

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/business/", "/favorites", "/account", "/login", "/auth/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
