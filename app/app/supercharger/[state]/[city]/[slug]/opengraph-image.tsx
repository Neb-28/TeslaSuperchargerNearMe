import { ImageResponse } from "next/og";
import { BoltMark, BRAND } from "@/lib/shareImage";
import { getStationBySlug } from "@/lib/superchargers";

// The preview card when a station page is shared: the brand mark, the station and its chargers.
export const alt = "Tesla Supercharger: stalls, charging speed and places nearby";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function StationImage({ params }: { params: Promise<{ slug: string }> }) {
  const station = getStationBySlug((await params).slug);
  const facts = station
    ? [station.stalls ? `${station.stalls} stalls` : null, station.maxKw ? `up to ${station.maxKw} kW` : null].filter(Boolean).join(" · ")
    : "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: BRAND.ink }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <BoltMark size={96} />
          <div style={{ fontSize: 40, fontWeight: 700, color: BRAND.surface }}>Tesla Supercharger Near Me</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 64, fontWeight: 700, color: BRAND.surface, lineHeight: 1.1 }}>{station?.name ?? "Tesla Supercharger"}</div>
          {facts ? <div style={{ marginTop: 20, fontSize: 40, color: BRAND.mint }}>{facts}</div> : null}
          <div style={{ marginTop: 16, fontSize: 32, color: BRAND.border }}>Places to eat, coffee and shops within walking distance</div>
        </div>
      </div>
    ),
    size,
  );
}
