/**
 * lib/ai-pronostics/forbidden-expressions.ts
 *
 * Filtre d'expressions interdites dans le contenu rédigé Elite-Turf.
 *
 * 📜 Conforme cahier des charges §24 (Règles de sécurité éditoriale).
 *
 * 🚨 RÈGLE ABSOLUE :
 *   Toute expression interdite détectée dans un draft → REJECTED par
 *   QualityValidator. Aucune exception.
 *
 * Pourquoi ces règles :
 *   - Protéger la marque Elite-Turf (sérieux, prudence)
 *   - Conformité juridique (ne pas promettre de gain financier)
 *   - Éviter le langage racoleur des sites de pronostics low-quality
 *   - Préserver la confiance des abonnés payants
 */

// ─────────────────────────────────────────────────────────────────────────
// EXPRESSIONS INTERDITES (rejet automatique)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Patterns regex insensibles à la casse pour détecter les expressions
 * interdites dans tout contenu généré par les agents IA.
 */
export const FORBIDDEN_EXPRESSIONS: Array<{ pattern: RegExp; raison: string }> = [
  // Promesses de gain absolues
  { pattern: /gain\s+garanti/i,             raison: "Promesse de gain garanti" },
  { pattern: /\bsûr\s+à\s+100/i,            raison: "Promesse de certitude" },
  { pattern: /\b100\s*%\s+gagnant/i,        raison: "Promesse de 100% gagnant" },
  { pattern: /\b100\s*%\s+sûr/i,            raison: "Promesse de certitude 100%" },
  { pattern: /tuyau\s+sûr/i,                raison: "Langage racoleur 'tuyau sûr'" },
  { pattern: /impossible\s+à\s+battre/i,    raison: "Promesse d'invincibilité" },
  { pattern: /banque\s+absolue/i,           raison: "Promesse de gain bancable" },
  { pattern: /base\s+infaillible/i,         raison: "Promesse d'infaillibilité" },
  { pattern: /certitude\s+du\s+jour/i,      raison: "Promesse de certitude" },
  { pattern: /cadeau\s+des\s+dieux/i,       raison: "Langage marketing/superstition" },

  // Incitations à miser gros
  { pattern: /\bmisez\s+gros/i,             raison: "Incitation à miser gros" },
  { pattern: /\ball[-\s]?in\b/i,            raison: "Incitation à miser tout" },
  { pattern: /\bjouez\s+tout/i,             raison: "Incitation à miser tout" },
  { pattern: /\bmettez\s+le\s+paquet/i,     raison: "Incitation à miser gros" },
  { pattern: /\bcoup\s+sûr\b/i,             raison: "Promesse de certitude" },

  // Verbes de promesse absolue
  { pattern: /va\s+gagner\s+à\s+coup\s+sûr/i, raison: "Promesse de victoire certaine" },
  { pattern: /victoire\s+assurée/i,         raison: "Promesse de victoire" },
  { pattern: /sûr\s+et\s+certain/i,         raison: "Double affirmation certaine" },

  // Superlatifs marketing agressifs
  { pattern: /\bimparable\b/i,              raison: "Superlatif marketing" },
  { pattern: /\bimbattable\b/i,             raison: "Superlatif marketing" },
  { pattern: /sans\s+aucun\s+risque/i,      raison: "Promesse d'absence de risque" },
];

// ─────────────────────────────────────────────────────────────────────────
// EXPRESSIONS RECOMMANDÉES (vocabulaire Elite-Turf)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Vocabulaire premium recommandé pour les rédactions des agents.
 * À utiliser en exemples positifs dans les prompts système.
 */
export const RECOMMENDED_EXPRESSIONS = [
  "base intéressante",
  "profil solide",
  "chance régulière",
  "outsider à surveiller",
  "possibilité intéressante",
  "sélection prudente",
  "lecture favorable",
  "risque à intégrer",
  "course ouverte",
  "prudence nécessaire",
  "favori logique",
  "appui crédible",
  "performance régulière",
  "incertitude réelle",
  "lecture difficile",
];

// ─────────────────────────────────────────────────────────────────────────
// NOTE RESPONSABLE OBLIGATOIRE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Note responsable à inclure dans tout contenu publié.
 * Conforme cahier des charges §25.
 */
export const RESPONSIBLE_NOTE_LONG =
  "Ce pronostic est une aide à la décision. Aucun résultat ne peut être " +
  "garanti. Les courses hippiques comportent toujours une part d'incertitude.";

/** Version courte pour les espaces contraints (emails, push, etc.) */
export const RESPONSIBLE_NOTE_SHORT =
  "Pronostic informatif. Aucun résultat ne peut être garanti.";

/**
 * Note de jeu responsable (ANJ — Autorité Nationale des Jeux France).
 * Obligatoire sur tout site de pronostics PMU en France.
 */
export const ANJ_RESPONSIBLE_GAMING_NOTE =
  "Jouer comporte des risques : endettement, isolement, dépendance. " +
  "Pour être aidé, appelez le 09 74 75 13 13 (appel non surtaxé). " +
  "Les paris sont interdits aux mineurs (moins de 18 ans).";

// ─────────────────────────────────────────────────────────────────────────
// HELPERS DE VALIDATION
// ─────────────────────────────────────────────────────────────────────────

export interface ExpressionViolation {
  expression_matchee: string;     // ex: "gain garanti"
  raison:             string;
  position:           number;     // index dans le texte original
}

/**
 * Détecte toutes les violations d'expressions interdites dans un texte.
 *
 * @returns Array de violations (vide si tout est OK)
 *
 * @example
 *   const violations = detectForbiddenExpressions("Ce pronostic est un tuyau sûr...");
 *   // → [{ expression_matchee: "tuyau sûr", raison: "Langage racoleur...", position: 24 }]
 */
export function detectForbiddenExpressions(text: string): ExpressionViolation[] {
  if (!text) return [];
  const violations: ExpressionViolation[] = [];

  for (const { pattern, raison } of FORBIDDEN_EXPRESSIONS) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      violations.push({
        expression_matchee: match[0],
        raison,
        position: match.index,
      });
    }
  }

  return violations;
}

/**
 * Helper rapide : retourne true si au moins 1 expression interdite est
 * détectée dans le texte.
 */
export function containsForbiddenExpression(text: string): boolean {
  if (!text) return false;
  return FORBIDDEN_EXPRESSIONS.some(({ pattern }) => pattern.test(text));
}

/**
 * Vérifie qu'un texte contient la mention de validation Afrique requise.
 * Conforme cahier des charges §4 (Mentions obligatoires) amendé 2026-05-14
 * pour le 3e palier VALIDATION_PMU_INTERNATIONAL (redistribution PMU
 * France via opérateurs nationaux africains).
 *
 * Les 3 mentions reconnues :
 *   - "Validation LONACI directe"     (palier 1, audience CI)
 *   - "Validation Afrique corroborée" (palier 2, autres opérateurs Afrique)
 *   - "Validation PMU international"  (palier 3, redistribution probable)
 *
 * 🎭 Ces mentions sont obligatoires côté draft (audit) mais cachées du
 * contenu public par sanitizeForPublic() au moment du publish (cf
 * public-tone.ts, décision PO 2026-05-13).
 */
export function containsAfricaValidationMention(text: string): boolean {
  if (!text) return false;
  return /Validation\s+LONACI\s+directe/i.test(text)
      || /Validation\s+Afrique\s+corroborée/i.test(text)
      || /Validation\s+PMU\s+international/i.test(text);
}

/**
 * Vérifie qu'un texte mentionne au moins 1 risque (cahier §13.3 règle 18).
 * Heuristique : présence de mots-clés liés au risque/prudence.
 */
export function mentionsRisk(text: string): boolean {
  if (!text) return false;
  const riskKeywords = [
    /\brisque\b/i,
    /\bprudence\b/i,
    /\bincertitude\b/i,
    /\bdifficulté\b/i,
    /\bsurveiller\b/i,
    /\battention\b/i,
    /\baléa/i,
  ];
  return riskKeywords.some((rx) => rx.test(text));
}
