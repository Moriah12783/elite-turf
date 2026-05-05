import { Metadata } from "next";
import ActeurIndexPage from "@/components/acteurs/ActeurIndexPage";
import { getTopEntites } from "@/lib/seo/acteurs";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Entraîneurs PMU | Performances et statistiques — Elite Turf",
  description: "Tous les entraîneurs PMU France et Afrique : taux de victoire, écuries actives, courses récentes, hippodromes fréquents.",
  alternates: { canonical: `${APP_URL}/entraineurs` },
};

export default async function EntraineursIndex() {
  const entites = await getTopEntites("entraineurs", 200);
  return <ActeurIndexPage type="entraineurs" entites={entites} heroImg="/images/heroes/hero-performances.jpg" />;
}
