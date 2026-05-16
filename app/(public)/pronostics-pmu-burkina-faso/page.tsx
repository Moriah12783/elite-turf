import { Metadata } from "next";
import GeoLandingPage from "@/components/geo/GeoLandingPage";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");
const country = COUNTRY_BY_SLUG["burkina-faso"];

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Pronostics PMU Burkina Faso ${country.drapeau} — Quinté+, Tiercé, Quarté+`,
  description: "Pronostics PMU France analysés par notre équipe experte pour les parieurs du Burkina Faso. Quinté+, Tiercé, Quarté+ avec analyse experte. Paiement Mobile Money & carte bancaire.",
  keywords: country.motsCles,
  alternates: { canonical: `${APP_URL}/pronostics-pmu-burkina-faso` },
  openGraph: {
    title: `Pronostics PMU Burkina Faso ${country.drapeau} — Elite Turf`,
    description: country.accroche,
    url: `${APP_URL}/pronostics-pmu-burkina-faso`,
    type: "website",
  },
};

export default function BurkinaFasoPage() {
  return <GeoLandingPage country={country} />;
}
