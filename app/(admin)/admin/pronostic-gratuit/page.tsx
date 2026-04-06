/**
 * Page admin : Pronostic Gratuit du Jour
 *
 * Sélectionne automatiquement la meilleure course du jour (Tiercé, 8-12 partants)
 * et propose 5 chevaux pré-sélectionnés selon les cotes PMU.
 * L'admin peut modifier la sélection et l'analyse avant de publier.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { Gift, Zap } from "lucide-react";
import PronosticGratuitClient from "./PronosticGratuitClient";
import { scoreCourse, buildSelection, generateAnalyse } from "@/lib/pronostic-gratuit";

export const metadata = { title: "Pronostic Gratuit du Jour — Admin" };
export const dynamic  = "force-dynamic";

function getTodayParis(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()).split("/").reverse().join("-");
}

export default async function PronosticGratuitPage() {
  const supabase = createServiceClient();
  const today    = getTodayParis();

  // ── 1. Déjà publié aujourd'hui ? ────────────────────────────────────────────
  const { data: existing } = await supabase
    .from("pronostics")
    .select("id")
    .eq("niveau_acces", "GRATUIT")
    .eq("publie", true)
    .gte("date_publication", today)
    .maybeSingle();

  if (existing) {
    return (
      <div className="space-y-6">
        <Header />
        <PronosticGratuitClient
          alreadyPublished
          pronosticId={existing.id}
          course={null}
          partants={[]}
          selection={[]}
          analyse=""
          noCoursesToday={false}
        />
      </div>
    );
  }

  // ── 2. Courses du jour avec Tiercé ──────────────────────────────────────────
  const { data: courses } = await supabase
    .from("courses")
    .select(`
      id, libelle, date_course, heure_depart,
      numero_reunion, numero_course,
      nb_partants, paris_disponibles,
      categorie, terrain, distance_metres,
      hippodrome:hippodromes(id, nom, pays)
    `)
    .eq("date_course", today)
    .in("statut", ["PROGRAMME", "EN_COURS"])
    .not("paris_disponibles", "is", null);

  const eligible = (courses || []).filter((c: any) => {
    const paris: string[] = c.paris_disponibles || [];
    return paris.includes("TIERCE") || paris.includes("TIERCE_ORDRE");
  });

  if (!eligible.length) {
    return (
      <div className="space-y-6">
        <Header />
        <PronosticGratuitClient
          alreadyPublished={false}
          course={null}
          partants={[]}
          selection={[]}
          analyse=""
          noCoursesToday
        />
      </div>
    );
  }

  // ── 3. Meilleure course selon l'algorithme ──────────────────────────────────
  const scored = eligible
    .map((c: any) => ({ course: c, score: scoreCourse(c) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0].course;

  // ── 4. Partants ─────────────────────────────────────────────────────────────
  const { data: partants } = await supabase
    .from("partants")
    .select("id, numero, nom_cheval, jockey, cote, non_partant")
    .eq("course_id", best.id)
    .eq("non_partant", false)
    .order("numero", { ascending: true });

  const partantsList = partants || [];

  // ── 5. Sélection auto des 5 chevaux ─────────────────────────────────────────
  const selection = buildSelection(partantsList);

  // ── 6. Analyse pré-remplie ───────────────────────────────────────────────────
  const analyse = generateAnalyse(best, partantsList, selection);

  return (
    <div className="space-y-6">
      <Header score={scored[0].score} coursesCount={eligible.length} />
      <PronosticGratuitClient
        alreadyPublished={false}
        course={best}
        partants={partantsList}
        selection={selection}
        analyse={analyse}
        noCoursesToday={false}
      />
    </div>
  );
}

function Header({ score, coursesCount }: { score?: number; coursesCount?: number }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h1 className="font-serif text-2xl font-bold text-text-primary flex items-center gap-2">
          <Gift className="w-6 h-6 text-gold-primary" />
          Pronostic Gratuit du Jour
        </h1>
        <span className="px-3 py-1 bg-status-win/10 text-status-win border border-status-win/20 rounded-full text-xs font-bold">
          GRATUIT PUBLIC
        </span>
      </div>
      <p className="text-text-secondary text-sm">
        Tiercé 5 chevaux — visible par tous les visiteurs sans inscription.
        {coursesCount !== undefined && (
          <span className="text-text-muted ml-2">
            · {coursesCount} course{coursesCount > 1 ? "s" : ""} Tiercé disponible{coursesCount > 1 ? "s" : ""} aujourd&apos;hui
            {score !== undefined && ` · Score sélection : ${score}`}
          </span>
        )}
      </p>
      <div className="mt-3 flex items-start gap-2 p-3 bg-gold-faint border border-gold-primary/20 rounded-xl">
        <Zap className="w-4 h-4 text-gold-primary flex-shrink-0 mt-0.5" />
        <p className="text-text-secondary text-xs leading-relaxed">
          Le cron publie automatiquement à <strong>7h UTC (≈ 8h Paris)</strong> si aucun pronostic gratuit n&apos;est encore publié.
          Vous pouvez publier manuellement ici avant cette heure — le cron détectera qu&apos;il est déjà publié et passera.
        </p>
      </div>
    </div>
  );
}
