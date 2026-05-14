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
    .from("jockeys")
    .select("slug")
    .order("derniere_course_at", { ascending: false, nullsFirst: false })
    .limit(200);
  return (data ?? []).map((j: any) => ({ slug: j.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const e = await getEntiteBySlug("jockeys", params.slug);
  if (!e) return { title: "Jockey introuvable — Elite Turf" };

  const rows = await getCoursesForEntite("jockeys", e.nom, 50);
  const stats = computeRichStats("jockeys", rows);

  return {
    title:       buildActeurTitle("jockeys", e, stats),
    description: buildActeurDescription("jockeys", e, stats),
    alternates:  { canonical: `${APP_URL}/jockeys/${params.slug}` },
    robots: isIndexable(stats)
      ? { index: true,  follow: true }
      : { index: false, follow: true },
    openGraph: {
      title:       buildActeurTitle("jockeys", e, stats),
      description: buildActeurDescription("jockeys", e, stats),
      url:         `${APP_URL}/jockeys/${params.slug}`,
      type:        "profile",
    },
  };
}

export default async function JockeyDetail({ params }: PageProps) {
  const entite = await getEntiteBySlug("jockeys", params.slug);
  if (!entite) notFound();
  const rows = await getCoursesForEntite("jockeys", entite.nom, 50);
  const stats = computeRichStats("jockeys", rows);
  return (
    <ActeurDetailPage
      type="jockeys"
      entite={entite}
      rows={rows}
      stats={stats}
      heroImg="/images/heroes/hero-pronostics.jpg"
    />
  );
}
