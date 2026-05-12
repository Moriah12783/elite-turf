/**
 * /admin/pronostics/bulk
 *
 * Page admin pour publier en masse les pronostics du jour (Elite + Pro + Gratuit)
 * en 1 seule soumission, sans passer par curl/script.
 *
 * Architecture :
 *  - Server component (cette page) : charge les courses du jour pour
 *    afficher les références R1C1 disponibles → aide à la saisie
 *  - Client component (BulkForm) : formulaire interactif avec lignes
 *    dynamiques + submit qui appelle POST /api/admin/pronostics/bulk
 *
 * Auth : protégée par middleware (cookie session admin) + endpoint accepte
 * la session admin via requireAdminAuth.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { todayParisISO } from "@/lib/paris-date";
import BulkForm from "./BulkForm";
import Link from "next/link";
import { ArrowLeft, Zap, Info } from "lucide-react";

export const metadata = { title: "Publier les pronostics du jour — Admin" };
export const dynamic  = "force-dynamic";

interface CourseForRef {
  id:             string;
  numero_reunion: number;
  numero_course:  number;
  libelle:        string;
  heure_depart:   string | null;
  nb_partants:    number | null;
  hippodrome:     string | null;
  paris_disponibles: string[] | null;
}

export default async function AdminPronosticsBulkPage() {
  const today = todayParisISO();
  const supabase = createServiceClient();

  // Récupérer toutes les courses du jour pour afficher leurs références R/C
  // → l'admin voit en un coup d'œil les courses dispo et leurs hippodromes
  const { data: rawCourses } = await supabase
    .from("courses")
    .select(`
      id, numero_reunion, numero_course, libelle, heure_depart, nb_partants, paris_disponibles,
      hippodrome:hippodromes(nom)
    `)
    .eq("date_course", today)
    .order("numero_reunion", { ascending: true })
    .order("numero_course",  { ascending: true });

  const courses: CourseForRef[] = (rawCourses ?? []).map((c: any) => ({
    id:             c.id,
    numero_reunion: c.numero_reunion,
    numero_course:  c.numero_course,
    libelle:        c.libelle,
    heure_depart:   c.heure_depart,
    nb_partants:    c.nb_partants,
    hippodrome:     c.hippodrome?.nom ?? null,
    paris_disponibles: c.paris_disponibles ?? null,
  }));

  // Pré-récupérer les pronostics du jour existants pour signaler à l'admin
  // les courses où il y a déjà un pronostic (souvent IA-cron) à remplacer
  const courseIds = courses.map((c) => c.id);
  let existingPronosticsByCourseId = new Map<string, { id: string; source: string | null; niveau_acces: string }>();
  if (courseIds.length > 0) {
    const { data: existing } = await supabase
      .from("pronostics")
      .select("id, course_id, source, niveau_acces")
      .in("course_id", courseIds)
      .eq("publie", true);
    for (const p of existing ?? []) {
      if (!existingPronosticsByCourseId.has(p.course_id)) {
        existingPronosticsByCourseId.set(p.course_id, {
          id:           p.id,
          source:       p.source,
          niveau_acces: p.niveau_acces,
        });
      }
    }
  }

  // Format pour le client component : on filtre les courses où le Quinté+
  // est disponible (priorité pour Elite/Pro) + flag "déjà_pronostic"
  const coursesEnrichies = courses.map((c) => ({
    ...c,
    has_quinte: Array.isArray(c.paris_disponibles)
      && c.paris_disponibles.some((p) => p === "QUINTE_PLUS" || p === "QUINTE"),
    existing_pronostic: existingPronosticsByCourseId.get(c.id) ?? null,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/pronostics"
          className="inline-flex items-center gap-1.5 text-text-secondary hover:text-gold-light text-sm font-medium transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Tous les pronostics
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center">
            <Zap className="w-5 h-5 text-gold-primary" fill="currentColor" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-text-primary">
              Publier les pronostics du jour
            </h1>
            <p className="text-text-muted text-sm mt-0.5">
              Saisis tes 3 (ou plus) pronostics Elite / Pro / Gratuit en une seule fois — Date : {today}
            </p>
          </div>
        </div>
      </div>

      {/* Info bloc — aide à la saisie */}
      <div className="card-base p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-gold-primary flex-shrink-0 mt-0.5" />
        <div className="text-text-secondary text-sm leading-relaxed">
          <p className="mb-1">
            <strong className="text-text-primary">Comment ça marche :</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Saisis la référence (ex : <code className="bg-bg-elevated px-1.5 py-0.5 rounded text-gold-light">R1C4</code>), le niveau, le type de pari et la sélection.</li>
            <li>Sélection au format <code className="bg-bg-elevated px-1.5 py-0.5 rounded text-gold-light">7,6,12,2,1,9</code> (numéros séparés par virgules).</li>
            <li>Si un pronostic existe déjà pour la course (IA-cron par ex.), il sera <strong className="text-gold-light">remplacé</strong> par ta version.</li>
            <li>Sinon, un nouveau pronostic sera créé. Tout est publié immédiatement.</li>
          </ul>
        </div>
      </div>

      {/* Formulaire client */}
      <BulkForm courses={coursesEnrichies} date={today} />

      {/* Liste des courses du jour pour référence */}
      <div className="card-base p-5">
        <h2 className="font-serif font-bold text-text-primary text-base mb-3 flex items-center gap-2">
          📅 Courses du jour ({coursesEnrichies.length})
        </h2>
        {coursesEnrichies.length === 0 ? (
          <p className="text-text-muted text-sm">Aucune course en BDD pour aujourd'hui — vérifier le cron <code>geny-programme</code>.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
            {coursesEnrichies.map((c) => (
              <div
                key={c.id}
                className={`text-xs p-2.5 rounded-lg border ${
                  c.has_quinte
                    ? "bg-gold-faint/40 border-gold-primary/30"
                    : "bg-bg-elevated border-border/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono font-bold text-gold-light">
                    R{c.numero_reunion}C{c.numero_course}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {c.has_quinte && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold-primary/20 text-gold-light font-bold border border-gold-primary/40">
                        Q+
                      </span>
                    )}
                    {c.existing_pronostic && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        c.existing_pronostic.source === "ADMIN"
                          ? "bg-status-win/15 text-status-win border border-status-win/30"
                          : "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                      }`}>
                        {c.existing_pronostic.source === "ADMIN" ? "✓ Admin" : "🤖 IA"}
                      </span>
                    )}
                    {c.heure_depart && (
                      <span className="text-text-muted text-[10px] font-mono">{c.heure_depart.slice(0,5)}</span>
                    )}
                  </div>
                </div>
                <p className="text-text-secondary truncate">{c.libelle}</p>
                <p className="text-text-muted text-[10px] mt-0.5">
                  {c.hippodrome ?? "—"}
                  {c.nb_partants ? ` · ${c.nb_partants} partants` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
        <p className="text-text-muted text-[10px] mt-3 flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-gold-faint border border-gold-primary/40"></span>
          Quinté+ disponible
          <span className="ml-3 inline-block px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 text-[9px] font-bold">🤖 IA</span>
          Pronostic IA déjà publié (sera remplacé)
          <span className="ml-3 inline-block px-1.5 py-0.5 rounded bg-status-win/15 text-status-win text-[9px] font-bold">✓ Admin</span>
          Pronostic Admin déjà publié
        </p>
      </div>
    </div>
  );
}
