import { ImageResponse } from "next/og";
import { BoltMark } from "@/lib/shareImage";

// iPhone home-screen icon, also used by iMessage and other apps for link previews.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  // iOS rounds the corners itself, so the square fills the whole image.
  return new ImageResponse(<BoltMark size={180} radius={0} />, size);
}
