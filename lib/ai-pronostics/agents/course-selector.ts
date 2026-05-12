/**
 * lib/ai-pronostics/agents/course-selector.ts
 *
 * Worker Agent #1 — Sélectionne 3 courses du jour (1 Elite, 1 Pro, 1 Gratuit).
 *
 * Stratégie de sélection :
 *   - ELITE  : course Quinté+ la plus prestigieuse du jour
 *              (hippodromes : Vincennes, Longchamp, Chantilly, ParisLongchamp,
 *               Auteuil, Cagnes, Deauville, Saint-Cloud)
 *              priorité au nb_partants élevé (12-18 = idéal) + Quinté+ confirmé
 *
 *   - PRO    : autre course Quinté+ OU Quarté+ jouable
 *              différente de l'Elite (autre hippodrome de préférence)
 *              nb_partants ≥ 10 idéal
 *
 *   - GRATUIT : course Tiercé (libre = 6 chevaux) accessible LONACI/Maroc si possible
 *               nb_partants ≥ 8 idéal
 *
 * Implémentation : SQL filter + ranking dans Postgres, PUIS Claude Sonnet pour
 * arbitrer entre 2-3 candidates équivalentes (raisonnement éditorial).
 *
 * Modèle : Sonnet 4.5 (reasoning, choix éditorial)
 * Coût estimé : ~$0.015 / run (input ~800 tokens, output ~300 tokens)
 */

import { createServiceClient } from "@/lib/supabase/server";
import { callClaude, CLAUDE_MODELS } from "../claude-client";
import type { CourseCandidate, CourseSelectionResult } from "../types";

/**
 * Récupère toutes les courses du jour candidates depuis Supabase.
 * Filtre : France OU Maroc OU CI (LONACI), avec geny_url valide.
 */
async function loadTodayCandidates(date: string): Promise<CourseCandidate[]> {
  // TODO Phase 2 : implémenter la query Supabase complète
  //   - Inner join hippodromes (nom, pays)
  //   - filter date_course = date
  //   - filter statut = 'PROGRAMME'
  //   - filter paris_disponibles ?| array['QUINTE_PLUS','QUARTE','TIERCE']
  //   - order by nb_partants DESC, heure_depart ASC
  //   - limit 30 (plus que ça = bruit)
  const supabase = createServiceClient();
  void supabase;
  void date;
  return [];
}

/**
 * Pre-filter rapide en TypeScript pour shortlister 3-6 candidates par niveau.
 * Évite d'envoyer 30 courses à Claude (économie tokens).
 */
function shortlistByNiveau(courses: CourseCandidate[]): {
  eliteCandidates:   CourseCandidate[];
  proCandidates:     CourseCandidate[];
  gratuitCandidates: CourseCandidate[];
} {
  // TODO Phase 2 :
  //   - eliteCandidates : Quinté+ + hippodrome prestigieux (whitelist)
  //   - proCandidates : Quinté+/Quarté+ hors elite + nb_partants >= 10
  //   - gratuitCandidates : Tiercé jouable + nb_partants >= 8
  void courses;
  return {
    eliteCandidates:   [],
    proCandidates:     [],
    gratuitCandidates: [],
  };
}

/**
 * Agent principal : sélectionne 3 courses parmi les candidates.
 *
 * Pipeline :
 *   1. Load candidates (Supabase)
 *   2. Shortlist par niveau (TypeScript, ~3-6 par catégorie)
 *   3. Claude Sonnet pour arbitrer (input compact, output JSON structuré)
 *   4. Validation : 3 courses distinctes, hippodromes différents si possible
 */
export async function runCourseSelectorAgent(date: string): Promise<{
  result: CourseSelectionResult | null;
  tokens_input:  number;
  tokens_output: number;
  error?: string;
}> {
  // TODO Phase 2 : implémentation complète
  //   Pour l'instant retourne null pour signaler "agent non implémenté"
  void date;
  void callClaude;
  void CLAUDE_MODELS;
  void loadTodayCandidates;
  void shortlistByNiveau;

  return {
    result: null,
    tokens_input:  0,
    tokens_output: 0,
    error: "Agent non implémenté (Phase 1 — fondations uniquement)",
  };
}
