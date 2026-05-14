import { Metadata } from "next";
import { notFound } from "next/navigation";
import ActeurDetailPage from "@/components/acteurs/ActeurDetailPage";
import {
  getEntiteBySlug, getCoursesForEntite, computeRichStats,
  buildActeurTitle, buildActeurDescription, isIndexable,
} from "@/lib/seo/acteurs";
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

  // ── Phase 1 : stats calculées à la volée depuis l'historique courses ──
  // Plus fiable que les colonnes BDD `nb_victoires`/`nb_places` qui sont
  // actuellement à 0 (job sync nightly absent). Bug GSC du 14/05/2026.
  const rows = await getCoursesForEntite("chevaux", e.nom, 50);
  const stats = computeRichStats("chevaux", rows);

  return {
    title:       buildActeurTitle("chevaux", e, stats),
    description: buildActeurDescription("chevaux", e, stats),
    alternates:  { canonical: `${APP_URL}/chevaux/${params.slug}` },
    // Anti thin-content : indexable seulement avec ≥3 courses ET au moins
    // 1 terminée. Aligné avec ActeursCard de TabStatsRich (PR #96) qui ne
    // linke pas les acteurs noindex → cohérence crawl budget.
    robots: isIndexable(stats)
      ? { index: true,  follow: true }
      : { index: false, follow: true },
    openGraph: {
      title:       buildActeurTitle("chevaux", e, stats),
      description: buildActeurDescription("chevaux", e, stats),
      url:         `${APP_URL}/chevaux/${params.slug}`,
      type:        "profile",
    },
  };
}

export default async function ChevauxDetail({ params }: PageProps) {
  const entite = await getEntiteBySlug("chevaux", params.slug);
  if (!entite) notFound();
  const rows = await getCoursesForEntite("chevaux", entite.nom, 50);
  const stats = computeRichStats("chevaux", rows);
  return (
    <ActeurDetailPage
      type="chevaux"
      entite={entite}
      rows={rows}
      stats={stats}
      heroImg="/images/heroes/hero-courses.jpg"
    />
  );
}
