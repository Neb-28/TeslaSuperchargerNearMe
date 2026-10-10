import type { Metadata } from "next";
import HomeContent from "@/components/HomeContent";

// The title and description come from the root layout's defaults.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// The US homepage. It reads no query string, so it is built once and served from the CDN;
// /?country=germany is rewritten to app/home/[country] instead (see next.config.ts).
export default function HomePage() {
  return <HomeContent country={null} />;
}
