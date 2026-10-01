import GeoLandingPage from "@/components/geo/GeoLandingPage";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";
import { buildGeoMetadata } from "@/lib/geo/content";

const country = COUNTRY_BY_SLUG["togo"];

export const revalidate = 3600;

// Brief « pages pays » (01/10/2026, §6) : ≈ 0 impression et aucune fiche
// vérifiée → noindex et hors sitemap (app/sitemap.ts) tant qu'aucune fiche
// sourcée n'existe. La page reste accessible aux visiteurs.
export const metadata = {
  ...buildGeoMetadata(country),
  robots: { index: false, follow: true },
};

export default function GeoCountryPage() {
  return <GeoLandingPage country={country} />;
}
