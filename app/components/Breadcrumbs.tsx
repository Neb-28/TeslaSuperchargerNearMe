import Link from "next/link";
import { absoluteUrl } from "@/lib/site";
import JsonLd from "./JsonLd";

export type Crumb = { name: string; href: string };

// Visible trail plus matching BreadcrumbList data, so Google can show "Home › Texas › Austin".
// `showCurrent={false}` hides the last crumb on screen when the page heading already says it.
export default function Breadcrumbs({ items, showCurrent = true }: { items: Crumb[]; showCurrent?: boolean }) {
  const visible = showCurrent ? items : items.slice(0, -1);
  return (
    <>
      <nav aria-label="Breadcrumb" className="breadcrumbs">
        <ol>
          {visible.map((item, index) => (
            <li key={item.href}>
              {showCurrent && index === items.length - 1 ? <span aria-current="page">{item.name}</span> : <Link href={item.href}>{item.name}</Link>}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: absoluteUrl(item.href),
          })),
        }}
      />
    </>
  );
}
