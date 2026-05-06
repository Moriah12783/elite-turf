import { Metadata } from "next";
import GeoLandingPage from "@/components/geo/GeoLandingPage";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");
const country = COUNTRY_BY_SLUG["mali"];

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Pronostics PMU Mali ${country.drapeau} — Quinté+, Quarté+`,
  description: "Pronostics PMU France pour les turfistes maliens. Paiement Orange Money, Moov Money. Tarifs en FCFA.",
  keywords: country.motsCles,
  alternates: { canonical: `${APP_URL}/pronostics-pmu-mali` },
  openGraph: {
    title: `Pronostics PMU Mali ${country.drapeau} — Elite Turf`,
    description: country.accroche,
    url: `${APP_URL}/pronostics-pmu-mali`,
    type: "website",
  },
};

export default function MaliPage() {
  return <GeoLandingPage country={country} />;
}
