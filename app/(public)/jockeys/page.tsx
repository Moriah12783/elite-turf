import { Metadata } from "next";
import ActeurIndexPage from "@/components/acteurs/ActeurIndexPage";
import { getTopEntites } from "@/lib/seo/acteurs";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Jockeys PMU | Performances et statistiques — Elite Turf",
  description: "Tous les jockeys engagés sur les courses PMU France et Afrique : taux de victoire, courses récentes, hippodromes fréquents.",
  alternates: { canonical: `${APP_URL}/jockeys` },
};

export default async function JockeysIndex() {
  const entites = await getTopEntites("jockeys", 200);
  return <ActeurIndexPage type="jockeys" entites={entites} heroImg="/images/heroes/hero-pronostics.jpg" />;
}
