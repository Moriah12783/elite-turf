/**
 * lib/ai-pronostics/agents/notification-builder.ts
 *
 * Worker Agent #6 — NotificationBuilder (cahier des charges §16).
 *
 * 🎯 RÔLE
 *   Crée un message court (Slack/email/WhatsApp) pour l'admin après chaque
 *   run du Director Multi-Agents. Format synthétique : nb de drafts prêts,
 *   nb bloqués, problèmes Afrique, rappel review humaine obligatoire.
 *
 * 💰 COÛT : $0 (déterministe — pas besoin de LLM pour ce format figé)
 *
 * 🛡️ RÈGLES (cahier §16.1)
 *   - Message court
 *   - Mentionner le nombre de drafts prêts
 *   - Mentionner les drafts bloqués si applicable
 *   - Ne JAMAIS dire que les pronostics sont publiés
 *   - Toujours rappeler que la validation humaine est nécessaire
 *   - Mentionner les problèmes de validation Afrique si applicable
 *
 * 📜 Conforme cahier §16.
 */

import type {
  AiPronosticDraft,
  CourseSelectorResult,
  NotificationBuilderResult,
  QualityValidatorResult,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────────────────

export interface NotificationBuilderInput {
  /** Date cible du run (YYYY-MM-DD) */
  date: string;
  /**
   * Drafts générés par le Director (avant ou après QualityValidator).
   * Permet de compter prêts/bloqués/needs_review.
   */
  drafts: AiPronosticDraft[];
  /**
   * Résultats QualityValidator de chaque draft (1 par draft, dans le même
   * ordre que `drafts`). Si certains drafts n'ont pas été validés (ex :
   * échec d'un agent amont), passer undefined à leur place.
   */
  validator_reports?: Array<QualityValidatorResult | undefined>;
  /**
   * Résultat du CourseSelector pour ce run (permet de détecter les
   * problèmes Afrique : courses rejetées, sources contradictoires…)
   */
  selector_result?: CourseSelectorResult | null;
  /**
   * Canaux de diffusion attendus (informatif, pas d'envoi ici).
   * L'envoi effectif est géré par le Director ou un orchestrateur externe.
   */
  channels?: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers de comptage
// ─────────────────────────────────────────────────────────────────────────

interface Counts {
  total:        number;
  ready:        number;   // status APPROVED_FOR_ADMIN_REVIEW
  blocked:      number;   // status REJECTED
  needs_review: number;   // status NEEDS_HUMAN_REVIEW ou NEEDS_CORRECTION
}

function countDrafts(drafts: AiPronosticDraft[]): Counts {
  let ready = 0;
  let blocked = 0;
  let needs_review = 0;
  for (const d of drafts) {
    switch (d.status) {
      case "APPROVED_FOR_ADMIN_REVIEW": ready++; break;
      case "REJECTED":                  blocked++; break;
      case "NEEDS_HUMAN_REVIEW":
      case "NEEDS_CORRECTION":          needs_review++; break;
    }
  }
  return { total: drafts.length, ready, blocked, needs_review };
}

/**
 * Compte les problèmes liés à la validation Afrique :
 *   - courses rejetées par CourseSelector pour AFRICA_VALIDATION manquante
 *   - drafts avec validator_report.africa_validation_check.passed=false
 *   - drafts avec blocking_issues code AFRICA_VALIDATION_MISSING / MANDATORY_MENTION_MISSING
 */
function countAfricaIssues(input: NotificationBuilderInput): number {
  let count = 0;

  // 1. Courses rejetées par le sélecteur pour cause Afrique
  if (input.selector_result?.rejected_courses) {
    count += input.selector_result.rejected_courses.filter((rc) =>
      rc.missing_requirements.includes("AFRICA_VALIDATION"),
    ).length;
  }

  // 2. Drafts dont la validation Afrique a échoué
  if (input.validator_reports) {
    for (const report of input.validator_reports) {
      if (!report) continue;
      if (!report.africa_validation_check.passed) count++;
      if (report.blocking_issues.some((bi) =>
        bi.code === "AFRICA_VALIDATION_MISSING" ||
        bi.code === "MANDATORY_MENTION_MISSING" ||
        bi.code === "AFRICA_SCORE_TOO_LOW",
      )) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Détecte un signal CONFLICT entre sources (à mentionner spécifiquement).
 */
function hasSourceConflict(input: NotificationBuilderInput): boolean {
  if (input.selector_result?.source_evidence?.some((ev) => ev.status === "CONFLICT")) {
    return true;
  }
  if (input.validator_reports) {
    for (const report of input.validator_reports) {
      if (report?.warnings.some((w) => w.code === "SOURCES_IN_CONFLICT")) return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────
// Formatage du message
// ─────────────────────────────────────────────────────────────────────────

/**
 * Génère un message court (≤ 280 chars) cohérent avec les exemples du
 * cahier §16.1. La structure varie selon la situation :
 *
 * Cas 1 : tout va bien, drafts prêts
 *   "3 pronostics IA Elite + 1 Pro + 1 gratuit prêts à vérifier."
 *
 * Cas 2 : drafts partiellement bloqués
 *   "2 pronostics IA prêts. 1 course rejetée : validation Afrique insuffisante."
 *
 * Cas 3 : aucun draft généré
 *   "Aucun pronostic généré aujourd'hui : aucune course validée Afrique."
 *
 * Cas 4 : review humaine forte
 *   "Attention : 2 drafts nécessitent une revue humaine (contradictions sources)."
 */
function buildMessage(
  date:          string,
  counts:        Counts,
  africa_issues: number,
  source_conflict: boolean,
): string {
  // Cas 3 : zéro draft total
  if (counts.total === 0) {
    return africa_issues > 0
      ? `Elite Turf IA (${date}) : aucun pronostic généré — aucune course avec "Validation LONACI directe" ou "Validation Afrique corroborée". Vérifier les sources Afrique.`
      : `Elite Turf IA (${date}) : aucun pronostic généré aujourd'hui. Vérifier les flux de courses.`;
  }

  // Cas 4 : besoin de review humaine prioritaire
  if (counts.needs_review > 0 && source_conflict) {
    return `Elite Turf IA (${date}) : ${counts.needs_review} draft(s) nécessite(nt) une revue humaine (contradiction sources détectée). ${counts.ready} prêt(s) à vérifier. Aucune publication automatique.`;
  }

  // Cas 2 : mix prêts + bloqués
  if (counts.blocked > 0) {
    const africaSuffix = africa_issues > 0
      ? ` ${africa_issues} problème(s) de validation Afrique.`
      : "";
    return `Elite Turf IA (${date}) : ${counts.ready} pronostic(s) prêt(s) à vérifier, ${counts.blocked} bloqué(s).${africaSuffix} Validation humaine obligatoire avant publication.`;
  }

  // Cas 1 : tout va bien
  const reviewSuffix = counts.needs_review > 0
    ? ` ${counts.needs_review} à revoir.`
    : "";
  return `Elite Turf IA (${date}) : ${counts.ready} pronostic(s) prêt(s) à vérifier.${reviewSuffix} Aucune publication automatique — validation humaine requise.`;
}

// ─────────────────────────────────────────────────────────────────────────
// Point d'entrée
// ─────────────────────────────────────────────────────────────────────────

/**
 * Construit la notification synchrone. Pure fonction (déterministe).
 * L'envoi vers Slack/email/WhatsApp est délégué au Director ou à un
 * orchestrateur externe — ce builder produit uniquement le message + meta.
 */
export function runNotificationBuilderAgent(
  input: NotificationBuilderInput,
): NotificationBuilderResult {
  const counts          = countDrafts(input.drafts);
  const africa_issues   = countAfricaIssues(input);
  const source_conflict = hasSourceConflict(input);
  const message         = buildMessage(input.date, counts, africa_issues, source_conflict);

  return {
    agent:                "NotificationBuilder",
    date:                 input.date,
    message,
    channels:             input.channels ?? ["slack"],
    drafts_ready_count:   counts.ready,
    drafts_blocked_count: counts.blocked,
    africa_issues_count:  africa_issues,
  };
}
