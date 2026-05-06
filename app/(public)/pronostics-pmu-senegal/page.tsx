import { Metadata } from "next";
import GeoLandingPage from "@/components/geo/GeoLandingPage";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");
const country = COUNTRY_BY_SLUG["senegal"];

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Pronostics PMU Sénégal ${country.drapeau} — Quinté+, Tiercé`,
  description: "Pronostics PMU France pour les parieurs sénégalais. Paiement Wave, Orange Money, Free Money. Tarifs en FCFA.",
  keywords: country.motsCles,
  alternates: { canonical: `${APP_URL}/pronostics-pmu-senegal` },
  openGraph: {
    title: `Pronostics PMU Sénégal ${country.drapeau} — Elite Turf`,
    description: country.accroche,
    url: `${APP_URL}/pronostics-pmu-senegal`,
    type: "website",
  },
};

export default function SenegalPage() {
  return <GeoLandingPage country={country} />;
}
