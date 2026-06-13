import { Metadata } from "next";
import GeoLandingPage from "@/components/geo/GeoLandingPage";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");
const country = COUNTRY_BY_SLUG["togo"];

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Pronostics PMU Togo ${country.drapeau} — Quinté+, Tiercé, Quarté+`,
  description: "Pronostics PMU France analysés par notre équipe experte pour les parieurs togolais. Quinté+, Tiercé, Quarté+ via LONATO. Paiement par carte bancaire (toutes cartes). Mobile Money bientôt disponible.",
  keywords: country.motsCles,
  alternates: { canonical: `${APP_URL}/pronostics-pmu-togo` },
  openGraph: {
    title: `Pronostics PMU Togo ${country.drapeau} — Elite Turf`,
    description: country.accroche,
    url: `${APP_URL}/pronostics-pmu-togo`,
    type: "website",
  },
};

export default function TogoPage() {
  return <GeoLandingPage country={country} />;
}
