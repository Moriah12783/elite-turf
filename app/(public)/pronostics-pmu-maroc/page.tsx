import { Metadata } from "next";
import GeoLandingPage from "@/components/geo/GeoLandingPage";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");
const country = COUNTRY_BY_SLUG["maroc"];

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Pronostics PMU Maroc ${country.drapeau} — MDJS, SOREC, Quinté+ | Elite Turf`,
  description: "Pronostics PMU France et courses marocaines (SOREC) pour les parieurs du Royaume. Paiement carte bancaire, Cash Plus, Wafacash. Tarifs en Dirhams.",
  keywords: country.motsCles,
  alternates: { canonical: `${APP_URL}/pronostics-pmu-maroc` },
  openGraph: {
    title: `Pronostics PMU Maroc ${country.drapeau} — Elite Turf`,
    description: country.accroche,
    url: `${APP_URL}/pronostics-pmu-maroc`,
    type: "website",
  },
};

export default function MarocPage() {
  return <GeoLandingPage country={country} />;
}
