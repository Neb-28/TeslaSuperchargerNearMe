import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Country slugs with a homepage (app/home/[country]), from the same snapshot lib/superchargers.ts reads.
const world = JSON.parse(readFileSync(path.join(process.cwd(), "data", "world-superchargers.json"), "utf8")) as {
  stations: { state: string }[];
};
const countrySlugs = [...new Set(world.stations.map((station) => station.state))].sort();
const countryValue = `(?<country>${countrySlugs.join("|")})`;

const nextConfig: NextConfig = {
  // Which Sentry environment this build reports as: Vercel's "production" or "preview", or
  // "local" for builds on a developer's machine (so testing never mixes with real visitors).
  env: { NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.VERCEL_ENV ?? "local" },

  // Dev only: lets a phone on the same Wi-Fi load the dev server's scripts
  // (e.g. http://192.168.1.224:3107). Has no effect on production builds.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],

  // The homepage stays a prebuilt page: /?country=germany is served by the prebuilt
  // app/home/germany page instead of rendering / on every visit. Unknown or missing
  // countries get the US homepage, as before.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", has: [{ type: "query", key: "country", value: countryValue }], destination: "/home/:country" }],
      afterFiles: [],
      fallback: [],
    };
  },
  // /home/germany is only an internal address; anyone who lands on it goes to the real one.
  async redirects() {
    return [{ source: "/home/:country", destination: "/?country=:country", permanent: true }];
  },
};

// Sentry's build step: uploads source maps so production stack traces are readable. Needs
// SENTRY_ORG, SENTRY_PROJECT and SENTRY_AUTH_TOKEN; without them the build simply skips the upload.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload a larger set of source maps for prettier stack traces
  widenClientFileUpload: true,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,
});
