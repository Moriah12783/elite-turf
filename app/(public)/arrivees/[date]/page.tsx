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
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar, MapPin, Trophy, ArrowLeft, ChevronRight, Star,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import PageHero from "@/components/layout/PageHero";
import ArriveesDateNav from "@/components/arrivees/ArriveesDateNav";
import {
  isValidDateParam, formatDateLong, formatDateCompact, formatDateShort,
  isToday, isFuture, todayParis, generateDateRangeParams,
} from "@/lib/seo/dates";
import { buildNewsArticleJsonLd } from "@/lib/seo/newsarticle-jsonld";
import { buildSportsEventJsonLd } from "@/lib/seo/sportsevent-jsonld";
import type { RapportsPMU } from "@/lib/sync/geny-rapports-parser";

// Format un rapport en EUR français : 4500 → "4 500,00 €"
function formatEuro(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface PageProps { params: { date: string } }

export async function generateStaticParams() {
  return generateDateRangeParams();
}

export const dynamicParams = true;
// Past dates / future : ISR 600s. Aujourd'hui : noStore() ci-dessous (full-dynamic)
// pour que les arrivées s'affichent dès la sync Geny → DB sans attendre le cache.
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

  // Pour aujourd'hui : on bypasse le cache ISR pour afficher les arrivées
  // dès que le cron geny-arrivees les sync en DB. Le scénario typique : la
  // course se termine à 17h32, le cron sync à 17h35, l'utilisateur F5 à 17h36
  // → il VEUT voir l'arrivée immédiatement, pas attendre 9 min de cache.
  // Past/futur restent en ISR 600s (résultats figés / programme stable).
  if (isToday(params.date)) noStore();

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
      partants(numero, nom_cheval, cote),
      arrivees(rapports_pmu)
    `)
    .eq("date_course", params.date)
    .neq("statut", "ANNULE")
    .order("heure_depart", { ascending: true });

  const allCourses = (rawCourses ?? []).map((c: any) => {
    const arrRow = Array.isArray(c.arrivees) ? c.arrivees[0] : c.arrivees;
    return {
      ...c,
      hippodrome:   Array.isArray(c.hippodrome) ? c.hippodrome[0] : c.hippodrome,
      rapports_pmu: (arrRow?.rapports_pmu ?? null) as RapportsPMU | null,
    };
  });

  // ── Dates avec arrivées disponibles (30 derniers jours) ─────────────────
  // Pour la nav : pastille ✓ sur les jours qui ont au moins 1 arrivée enregistrée.
  // On récupère les dates DISTINCT qui ont au moins 1 course TERMINE avec arrivee_officielle
  // dans la fenêtre [J-30, J+1]. Limité à 30j pour limiter la charge query.
  const minPillDate = new Date(new Date(today).getTime() - 30 * 24 * 3600 * 1000)
    .toISOString().split("T")[0];
  const maxPillDate = new Date(new Date(today).getTime() + 1 * 24 * 3600 * 1000)
    .toISOString().split("T")[0];
  const { data: rawDates } = await supabase
    .from("courses")
    .select("date_course")
    .gte("date_course", minPillDate)
    .lte("date_course", maxPillDate)
    .not("arrivee_officielle", "is", null);
  const datesWithArrivees = Array.from(
    new Set((rawDates ?? []).map((r: { date_course: string }) => r.date_course)),
  );

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

  // NewsArticle JSON-LD : critère Google News + Top Stories carousel.
  // datePublished = aujourd'hui à 21h pour les dates passées (heure typique
  // de finalisation des arrivées) ; pour aujourd'hui, "maintenant" pour
  // signaler la fraîcheur. dateModified = "now" si l'on continue d'enrichir.
  const newsArticleLd = buildNewsArticleJsonLd({
    url:           `${APP_URL}/arrivees/${params.date}`,
    headline:      `Arrivées PMU et rapports du ${dateLong}`,
    description:   `Toutes les arrivées des courses hippiques du ${dateLong} : Quinté+, Tiercé, Quarté+, Couplé, Trio. Rapports officiels PMU détaillés et hippodromes.`,
    datePublished: today2
      ? new Date().toISOString()
      : `${params.date}T21:00:00.000Z`,
    dateModified:  new Date().toISOString(),
    image:         `${APP_URL}/images/heroes/hero-performances.jpg`,
    keywords:      ["arrivée PMU", "rapports PMU", "résultats hippiques", "Quinté+", "Tiercé", "Quarté+"],
    articleSection: "Hippisme — Arrivées PMU",
  });

  // SportsEvent enrichi via helper centralisé : injecte endDate, eventStatus
  // (TERMINE → EventCompleted), image, description, performer, organizer.
  const eventListLd = {
    "@context": "https://schema.org",
    "@type":    "ItemList",
    name:        `Arrivées PMU du ${dateLong}`,
    numberOfItems: finies.length,
    itemListElement: finies.slice(0, 50).map((c: any, idx: number) => ({
      "@type":   "ListItem",
      position:  idx + 1,
      item: buildSportsEventJsonLd(c),
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleLd) }}
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

        <nav className="mb-4 flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-muted">Arrivées</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-secondary">{dateShort}</span>
        </nav>

        {/* ── Navigation entre dates (historique consultable) ───────── */}
        <ArriveesDateNav
          currentDate={params.date}
          datesWithArrivees={datesWithArrivees}
        />

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

            {/* Rapports Quinté+ — affichage compact des dividendes principaux */}
            {quinte.rapports_pmu?.quinte_plus && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Ordre",    value: quinte.rapports_pmu.quinte_plus.ordre,    accent: true },
                  { label: "Désordre", value: quinte.rapports_pmu.quinte_plus.desordre, accent: false },
                  { label: "Bonus 4",  value: quinte.rapports_pmu.quinte_plus.bonus4,   accent: false },
                  { label: "Bonus 3",  value: quinte.rapports_pmu.quinte_plus.bonus3,   accent: false },
                ].filter((r) => r.value != null).map((r) => (
                  <div
                    key={r.label}
                    className={`px-3 py-2 rounded-lg text-center ${
                      r.accent
                        ? "bg-gold-primary/10 border border-gold-primary/40"
                        : "bg-bg-elevated border border-border"
                    }`}
                  >
                    <div className="text-text-muted text-[10px] uppercase tracking-wider">{r.label}</div>
                    <div className={`font-bold text-sm ${r.accent ? "text-gold-primary" : "text-text-primary"}`}>
                      {formatEuro(r.value)}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                  {g.courses.map((c: any) => {
                    // Synthèse rapports : on prend les 3 chiffres les plus parlants
                    // selon ce qui est dispo (Quinté > Quarté > Tiercé > Couplé G > Trio > Simple G).
                    const rp = c.rapports_pmu as RapportsPMU | null;
                    const headlines: { label: string; value: number; accent?: boolean }[] = [];
                    if (rp?.quinte_plus?.ordre  != null) headlines.push({ label: "Quinté+ Ordre",    value: rp.quinte_plus.ordre,  accent: true });
                    if (rp?.quarte_plus?.ordre  != null) headlines.push({ label: "Quarté+ Ordre",    value: rp.quarte_plus.ordre });
                    if (rp?.tierce?.ordre        != null) headlines.push({ label: "Tiercé Ordre",     value: rp.tierce.ordre });
                    if (rp?.couple_gagnant       != null) headlines.push({ label: "Couplé Gagnant",   value: rp.couple_gagnant });
                    if (rp?.trio                 != null) headlines.push({ label: "Trio",             value: rp.trio });
                    if (rp?.simple_gagnant       != null) headlines.push({ label: "Simple Gagnant",   value: rp.simple_gagnant });
                    const top3 = headlines.slice(0, 3);

                    return (
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

                        {/* Rapports synthèse */}
                        {top3.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/30 flex flex-wrap gap-x-3 gap-y-1">
                            {top3.map((h) => (
                              <div key={h.label} className="flex items-center gap-1.5 text-xs">
                                <span className="text-text-muted">{h.label}</span>
                                <span className={`font-bold ${h.accent ? "text-gold-primary" : "text-text-secondary"}`}>
                                  {formatEuro(h.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </Link>
                    );
                  })}
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
