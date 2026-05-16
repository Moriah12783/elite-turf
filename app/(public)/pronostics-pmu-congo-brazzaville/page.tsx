import { Metadata } from "next";
import GeoLandingPage from "@/components/geo/GeoLandingPage";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");
const country = COUNTRY_BY_SLUG["congo-brazzaville"];

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Pronostics PMU Congo Brazzaville ${country.drapeau} — Quinté+, Tiercé, Quarté+`,
  description: "Pronostics PMU France analysés par notre équipe experte pour les parieurs congolais (Brazzaville). Quinté+, Tiercé, Quarté+. Paiement Mobile Money & carte bancaire.",
  keywords: country.motsCles,
  alternates: { canonical: `${APP_URL}/pronostics-pmu-congo-brazzaville` },
  openGraph: {
    title: `Pronostics PMU Congo Brazzaville ${country.drapeau} — Elite Turf`,
    description: country.accroche,
    url: `${APP_URL}/pronostics-pmu-congo-brazzaville`,
    type: "website",
  },
};

export default function CongoBrazzavillePage() {
  return <GeoLandingPage country={country} />;
}
