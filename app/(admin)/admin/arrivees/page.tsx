/**
 * /admin/arrivees — Saisie manuelle des arrivées + rapports PMU.
 *
 * Stratégie SEO : Google adore les pages dynamiques avec contenu frais quotidien.
 * En remplissant les arrivées de 10 courses/jour (3 Elite Turf + 7 sélectionnées),
 * on multiplie les mots-clés indexés (chevaux, jockeys, hippodromes, rapports €)
 * et on alimente Google News avec du contenu chaque soir.
 *
 * Catégorisation des courses du jour :
 *  ⭐ Elite Turf      : courses avec un pronostic publié (priorité absolue)
 *  📋 Top 7 du jour   : 3 prestige (Vincennes/Longchamp/Auteuil…)
 *                       + 2 quartés (paris_disponibles contient QUARTE_PLUS)
 *                       + 2 trotting (Vincennes/Cagnes — categorie TROT)
 *  📋 Autres courses  : le reste (collapsible, low priority)
 */

import Link from "next/link";
import { Trophy, Calendar, ChevronLeft, ChevronRight, Filter, AlertTriangle } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { todayParisISO, parisDateISOPlusDays } from "@/lib/paris-date";
import ArriveesAdminClient from "./ArriveesAdminClient";
import BatchPrefillButton from "./BatchPrefillButton";

export const metadata = { title: "Arrivées & Rapports — Admin Elite Turf" };
export const dynamic   = "force-dynamic"; // toujours frais (admin)

// ── Hippodromes prestige (manuel pour avoir un contrôle fin) ─────────────────
const PRESTIGE_HIPPODROMES = new Set([
  "Vincennes", "ParisLongchamp", "Paris-Longchamp", "Longchamp",
  "Auteuil", "Saint-Cloud", "Chantilly", "Deauville", "Maisons-Laffitte",
  "Cagnes-sur-Mer", "Lyon-Parilly",
]);

// ── Hippodromes qui font majoritairement du trotting ─────────────────────────
const TROTTING_HIPPODROMES = new Set([
  "Vincennes", "Cagnes-sur-Mer", "Cabourg", "Enghien", "Caen", "Le Croisé-Laroche",
  "Reims", "Meslay-du-Maine",
]);

interface CourseRow {
  id:                 string;
  numero_reunion:     number;
  numero_course:      number;
  libelle:            string;
  heure_depart:       string | null;
  date_course:        string;
  paris_disponibles:  string[];
  categorie:          string | null;
  arrivee_officielle: number[] | null;
  geny_url:           string | null;
  hippodrome:         { nom: string; pays: string } | null;
  pronostics:         { id: string; publie: boolean }[];
  arrivees:           {
    rapports_pmu: Record<string, unknown> | null;
    commentaire:  string | null;
  }[];
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDateFr(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default async function AdminArriveesPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const supabase = createServiceClient();

  const today = todayParisISO();
  const rawDate = searchParams?.date || today;
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;

  const prevDate = offsetDate(selectedDate, -1);
  const nextDate = offsetDate(selectedDate, +1);
  const isToday  = selectedDate === today;

  // ── Fetch courses du jour avec arrivée + pronostics ─────────────────────
  const { data: rawCourses } = await supabase
    .from("courses")
    .select(`
      id, numero_reunion, numero_course, libelle,
      date_course, heure_depart, paris_disponibles, categorie,
      arrivee_officielle, geny_url,
      hippodrome:hippodromes(nom, pays),
      pronostics(id, publie),
      arrivees(rapports_pmu, commentaire)
    `)
    .eq("date_course", selectedDate)
    .order("numero_reunion", { ascending: true })
    .order("numero_course",  { ascending: true });

  const allCourses = (rawCourses ?? []) as unknown as CourseRow[];

  // ── Catégorisation : Elite Turf / Top 7 / Autres ────────────────────────
  const eliteTurf = allCourses.filter((c) =>
    c.pronostics?.some((p) => p.publie),
  );
  const eliteIds = new Set(eliteTurf.map((c) => c.id));

  const candidates = allCourses.filter((c) => !eliteIds.has(c.id));

  // 3 prestige (priorité aux gros hippodromes)
  const prestige = candidates
    .filter((c) => c.hippodrome?.nom && PRESTIGE_HIPPODROMES.has(c.hippodrome.nom))
    .slice(0, 3);
  const prestigeIds = new Set(prestige.map((c) => c.id));

  // 2 quartés (QUARTE_PLUS dans paris_disponibles, hors Elite et hors prestige)
  const quartes = candidates
    .filter((c) =>
      !prestigeIds.has(c.id)
      && Array.isArray(c.paris_disponibles)
      && c.paris_disponibles.includes("QUARTE_PLUS"),
    )
    .slice(0, 2);
  const quarteIds = new Set(quartes.map((c) => c.id));

  // 2 trotting (Vincennes/Cagnes/etc, hors déjà sélectionnés)
  const trotting = candidates
    .filter((c) =>
      !prestigeIds.has(c.id)
      && !quarteIds.has(c.id)
      && c.hippodrome?.nom
      && TROTTING_HIPPODROMES.has(c.hippodrome.nom),
    )
    .slice(0, 2);
  const trottingIds = new Set(trotting.map((c) => c.id));

  const top7 = [...prestige, ...quartes, ...trotting];
  const top7Ids = new Set(top7.map((c) => c.id));

  const others = candidates.filter((c) => !top7Ids.has(c.id));

  // ── Stats ───────────────────────────────────────────────────────────────
  const totalRempli = allCourses.filter((c) => !!c.arrivee_officielle).length;
  const totalAttendus = eliteTurf.length + top7.length;
  const eliteRempli = eliteTurf.filter((c) => !!c.arrivee_officielle).length;
  const top7Rempli = top7.filter((c) => !!c.arrivee_officielle).length;

  function toClientRow(c: CourseRow) {
    return {
      id:                 c.id,
      numero_reunion:     c.numero_reunion,
      numero_course:      c.numero_course,
      libelle:            c.libelle,
      heure_depart:       c.heure_depart,
      hippodrome_nom:     c.hippodrome?.nom ?? "—",
      paris_disponibles:  c.paris_disponibles ?? [],
      arrivee_officielle: c.arrivee_officielle,
      has_arrivee:        !!c.arrivee_officielle,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rapports_pmu:       (c.arrivees?.[0]?.rapports_pmu as any) ?? null,
      commentaire:        c.arrivees?.[0]?.commentaire ?? null,
      geny_url:           c.geny_url,
    };
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-text-primary flex items-center gap-2">
            <Trophy className="w-6 h-6 text-gold-primary" />
            Arrivées &amp; Rapports
          </h1>
          <p className="text-text-secondary text-sm mt-1 capitalize">
            {formatDateFr(selectedDate)}
            {isToday && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gold-primary/10 text-gold-primary border border-gold-primary/20 font-medium normal-case">
                Aujourd&apos;hui
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Navigation par date */}
      <div className="flex items-center justify-between card-base p-3">
        <Link
          href={`/admin/arrivees?date=${prevDate}`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
        >
          <ChevronLeft className="w-4 h-4" />
          {new Date(prevDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
        </Link>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gold-primary" />
          <span className="text-text-primary font-semibold text-sm capitalize">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>

        <Link
          href={`/admin/arrivees?date=${nextDate}`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
        >
          {new Date(nextDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Raccourcis rapides */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: "Hier",       date: parisDateISOPlusDays(-1) },
          { label: "Aujourd'hui", date: today },
          { label: "Demain",     date: parisDateISOPlusDays(+1) },
        ].map(({ label, date }) => (
          <Link
            key={date}
            href={`/admin/arrivees?date=${date}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              selectedDate === date
                ? "bg-gold-primary text-bg-primary border-gold-primary"
                : "bg-bg-elevated text-text-secondary border-border hover:border-gold-primary/50 hover:text-text-primary"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-base p-4 text-center">
          <div className="text-2xl font-bold font-serif text-text-primary">
            {totalRempli} <span className="text-text-muted text-base">/ {allCourses.length}</span>
          </div>
          <div className="text-text-muted text-xs mt-1">Total remplies</div>
        </div>
        <div className="card-base p-4 text-center">
          <div className="text-2xl font-bold font-serif text-gold-primary">
            {eliteRempli} <span className="text-text-muted text-base">/ {eliteTurf.length}</span>
          </div>
          <div className="text-text-muted text-xs mt-1">⭐ Elite Turf</div>
        </div>
        <div className="card-base p-4 text-center">
          <div className="text-2xl font-bold font-serif text-purple-400">
            {top7Rempli} <span className="text-text-muted text-base">/ {top7.length}</span>
          </div>
          <div className="text-text-muted text-xs mt-1">📋 Top {top7.length} du jour</div>
        </div>
      </div>

      {/* Aide / instructions */}
      {totalAttendus > 0 && totalRempli < totalAttendus && (
        <div className="card-base p-4 border-l-4 border-gold-primary flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-gold-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-text-secondary">
            <strong className="text-text-primary">{totalAttendus - totalRempli} arrivée(s) restantes à remplir aujourd&apos;hui.</strong>
            <br />
            Clique sur une course → bouton <span className="font-mono text-purple-400">Pré-remplir Geny</span> → vérifie les valeurs → <span className="font-mono text-gold-primary">Enregistrer</span>.
            <br />
            <em className="text-text-muted">Ou utilise le bouton magique ci-dessous pour tout faire en 1 clic.</em>
          </div>
        </div>
      )}

      {/* 🪄 Batch prefill — bouton magique pour tout publier d'un coup */}
      <BatchPrefillButton date={selectedDate} />

      {/* ⭐ Section Elite Turf */}
      {eliteTurf.length > 0 && (
        <section>
          <h2 className="font-serif text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
            ⭐ Elite Turf <span className="text-xs font-normal text-text-muted">(courses avec pronostic publié — priorité absolue)</span>
          </h2>
          <div className="space-y-2">
            {eliteTurf.map((c) => (
              <ArriveesAdminClient key={c.id} course={toClientRow(c)} />
            ))}
          </div>
        </section>
      )}

      {/* 📋 Section Top 7 du jour */}
      {top7.length > 0 && (
        <section>
          <h2 className="font-serif text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
            📋 Top {top7.length} du jour <span className="text-xs font-normal text-text-muted">({prestige.length} prestige + {quartes.length} quarté+ + {trotting.length} trotting)</span>
          </h2>
          <div className="space-y-2">
            {top7.map((c) => (
              <ArriveesAdminClient key={c.id} course={toClientRow(c)} />
            ))}
          </div>
        </section>
      )}

      {/* 📋 Autres courses (collapsed by default via details) */}
      {others.length > 0 && (
        <section>
          <details>
            <summary className="cursor-pointer font-serif text-lg font-bold text-text-secondary mb-3 flex items-center gap-2 hover:text-text-primary transition-colors">
              <Filter className="w-4 h-4" />
              Autres courses ({others.length}) <span className="text-xs font-normal text-text-muted">— low priority, clique pour déplier</span>
            </summary>
            <div className="space-y-2 mt-3">
              {others.map((c) => (
                <ArriveesAdminClient key={c.id} course={toClientRow(c)} />
              ))}
            </div>
          </details>
        </section>
      )}

      {/* État vide */}
      {allCourses.length === 0 && (
        <div className="card-base p-12 text-center">
          <Calendar className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary text-sm">
            Aucune course pour le {formatDateFr(selectedDate)}.
          </p>
          <p className="text-text-muted text-xs mt-2">
            Le programme Geny doit être sync au préalable (cron auto ou /admin → Forcer Sync PMU).
          </p>
        </div>
      )}
    </div>
  );
}
