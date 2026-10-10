export const BRAND_NAME = "TeslaSuperchargerNearMe";

// Breaks after "Supercharger" on narrow screens so the long name never gets cut off.
export default function BrandName() {
  return (
    <>
      TeslaSupercharger
      <wbr />
      NearMe
    </>
  );
}
