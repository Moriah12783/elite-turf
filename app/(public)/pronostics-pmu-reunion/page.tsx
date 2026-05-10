import { Metadata } from "next";
import GeoLandingPage from "@/components/geo/GeoLandingPage";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");
const country = COUNTRY_BY_SLUG["reunion"];

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Pronostics PMU Réunion 974 ${country.drapeau} — Quinté+, Tiercé, Quarté+`,
  description: "Pronostics PMU France analysés depuis Paris pour les turfistes réunionnais. Quinté+, Tiercé, Quarté+ via PMU France. Paiement CB, virement SEPA, PayPal.",
  keywords: country.motsCles,
  alternates: { canonical: `${APP_URL}/pronostics-pmu-reunion` },
  openGraph: {
    title: `Pronostics PMU La Réunion ${country.drapeau} — Elite Turf`,
    description: country.accroche,
    url: `${APP_URL}/pronostics-pmu-reunion`,
    type: "website",
  },
};

export default function ReunionPage() {
  return <GeoLandingPage country={country} />;
}
