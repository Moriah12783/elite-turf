import { Metadata } from "next";
import GeoLandingPage from "@/components/geo/GeoLandingPage";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");
const country = COUNTRY_BY_SLUG["cameroun"];

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Pronostics PMU Cameroun ${country.drapeau} — Quinté+, PMUC | Elite Turf`,
  description: "Pronostics PMU France pour les turfistes camerounais. Paiement Orange Money, MTN MoMo, Express Union. Tarifs en FCFA.",
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
