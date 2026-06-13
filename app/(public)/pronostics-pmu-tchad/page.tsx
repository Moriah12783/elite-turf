import { Metadata } from "next";
import GeoLandingPage from "@/components/geo/GeoLandingPage";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");
const country = COUNTRY_BY_SLUG["tchad"];

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Pronostics PMU Tchad ${country.drapeau} — Quinté+, Tiercé, Quarté+`,
  description: "Pronostics PMU France analysés par notre équipe experte pour les parieurs tchadiens. Quinté+, Tiercé, Quarté+ avec analyse experte. Paiement par carte bancaire (toutes cartes). Mobile Money bientôt disponible.",
  keywords: country.motsCles,
  alternates: { canonical: `${APP_URL}/pronostics-pmu-tchad` },
  openGraph: {
    title: `Pronostics PMU Tchad ${country.drapeau} — Elite Turf`,
    description: country.accroche,
    url: `${APP_URL}/pronostics-pmu-tchad`,
    type: "website",
  },
};

export default function TchadPage() {
  return <GeoLandingPage country={country} />;
}
