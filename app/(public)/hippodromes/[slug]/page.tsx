/**
 * /hippodromes/[slug] — Page détail d'un hippodrome.
 *
 * Levier SEO : "hippodrome longchamp courses", "longchamp pmu",
 *              "vincennes courses du jour".
 *
 * Contenu :
 *  - Description hippodrome (nom, ville, pays)
 *  - Programme du jour (si courses prévues)
 *  - Prochaines courses (J+1 à J+7)
 *  - Dernières arrivées (10 derniers jours)
 *  - Schema.org Place
 */

import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar, MapPin, Clock, Trophy, ChevronRight, ArrowLeft,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import PageHero from "@/components/layout/PageHero";
import { slugify, findBySlug } from "@/lib/seo/slugs";
import { todayParis, formatDateLong, formatDateShort } from "@/lib/seo/dates";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface PageProps { params: { slug: string } }

export const dynamicParams = true;
export const revalidate    = 1800; // 30min

// Pré-rendre les hippodromes principaux. Les autres sont rendus à la volée.
export async function generateStaticParams() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("hippodromes")
    .select("nom")
    .eq("actif", true);
  return (data ?? []).map((h: any) => ({ slug: slugify(h.nom) }));
}

async function resolveHippo(slug: string) {
  const supabase = createServiceClient();
  const { data: hippos } = await supabase
    .from("hippodromes")
    .select("id, nom, pays, ville, fuseau_horaire, actif")
    .eq("actif", true);
  return findBySlug(hippos ?? [], slug);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const hippo = await resolveHippo(params.slug);
  if (!hippo) return { title: "Hippodrome introuvable — Elite Turf" };

  return {
    title: `Hippodrome de ${hippo.nom} | Programme, partants & pronostics — Elite Turf`,
    description: `Toutes les courses, partants et résultats de l'hippodrome de ${hippo.nom} (${hippo.ville}). Pronostic Quinté+, Tiercé et analyses expertes.`,
    alternates: { canonical: `${APP_URL}/hippodromes/${params.slug}` },
    openGraph: {
      title: `Hippodrome de ${hippo.nom}`,
      description: `Programme courses & pronostics — ${hippo.ville}, ${hippo.pays}.`,
      url: `${APP_URL}/hippodromes/${params.slug}`,
      type: "website",
    },
  };
}

export default async function HippodromePage({ params }: PageProps) {
  const hippo = await resolveHippo(params.slug);
  if (!hippo) notFound();

  const supabase = createServiceClient();
  const today = todayParis();
  const plus7 = new Date(new Date(today).getTime() + 7 * 24 * 3600 * 1000)
    .toISOString().split("T")[0];
  const minus10 = new Date(new Date(today).getTime() - 10 * 24 * 3600 * 1000)
    .toISOString().split("T")[0];

  // ── Courses futures (aujourd'hui + J+1 à J+7) ──────────────────────
  const { data: rawFutures } = await supabase
    .from("courses")
    .select(`
      id, numero_reunion, numero_course, libelle,
      date_course, heure_depart, distance_metres, categorie,
      nb_partants, statut, paris_disponibles
    `)
    .eq("hippodrome_id", hippo.id)
    .gte("date_course", today)
    .lte("date_course", plus7)
    .neq("statut", "ANNULE")
    .order("date_course", { ascending: true })
    .order("heure_depart",  { ascending: true });

  // ── Dernières arrivées (10 derniers jours, courses terminées) ──────
  const { data: rawPast } = await supabase
    .from("courses")
    .select(`
      id, numero_reunion, numero_course, libelle,
      date_course, heure_depart, statut, arrivee_officielle,
      paris_disponibles
    `)
    .eq("hippodrome_id", hippo.id)
    .gte("date_course", minus10)
    .lt("date_course", today)
    .eq("statut", "TERMINE")
    .order("date_course", { ascending: false })
    .order("heure_depart",  { ascending: false })
    .limit(40);

  const futures = rawFutures ?? [];
  const past    = (rawPast ?? []).filter(
    (c: any) => Array.isArray(c.arrivee_officielle) && c.arrivee_officielle.length > 0,
  );

  // Regrouper futures par date
  const futuresByDate: Record<string, any[]> = {};
  for (const c of futures) {
    if (!futuresByDate[c.date_course]) futuresByDate[c.date_course] = [];
    futuresByDate[c.date_course].push(c);
  }
  const futureDates = Object.keys(futuresByDate).sort();

  // Regrouper past par date
  const pastByDate: Record<string, any[]> = {};
  for (const c of past) {
    if (!pastByDate[c.date_course]) pastByDate[c.date_course] = [];
    pastByDate[c.date_course].push(c);
  }
  const pastDates = Object.keys(pastByDate).sort().reverse();

  // ── Schema.org ───────────────────────────────────────────────────
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil",     item: APP_URL },
      { "@type": "ListItem", position: 2, name: "Hippodromes", item: `${APP_URL}/hippodromes` },
      { "@type": "ListItem", position: 3, name: hippo.nom,     item: `${APP_URL}/hippodromes/${params.slug}` },
    ],
  };

  const placeLd = {
    "@context": "https://schema.org",
    "@type":    "Place",
    name:        `Hippodrome de ${hippo.nom}`,
    url:         `${APP_URL}/hippodromes/${params.slug}`,
    address: {
      "@type":          "PostalAddress",
      addressLocality:  hippo.ville,
      addressCountry:   hippo.pays,
    },
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeLd) }}
      />

      <PageHero
        image="/images/heroes/hero-courses.jpg"
        titre={`Hippodrome de ${hippo.nom}`}
        sousTitre={`${hippo.ville} · ${hippo.pays}`}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <nav className="mb-6 flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/hippodromes" className="hover:text-gold-primary">Hippodromes</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-secondary">{hippo.nom}</span>
        </nav>

        {/* ── Stats ──────────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-elevated border border-border rounded-full">
            <MapPin className="w-3.5 h-3.5 text-gold-primary" />
            <span className="text-text-secondary text-xs font-medium">{hippo.ville}, {hippo.pays}</span>
          </div>
          {futures.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-elevated border border-border rounded-full">
              <Calendar className="w-3.5 h-3.5 text-gold-primary" />
              <span className="text-text-secondary text-xs font-medium">{futures.length} courses à venir</span>
            </div>
          )}
          {past.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-elevated border border-border rounded-full">
              <Trophy className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-text-muted text-xs">{past.length} arrivées (10j)</span>
            </div>
          )}
        </div>

        {/* ── Courses à venir ──────────────────────────────────────── */}
        {futureDates.length > 0 && (
          <section className="mb-10">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gold-primary" />
              Programme à venir
            </h2>
            <div className="space-y-6">
              {futureDates.map((date) => {
                const dateLong  = formatDateLong(date);
                const dateShort = formatDateShort(date);
                const isToday   = date === today;
                return (
                  <div key={date}>
                    <Link
                      href={`/programme/${date}`}
                      className="inline-flex items-center gap-2 text-text-secondary text-sm font-semibold mb-2 hover:text-gold-primary"
                    >
                      <span>{isToday ? "Aujourd'hui" : dateLong}</span>
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                    <div className="space-y-2">
                      {futuresByDate[date].map((c: any) => {
                        const isQuinte = Array.isArray(c.paris_disponibles) && c.paris_disponibles.includes("QUINTE_PLUS");
                        return (
                          <Link
                            key={c.id}
                            href={`/courses/${c.id}`}
                            className="flex items-center gap-3 p-3 rounded-xl bg-bg-elevated border border-border hover:border-gold-primary/40 transition-all"
                          >
                            <span className="text-gold-primary font-mono text-xs font-bold w-12 flex-shrink-0">
                              R{c.numero_reunion}C{c.numero_course}
                            </span>
                            <span className="text-text-muted text-xs w-12 flex-shrink-0">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {c.heure_depart?.substring(0, 5)}
                            </span>
                            <span className="flex-1 text-text-primary text-sm font-medium truncate">
                              {c.libelle}
                            </span>
                            {isQuinte && (
                              <span className="text-gold-primary text-xs font-bold uppercase tracking-wider hidden sm:inline">
                                Quinté+
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Dernières arrivées ─────────────────────────────────────── */}
        {pastDates.length > 0 && (
          <section className="mb-10">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-gold-primary" />
              Dernières arrivées
            </h2>
            <div className="space-y-6">
              {pastDates.map((date) => {
                const dateLong = formatDateLong(date);
                return (
                  <div key={date}>
                    <Link
                      href={`/arrivees/${date}`}
                      className="inline-flex items-center gap-2 text-text-secondary text-sm font-semibold mb-2 hover:text-gold-primary"
                    >
                      <span>{dateLong}</span>
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                    <div className="space-y-2">
                      {pastByDate[date].map((c: any) => (
                        <Link
                          key={c.id}
                          href={`/courses/${c.id}`}
                          className="block p-3 rounded-xl bg-bg-elevated border border-border hover:border-gold-primary/40 transition-all"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-gold-primary font-mono text-xs font-bold">
                              R{c.numero_reunion}C{c.numero_course}
                            </span>
                            <span className="flex-1 text-text-primary text-sm font-medium truncate">
                              {c.libelle}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {c.arrivee_officielle.slice(0, 5).map((num: number, idx: number) => (
                              <span
                                key={idx}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono ${
                                  idx === 0
                                    ? "bg-status-win/15 text-status-win border border-status-win/30"
                                    : "bg-bg-card text-text-secondary border border-border"
                                }`}
                              >
                                <span className="text-text-muted">{idx + 1}.</span>
                                <span className="font-bold">{num}</span>
                              </span>
                            ))}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Empty state ──────────────────────────────────────────── */}
        {futureDates.length === 0 && pastDates.length === 0 && (
          <div className="card-base p-10 text-center">
            <Calendar className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary text-sm font-medium mb-2">
              Aucune course récente sur cet hippodrome
            </p>
            <p className="text-text-muted text-xs mb-4">
              Les courses sont publiées au fur et à mesure du calendrier PMU.
            </p>
            <Link href="/hippodromes" className="inline-flex items-center gap-2 text-gold-primary text-sm hover:text-gold-light transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Voir tous les hippodromes
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
