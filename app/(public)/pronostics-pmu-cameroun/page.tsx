import { Metadata } from "next";
import GeoLandingPage from "@/components/geo/GeoLandingPage";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");
const country = COUNTRY_BY_SLUG["cameroun"];

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Pronostics PMU Cameroun ${country.drapeau} — Quinté+, PMUC`,
  description: "Pronostics PMU France pour les turfistes camerounais. Paiement par carte bancaire (toutes cartes). Mobile Money bientôt disponible.",
  keywords: country.motsCles,
  alternates: { canonical: `${APP_URL}/pronostics-pmu-cameroun` },
  openGraph: {
    title: `Pronostics PMU Cameroun ${country.drapeau} — Elite Turf`,
    description: country.accroche,
    url: `${APP_URL}/pronostics-pmu-cameroun`,
    type: "website",
  },
};

export default function CamerounPage() {
  return <GeoLandingPage country={country} />;
}
