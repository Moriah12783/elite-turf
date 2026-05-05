/**
 * /arrivees/[date] — Arrivées officielles d'une date.
 *
 * Levier SEO : "arrivée pmu 4 mai", "arrivée du quinté", "résultats hippiques".
 * Volume Ahrefs ≈ 30k/jour France. Concurrents (Geny, Paris-Turf) trustent.
 *
 * Stratégie :
 *  - Liste des courses TERMINÉES de la date avec arrivée officielle
 *  - Highlight Quinté+ (top arrivee + ordre disordre éventuels)
 *  - Schema.org SportsEvent par course terminée
 *  - ISR 24h pour dates passées (résultats figés)
 */

import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar, MapPin, Trophy, ArrowLeft, ChevronRight, Star,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import PageHero from "@/components/layout/PageHero";
import {
  isValidDateParam, formatDateLong, formatDateCompact, formatDateShort,
  isToday, isFuture, todayParis, generateDateRangeParams,
} from "@/lib/seo/dates";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface PageProps { params: { date: string } }

export async function generateStaticParams() {
  return generateDateRangeParams();
}

export const dynamicParams = true;
// Past dates : 24h. Today : revalidé via course events. Future : 600s.
export const revalidate = 600;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (!isValidDateParam(params.date)) return { title: "Date invalide — Elite Turf" };
  const dateLong    = formatDateLong(params.date);
  const dateCompact = formatDateCompact(params.date);
  const today       = isToday(params.date);
  const future      = isFuture(params.date);

  if (future) {
    return {
      title: `Arrivées PMU du ${dateCompact} — pas encore disponibles | Elite Turf`,
      description: `Les arrivées du ${dateLong} ne sont pas encore disponibles. Consultez le programme.`,
      alternates: { canonical: `${APP_URL}/arrivees/${params.date}` },
      robots: { index: false, follow: true }, // pas indexable dans le futur
    };
  }

  return {
    title: `Arrivées PMU ${today ? "du jour" : `du ${dateCompact}`} | Résultats officiels Elite Turf`,
    description: `Toutes les arrivées des courses hippiques du ${dateLong} : Quinté+, Tiercé, Quarté+. Résultats officiels et ordre d'arrivée.`,
    alternates: { canonical: `${APP_URL}/arrivees/${params.date}` },
    openGraph: {
      title: `Arrivées PMU ${dateCompact}`,
      description: `Résultats officiels des courses du ${dateLong}.`,
      url: `${APP_URL}/arrivees/${params.date}`,
      type: "website",
    },
  };
}

export default async function ArriveesPage({ params }: PageProps) {
  if (!isValidDateParam(params.date)) notFound();

  const today    = todayParis();
  const minDate  = new Date(new Date(today).getTime() - 365 * 24 * 3600 * 1000)
    .toISOString().split("T")[0];
  const maxDate  = new Date(new Date(today).getTime() + 30 * 24 * 3600 * 1000)
    .toISOString().split("T")[0];
  if (params.date < minDate || params.date > maxDate) notFound();

  const supabase = createServiceClient();

  const { data: rawCourses } = await supabase
    .from("courses")
    .select(`
      id, numero_reunion, numero_course, libelle,
      date_course, heure_depart, distance_metres,
      categorie, nb_partants, statut, arrivee_officielle,
      paris_disponibles,
      hippodrome:hippodromes(id, nom, pays, ville),
      partants(numero, nom_cheval, cote)
    `)
    .eq("date_course", params.date)
    .neq("statut", "ANNULE")
    .order("heure_depart", { ascending: true });

  const allCourses = (rawCourses ?? []).map((c: any) => ({
    ...c,
    hippodrome: Array.isArray(c.hippodrome) ? c.hippodrome[0] : c.hippodrome,
  }));

  // Courses avec arrivée officielle
  const finies = allCourses.filter(
    (c: any) => Array.isArray(c.arrivee_officielle) && c.arrivee_officielle.length > 0,
  );
  const enAttente = allCourses.filter(
    (c: any) => !Array.isArray(c.arrivee_officielle) || c.arrivee_officielle.length === 0,
  );

  const dateLong   = formatDateLong(params.date);
  const dateShort  = formatDateShort(params.date);
  const today2     = isToday(params.date);
  const isFut      = isFuture(params.date);

  // Quinté+ (highlight)
  const quinte = finies.find(
    (c: any) => Array.isArray(c.paris_disponibles) && c.paris_disponibles.includes("QUINTE_PLUS"),
  );

  // Regrouper par hippodrome
  const groupByHippo = (list: any[]) => {
    const grouped: Record<string, { hippodrome: any; courses: any[] }> = {};
    for (const c of list) {
      const key = c.hippodrome?.nom || "Autre";
      if (!grouped[key]) grouped[key] = { hippodrome: c.hippodrome, courses: [] };
      grouped[key].courses.push(c);
    }
    return Object.values(grouped);
  };
  const groupsFinies    = groupByHippo(finies);
  const groupsEnAttente = groupByHippo(enAttente);

  // ── Schema.org ───────────────────────────────────────────────────
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil",   item: APP_URL },
      { "@type": "ListItem", position: 2, name: "Arrivées",   item: `${APP_URL}/courses` },
      { "@type": "ListItem", position: 3, name: dateShort,    item: `${APP_URL}/arrivees/${params.date}` },
    ],
  };

  const eventListLd = {
    "@context": "https://schema.org",
    "@type":    "ItemList",
    name:        `Arrivées PMU du ${dateLong}`,
    numberOfItems: finies.length,
    itemListElement: finies.slice(0, 50).map((c: any, idx: number) => ({
      "@type":   "ListItem",
      position:  idx + 1,
      item: {
        "@type":    "SportsEvent",
        name:       c.libelle,
        startDate:  c.heure_depart ? `${c.date_course}T${c.heure_depart}` : c.date_course,
        sport:      "Horse Racing",
        url:        `${APP_URL}/courses/${c.id}`,
        eventStatus: "https://schema.org/EventCompleted",
        location: c.hippodrome ? {
          "@type":         "Place",
          name:            c.hippodrome.nom,
          address: c.hippodrome.ville ? {
            "@type":         "PostalAddress",
            addressLocality: c.hippodrome.ville,
            addressCountry:  c.hippodrome.pays || "FR",
          } : undefined,
        } : undefined,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventListLd) }}
      />

      <PageHero
        image="/images/heroes/hero-performances.jpg"
        titre={`Arrivées ${today2 ? "du jour" : ""}`}
        sousTitre={dateLong}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <nav className="mb-6 flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-muted">Arrivées</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-secondary">{dateShort}</span>
        </nav>

        {/* ── Stats ────────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-elevated border border-border rounded-full">
            <Trophy className="w-3.5 h-3.5 text-gold-primary" />
            <span className="text-text-secondary text-xs font-medium">{finies.length} arrivées</span>
          </div>
          {enAttente.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-elevated border border-border rounded-full">
              <Calendar className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-text-muted text-xs">{enAttente.length} en attente</span>
            </div>
          )}
        </div>

        {/* ── Quinté+ highlight ───────────────────────────────────── */}
        {quinte && (
          <Link
            href={`/quinte-plus/${params.date}`}
            className="block mb-6 p-5 rounded-2xl bg-gradient-to-r from-bg-card via-[#1A1610] to-bg-card border border-gold-primary/40 hover:border-gold-primary transition-all"
          >
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <div className="text-gold-primary text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Star className="w-3 h-3" fill="currentColor" />
                  Arrivée Quinté+
                </div>
                <div className="text-text-primary font-serif font-bold text-base sm:text-lg">
                  {quinte.libelle}
                </div>
                <div className="text-text-muted text-xs mt-1">
                  {quinte.hippodrome?.nom} · {quinte.heure_depart?.substring(0, 5)}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {quinte.arrivee_officielle.slice(0, 5).map((num: number, idx: number) => {
                const part = quinte.partants?.find((p: any) => p.numero === num);
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                      idx === 0
                        ? "bg-status-win/15 border border-status-win/40"
                        : "bg-bg-elevated border border-border"
                    }`}
                  >
                    <span className="text-text-muted text-xs font-mono">
                      {idx + 1}<sup>e</sup>
                    </span>
                    <span className="text-gold-primary font-bold text-sm">{num}</span>
                    {part?.nom_cheval && (
                      <span className="text-text-primary text-xs font-medium hidden sm:inline">
                        {part.nom_cheval}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Link>
        )}

        {/* ── Arrivées par hippodrome ──────────────────────────────── */}
        {groupsFinies.length === 0 ? (
          <div className="card-base p-10 text-center">
            <Trophy className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary text-sm font-medium mb-2">
              {isFut
                ? "Date future — pas d'arrivées disponibles"
                : today2
                  ? "Aucune arrivée disponible pour le moment"
                  : "Aucune arrivée enregistrée pour cette date"}
            </p>
            <p className="text-text-muted text-xs mb-4">
              {today2 && enAttente.length > 0
                ? `${enAttente.length} courses programmées pour aujourd'hui — résultats publiés au fur et à mesure.`
                : "Les résultats sont synchronisés automatiquement après chaque course."}
            </p>
            <Link href={`/programme/${params.date}`} className="inline-flex items-center gap-2 text-gold-primary text-sm hover:text-gold-light transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Voir le programme du {dateShort}
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {groupsFinies.map((g) => (
              <section key={g.hippodrome?.nom || "autre"}>
                <header className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-gold-primary flex-shrink-0" />
                  <h2 className="font-serif font-bold text-text-primary text-lg">
                    {g.hippodrome?.nom || "Hippodrome"}
                  </h2>
                  <span className="text-text-muted text-sm">·</span>
                  <span className="text-text-muted text-sm">{g.hippodrome?.pays}</span>
                  <span className="ml-auto text-text-muted text-xs bg-bg-elevated border border-border px-2 py-0.5 rounded">
                    {g.courses.length} arrivées
                  </span>
                </header>
                <hr className="gold-divider mb-3" />
                <div className="space-y-2">
                  {g.courses.map((c: any) => (
                    <Link
                      key={c.id}
                      href={`/courses/${c.id}`}
                      className="block p-3 rounded-xl bg-bg-elevated border border-border hover:border-gold-primary/40 transition-all"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-gold-primary font-mono text-xs font-bold">
                          R{c.numero_reunion}C{c.numero_course}
                        </span>
                        <span className="text-text-muted text-xs">{c.heure_depart?.substring(0, 5)}</span>
                        <span className="flex-1 text-text-primary text-sm font-medium truncate">
                          {c.libelle}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
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
                        {c.arrivee_officielle.length > 5 && (
                          <span className="text-text-muted text-xs px-2 py-0.5">
                            + {c.arrivee_officielle.length - 5}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── Liens annexes ───────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-3 mt-8">
          <Link
            href={`/programme/${params.date}`}
            className="card-base p-4 hover:border-gold-primary/40 transition-all flex items-center gap-3"
          >
            <Calendar className="w-5 h-5 text-gold-primary" />
            <div className="flex-1">
              <div className="text-text-primary text-sm font-semibold">Programme du {dateShort}</div>
              <div className="text-text-muted text-xs">Toutes les courses du jour</div>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted" />
          </Link>
          {quinte && (
            <Link
              href={`/quinte-plus/${params.date}`}
              className="card-base p-4 hover:border-gold-primary/40 transition-all flex items-center gap-3"
            >
              <Star className="w-5 h-5 text-gold-primary" />
              <div className="flex-1">
                <div className="text-text-primary text-sm font-semibold">Quinté+ du {dateShort}</div>
                <div className="text-text-muted text-xs">Pronostic, partants, arrivée</div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
