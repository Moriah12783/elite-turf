/**
 * lib/ai-pronostics/agents/analyse-writer.ts
 *
 * Worker Agent #4 — Rédige l'analyse_courte de chaque pronostic.
 *
 * Style éditorial Elite Turf (charte) :
 *   - Ton : professionnel, analytique, rassurant — pas survendre
 *   - Format : 2-4 phrases, 150-300 chars
 *   - Inclut : référence à la base (1-2 chevaux clés), justification analytique,
 *     mention discrète de la couverture (nb chevaux)
 *   - Évite : promesses de gain, langage marketing agressif, superlatifs
 *
 * Exemples cibles :
 *
 *   ELITE :
 *   "Sélection Elite Quinté+ Prix de Diane (Chantilly). Base #4 et #7 dominent
 *   par leur régularité (4/5 top-3 sur la musique), encadrés de 4 outsiders
 *   value (cote ≥ 8, taux victoire historique ≥ 18%). Confiance élevée."
 *
 *   PRO :
 *   "Notre sélection Pro pour ce Quinté+ Vincennes — 8 chevaux pour sécuriser
 *   les combinés. Base #12 + #3 (favoris confirmés), couverture jusqu'à #9
 *   pour intégrer 2 outsiders raisonnables sur ce field 16 partants."
 *
 *   GRATUIT :
 *   "Tiercé libre gratuit du jour à Cagnes. 6 chevaux retenus : 2 favoris
 *   confirmés (#8 et #11), 4 outsiders ciblés pour les variantes. À jouer
 *   en libre pour optimiser le ratio gain/risque."
 *
 * Modèle : Haiku (tâche simple de rédaction structurée)
 * Coût estimé : ~$0.005 / run × 3 courses = $0.015/jour
 */

import { callClaude, CLAUDE_MODELS } from "../claude-client";
import type {
  AnalyseWriterResult,
  FieldAnalyzerResult,
  NiveauAcces,
  SelectionBuilderResult,
} from "../types";

interface AnalyseWriterInput {
  selection: SelectionBuilderResult;
  field:     FieldAnalyzerResult;
  niveau:    NiveauAcces;
  course_libelle:    string;
  course_hippodrome: string;
  course_heure:      string;
}

const SYSTEM_PROMPT_ANALYSTE = `Tu es l'analyste éditorial officiel d'Elite Turf. Tu rédiges des analyses courtes pour des pronostics PMU.

RÈGLES ABSOLUES :
- Ton professionnel, analytique, rassurant
- 2 à 4 phrases maximum
- 150 à 300 caractères TOTAL
- Mention 1 ou 2 chevaux clés par leur numéro (#N)
- Justification analytique brève (musique, cote, taux historique)
- JAMAIS de promesse de gain ("ce cheval va gagner", etc.)
- JAMAIS de superlatifs marketing ("incontournable", "imbattable", etc.)
- Niveau écriture : presse hippique professionnelle (Paris-Turf, Geny)

FORMAT DE SORTIE :
Réponds UNIQUEMENT avec un JSON valide :
{ "analyse_courte": "..." }`;

/**
 * Agent principal : rédige l'analyse_courte avec Claude Haiku.
 */
export async function runAnalyseWriterAgent(input: AnalyseWriterInput): Promise<{
  result: AnalyseWriterResult | null;
  tokens_input:  number;
  tokens_output: number;
  error?: string;
}> {
  // TODO Phase 2 :
  //   1. Construire userPrompt compact :
  //      - Niveau + type pari
  //      - Course + hippodrome
  //      - Sélection (numéros)
  //      - Données clés des 3 premiers chevaux (musique, cote, taux histo)
  //   2. callClaude({ model: HAIKU, expectJson: true })
  //   3. Validation longueur (150-300 chars), retry si hors range
  //   4. Retourner AnalyseWritten

  void input;
  void callClaude;
  void CLAUDE_MODELS;
  void SYSTEM_PROMPT_ANALYSTE;

  return {
    result: null,
    tokens_input:  0,
    tokens_output: 0,
    error: "Agent non implémenté (Phase 1 — fondations uniquement)",
  };
}
