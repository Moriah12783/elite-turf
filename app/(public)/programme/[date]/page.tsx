/**
 * /programme/[date] — Programme courses d'une date donnée.
 *
 * Levier SEO : capter les requêtes long-tail typées
 *   "courses pmu 4 mai 2026"
 *   "programme hippique du jour"
 *   "quinté demain"
 * Concurrents (Geny/Zone-Turf/Paris-Turf) utilisent ce pattern d'URL dépuis des années.
 *
 * Note : page complémentaire de /courses?date=X (UI interactive avec filtres).
 * Ici, URL canonique propre + ISR + schema.org SportsEvent par course.
 */

import { Metadata } from "next";
import { isCourseEligible, hasPariNational, isHippodromePrioritaire } from "@/lib/turf/course-eligibility";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, MapPin, Users, ArrowLeft, ChevronRight } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import PageHero from "@/components/layout/PageHero";
import DateRangeNav from "@/components/ui/DateRangeNav";
import {
  isValidDateParam, formatDateLong, formatDateCompact, formatDateShort,
  isToday, isFuture, todayParis, generateDateRangeParams, getRevalidateForDate,
} from "@/lib/seo/dates";
import { buildSportsEventJsonLd } from "@/lib/seo/sportsevent-jsonld";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface PageProps { params: { date: string } }

export async function generateStaticParams() {
  return generateDateRangeParams();
}

// ISR dynamique selon la position temporelle de la date
export const dynamicParams = true; // dates hors-fenêtre rendues à la volée
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (!isValidDateParam(params.date)) return { title: "Date invalide — Elite Turf" };
  const dateLong    = formatDateLong(params.date);
  const dateCompact = formatDateCompact(params.date);
  const today       = isToday(params.date);
  const future      = isFuture(params.date);

  const verb = today  ? "du jour"
             : future ? "à venir"
             : "passées";

  // ── Boost CTR : emoji début (signal SERP) + intent commercial fort ──
  // Avant : "Programme courses PMU du jour | Elite Turf"
  // Après : "🏇 Programme PMU du jour · Quinté+, Tiercé, Quarté+ analysés"
  // → emoji 🏇 = signal hippique visible en SERP
  // → "Quinté+, Tiercé, Quarté+" = capture les requêtes types de pari
  // → "analysés" = valeur perçue (vs simple "programme")
  const emoji = today ? "🏇" : future ? "📅" : "🏆";
  const titleSuffix = today
    ? "Quinté+, Tiercé, Quarté+ analysés"
    : future ? "Programme complet à venir"
             : "Résultats et arrivées";

  return {
    title: `${emoji} Programme PMU ${today ? "du jour" : dateCompact} · ${titleSuffix} | Elite Turf`,
    description: `${emoji} Toutes les courses PMU ${verb} (${dateLong}) : Vincennes, Longchamp, Cagnes-sur-Mer, Casablanca, Abidjan. Horaires, partants, cotes et pronostics gratuits Elite Turf.`,
    alternates: { canonical: `${APP_URL}/programme/${params.date}` },
    openGraph: {
      title: `${emoji} Programme PMU ${dateCompact} — Elite Turf`,
      description: `Programme PMU complet du ${dateLong} avec pronostics experts.`,
      url: `${APP_URL}/programme/${params.date}`,
      type: "website",
    },
  };
}

export default async function ProgrammePage({ params }: PageProps) {
  if (!isValidDateParam(params.date)) notFound();

  // Aujourd'hui : bypass du cache ISR pour afficher les arrivées et la mise à
  // jour des courses (statut PROGRAMME → TERMINE) dès chaque sync Geny.
  // Past/futur restent en ISR 600s (programme stable, résultats figés).
  if (isToday(params.date)) noStore();

  // Fenêtre de validité raisonnable : -90j à +30j (hors plage = 404 SEO-friendly)
  const today    = todayParis();
  const minDate  = new Date(new Date(today).getTime() - 90 * 24 * 3600 * 1000)
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
      categorie, terrain, nb_partants, statut, paris_disponibles,
      hippodrome:hippodromes(id, nom, pays, ville),
      pronostics(id, niveau_acces, publie)
    `)
    .eq("date_course", params.date)
    .neq("statut", "ANNULE")
    .order("heure_depart", { ascending: true });

  const courses = (rawCourses || []).map((c: any) => ({
    ...c,
    hippodrome: Array.isArray(c.hippodrome) ? c.hippodrome[0] : c.hippodrome,
  })).filter((c: any) => isCourseEligible({
    hippodromeNom: c.hippodrome?.nom,
    nbPartants:    c.nb_partants,
    aPronostic:    c.pronostics?.some((p: any) => p.publie),
    aPariNational: hasPariNational(c.paris_disponibles),
  }));

  // ── Dates avec programme disponible (pour pastilles ✓ de la nav) ────
  // Pour /programme, presque toutes les dates ont des courses (programme PMU
  // quotidien). On récupère quand même la fenêtre [J-30, J+7] pour mettre
  // une pastille sur les jours qui ont au moins 1 course.
  const minPillDate = new Date(new Date(today).getTime() - 30 * 24 * 3600 * 1000)
    .toISOString().split("T")[0];
  const maxPillDate = new Date(new Date(today).getTime() + 7 * 24 * 3600 * 1000)
    .toISOString().split("T")[0];
  const { data: rawDates } = await supabase
    .from("courses")
    .select("date_course")
    .gte("date_course", minPillDate)
    .lte("date_course", maxPillDate)
    .neq("statut", "ANNULE");
  const datesWithProgramme = Array.from(
    new Set((rawDates ?? []).map((r: { date_course: string }) => r.date_course)),
  );

  // Regrouper par hippodrome
  const groups: Record<string, { hippodrome: any; courses: any[] }> = {};
  for (const c of courses) {
    const key = c.hippodrome?.nom || "Autre";
    if (!groups[key]) groups[key] = { hippodrome: c.hippodrome, courses: [] };
    groups[key].courses.push(c);
  }
  const groupsList = Object.values(groups);
  // Mise en avant : hippodromes vedettes (+ pari national) en tête.
  groupsList.sort((a, b) => {
    const va = isHippodromePrioritaire(a.hippodrome?.nom) || a.courses.some((c: any) => hasPariNational(c.paris_disponibles));
    const vb = isHippodromePrioritaire(b.hippodrome?.nom) || b.courses.some((c: any) => hasPariNational(c.paris_disponibles));
    return Number(vb) - Number(va);
  });

  // Quinté+ du jour (highlight si présent)
  const quinte = courses.find((c: any) => Array.isArray(c.paris_disponibles) && c.paris_disponibles.includes("QUINTE_PLUS"));

  const today2     = isToday(params.date);
  const isFut      = isFuture(params.date);
  const totalParts = courses.reduce((s: number, c: any) => s + (c.nb_partants || 0), 0);
  const dateLong   = formatDateLong(params.date);
  const dateShort  = formatDateShort(params.date);

  // ── JSON-LD : ItemList des courses + BreadcrumbList ──────────────
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil",   item: APP_URL },
      { "@type": "ListItem", position: 2, name: "Programme", item: `${APP_URL}/courses` },
      { "@type": "ListItem", position: 3, name: dateShort,   item: `${APP_URL}/programme/${params.date}` },
    ],
  };

  // SportsEvent enrichi via helper centralisé : injecte endDate, eventStatus,
  // image, description, performer, organizer (champs recommandés Google Search
  // Console signalés en warning si absents — on règle les 7 d'un coup).
  const eventListLd = {
    "@context": "https://schema.org",
    "@type":    "ItemList",
    name:        `Programme courses PMU du ${dateLong}`,
    numberOfItems: courses.length,
    itemListElement: courses.slice(0, 50).map((c: any, idx: number) => ({
      "@type": "ListItem",
      position: idx + 1,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventListLd) }}
      />

      <PageHero
        image="/images/heroes/hero-courses.jpg"
        titre={`Programme ${today2 ? "du jour" : "courses"}`}
        sousTitre={dateLong}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Breadcrumb ──────────────────────────────────────────── */}
        <nav className="mb-4 flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/courses" className="hover:text-gold-primary">Programme</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-secondary">{dateShort}</span>
        </nav>

        {/* ── Navigation entre dates ────────────────────────────────── */}
        <DateRangeNav
          currentDate={params.date}
          basePath="/programme"
          datesWithContent={datesWithProgramme}
          contentLabel="Programme défini"
          pastDays={90}
        />

        {/* ── Stats ────────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-elevated border border-border rounded-full">
            <Calendar className="w-3.5 h-3.5 text-gold-primary" />
            <span className="text-text-secondary text-xs font-medium">{courses.length} courses</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-elevated border border-border rounded-full">
            <MapPin className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-text-muted text-xs">{groupsList.length} hippodromes</span>
          </div>
          {totalParts > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-elevated border border-border rounded-full">
              <Users className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-text-muted text-xs">{totalParts} partants</span>
            </div>
          )}
        </div>

        {/* ── Quinté+ highlight si présent ─────────────────────────── */}
        {quinte && (
          <Link
            href={`/quinte-plus/${params.date}`}
            className="block mb-6 p-5 rounded-2xl bg-gradient-to-r from-bg-card via-[#1A1610] to-bg-card border border-gold-primary/40 hover:border-gold-primary transition-all"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-gold-primary text-xs font-bold uppercase tracking-wider mb-1">
                  Quinté+ {today2 ? "du jour" : `du ${dateShort}`}
                </div>
                <div className="text-text-primary font-serif font-bold text-base sm:text-lg">
                  {quinte.libelle}
                </div>
                <div className="text-text-muted text-xs mt-1">
                  {quinte.hippodrome?.nom} · {quinte.heure_depart?.substring(0, 5)} · {quinte.nb_partants} partants
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gold-primary flex-shrink-0" />
            </div>
          </Link>
        )}

        {/* ── Liste courses par hippodrome ─────────────────────────── */}
        {groupsList.length === 0 ? (
          <div className="card-base p-10 text-center">
            <p className="text-text-secondary text-sm font-medium mb-2">
              {isFut
                ? "Programme pas encore publié pour cette date"
                : "Aucune course enregistrée pour cette date"}
            </p>
            <p className="text-text-muted text-xs mb-4">
              {isFut
                ? "Le programme PMU est généralement disponible la veille à 17h45."
                : "Cette date n'a pas eu de courses ou les données ne sont plus disponibles."}
            </p>
            <Link href={`/programme/${todayParis()}`} className="inline-flex items-center gap-2 text-gold-primary text-sm hover:text-gold-light transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Voir le programme du jour
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {groupsList.map((g) => (
              <section key={g.hippodrome?.nom || "autre"}>
                <header className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-gold-primary flex-shrink-0" />
                  <h2 className="font-serif font-bold text-text-primary text-lg">
                    {g.hippodrome?.nom || "Hippodrome"}
                  </h2>
                  <span className="text-text-muted text-sm">·</span>
                  <span className="text-text-muted text-sm">{g.hippodrome?.pays}</span>
                  <span className="ml-auto text-text-muted text-xs bg-bg-elevated border border-border px-2 py-0.5 rounded">
                    {g.courses.length} courses
                  </span>
                </header>
                <hr className="gold-divider mb-3" />
                <div className="space-y-2">
                  {g.courses.map((c: any) => (
                    <Link
                      key={c.id}
                      href={`/courses/${c.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-bg-elevated border border-border hover:border-gold-primary/40 transition-all"
                    >
                      <span className="text-gold-primary font-mono text-xs font-bold w-12 flex-shrink-0">
                        R{c.numero_reunion}C{c.numero_course}
                      </span>
                      <span className="text-text-muted text-xs w-12 flex-shrink-0">
                        {c.heure_depart?.substring(0, 5)}
                      </span>
                      <span className="flex-1 text-text-primary text-sm font-medium truncate">
                        {c.libelle}
                      </span>
                      {c.nb_partants && (
                        <span className="text-text-muted text-xs hidden sm:inline">
                          {c.nb_partants} partants
                        </span>
                      )}
                      {c.pronostics?.some((p: any) => p.publie) && (
                        <span className="text-gold-primary text-xs font-bold">★</span>
                      )}
                      <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── Liens annexes ────────────────────────────────────────── */}
        {/*
          Card "Voir tous nos pronostics" en 1ere position : Clarity 14j montre
          que /programme/[date] a un bounce rate de 97,6% (la plus elevee du
          site). On expose ici le hub /pronostics pour convertir le trafic SEO
          calendaire en engagement avec le contenu Elite Turf.
        */}
        <div className="mt-10 grid sm:grid-cols-3 gap-3">
          <Link
            href="/pronostics"
            className="card-base p-4 hover:border-gold-primary/60 transition-all flex items-center gap-3 border-gold-primary/30 bg-gradient-to-br from-bg-card to-[#1A1610]"
          >
            <span className="text-2xl">⭐</span>
            <div className="flex-1">
              <div className="text-text-primary text-sm font-semibold">Tous nos pronostics</div>
              <div className="text-text-muted text-xs">Tiercé, Quarté+, Quinté+ du jour</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gold-primary" />
          </Link>
          {!isFut && (
            <Link
              href={`/arrivees/${params.date}`}
              className="card-base p-4 hover:border-gold-primary/40 transition-all flex items-center gap-3"
            >
              <span className="text-2xl">🏁</span>
              <div className="flex-1">
                <div className="text-text-primary text-sm font-semibold">Arrivées du {dateShort}</div>
                <div className="text-text-muted text-xs">Résultats officiels et rapports</div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </Link>
          )}
          {quinte && (
            <Link
              href={`/quinte-plus/${params.date}`}
              className="card-base p-4 hover:border-gold-primary/40 transition-all flex items-center gap-3"
            >
              <span className="text-2xl">🏆</span>
              <div className="flex-1">
                <div className="text-text-primary text-sm font-semibold">Quinté+ du {dateShort}</div>
                <div className="text-text-muted text-xs">Pronostic, partants, cotes</div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}

// ISR 600s pour le futur (programme stable) et le passé (résultats figés).
// Aujourd'hui est rendu full-dynamic via noStore() dans la fonction page,
// pour que les changements de statut (PROGRAMME → TERMINE) et arrivées
// apparaissent sans délai après chaque sync Geny.
export const revalidate = 600;
