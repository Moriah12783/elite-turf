import { Metadata } from "next";
import { notFound } from "next/navigation";
import ActeurDetailPage from "@/components/acteurs/ActeurDetailPage";
import { getEntiteBySlug, getCoursesForEntite, tauxVictoire } from "@/lib/seo/acteurs";
import { createServiceClient } from "@/lib/supabase/server";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface PageProps { params: { slug: string } }

export const revalidate = 1800;
export const dynamicParams = true;

export async function generateStaticParams() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("jockeys")
    .select("slug")
    .order("derniere_course_at", { ascending: false, nullsFirst: false })
    .limit(200);
  return (data ?? []).map((j: any) => ({ slug: j.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const e = await getEntiteBySlug("jockeys", params.slug);
  if (!e) return { title: "Jockey introuvable — Elite Turf" };
  const tauxVic = tauxVictoire(e);
  const tauxStr = tauxVic !== null ? ` Taux victoire ${tauxVic.toFixed(1)}%.` : "";
  return {
    title: `${e.nom} — Jockey PMU : statistiques et historique | Elite Turf`,
    description: `Jockey ${e.nom} : ${e.nb_courses ?? 0} courses, ${e.nb_victoires ?? 0} victoires, ${e.nb_places ?? 0} top 3.${tauxStr} Performances détaillées.`,
    alternates: { canonical: `${APP_URL}/jockeys/${params.slug}` },
  };
}

export default async function JockeyDetail({ params }: PageProps) {
  const entite = await getEntiteBySlug("jockeys", params.slug);
  if (!entite) notFound();
  const rows = await getCoursesForEntite("jockeys", entite.nom, 50);
  return <ActeurDetailPage type="jockeys" entite={entite} rows={rows} heroImg="/images/heroes/hero-pronostics.jpg" />;
}
