import { permanentRedirect } from "next/navigation";
import { stationHref, superchargers } from "@/lib/superchargers";

// The old single sample page. Send anyone with the old link to the real station it showed.
export default function OldStationPage() {
  const station = superchargers.find((item) => item.name === "Woodbridge, VA – Potomac Town Place");
  permanentRedirect(station ? stationHref(station) : "/map");
}
