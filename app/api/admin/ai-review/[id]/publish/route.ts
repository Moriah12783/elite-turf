/**
 * POST /api/admin/ai-review/:id/publish
 *
 * Promotion d'un draft IA en pronostic réellement publié.
 *
 * Pipeline :
 *   1. Charger le draft depuis `ai_pronostic_drafts` (statut, contenu)
 *   2. Vérifier que statut ≠ REJECTED (sinon refus)
 *   3. UPSERT dans `pronostics` (table legacy publique) :
 *      - course_id, niveau_acces, type_pari, selection, confiance,
 *        analyse_courte synthétisée, publie=true, source='AI-MULTI-AGENT'
 *   4. UPDATE `ai_pronostic_drafts.human_review.decision = 'PUBLISHED'`
 *
 * 🔐 Auth : Bearer CRON_SECRET OU session admin (requireAdminAuth)
 *
 * 📦 Body : { human_comment?: string }
 *
 * 📦 Response :
 *   {
 *     ok: true,
 *     draft_id: "...",
 *     pronostic_id: "...",
 *     action: "inserted" | "updated"
 *   }
 *
 * 🛡️ MAPPING niveaux : FREE→GRATUIT, STARTER/PRO→PRO, ELITE→ELITE
 *   (la table `pronostics` n'a pas STARTER — c'est un niveau de durée, pas
 *   de contenu, donc même contenu que PRO une fois publié).
 *
 * 📜 Conforme cahier §17 (page admin).
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";
import type { AnalyseWriterResult, ElitePlanDeJeu, NiveauAcces } from "@/lib/ai-pronostics/types";
import { sanitizeForPublic } from "@/lib/ai-pronostics/public-tone";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

// ─────────────────────────────────────────────────────────────────────────
// Mapping niveau IA → niveau legacy table pronostics
// ─────────────────────────────────────────────────────────────────────────

type NiveauLegacy = "GRATUIT" | "PRO" | "ELITE";

function mapNiveau(ia: NiveauAcces): NiveauLegacy {
  switch (ia) {
    case "FREE":    return "GRATUIT";
    case "STARTER": return "PRO";        // STARTER = même contenu Pro mais hebdo
    case "PRO":     return "PRO";
    case "ELITE":   return "ELITE";
  }
}

type Confiance = "FAIBLE" | "MOYEN" | "ELEVE" | "TRES_ELEVE";

const DEFAULT_CONFIANCE: Record<NiveauLegacy, Confiance> = {
  GRATUIT: "MOYEN",
  PRO:     "ELEVE",
  ELITE:   "TRES_ELEVE",
};

/**
 * Heuristique : confidence_level (writer) → confiance enum legacy.
 */
function mapConfiance(level: "LOW" | "MEDIUM" | "HIGH" | undefined, fallback: NiveauLegacy): Confiance {
  if (level === "HIGH")   return "TRES_ELEVE";
  if (level === "MEDIUM") return "ELEVE";
  if (level === "LOW")    return "MOYEN";
  return DEFAULT_CONFIANCE[fallback];
}

/**
 * Synthétise l'analyse_courte legacy depuis le subscriber_content (rich)
 * PUIS applique le sanitizer public (`sanitizeForPublic`) qui retire les
 * mentions LONACI, listes pays Afrique, et "heure Abidjan" — au profit
 * d'un ton international francophone neutre (cf lib/ai-pronostics/
 * public-tone.ts pour la rationale produit).
 *
 * IMPORTANT : on N'INJECTE PLUS le `badge` ("Validation LONACI directe" /
 * "Validation Afrique corroborée") dans le texte public — cette info
 * reste enregistrée en BDD sur `pronostics.source='AI-MULTI-AGENT'` et
 * sur `ai_pronostic_drafts.validation_status` (audit/admin) mais
 * n'apparaît plus textuellement côté abonné.
 *
 * @param subscriber Contenu rich généré par AnalyseWriter (LLM)
 * @returns Texte sanitizé et capé à 950 chars
 */
function buildAnalyseCourte(subscriber: AnalyseWriterResult["subscriber_content"]): {
  text: string;
  sanitizerRulesApplied: string[];
} {
  const parts: string[] = [];
  if (subscriber.intro)         parts.push(subscriber.intro.trim());
  if (subscriber.course_context) parts.push(subscriber.course_context.trim());
  if (subscriber.race_reading)  parts.push(subscriber.race_reading.trim());
  if (subscriber.risks?.length) parts.push(`Risques : ${subscriber.risks.slice(0, 2).join(" — ")}`);

  const rawText = parts.join(" ");

  // ⚙️ Sanitization éditoriale (décision PO 2026-05-13)
  const { text, appliedRules } = sanitizeForPublic(rawText);

  return {
    text: text.slice(0, 950),
    sanitizerRulesApplied: appliedRules,
  };
}

/**
 * Détermine le type_pari legacy depuis l'access_level + selection_type.
 * - FREE (6) → TIERCE
 * - PRO/STARTER (8) → QUINTE_PLUS
 * - ELITE (6) → QUINTE_PLUS
 */
function mapTypePari(level: NiveauAcces, runnerCount: number): "TIERCE" | "QUARTE" | "QUINTE_PLUS" {
  if (level === "FREE") return runnerCount === 6 ? "TIERCE" : "QUARTE";
  return "QUINTE_PLUS";
}

/**
 * Met en forme le plan de jeu ELITE (refonte 2026-06-26) en texte multi-ligne
 * destiné au champ `pronostics.analyse_texte` — rendu dans son propre encadré
 * (whitespace-pre-line) sur la fiche pronostic, réservé aux abonnés ayant accès.
 * Texte déterministe et propre (mises en UNITÉS, jamais en €).
 */
function formatPlanDeJeuText(plan: ElitePlanDeJeu): string {
  const lines: string[] = [];
  lines.push("👑 PLAN DE JEU ELITE");
  lines.push("");
  lines.push(`🔑 Banker : n°${plan.banker.number} ${plan.banker.name} — ${plan.banker.justification}`);
  lines.push("");
  lines.push(`🎯 Stratégie : ${plan.bet_strategy.type_pari} — champ réduit ${plan.bet_strategy.champ_reduit.join("-")}.`);
  if (plan.bet_strategy.mise_unites.length > 0) {
    lines.push("");
    lines.push("💰 Mise (en unités) :");
    for (const m of plan.bet_strategy.mise_unites) {
      lines.push(`• ${m.libelle} — ${m.unites} u`);
    }
  }
  if (plan.value_picks.length > 0) {
    lines.push("");
    lines.push("⭐ Value (cote supérieure à la probabilité estimée) :");
    for (const v of plan.value_picks) {
      lines.push(`• n°${v.number} ${v.name} — ${v.raison}`);
    }
  }
  if (plan.quinte_plan) {
    lines.push("");
    lines.push(`🏆 Quinté+ travaillé : base ${plan.quinte_plan.base.join("-")} / champ ${plan.quinte_plan.champ.join("-")}. ${plan.quinte_plan.strategie}`);
  }
  lines.push("");
  lines.push("⚠️ Jeu responsable : les mises sont indicatives (en unités), à adapter à votre budget. Pariez avec modération.");
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  const draftId = ctx.params?.id;
  if (!draftId || !/^[0-9a-f-]{36}$/i.test(draftId)) {
    return NextResponse.json({ error: "id de draft invalide (UUID attendu)" }, { status: 400 });
  }

  let body: { human_comment?: string } = {};
  try { body = await req.json(); } catch { /* body optionnel */ }

  const supabase = createServiceClient();

  // 1. Charger le draft
  const { data: draft, error: errDraft } = await supabase
    .from("ai_pronostic_drafts")
    .select("id, draft_date, access_level, course_id, validation_status, validation_badge, status, title, subscriber_content, selection, human_review")
    .eq("id", draftId)
    .single();

  if (errDraft || !draft) {
    return NextResponse.json({ error: `Draft introuvable : ${errDraft?.message ?? "not found"}` }, { status: 404 });
  }

  if (draft.status === "REJECTED") {
    return NextResponse.json({ error: "Ce draft a été rejeté par QualityValidator — publication interdite" }, { status: 409 });
  }
  if (draft.human_review?.decision === "PUBLISHED") {
    return NextResponse.json({ error: "Ce draft est déjà publié" }, { status: 409 });
  }

  // 2. Préparer le payload pronostic
  const niveauIA      = draft.access_level as NiveauAcces;
  const niveauLegacy  = mapNiveau(niveauIA);
  const selectedRunners = (draft.selection ?? []) as Array<{ number: number }>;
  const selectionNumbers = selectedRunners.map((r) => r.number).filter((n) => Number.isFinite(n));

  if (selectionNumbers.length === 0) {
    return NextResponse.json({ error: "Sélection vide — impossible de publier" }, { status: 422 });
  }

  const subscriber = draft.subscriber_content as AnalyseWriterResult["subscriber_content"];

  const { text: analyseCourte, sanitizerRulesApplied } = buildAnalyseCourte(subscriber);
  const typePari   = mapTypePari(niveauIA, selectionNumbers.length);
  const confiance  = mapConfiance(subscriber?.confidence_level, niveauLegacy);
  const nowISO     = new Date().toISOString();

  // Plan de jeu ELITE → champ analyse_texte (rendu dans son propre encadré sur
  // la fiche, gated hasAccess). null pour les autres niveaux (pas de plan).
  const planDeJeuText =
    niveauIA === "ELITE" && subscriber?.plan_de_jeu
      ? formatPlanDeJeuText(subscriber.plan_de_jeu)
      : null;

  // Plan de jeu STRUCTURÉ (jsonb) → bloc dédié sur la fiche (cf migration
  // docs/migrations/2026-06-26-pronostics-plan-de-jeu.sql + ElitePlanBlock).
  // analyse_texte ci-dessus reste un fallback texte (autres consommateurs).
  const planDeJeuJson =
    niveauIA === "ELITE" ? (subscriber?.plan_de_jeu ?? null) : null;

  // Sélection détaillée (rôles) + ticket → affichage PRO hiérarchisé (Base /
  // Chances / Outsiders). Écrit pour tous les niveaux ; consommé surtout par PRO.
  // Cf migration docs/migrations/2026-06-26-pronostics-selection-detail.sql.
  const selectionDetail = Array.isArray(subscriber?.selection)
    ? subscriber.selection.map((s) => ({ number: s.number, name: s.name, role: s.role }))
    : null;
  const suggestedTicket = subscriber?.suggested_ticket?.trim() || null;

  // 3. UPSERT dans `pronostics`
  // On cherche un pronostic existant sur (course_id, niveau_acces) — pas
  // de FK formel sur ces 2 colonnes mais c'est le pattern attendu.
  const { data: existing } = await supabase
    .from("pronostics")
    .select("id")
    .eq("course_id",    draft.course_id)
    .eq("niveau_acces", niveauLegacy)
    .maybeSingle();

  const pronosticPayload = {
    course_id:        draft.course_id,
    niveau_acces:     niveauLegacy,
    type_pari:        typePari,
    selection:        selectionNumbers,
    confiance,
    analyse_courte:   analyseCourte,
    analyse_texte:    planDeJeuText,
    plan_de_jeu:      planDeJeuJson,
    selection_detail: selectionDetail,
    suggested_ticket: suggestedTicket,
    publie:           true,
    date_publication: nowISO,
    source:           "AI-MULTI-AGENT",
    updated_at:       nowISO,
  };

  let pronosticId: string;
  let action: "inserted" | "updated";

  if (existing?.id) {
    const { error: errUp } = await supabase
      .from("pronostics")
      .update(pronosticPayload)
      .eq("id", existing.id);
    if (errUp) {
      return NextResponse.json({ error: `UPDATE pronostic: ${errUp.message}` }, { status: 500 });
    }
    pronosticId = existing.id;
    action = "updated";
  } else {
    const { data: inserted, error: errIns } = await supabase
      .from("pronostics")
      .insert(pronosticPayload)
      .select("id")
      .single();
    if (errIns || !inserted) {
      return NextResponse.json({ error: `INSERT pronostic: ${errIns?.message ?? "no row"}` }, { status: 500 });
    }
    pronosticId = inserted.id;
    action = "inserted";
  }

  // 4. UPDATE draft.human_review.decision = PUBLISHED
  const { data: { user } } = await supabase.auth.getUser();
  const adminUserId = user?.id ?? null;

  const { error: errDraftUpdate } = await supabase
    .from("ai_pronostic_drafts")
    .update({
      human_review: {
        edited_by:     adminUserId,
        edited_at:     nowISO,
        decision:      "PUBLISHED",
        human_comment: body.human_comment ?? null,
      },
      updated_at: nowISO,
    })
    .eq("id", draftId);

  if (errDraftUpdate) {
    return NextResponse.json({
      ok:           false,
      error:        `Pronostic publié mais échec UPDATE draft: ${errDraftUpdate.message}`,
      draft_id:     draftId,
      pronostic_id: pronosticId,
      action,
    }, { status: 500 });
  }

  // 5. Revalidate caches
  try {
    revalidatePath("/pronostics");
    revalidatePath(`/courses/${draft.course_id}`);
    revalidatePath("/admin/pronostics/ai-review");
  } catch { /* non bloquant */ }

  return NextResponse.json({
    ok:           true,
    draft_id:     draftId,
    pronostic_id: pronosticId,
    action,
    sanitizer_rules_applied: sanitizerRulesApplied,  // transparence admin
    niveau_legacy: niveauLegacy,
  });
}
