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
}

export interface EliteSelectionInput {
  runners: EliteRunnerInput[];
  paris_disponibles: string[];
}

const VALUE_THRESHOLD = 50;

/** Choisit le meilleur type de pari disponible (du plus prestigieux au moins). */
function pickBetType(paris: string[]): { type_pari: string; isQuinte: boolean } {
  if (paris.includes("QUINTE_PLUS")) return { type_pari: "Quinté+ (ordre/désordre)", isQuinte: true };
  if (paris.includes("QUARTE_PLUS") || paris.includes("QUARTE")) return { type_pari: "Quarté+", isQuinte: false };
  if (paris.includes("TIERCE")) return { type_pari: "Tiercé", isQuinte: false };
  return { type_pari: "Couplé", isQuinte: false };
}

export function buildElitePlanDeJeu(input: EliteSelectionInput): ElitePlanDeJeu {
  // Tri par confidence décroissante (le banker = plus haute confiance).
  const byConfidence = [...input.runners].sort((a, b) => b.confidence_score - a.confidence_score);
  const banker = byConfidence[0];

  const { type_pari, isQuinte } = pickBetType(input.paris_disponibles);

  // Champ réduit = les numéros de la sélection, dans l'ordre du mérite d'origine.
  const champ_reduit = input.runners.map((r) => r.number);

  // value_picks = chevaux sous-cotés (value_score élevé) = le "edge" Elite.
  const value_picks = input.runners
    .filter((r) => r.value_score >= VALUE_THRESHOLD)
    .map((r) => ({
      number: r.number,
      name: r.name,
      raison: `Cote supérieure à sa probabilité estimée (value ${r.value_score}/100)`,
    }));

  // Mise en UNITÉS — template responsable, jamais d'euros.
  const mise_unites = [
    { libelle: `Base autour du n°${banker.number} (${banker.name})`, unites: 5 },
    { libelle: `Champ réduit ${champ_reduit.join("-")}`, unites: 2 },
  ];

  // Quinté+ travaillé : base = 2 meilleurs confidence, champ = le reste (par confidence).
  const quinte_plan = isQuinte
    ? {
        base: byConfidence.slice(0, 2).map((r) => r.number),
        champ: byConfidence.slice(2).map((r) => r.number),
        strategie:
          "Jouer la base en couverture ordre + désordre, compléter par le champ. " +
          "Privilégier le désordre si le field est ouvert.",
      }
    : null;

  return {
    banker: {
      number: banker.number,
      name: banker.name,
      justification: `Plus haute confiance de la sélection (${banker.confidence_score}/100) — pivot du jeu.`,
    },
    bet_strategy: { type_pari, champ_reduit, mise_unites },
    value_picks,
    quinte_plan,
  };
}
