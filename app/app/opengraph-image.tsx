import { ImageResponse } from "next/og";
import { BoltMark, BRAND } from "@/lib/shareImage";

// The preview card when a page of the site is shared (pages without their own card).
export const alt = "Tesla Supercharger Near Me: find a Supercharger and what's nearby while you charge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: BRAND.ink }}>
        <BoltMark size={140} />
        <div style={{ marginTop: 48, fontSize: 72, fontWeight: 700, color: BRAND.surface }}>Tesla Supercharger Near Me</div>
        <div style={{ marginTop: 20, fontSize: 36, color: BRAND.border }}>
          Find a Supercharger and see what&apos;s within walking distance while you charge.
        </div>
      </div>
    ),
    size,
  );
}
