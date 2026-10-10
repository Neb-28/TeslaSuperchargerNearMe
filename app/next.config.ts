import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Country slugs with a homepage (app/home/[country]), from the same snapshot lib/superchargers.ts reads.
const world = JSON.parse(readFileSync(path.join(process.cwd(), "data", "world-superchargers.json"), "utf8")) as {
  stations: { state: string }[];
};
const countrySlugs = [...new Set(world.stations.map((station) => station.state))].sort();
const countryValue = `(?<country>${countrySlugs.join("|")})`;

const nextConfig: NextConfig = {
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

export default nextConfig;
