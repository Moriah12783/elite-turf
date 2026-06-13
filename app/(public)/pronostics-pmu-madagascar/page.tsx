import { Metadata } from "next";
import GeoLandingPage from "@/components/geo/GeoLandingPage";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");
const country = COUNTRY_BY_SLUG["madagascar"];

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Pronostics PMU Madagascar ${country.drapeau} — Quinté+, Tiercé, Quarté+`,
  description: "Pronostics PMU France analysés par notre équipe experte pour les turfistes malgaches. Quinté+, Tiercé, Quarté+ avec analyse experte. Paiement par carte bancaire (toutes cartes). Mobile Money bientôt disponible.",
  keywords: country.motsCles,
  alternates: { canonical: `${APP_URL}/pronostics-pmu-madagascar` },
  openGraph: {
    title: `Pronostics PMU Madagascar ${country.drapeau} — Elite Turf`,
    description: country.accroche,
    url: `${APP_URL}/pronostics-pmu-madagascar`,
    type: "website",
  },
};

export default function MadagascarPage() {
  return <GeoLandingPage country={country} />;
}
