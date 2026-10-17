export const BRAND_NAME = "TeslaSuperchargerNearMe";

// How the name reads in the header: separate words, always on one line (on phones the header
// shrinks the font to fit; see .topbar .brand-mark).
const BRAND_DISPLAY_NAME = "Tesla Supercharger Near Me";

export default function BrandName() {
  return <>{BRAND_DISPLAY_NAME}</>;
}
