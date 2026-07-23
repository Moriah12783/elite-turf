/**
 * POST /api/admin/pronostics/bulk
 *
 * Publication en masse de pronostics experts. UPSERT par (date, réf R/C) :
 *   - Si un pronostic existe déjà pour la course → UPDATE (remplace les valeurs IA-cron)
 *   - Sinon → INSERT nouveau
 *
 * Auth : Authorization: Bearer ${CRON_SECRET}
 *
 * Body :
 *   {
 *     "date": "2026-05-11",          // optionnel, défaut = aujourd'hui Paris
 *     "pronostics": [
 *       {
 *         "ref": "R1C4",              // R{reunion}C{course}
 *         "niveau": "ELITE",          // GRATUIT | PRO | ELITE
 *         "type": "QUINTE_PLUS",      // SIMPLE | TIERCE | QUARTE | QUINTE_PLUS
 *         "selection": [7,6,12,2,1,9],
 *         "confiance": "TRES_ELEVE",  // optionnel — défaut selon niveau
 *         "analyse_courte": "..."     // optionnel — défaut généré
 *       }
 *     ]
 *   }
 *
 * Response :
 *   {
 *     "ok": true,
 *     "date": "2026-05-11",
 *     "results": [
 *       { "ref": "R1C4", "status": "updated", "pronostic_id": "...", "course_id": "..." },
 *       { "ref": "R1C7", "status": "inserted", "pronostic_id": "...", "course_id": "..." },
 *       { "ref": "R2C3", "status": "error", "error": "Course non trouvée" }
 *     ]
 *   }
 *
 * Use case : automation matinale par Stéphane via un script bash ou curl.
 * Évite la friction "1 SQL UPDATE manuel par course".
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { todayParisISO } from "@/lib/paris-date";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

// ── Types ──────────────────────────────────────────────────────────────────

type Niveau    = "GRATUIT" | "PRO" | "ELITE";
type TypePari  = "SIMPLE" | "TIERCE" | "QUARTE" | "QUINTE_PLUS";
type Confiance = "FAIBLE" | "MOYEN" | "ELEVE" | "TRES_ELEVE";

interface PronosticInput {
  ref:             string;
  niveau:          Niveau;
  type:            TypePari;
  selection:       number[];
  confiance?:      Confiance;
  analyse_courte?: string;
}

interface PronosticResult {
  ref:           string;
  status:        "inserted" | "updated" | "error";
  pronostic_id?: string;
  course_id?:    string;
  error?:        string;
}

const NIVEAUX:    Niveau[]    = ["GRATUIT", "PRO", "ELITE"];
const TYPES:      TypePari[]  = ["SIMPLE", "TIERCE", "QUARTE", "QUINTE_PLUS"];
const CONFIANCES: Confiance[] = ["FAIBLE", "MOYEN", "ELEVE", "TRES_ELEVE"];

const DEFAULT_CONFIANCE: Record<Niveau, Confiance> = {
  GRATUIT: "MOYEN",
  PRO:     "ELEVE",
  ELITE:   "TRES_ELEVE",
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Parse "R1C4" → { reunion: 1, course: 4 }. Retourne null si format invalide. */
function parseRef(ref: string): { reunion: number; course: number } | null {
  const m = ref?.match(/^R(\d+)C(\d+)$/);
  if (!m) return null;
  const reunion = parseInt(m[1], 10);
  const course  = parseInt(m[2], 10);
  if (isNaN(reunion) || isNaN(course) || reunion < 1 || course < 1) return null;
  return { reunion, course };
}

/** Valide un input pronostic. Retourne message d'erreur ou null si OK. */
function validateInput(p: PronosticInput): string | null {
  if (!p.ref || typeof p.ref !== "string")              return "ref manquante ou invalide";
  if (!parseRef(p.ref))                                  return `ref "${p.ref}" doit être au format R{n}C{n}`;
  if (!NIVEAUX.includes(p.niveau))                       return `niveau "${p.niveau}" invalide (${NIVEAUX.join("|")})`;
  if (!TYPES.includes(p.type))                           return `type "${p.type}" invalide (${TYPES.join("|")})`;
  if (!Array.isArray(p.selection) || p.selection.length === 0)
                                                          return "selection doit être un array non vide";
  if (p.selection.some((n) => typeof n !== "number" || n < 1 || n > 30))
                                                          return "selection doit contenir des entiers 1-30";
  if (p.confiance && !CONFIANCES.includes(p.confiance))   return `confiance "${p.confiance}" invalide (${CONFIANCES.join("|")})`;
  if (p.analyse_courte && p.analyse_courte.length > 1000) return "analyse_courte trop longue (max 1000 chars)";
  return null;
}

/** Génère une analyse_courte minimaliste si pas fournie. */
function defaultAnalyse(niveau: Niveau, libelle: string, selection: number[]): string {
  const niveauLabel = niveau === "ELITE" ? "Elite"
                    : niveau === "PRO"   ? "Pro"
                    : "Gratuite";
  return `Sélection ${niveauLabel} Elite Turf pour ${libelle}. ${selection.length} chevaux retenus. Analyse complète disponible en page détaillée.`;
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth — Bearer CRON_SECRET (scripts curl) OU session admin (cookie depuis UI)
  // Permet d'appeler l'endpoint depuis :
  //   - la page admin /admin/pronostics/bulk (cookie)
  //   - un script bash/PowerShell automatisé (Bearer)
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  // 2. Parse body
  let body: { date?: string; pronostics?: PronosticInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const dateISO = body.date ?? todayParisISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return NextResponse.json({ error: `date "${dateISO}" doit être au format YYYY-MM-DD` }, { status: 400 });
  }

  const pronostics = body.pronostics;
  if (!Array.isArray(pronostics) || pronostics.length === 0) {
    return NextResponse.json({ error: "pronostics doit être un array non vide" }, { status: 400 });
  }
  if (pronostics.length > 50) {
    return NextResponse.json({ error: "Maximum 50 pronostics par requête" }, { status: 400 });
  }

  // 3. Validation early-fail (avant toute écriture DB)
  for (let i = 0; i < pronostics.length; i++) {
    const err = validateInput(pronostics[i]);
    if (err) {
      return NextResponse.json({ error: `pronostics[${i}] : ${err}` }, { status: 400 });
    }
  }

  // 4. Résolution batch des course_id pour tous les refs (1 query Supabase)
  const supabase = createServiceClient();
  const refs = pronostics.map((p) => parseRef(p.ref)!);
  const reunionsUniques = Array.from(new Set(refs.map((r) => r.reunion)));
  const coursesUniques  = Array.from(new Set(refs.map((r) => r.course)));

  const { data: courses, error: errCourses } = await supabase
    .from("courses")
    .select("id, numero_reunion, numero_course, libelle")
    .eq("date_course", dateISO)
    .in("numero_reunion", reunionsUniques)
    .in("numero_course",  coursesUniques);

  if (errCourses) {
    return NextResponse.json({ error: `Query courses: ${errCourses.message}` }, { status: 500 });
  }

  // Map (R, C) → course
  const courseMap = new Map<string, { id: string; libelle: string }>();
  for (const c of courses ?? []) {
    courseMap.set(`R${c.numero_reunion}C${c.numero_course}`, { id: c.id, libelle: c.libelle });
  }

  // 5. Récupérer les pronostics existants pour ces courses (pour UPSERT logic)
  const courseIds = Array.from(new Set(Array.from(courseMap.values()).map((c) => c.id)));
  // course_id → { id, selection } — la sélection sert à savoir si les colonnes
  // dérivées (rôles, plan de jeu, ticket, analyse) décrivent encore le pronostic.
  let existingByCourseId = new Map<string, { id: string; selection: number[] }>();
  if (courseIds.length > 0) {
    const { data: existing } = await supabase
      .from("pronostics")
      .select("id, course_id, selection")
      .in("course_id", courseIds);
    for (const p of existing ?? []) {
      // On garde le premier pronostic trouvé par course (cas pas de doublon attendu mais safe)
      if (!existingByCourseId.has(p.course_id)) {
        existingByCourseId.set(p.course_id, {
          id: p.id,
          selection: Array.isArray(p.selection) ? p.selection.map(Number) : [],
        });
      }
    }
  }

  // 6. Traitement séquentiel (les écritures peuvent échouer indépendamment)
  const results: PronosticResult[] = [];
  const nowISO = new Date().toISOString();

  for (const p of pronostics) {
    const refParsed = parseRef(p.ref);
    if (!refParsed) {
      results.push({ ref: p.ref, status: "error", error: "ref invalide" });
      continue;
    }
    const course = courseMap.get(p.ref);
    if (!course) {
      results.push({ ref: p.ref, status: "error", error: `Course non trouvée pour ${p.ref} le ${dateISO}` });
      continue;
    }

    const payload = {
      course_id:        course.id,
      niveau_acces:     p.niveau,
      type_pari:        p.type,
      selection:        p.selection,
      confiance:        p.confiance ?? DEFAULT_CONFIANCE[p.niveau],
      analyse_courte:   p.analyse_courte ?? defaultAnalyse(p.niveau, course.libelle, p.selection),
      publie:           true,
      date_publication: nowISO,
      source:           "ADMIN",
      updated_at:       nowISO,
    };

    const existant = existingByCourseId.get(course.id);
    if (existant) {
      // Le bulk REMPLACE un pronostic existant (typiquement celui de l'IA-cron).
      // Ces 4 colonnes décrivent l'ANCIENNE sélection : les garder afficherait
      // des rôles, un plan de jeu et un ticket portant sur des chevaux qui ne
      // sont plus au pronostic. On ne les efface QUE si la sélection a
      // réellement changé — sinon un simple re-run du lot (correction d'une
      // autre ligne, republication partielle) détruirait une analyse et une
      // hiérarchie saisies à la main, que le bulk ne sait pas réécrire.
      const memeSelection =
        existant.selection.length === p.selection.length &&
        existant.selection.every((n, i) => n === p.selection[i]);
      const nettoyage = memeSelection
        ? {}
        : { selection_detail: null, plan_de_jeu: null, suggested_ticket: null, analyse_texte: null };

      const { error } = await supabase
        .from("pronostics")
        .update({ ...payload, ...nettoyage })
        .eq("id", existant.id);
      if (error) {
        results.push({ ref: p.ref, status: "error", error: error.message });
      } else {
        results.push({ ref: p.ref, status: "updated", pronostic_id: existant.id, course_id: course.id });
      }
    } else {
      // INSERT nouveau
      const { data: inserted, error } = await supabase
        .from("pronostics")
        .insert(payload)
        .select("id")
        .single();
      if (error || !inserted) {
        results.push({ ref: p.ref, status: "error", error: error?.message ?? "Insert failed" });
      } else {
        results.push({ ref: p.ref, status: "inserted", pronostic_id: inserted.id, course_id: course.id });
      }
    }
  }

  // 7. Revalidate caches Next.js (best-effort, on n'échoue pas si ça plante)
  try {
    revalidatePath("/pronostics");
    revalidatePath("/admin/pronostics");
    for (const r of results) {
      if (r.course_id) revalidatePath(`/courses/${r.course_id}`);
    }
  } catch {
    // Cache revalidation non bloquante
  }

  const summary = {
    inserted: results.filter((r) => r.status === "inserted").length,
    updated:  results.filter((r) => r.status === "updated").length,
    errors:   results.filter((r) => r.status === "error").length,
  };

  return NextResponse.json({
    ok:      summary.errors === 0,
    date:    dateISO,
    summary,
    results,
  });
}
