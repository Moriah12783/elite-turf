import { Metadata } from "next";
import ActeurIndexPage from "@/components/acteurs/ActeurIndexPage";
import { getTopEntites } from "@/lib/seo/acteurs";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Chevaux PMU | Performances, victoires et historique — Elite Turf",
  description: "Tous les chevaux engagés sur les courses PMU France et Afrique : performances, victoires, places, dernières courses.",
  alternates: { canonical: `${APP_URL}/chevaux` },
};

export default async function ChevauxIndex() {
  const entites = await getTopEntites("chevaux", 200);
  return <ActeurIndexPage type="chevaux" entites={entites} heroImg="/images/heroes/hero-courses.jpg" />;
}
