import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomeContent from "@/components/HomeContent";
import { countries, getCountry } from "@/lib/superchargers";

// The homepage for one country. Visitors reach it as /?country=germany (next.config.ts rewrites
// that URL here, and sends /home/germany back to it), so the address bar never shows /home.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Every country's homepage is built at deploy time; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return countries.map((country) => ({ country: country.slug }));
}

export default async function CountryHomePage({ params }: PageProps<"/home/[country]">) {
  const country = getCountry((await params).country);
  if (!country) notFound();
  return <HomeContent country={country} />;
}
