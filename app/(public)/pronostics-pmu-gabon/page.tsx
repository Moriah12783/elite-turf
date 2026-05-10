import { Metadata } from "next";
import GeoLandingPage from "@/components/geo/GeoLandingPage";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");
const country = COUNTRY_BY_SLUG["gabon"];

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Pronostics PMU Gabon ${country.drapeau} — Quinté+, Tiercé, Quarté+`,
  description: "Pronostics PMU France analysés depuis Paris pour les parieurs gabonais. Quinté+, Tiercé, Quarté+ avec analyse experte. Paiement Mobile Money & carte bancaire.",
  keywords: country.motsCles,
  alternates: { canonical: `${APP_URL}/pronostics-pmu-gabon` },
  openGraph: {
    title: `Pronostics PMU Gabon ${country.drapeau} — Elite Turf`,
    description: country.accroche,
    url: `${APP_URL}/pronostics-pmu-gabon`,
    type: "website",
  },
};

export default function GabonPage() {
  return <GeoLandingPage country={country} />;
}
