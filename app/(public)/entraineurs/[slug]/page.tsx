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
    .from("entraineurs")
    .select("slug")
    .order("derniere_course_at", { ascending: false, nullsFirst: false })
    .limit(200);
  return (data ?? []).map((e: any) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const e = await getEntiteBySlug("entraineurs", params.slug);
  if (!e) return { title: "Entraîneur introuvable — Elite Turf" };
  const tauxVic = tauxVictoire(e);
  const tauxStr = tauxVic !== null ? ` Taux victoire ${tauxVic.toFixed(1)}%.` : "";
  return {
    title: `${e.nom} — Entraîneur PMU : statistiques et historique | Elite Turf`,
    description: `Entraîneur ${e.nom} : ${e.nb_courses ?? 0} courses, ${e.nb_victoires ?? 0} victoires, ${e.nb_places ?? 0} top 3.${tauxStr} Écurie et performances.`,
    alternates: { canonical: `${APP_URL}/entraineurs/${params.slug}` },
  };
}

export default async function EntraineurDetail({ params }: PageProps) {
  const entite = await getEntiteBySlug("entraineurs", params.slug);
  if (!entite) notFound();
  const rows = await getCoursesForEntite("entraineurs", entite.nom, 50);
  return <ActeurDetailPage type="entraineurs" entite={entite} rows={rows} heroImg="/images/heroes/hero-performances.jpg" />;
}
