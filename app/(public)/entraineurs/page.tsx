import { Metadata } from "next";
import ActeurIndexPage from "@/components/acteurs/ActeurIndexPage";
import { getTopEntites } from "@/lib/seo/acteurs";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const revalidate = 1800;

// CTR boost Sprint A : emoji visuel SERP + signal "Top 200"
export const metadata: Metadata = {
  title: "⭐ Entraîneurs PMU — Top 200 stats, écuries & forme | Elite Turf",
  description: "⭐ Top 200 entraîneurs PMU France & Afrique : taux de victoire, chevaux entraînés, courses récentes, hippodromes favoris. Profils complets Elite Turf.",
  alternates: { canonical: `${APP_URL}/entraineurs` },
};

export default async function EntraineursIndex() {
  const entites = await getTopEntites("entraineurs", 200);
  return <ActeurIndexPage type="entraineurs" entites={entites} heroImg="/images/heroes/hero-performances.jpg" />;
}
