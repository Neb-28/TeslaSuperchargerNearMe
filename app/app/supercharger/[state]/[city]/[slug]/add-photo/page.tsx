import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import AddPhotoForm from "@/components/AddPhotoForm";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { blurConfigured } from "@/lib/photoBlur";
import { getStationBySlug, stationHref } from "@/lib/superchargers";

type AddPhotoPageProps = PageProps<"/supercharger/[state]/[city]/[slug]/add-photo">;

// Built the first time someone visits, like the station page above it.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: AddPhotoPageProps): Promise<Metadata> {
  const station = getStationBySlug((await params).slug);
  if (!station) return {};
  return {
    title: `Add a photo of ${station.name}`,
    // A form, not content: keep it out of search results but let Google follow the links.
    robots: { index: false, follow: true },
  };
}

export default async function AddPhotoPage({ params }: AddPhotoPageProps) {
  const { state, city, slug } = await params;
  const station = getStationBySlug(slug);
  if (!station) notFound();
  const href = stationHref(station);
  if (state !== station.state || city !== station.city) permanentRedirect(`${href}/add-photo`);

  return (
    <div className="app-shell">
      <SiteHeader backHref={href} />
      <main id="main" className="content-page">
        <h1 className="page-title">Add a photo of {station.name}</h1>
        <p className="page-sub">
          Help the next driver find the stalls: where they are in the lot or garage, how to get in, and what&apos;s around them.
          {station.address ? ` ${station.address}.` : ""}
        </p>
        <noscript>
          <p className="form-error">Adding a photo needs JavaScript. Please turn it on and reload this page.</p>
        </noscript>
        <AddPhotoForm stationId={station.id} stationName={station.name} stationHref={href} blurOn={blurConfigured()} />
      </main>
      <SiteFooter />
    </div>
  );
}
