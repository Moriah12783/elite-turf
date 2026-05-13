/**
 * lib/ai-pronostics/public-tone.ts
 *
 * Sanitizer éditorial appliqué AU MOMENT DE LA PUBLICATION (et seulement
 * là). Transforme le contenu IA "interne-friendly" (qui peut citer LONACI,
 * lister les pays africains prioritaires, mentionner "heure Abidjan", etc.)
 * en contenu "public-friendly" qui adopte un ton **international francophone
 * sans stigmatisation**.
 *
 * 🎯 PRINCIPE PRODUIT (décision Stéphane PO, 13 mai 2026)
 *
 *   Elite Turf est techniquement Afrique-first (90 % de l'audience cible),
 *   mais commercialement TRI-PUBLIC :
 *     - parieurs Afrique francophone (priorité produit)
 *     - parieurs France métropolitaine
 *     - parieurs Belgique / Suisse / outre-mer / Maghreb
 *
 *   Le contenu public doit donc :
 *     ❌ NE PAS dire "Validation LONACI directe"
 *        → un parieur gabonais/camerounais/marocain voit LONACI (= ivoirien)
 *          comme une friction ("ce n'est pas mon opérateur")
 *     ❌ NE PAS lister les pays prioritaires Afrique
 *        → un parieur français se sent exclu du contenu
 *     ❌ NE PAS dire "heure Abidjan"
 *        → un Sénégalais/Marocain n'est pas à Abidjan
 *     ✅ DIRE "Course PMU française ouverte aux parieurs francophones
 *             (France et international)"
 *     ✅ DIRE "Heure GMT" (label neutre, même valeur qu'Abidjan en pratique)
 *
 *   En interne (page admin /admin/pronostics/ai-review, table
 *   `ai_pronostic_drafts`, validator_report, agent_logs), tout reste
 *   visible et auditable : LONACI directe, scores Afrique, preuves
 *   sources, etc. C'est UNIQUEMENT le texte injecté dans `pronostics`
 *   (table publique) qui est aseptisé par ce module.
 *
 * 🧪 IDÉMPOTENT
 *   Ce sanitizer peut être ré-appliqué sans dommage : si "LONACI" n'est
 *   plus dans le texte, le regex ne matche rien, le texte est laissé tel
 *   quel. Permet de l'appeler en safety même si le LLM a déjà produit
 *   du contenu déjà neutre (futur cas Phase 2 quand les prompts seront
 *   amendés).
 *
 * 📜 Référence : amende cahier des charges §13.2 R2 (la mention
 *    obligatoire reste enregistrée en BDD via validation_status mais
 *    n'apparaît plus textuellement dans le contenu abonné).
 */

// ─────────────────────────────────────────────────────────────────────────
// Constantes — formulations de remplacement
// ─────────────────────────────────────────────────────────────────────────

/**
 * Formulation publique qui remplace les mentions "Validation LONACI" /
 * "Validation Afrique" / listes de pays Afrique. Décision PO 2026-05-13.
 */
export const PUBLIC_FRANCOPHONE_FRAMING =
  "Course PMU française ouverte aux parieurs francophones (France et international)";

/**
 * Variante plus courte si on est dans un contexte où la phrase complète
 * serait trop lourde (ex : remplacement inline en milieu de phrase).
 */
export const PUBLIC_FRANCOPHONE_SHORT = "communauté francophone internationale";

// ─────────────────────────────────────────────────────────────────────────
// Règles de remplacement (ordonnées du plus spécifique au plus générique)
// ─────────────────────────────────────────────────────────────────────────

interface ReplaceRule {
  /** Pattern à matcher (insensible casse + multiline) */
  pattern: RegExp;
  /** Remplacement (string ou fonction) */
  replacement: string;
  /** Nom de la règle pour debug/audit */
  name: string;
}

const RULES: ReplaceRule[] = [
  // ── 1. Mentions de validation Afrique (cahier §13.2 R2) ──────────────
  {
    name:        "validation_lonaci_directe",
    pattern:     /\b[Vv]alidation\s+LONACI\s+directe\b/g,
    replacement: PUBLIC_FRANCOPHONE_FRAMING,
  },
  {
    name:        "validation_afrique_corroboree",
    pattern:     /\b[Vv]alidation\s+Afrique\s+corrobor[ée]e\b/g,
    replacement: PUBLIC_FRANCOPHONE_FRAMING,
  },

  // ── 2. Listes explicites de pays africains prioritaires ──────────────
  // Pattern : "Public prioritaire : Côte d'Ivoire, Sénégal, Burkina Faso,
  //            Gabon, Cameroun et francophonie africaine."
  // On capture toute la phrase commençant par "Public prioritaire" ou
  // similaire et listant >= 2 pays.
  {
    name:        "public_prioritaire_avec_pays",
    pattern:     /[Pp]ublic\s+prioritaire\s*:[^.]*?[Cc]ôte\s+d['']?[Ii]voire[^.]*\./g,
    replacement: `${PUBLIC_FRANCOPHONE_FRAMING}.`,
  },
  // Variante sans "Public prioritaire" mais qui liste les pays
  {
    name:        "liste_pays_afrique_inline",
    pattern:     /\b[Cc]ôte\s+d['']?[Ii]voire\s*,\s*[A-ZÀ-ÿ][a-zà-ÿ]+\s*,\s*[A-ZÀ-ÿ][a-zà-ÿ\s]+(?:\s*,\s*[A-ZÀ-ÿ][a-zà-ÿ\s]+)*(?:\s+et\s+[a-zà-ÿ\s]+)?/g,
    replacement: PUBLIC_FRANCOPHONE_SHORT,
  },

  // ── 3. Heure Abidjan → Heure GMT ─────────────────────────────────────
  // On garde la valeur numérique, on remplace juste le label.
  {
    name:        "abidjan_label_parenthese",
    pattern:     /\(\s*Abidjan\s*\)/g,
    replacement: "(GMT)",
  },
  {
    name:        "abidjan_label_apres_heure",
    pattern:     /\bheure\s+d['']Abidjan\b/gi,
    replacement: "heure GMT",
  },
  {
    name:        "abidjan_simple",
    pattern:     /\bAbidjan\s*\/\s*/g,        // "Abidjan / Paris"
    replacement: "GMT / ",
  },

  // ── 4. Mention "Réservée abonnés premium" — laissée mais on s'assure
  //       qu'elle n'est pas redondante avec d'autres marqueurs. (pas de
  //       remplacement actif ici, juste documentation pour Phase 2)
];

// ─────────────────────────────────────────────────────────────────────────
// Sanitizer public
// ─────────────────────────────────────────────────────────────────────────

export interface SanitizeResult {
  /** Texte transformé pour publication publique */
  text: string;
  /** Règles qui ont effectivement matché (pour debug/admin) */
  appliedRules: string[];
}

/**
 * Applique les règles de transformation au texte. Idempotent.
 *
 * @example
 *   sanitizeForPublic("Analyse ELITE réservée abonnés premium. Course
 *   R4C4 Prix North Col affiche un field fragmenté. Validation LONACI
 *   directe. Public prioritaire : Côte d'Ivoire, Sénégal, Burkina Faso,
 *   Gabon, Cameroun et francophonie africaine.")
 *   →
 *   "Analyse ELITE réservée abonnés premium. Course R4C4 Prix North Col
 *   affiche un field fragmenté. Course PMU française ouverte aux
 *   parieurs francophones (France et international). Course PMU
 *   française ouverte aux parieurs francophones (France et international)."
 */
export function sanitizeForPublic(text: string | null | undefined): SanitizeResult {
  if (!text) return { text: "", appliedRules: [] };

  let out = text;
  const applied: string[] = [];

  for (const rule of RULES) {
    if (rule.pattern.test(out)) {
      applied.push(rule.name);
      // Reset lastIndex pour les regex /g
      rule.pattern.lastIndex = 0;
      out = out.replace(rule.pattern, rule.replacement);
    }
  }

  // Nettoyage final : collapse les espaces multiples + ponctuation orpheline
  out = out
    .replace(/\s+/g, " ")            // multiples espaces → 1 espace
    .replace(/\s+([.,;:])/g, "$1")   // espace avant ponctuation → rien
    .replace(/\(\s*\)/g, "")         // parenthèses vides → rien
    .trim();

  // ── Déduplication : 2 patterns regex différents peuvent retourner LA
  //    MÊME formulation publique (ex: "Validation LONACI directe" et
  //    "Public prioritaire : Côte d'Ivoire..." remplacés tous les deux
  //    par PUBLIC_FRANCOPHONE_FRAMING). Sans dédup, on a "X. X." → moche.
  //
  //    Détecte une même phrase répétée 2× consécutivement (séparée par
  //    point + espace) et ne garde qu'une seule occurrence.
  out = dedupeConsecutiveSentences(out);
  if (applied.length >= 2) {
    // Si on a appliqué 2+ règles, le risque de doublon est réel — on
    // documente la dédup dans le log d'audit pour transparence.
    applied.push("__deduped");
  }

  return { text: out, appliedRules: applied };
}

/**
 * Si la même phrase apparaît 2× (ou plus) consécutivement séparées par
 * "." ou ". ", on ne garde qu'une seule occurrence.
 *
 * Algorithme simple : split par ". ", scan séquentiel, skip si phrase
 * identique à la précédente (insensible casse + espaces normalisés).
 *
 * @example
 *   "A. B. B. C." → "A. B. C."
 *   "B. b." → "B." (case insensitive)
 */
function dedupeConsecutiveSentences(text: string): string {
  if (!text || !text.includes(".")) return text;

  // Split en gardant les délimiteurs (. ! ?) pour reconstruire fidèlement
  const sentences = text.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let previousNormalized = "";

  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase().replace(/\s+/g, " ").trim();
    if (normalized === previousNormalized && normalized.length > 0) {
      // Skip : c'est un doublon consécutif
      continue;
    }
    out.push(sentence);
    previousNormalized = normalized;
  }

  return out.join(" ");
}
