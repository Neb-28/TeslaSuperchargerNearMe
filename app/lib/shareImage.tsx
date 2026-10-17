// The brand mark drawn for generated images (app icons, link previews), with the design tokens'
// literal colors: ImageResponse draws outside the page, so CSS variables aren't available.
export const BRAND = {
  ink: "#171A1C",
  inkRaised: "#2A2E31",
  brand: "#E82127",
  surface: "#FFFFFF",
  border: "#D4D6D9",
};

// Red rounded square with the white lightning bolt, as in the site header.
export function BoltMark({ size, radius = size * 0.25 }: { size: number; radius?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: BRAND.brand,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke={BRAND.surface} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
      </svg>
    </div>
  );
}
