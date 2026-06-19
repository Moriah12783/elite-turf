import GeoLandingPage from "@/components/geo/GeoLandingPage";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";
import { buildGeoMetadata } from "@/lib/geo/content";

const country = COUNTRY_BY_SLUG["senegal"];

export const revalidate = 3600;
export const metadata = buildGeoMetadata(country);

export default function GeoCountryPage() {
  return <GeoLandingPage country={country} />;
}
