/**
 * /blog/decouvrir-hippodrome/[slug] — Guide enrichi par hippodrome.
 *
 * Différent de /hippodromes/[slug] qui est un index data-listing brut.
 * Ici : article narratif avec stats, top jockeys/chevaux fréquents, contexte.
 * Capture le SEO long-tail "découvrir hippodrome longchamp", "guide vincennes",
 * "histoire chantilly", etc.
 */

import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy, MapPin, Calendar, TrendingUp } from "lucide-react";
import AutoArticleLayout from "@/components/blog-auto/AutoArticleLayout";
import { createServiceClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/seo/slugs";
import { getHippodromeStats } from "@/lib/blog-auto/queries";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface PageProps { params: { slug: string } }

export const dynamicParams = true;
export const revalidate = 86400; // 24h — l'historique d'un hippo bouge peu

export async function generateStaticParams() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("hippodromes")
    .select("nom")
    .eq("actif", true);
  return (data ?? []).map((h: any) => ({ slug: slugify(h.nom) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const stats = await getHippodromeStats(params.slug);
  if (!stats) return { title: "Hippodrome introuvable — Elite Turf" };
  return {
    title: `Découvrir l'hippodrome de ${stats.nom} — Guide & statistiques | Elite Turf`,
    description: `Tout savoir sur l'hippodrome de ${stats.nom} (${stats.ville}, ${stats.pays}) : ${stats.nb_courses_total}+ courses analysées, top jockeys, chevaux fréquents. Guide complet du turf local.`,
    alternates: { canonical: `${APP_URL}/blog/decouvrir-hippodrome/${params.slug}` },
    openGraph: {
      title: `Découvrir l'hippodrome de ${stats.nom}`,
      description: `Guide complet : programmes, stats, top jockeys, chevaux fréquents.`,
      url: `${APP_URL}/blog/decouvrir-hippodrome/${params.slug}`,
      type: "article",
    },
  };
}

export default async function GuideHippodromePage({ params }: PageProps) {
  const stats = await getHippodromeStats(params.slug);
  if (!stats) notFound();

  const nowISO = new Date().toISOString().split("T")[0];
  const nowHuman = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  const jsonLd = {
    "@context":  "https://schema.org",
    "@type":     "Article",
    headline:    `Découvrir l'hippodrome de ${stats.nom}`,
    description: `Guide hippodrome ${stats.nom} (${stats.ville}, ${stats.pays}). ${stats.nb_courses_total}+ courses analysées.`,
    datePublished: nowISO,
    dateModified:  nowISO,
    author:    { "@type": "Organization", name: "Elite Turf", url: APP_URL },
    publisher: {
      "@type": "Organization", name: "Elite Turf",
      logo: { "@type": "ImageObject", url: `${APP_URL}/og-image.jpg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${APP_URL}/blog/decouvrir-hippodrome/${params.slug}` },
    about: {
      "@type": "Place",
      name:    stats.nom,
      address: {
        "@type":         "PostalAddress",
        addressLocality: stats.ville,
        addressCountry:  stats.pays,
      },
    },
    inLanguage: "fr-FR",
  };

  return (
    <AutoArticleLayout
      titre={`Découvrir l'hippodrome de ${stats.nom}`}
      sousTitre={`${stats.ville}, ${stats.pays} · ${stats.nb_courses_total}+ courses analysées par Elite Turf`}
      category="Guide hippodrome"
      heroImage="/images/heroes/hero-courses.jpg"
      publishedISO={nowISO}
      publishedHuman={nowHuman}
      readTimeMin={5}
      breadcrumb={[
        { label: "Accueil",     href: "/" },
        { label: "Blog",        href: "/blog" },
        { label: "Hippodromes", href: "/hippodromes" },
        { label: stats.nom },
      ]}
      jsonLd={jsonLd}
    >
      <section className="not-prose grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Courses (30j)" value={stats.nb_courses_30j} accent />
        <StatCard label="Total analysé" value={stats.nb_courses_total} />
        <StatCard label="Jockeys actifs" value={stats.top_jockeys.length} />
        <StatCard label="Chevaux actifs" value={stats.top_chevaux.length} />
      </section>

      <p>
        L&apos;hippodrome de <strong>{stats.nom}</strong>, situé à{" "}
        <strong>{stats.ville}</strong> ({stats.pays}), est l&apos;un des sites
        de référence couverts par Elite Turf. Notre base de données compile{" "}
        <strong>{stats.nb_courses_total}+ courses</strong> analysées sur ce site,
        avec arrivées officielles, partants, jockeys et entraîneurs.
      </p>

      <p>
        Cette fiche synthétise les principales tendances observées sur les
        derniers mois — un bon point de départ avant de jouer un Quinté+,
        Tiercé ou Quarté+ programmé sur ce site.
      </p>

      {stats.top_jockeys.length > 0 && (
        <>
          <h2 className="font-serif text-text-primary mt-10 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold-primary" />
            Jockeys fréquents à {stats.nom}
          </h2>
          <p>
            Les jockeys les plus actifs sur cet hippodrome — connaître leurs
            performances locales aide à affiner les pronostics.
          </p>
          <div className="not-prose grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">
            {stats.top_jockeys.map((j) => (
              <Link
                key={j.slug}
                href={`/jockeys/${j.slug}`}
                className="card-base p-3 flex items-center justify-between gap-3 hover:border-gold-primary/40 transition-all"
              >
                <span className="text-text-primary text-sm font-medium truncate">{j.nom}</span>
                <span className="inline-flex items-center gap-2 text-xs">
                  <span className="text-text-muted">{j.courses} montes</span>
                  {j.victoires > 0 && (
                    <span className="inline-flex items-center gap-1 text-status-win">
                      <Trophy className="w-3 h-3" />
                      <span className="font-bold">{j.victoires}</span>
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {stats.top_chevaux.length > 0 && (
        <>
          <h2 className="font-serif text-text-primary mt-10 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gold-primary" />
            Chevaux fréquents à {stats.nom}
          </h2>
          <p>
            Les chevaux engagés le plus souvent sur cet hippodrome. La régularité
            géographique est un signal d&apos;efficacité — notamment pour le trot
            attelé sur les pistes au tracé spécifique.
          </p>
          <div className="not-prose grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">
            {stats.top_chevaux.map((c) => (
              <Link
                key={c.slug}
                href={`/chevaux/${c.slug}`}
                className="card-base p-3 flex items-center justify-between gap-3 hover:border-gold-primary/40 transition-all"
              >
                <span className="text-text-primary text-sm font-medium truncate">{c.nom}</span>
                <span className="inline-flex items-center gap-2 text-xs">
                  <span className="text-text-muted">{c.courses} courses</span>
                  {c.victoires > 0 && (
                    <span className="inline-flex items-center gap-1 text-status-win">
                      <Trophy className="w-3 h-3" />
                      <span className="font-bold">{c.victoires}</span>
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="font-serif text-text-primary mt-10 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-gold-primary" />
        Liens utiles
      </h2>
      <ul>
        <li>
          <Link href={`/hippodromes/${params.slug}`} className="text-gold-primary hover:text-gold-light">
            Voir le programme complet & dernières arrivées →
          </Link>
        </li>
        <li>
          <Link href="/programme/2026-05-06" className="text-gold-primary hover:text-gold-light">
            Programme PMU du jour (toutes hippodromes confondus) →
          </Link>
        </li>
        <li>
          <Link href="/pronostics" className="text-gold-primary hover:text-gold-light">
            Nos pronostics quotidiens →
          </Link>
        </li>
      </ul>

      {stats.derniere_date && (
        <p className="text-text-muted text-xs italic mt-8">
          Dernière course enregistrée : {new Date(stats.derniere_date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.
        </p>
      )}
    </AutoArticleLayout>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`card-base p-4 text-center ${accent ? "border-gold-primary/30" : ""}`}>
      <div className={`font-serif font-bold text-2xl ${accent ? "text-gold-primary" : "text-text-primary"}`}>
        {value}
      </div>
      <div className="text-text-muted text-xs uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}
