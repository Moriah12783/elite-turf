/**
 * lib/ai-pronostics/elite-plan.ts
 *
 * Module PUR (zéro I/O, zéro LLM) : transforme une sélection ELITE en
 * "plan de jeu" — la différence de NATURE entre Elite et Pro (cf. spec
 * docs/superpowers/specs/2026-06-26-pronostic-model-design.md). Mises en
 * UNITÉS (jamais €) — jeu responsable.
 */
import type { ElitePlanDeJeu } from "./types";

export interface EliteRunnerInput {
  number: number;
  name: string;
  role: "BASE" | "APPUI" | "OUTSIDER" | "COMPLEMENT";
  confidence_score: number;
  value_score: number;
  /** Optionnel — défaut 0 (sûr). Un value pick exige un risque maîtrisé (< 65). */
  risk_score?: number;
}

export interface EliteSelectionInput {
  runners: EliteRunnerInput[];
  paris_disponibles: string[];
}

const VALUE_THRESHOLD = 50;
const MAX_VALUE_RISK = 65;

/** Choisit le meilleur type de pari disponible (du plus prestigieux au moins). */
function pickBetType(paris: string[]): { type_pari: string; isQuinte: boolean } {
  if (paris.includes("QUINTE_PLUS")) return { type_pari: "Quinté+ (ordre/désordre)", isQuinte: true };
  if (paris.includes("QUARTE_PLUS") || paris.includes("QUARTE")) return { type_pari: "Quarté+", isQuinte: false };
  if (paris.includes("TIERCE")) return { type_pari: "Tiercé", isQuinte: false };
  return { type_pari: "Couplé", isQuinte: false };
}

export function buildElitePlanDeJeu(input: EliteSelectionInput): ElitePlanDeJeu {
  if (input.runners.length === 0) {
    // Défense en profondeur : ce module est le seul rempart déterministe du bloc
    // Elite. En prod le Director écarte les sélections vides en amont, mais un
    // appelant direct (backfill, script admin) doit échouer clairement.
    throw new Error("buildElitePlanDeJeu : sélection vide (aucun cheval)");
  }

  // Clé de tri UNIQUE = l'ordre de MÉRITE d'entrée (selected_runners, trié par
  // global_score). banker = tête de sélection (cohérent avec le « 1er choix »
  // affiché) ; base Quinté+ = les 2 têtes. (Avant : tri par confidence => banker
  // et base pouvaient diverger de la tête de sélection — incohérence d'audit.)
  const runners = input.runners;
  const banker = runners[0];

  const { type_pari, isQuinte } = pickBetType(input.paris_disponibles);

  // Champ réduit = les numéros de la sélection, dans l'ordre du mérite.
  const champ_reduit = runners.map((r) => r.number);

  // value_picks = chevaux sous-cotés (indice value élevé), HORS banker et à
  // risque maîtrisé — MÊME définition d'edge que le SelectionBuilder
  // (value ≥ 50 & risk < 65). On ne présente jamais le banker comme un outsider.
  const value_picks = runners
    .filter(
      (r) =>
        r.number !== banker.number &&
        r.value_score >= VALUE_THRESHOLD &&
        (r.risk_score ?? 0) < MAX_VALUE_RISK,
    )
    .map((r) => ({
      number: r.number,
      name: r.name,
      raison: `Cote attractive au regard de sa forme récente (indice value ${r.value_score}/100)`,
    }));

  // Mise en UNITÉS — template responsable, jamais d'euros.
  const mise_unites = [
    { libelle: `Base autour du n°${banker.number} (${banker.name})`, unites: 5 },
    { libelle: `Champ réduit ${champ_reduit.join("-")}`, unites: 2 },
  ];

  // Quinté+ travaillé : base = 2 têtes de sélection (mérite), champ = le reste.
  const quinte_plan = isQuinte
    ? {
        base: runners.slice(0, 2).map((r) => r.number),
        champ: runners.slice(2).map((r) => r.number),
        strategie:
          "Jouer la base en couverture ordre + désordre, compléter par le champ. " +
          "Privilégier le désordre si le field est ouvert.",
      }
    : null;

  return {
    banker: {
      number: banker.number,
      name: banker.name,
      justification: `Tête de la sélection (confiance ${banker.confidence_score}/100) — pivot du jeu.`,
    },
    bet_strategy: { type_pari, champ_reduit, mise_unites },
    value_picks,
    quinte_plan,
  };
}
