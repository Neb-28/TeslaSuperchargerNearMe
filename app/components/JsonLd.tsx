// Structured data for search engines (schema.org JSON-LD).
export default function JsonLd({ data }: { data: object }) {
  // Escape "<" so text inside the JSON can never close the script tag.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
