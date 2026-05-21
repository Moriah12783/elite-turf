import { Metadata } from "next";
import ActeurIndexPage from "@/components/acteurs/ActeurIndexPage";
import { getTopEntites } from "@/lib/seo/acteurs";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const revalidate = 1800;

// CTR boost Sprint A : emoji visuel SERP + signal "Top 200"
export const metadata: Metadata = {
  title: "🏆 Jockeys PMU — Top 200 victoires, taux & forme | Elite Turf",
  description: "🏆 Top 200 jockeys PMU France & Afrique : taux de victoire, courses récentes, hippodromes fréquents, chevaux montés. Stats détaillées Elite Turf.",
  alternates: { canonical: `${APP_URL}/jockeys` },
};

export default async function JockeysIndex() {
  const entites = await getTopEntites("jockeys", 200);
  return <ActeurIndexPage type="jockeys" entites={entites} heroImg="/images/heroes/hero-pronostics.jpg" />;
}
