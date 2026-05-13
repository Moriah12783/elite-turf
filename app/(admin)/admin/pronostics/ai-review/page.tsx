/**
 * /admin/pronostics/ai-review
 *
 * Page admin de revue des drafts générés par le système Multi-Agents IA.
 *
 * Workflow :
 *   1. Le cron `/api/cron/ia-pronostics-v2` (4h Paris) génère des drafts
 *      dans la table `ai_pronostic_drafts` avec status =
 *      APPROVED_FOR_ADMIN_REVIEW ou NEEDS_HUMAN_REVIEW.
 *   2. Stéphane ouvre cette page chaque matin pour relire, vérifier
 *      les badges Afrique, consulter les preuves sources, lire les
 *      analyses générées par l'IA.
 *   3. Pour chaque draft, il peut :
 *      - PUBLIER → POST /api/admin/ai-review/:id/publish (crée/UPDATE pronostics)
 *      - REJETER → POST /api/admin/ai-review/:id/reject  (marque human_review.decision)
 *
 * 🚨 RAPPEL : AUCUN draft n'est publié automatiquement. Stéphane décide.
 *
 * Architecture :
 *   - Server component (ce fichier) : charge tous les drafts du jour + jointures
 *     courses/hippodromes pour avoir les labels lisibles.
 *   - Client component (`AiReviewClient`) : UI interactive (filtre, détail, actions).
 *
 * 📜 Conforme cahier des charges §17.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { todayParisISO } from "@/lib/paris-date";
import Link from "next/link";
import { ArrowLeft, Brain, Info } from "lucide-react";
import AiReviewClient from "./AiReviewClient";
import type { AiPronosticDraft } from "@/lib/ai-pronostics/types";

export const metadata = { title: "Revue drafts IA — Admin" };
export const dynamic  = "force-dynamic";

interface CourseLabel {
  id:             string;
  numero_reunion: number;
  numero_course:  number;
  libelle:        string;
  heure_depart:   string | null;
  hippodrome:     string | null;
  hippodrome_pays: string | null;
}

export interface DraftWithCourse {
  draft:        AiPronosticDraft;
  course:       CourseLabel | null;
}

export default async function AdminAiReviewPage({
  searchParams,
}: {
  searchParams?: { date?: string };
}) {
  const supabase = createServiceClient();
  const dateISO = searchParams?.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
    ? searchParams.date
    : todayParisISO();

  // ── 1. Charger les drafts du jour ──────────────────────────────────────
  const { data: rawDrafts } = await supabase
    .from("ai_pronostic_drafts")
    .select("*")
    .eq("draft_date", dateISO)
    .order("access_level", { ascending: true })
    .order("created_at",   { ascending: false });

  const drafts: AiPronosticDraft[] = (rawDrafts ?? []) as AiPronosticDraft[];

  // ── 2. Charger les courses associées pour les labels ───────────────────
  const courseIds = Array.from(new Set(drafts.map((d) => d.course_id)));
  let courseById = new Map<string, CourseLabel>();

  if (courseIds.length > 0) {
    const { data: rawCourses } = await supabase
      .from("courses")
      .select(`
        id, numero_reunion, numero_course, libelle, heure_depart,
        hippodrome:hippodromes ( nom, pays )
      `)
      .in("id", courseIds);

    for (const c of (rawCourses ?? []) as any[]) {
      courseById.set(c.id, {
        id:              c.id,
        numero_reunion:  c.numero_reunion,
        numero_course:   c.numero_course,
        libelle:         c.libelle,
        heure_depart:    c.heure_depart,
        hippodrome:      c.hippodrome?.nom  ?? null,
        hippodrome_pays: c.hippodrome?.pays ?? null,
      });
    }
  }

  const draftsWithCourse: DraftWithCourse[] = drafts.map((d) => ({
    draft:  d,
    course: courseById.get(d.course_id) ?? null,
  }));

  // ── 3. Stats récap pour le header ──────────────────────────────────────
  const stats = {
    total:        drafts.length,
    approved:     drafts.filter((d) => d.status === "APPROVED_FOR_ADMIN_REVIEW").length,
    needs_review: drafts.filter((d) => d.status === "NEEDS_HUMAN_REVIEW").length,
    rejected:     drafts.filter((d) => d.status === "REJECTED").length,
    published:    drafts.filter((d) => d.human_review?.decision === "PUBLISHED").length,
  };

  return (
    <div className="min-h-screen bg-bg-page p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary mb-3"
          >
            <ArrowLeft className="w-4 h-4" /> Retour Admin
          </Link>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-text-primary flex items-center gap-3">
                <Brain className="w-8 h-8 text-elite-gold" />
                Revue drafts IA Multi-Agents
              </h1>
              <p className="text-text-secondary mt-2 max-w-2xl">
                Drafts générés par le système Multi-Agents pour le{" "}
                <span className="font-semibold">{dateISO}</span>. Aucune publication
                automatique — vérifie chaque draft puis publie ou rejette.
              </p>
            </div>

            {/* Date picker (lien query string) */}
            <form className="flex items-center gap-2">
              <label className="text-sm text-text-secondary">Date :</label>
              <input
                type="date"
                name="date"
                defaultValue={dateISO}
                className="bg-bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary"
              />
              <button
                type="submit"
                className="text-sm px-3 py-1.5 bg-elite-gold/10 border border-elite-gold/30 text-elite-gold rounded-lg hover:bg-elite-gold/20"
              >
                Charger
              </button>
            </form>
          </div>

          {/* Stats récap */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
            <StatCard label="Total drafts"     value={stats.total}        tone="neutral" />
            <StatCard label="Prêts à publier"  value={stats.approved}     tone="success" />
            <StatCard label="Review humaine"   value={stats.needs_review} tone="warning" />
            <StatCard label="Rejetés IA"       value={stats.rejected}     tone="danger"  />
            <StatCard label="Publiés"          value={stats.published}    tone="info"    />
          </div>
        </div>

        {/* Aide */}
        {stats.total === 0 && (
          <div className="bg-bg-card border border-border rounded-xl p-6 mb-6 flex items-start gap-3">
            <Info className="w-5 h-5 text-elite-gold flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-text-primary">Aucun draft pour {dateISO}.</p>
              <p className="text-text-secondary mt-1">
                Soit le cron <code className="bg-bg-page px-1 rounded">/api/cron/ia-pronostics-v2</code> n'a
                pas tourné, soit aucune course n'a passé la validation Afrique aujourd'hui.
                Vérifie les logs cron ou la table <code className="bg-bg-page px-1 rounded">course_source_evidence</code>.
              </p>
            </div>
          </div>
        )}

        {/* Liste + détail (client) */}
        {draftsWithCourse.length > 0 && (
          <AiReviewClient draftsWithCourse={draftsWithCourse} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// StatCard helper
// ─────────────────────────────────────────────────────────────────────────

function StatCard({
  label, value, tone,
}: {
  label: string;
  value: number;
  tone:  "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const toneClasses = {
    neutral: "border-border       text-text-primary",
    success: "border-green-500/40 text-green-400",
    warning: "border-orange-500/40 text-orange-400",
    danger:  "border-red-500/40   text-red-400",
    info:    "border-blue-500/40  text-blue-400",
  }[tone];

  return (
    <div className={`bg-bg-card border ${toneClasses} rounded-xl p-3`}>
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
