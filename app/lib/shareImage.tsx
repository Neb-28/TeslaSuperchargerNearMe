// The brand mark drawn for generated images (app icons, link previews), with the design tokens'
// literal colors: ImageResponse draws outside the page, so CSS variables aren't available.
export const BRAND = {
  ink: "#14211C",
  inkRaised: "#24342E",
  mint: "#3DDC97",
  surface: "#FFFFFF",
  border: "#CFD8D3",
};

// Mint rounded square with the dark lightning bolt, as in the site header.
export function BoltMark({ size, radius = size * 0.25 }: { size: number; radius?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: BRAND.mint,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke={BRAND.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
      </svg>
    </div>
  );
}
