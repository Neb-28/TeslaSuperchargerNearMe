"use client";

import { useRouter } from "next/navigation";
import SearchSuggest, { suggestionHref } from "./SearchSuggest";

// The home page's search box: picking a suggestion opens the map there; Enter still submits the
// plain GET form to /map.
export default function HomeSearchInput({ country }: { country: string | null }) {
  const router = useRouter();
  return (
    <SearchSuggest
      id="home-search"
      name="q"
      type="search"
      enterKeyHint="search"
      placeholder="Search an address, city or ZIP code"
      country={country}
      onPick={(suggestion) => router.push(suggestionHref(suggestion))}
    />
  );
}
