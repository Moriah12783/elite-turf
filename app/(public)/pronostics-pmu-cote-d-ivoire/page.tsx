import { Metadata } from "next";
import GeoLandingPage from "@/components/geo/GeoLandingPage";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");
const country = COUNTRY_BY_SLUG["cote-d-ivoire"];

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Pronostics PMU Côte d'Ivoire ${country.drapeau} — Quinté+, Tiercé, Quarté+`,
  description: "Pronostics PMU France et courses LONACI analysés par notre équipe experte pour les parieurs de Côte d'Ivoire. Paiement Orange Money, Wave, MTN. Tarifs en FCFA.",
  keywords: country.motsCles,
  alternates: { canonical: `${APP_URL}/pronostics-pmu-cote-d-ivoire` },
  openGraph: {
    title: `Pronostics PMU Côte d'Ivoire ${country.drapeau} — Elite Turf`,
    description: country.accroche,
    url: `${APP_URL}/pronostics-pmu-cote-d-ivoire`,
    type: "website",
  },
};

export default function CoteDIvoirePage() {
  return <GeoLandingPage country={country} />;
}
