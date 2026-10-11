import type { Metadata } from "next";
import RoutePlanner from "@/components/RoutePlanner";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { routingConfigured } from "@/lib/openRouteService";

export const metadata: Metadata = {
  title: "EV route planner: Superchargers along your trip",
  description:
    "Enter your start, destination, car and range. See which Tesla Superchargers to stop at, how long to charge, and where to eat or grab coffee while you charge.",
  alternates: { canonical: "/route-planner" },
};

export default function RoutePlannerPage() {
  return (
    <div className="app-shell">
      <SiteHeader backHref="/" />
      <main id="main" className="content-page">
        <h1 className="page-title">Route planner</h1>
        <p className="page-sub">
          Tell us where you&apos;re starting, where you&apos;re going and what you drive. We&apos;ll pick Superchargers along the way and
          show what&apos;s nearby at each stop.
        </p>
        <RoutePlanner configured={routingConfigured()} />
      </main>
      <SiteFooter osmCredit />
    </div>
  );
}
