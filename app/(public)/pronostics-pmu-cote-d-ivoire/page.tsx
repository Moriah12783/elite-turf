/**
 * /pronostics-pmu-cote-d-ivoire — page pays migrée (brief « pages pays », vague 1).
 * Contenu : components/geo/pays/PagePays.tsx (registre de faits validé + données
 * du jour). Les pages des autres pays gardent GeoLandingPage jusqu'à leur vague.
 */
import PagePays from "@/components/geo/pays/PagePays";
import { metadataPagePays } from "@/lib/geo/metadata-pays";

export const revalidate = 3600;

export function generateMetadata() {
  return metadataPagePays("cote-d-ivoire");
}

export default function GeoCountryPage() {
  return <PagePays slug="cote-d-ivoire" />;
}
