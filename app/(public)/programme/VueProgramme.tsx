/**
 * Affichage d'une page programme, partagé par :
 *   - `/programme/[date]` : le programme d'une date ;
 *   - `/programme` : la page pilier « Programme PMU du jour » (brief SEO du
 *     01/10/2026, B2), à URL fixe.
 *
 * Déplacé tel quel depuis `[date]/page.tsx` (une page Next.js ne peut pas
 * exporter de composant réutilisable). `pilier` n'ajuste que le fil d'Ariane
 * et le titre du bandeau ; `complement` insère les blocs de la page pilier.
 */
import type { ReactNode } from "react";
import { hasPariNational, isHippodromePrioritaire } from "@/lib/turf/course-eligibility";
import { sortPageProgramme } from "@/lib/seo/programme-fenetre";
import { pickQuinteDuJour } from "@/lib/turf/course-vedette";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, MapPin, Users, ArrowLeft, ChevronRight } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import PageHero from "@/components/layout/PageHero";
import DateRangeNav from "@/components/ui/DateRangeNav";
import {
  isValidDateParam, formatDateLong, formatDateShort,
  isToday, isFuture, todayParis,
} from "@/lib/seo/dates";
import { buildSportsEventJsonLd } from "@/lib/seo/sportsevent-jsonld";
import { chargerCoursesProgramme } from "./donnees";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export default async function VueProgramme({
  date,
  pilier = false,
  complement,
}: {
  date: string;
  pilier?: boolean;
  complement?: ReactNode;
}) {
  if (!isValidDateParam(date)) notFound();

  // Aujourd'hui : bypass du cache ISR pour afficher les arrivées et la mise à
  // jour des courses (statut PROGRAMME → TERMINE) dès chaque sync Geny.
  // Past/futur restent en ISR 600s (programme stable, résultats figés).
  if (isToday(date)) noStore();

  // Le CONTENU décide du sort de la page, plus la distance à aujourd'hui.
  // L'ancienne fenêtre fixe [J-90, J+30] renvoyait 404 sur 142 journées passées
  // qui AVAIENT des courses, et servait en 200 des journées futures vides.
  // Règle et historique complets : lib/seo/programme-fenetre.ts.
  const today   = todayParis();
  const courses = await chargerCoursesProgramme(date);
  if (sortPageProgramme(date, today, courses.length) === "introuvable") notFound();

  const supabase = createServiceClient();

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
  const quinte: any = pickQuinteDuJour(courses);

  const today2     = isToday(date);
  const isFut      = isFuture(date);
  const totalParts = courses.reduce((s: number, c: any) => s + (c.nb_partants || 0), 0);
  const dateLong   = formatDateLong(date);
  const dateShort  = formatDateShort(date);

  // ── JSON-LD : ItemList des courses + BreadcrumbList ──────────────
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: pilier
      ? [
          { "@type": "ListItem", position: 1, name: "Accueil", item: APP_URL },
          { "@type": "ListItem", position: 2, name: "Programme PMU du jour", item: `${APP_URL}/programme` },
        ]
      : [
          { "@type": "ListItem", position: 1, name: "Accueil",   item: APP_URL },
          { "@type": "ListItem", position: 2, name: "Programme", item: `${APP_URL}/programme` },
          { "@type": "ListItem", position: 3, name: dateShort,   item: `${APP_URL}/programme/${date}` },
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
        titre={pilier ? "Programme PMU du jour" : `Programme ${today2 ? "du jour" : "courses"}`}
        sousTitre={dateLong}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Breadcrumb ──────────────────────────────────────────── */}
        <nav className="mb-4 flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" />
          {pilier ? (
            <span className="text-text-secondary">Programme PMU du jour</span>
          ) : (
            <>
              <Link href="/programme" className="hover:text-gold-primary">Programme</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-text-secondary">{dateShort}</span>
            </>
          )}
        </nav>

        {/* ── Navigation entre dates ────────────────────────────────── */}
        <DateRangeNav
          currentDate={date}
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
            href={today2 ? "/quinte-plus" : `/quinte-plus/${date}`}
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
            <Link href="/programme" className="inline-flex items-center gap-2 text-gold-primary text-sm hover:text-gold-light transition-colors">
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
                      {c.nb_partants > 0 && (
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

        {complement}

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
              href={`/arrivees/${date}`}
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
              href={today2 ? "/quinte-plus" : `/quinte-plus/${date}`}
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
