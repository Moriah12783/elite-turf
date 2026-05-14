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

  const rows = await getCoursesForEntite("entraineurs", e.nom, 50);
  const stats = computeRichStats("entraineurs", rows);

  return {
    title:       buildActeurTitle("entraineurs", e, stats),
    description: buildActeurDescription("entraineurs", e, stats),
    alternates:  { canonical: `${APP_URL}/entraineurs/${params.slug}` },
    robots: isIndexable(stats)
      ? { index: true,  follow: true }
      : { index: false, follow: true },
    openGraph: {
      title:       buildActeurTitle("entraineurs", e, stats),
      description: buildActeurDescription("entraineurs", e, stats),
      url:         `${APP_URL}/entraineurs/${params.slug}`,
      type:        "profile",
    },
  };
}

export default async function EntraineurDetail({ params }: PageProps) {
  const entite = await getEntiteBySlug("entraineurs", params.slug);
  if (!entite) notFound();
  const rows = await getCoursesForEntite("entraineurs", entite.nom, 50);
  const stats = computeRichStats("entraineurs", rows);
  return (
    <ActeurDetailPage
      type="entraineurs"
      entite={entite}
      rows={rows}
      stats={stats}
      heroImg="/images/heroes/hero-performances.jpg"
    />
  );
}
