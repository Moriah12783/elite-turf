import { Metadata } from "next";
import ActeurIndexPage from "@/components/acteurs/ActeurIndexPage";
import { getTopEntites } from "@/lib/seo/acteurs";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const revalidate = 1800;

// CTR boost Sprint A : emoji visuel SERP + signal "Top 200" pour matière
export const metadata: Metadata = {
  title: "🏇 Chevaux PMU — Top 200 stats, victoires & musique | Elite Turf",
  description: "🏇 Top 200 chevaux PMU France & Afrique : victoires, places, taux de réussite, musique récente, jockeys habituels. Analyses détaillées Elite Turf.",
  alternates: { canonical: `${APP_URL}/chevaux` },
};

export default async function ChevauxIndex() {
  const entites = await getTopEntites("chevaux", 200);
  return <ActeurIndexPage type="chevaux" entites={entites} heroImg="/images/heroes/hero-courses.jpg" />;
}
