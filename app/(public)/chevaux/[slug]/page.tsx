import { Metadata } from "next";
import { notFound } from "next/navigation";
import ActeurDetailPage from "@/components/acteurs/ActeurDetailPage";
import { getEntiteBySlug, getCoursesForEntite, tauxVictoire } from "@/lib/seo/acteurs";
import { createServiceClient } from "@/lib/supabase/server";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface PageProps { params: { slug: string } }

export const revalidate = 1800;
export const dynamicParams = true;

// Pré-rendre les 100 chevaux les plus actifs récemment
export async function generateStaticParams() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("chevaux")
    .select("slug")
    .order("derniere_course_at", { ascending: false, nullsFirst: false })
    .limit(100);
  return (data ?? []).map((c: any) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const e = await getEntiteBySlug("chevaux", params.slug);
  if (!e) return { title: "Cheval introuvable — Elite Turf" };
  const tauxVic = tauxVictoire(e);
  const tauxStr = tauxVic !== null ? ` Taux victoire ${tauxVic.toFixed(1)}%.` : "";
  return {
    title: `${e.nom} — Cheval PMU : performances et historique | Elite Turf`,
    description: `${e.nom} : ${e.nb_courses ?? 0} courses, ${e.nb_victoires ?? 0} victoires, ${e.nb_places ?? 0} places.${tauxStr} Historique complet.`,
    alternates: { canonical: `${APP_URL}/chevaux/${params.slug}` },
  };
}

export default async function ChevauxDetail({ params }: PageProps) {
  const entite = await getEntiteBySlug("chevaux", params.slug);
  if (!entite) notFound();
  const rows = await getCoursesForEntite("chevaux", entite.nom, 50);
  return <ActeurDetailPage type="chevaux" entite={entite} rows={rows} heroImg="/images/heroes/hero-courses.jpg" />;
}
