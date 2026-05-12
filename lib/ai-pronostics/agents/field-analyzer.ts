/**
 * lib/ai-pronostics/agents/field-analyzer.ts
 *
 * Worker Agent #2 — Analyse en profondeur le field d'une course.
 *
 * Stratégie :
 *   - **PAS de Claude pour cet agent** — purement déterministe
 *   - Réutilise lib/courses/getCourseStatsEnrichies.ts (déjà construit !)
 *     qui croise partants × tables historiques chevaux/jockeys/entraîneurs
 *   - Retourne le top 3 (vedettes) + outsiders (value bets)
 *
 * Pourquoi pas de LLM ici :
 *   - Le calcul de score composite est déterministe, mieux fait en code
 *   - Économie tokens (1 LLM call évité × 3 courses × 365 jours = $$$ économie/an)
 *   - Plus rapide (~50ms vs 2-3s avec Claude)
 *
 * Le LLM intervient seulement après (SelectionBuilder, AnalyseWriter, etc.)
 * pour les décisions éditoriales et la rédaction.
 *
 * Modèle : Aucun (pas d'appel API)
 * Coût : $0
 */

import { getCourseStatsEnrichies } from "@/lib/courses/getCourseStatsEnrichies";
import type { PartantInput } from "@/lib/courses/stats-types";
import { createServiceClient } from "@/lib/supabase/server";
import type { FieldAnalysis, PartantPourAnalyse } from "../types";

/**
 * Charge les partants d'une course depuis Supabase.
 */
async function loadPartants(courseId: string): Promise<PartantInput[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("partants")
    .select("id, numero, nom_cheval, jockey, entraineur, cote, musique, poids_kg, non_partant")
    .eq("course_id", courseId);
  if (error || !data) return [];
  return data
    .filter((p: any) => !p.non_partant)
    .map((p: any) => ({
      id:          p.id,
      numero:      p.numero,
      nom_cheval:  p.nom_cheval,
      jockey:      p.jockey,
      entraineur:  p.entraineur,
      cote:        p.cote,
      musique:     p.musique,
      poids_kg:    p.poids_kg,
    }));
}

/**
 * Agent principal : enrichit les partants avec stats historiques + scores.
 *
 * Pipeline :
 *   1. Load partants (Supabase)
 *   2. getCourseStatsEnrichies (croise avec tables historiques)
 *   3. Format compact pour les agents suivants (PartantPourAnalyse[])
 */
export async function runFieldAnalyzerAgent(courseId: string): Promise<{
  result: FieldAnalysis | null;
  error?: string;
}> {
  // TODO Phase 2 : implémentation complète
  //   1. partants = await loadPartants(courseId)
  //   2. stats = await getCourseStatsEnrichies(partants)
  //   3. mapper PartantEnrichi → PartantPourAnalyse (slim version pour LLM tokens)
  //   4. extraire top_3 et outsiders depuis stats.partants

  void courseId;
  void loadPartants;
  void getCourseStatsEnrichies;
  void ({} as PartantPourAnalyse);

  return {
    result: null,
    error: "Agent non implémenté (Phase 1 — fondations uniquement)",
  };
}
