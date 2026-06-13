import { createServiceClient } from "@/lib/supabase/server";

/**
 * Résout l'UUID de la table `plans` (DB) à partir d'un plan de PLAN_CONFIG (code).
 *
 * Pourquoi : `abonnements.plan_id` est une FK **UUID** → plans(id), mais
 * PLAN_CONFIG utilise des ids **texte** ("starter", "elite", "test-paystack"…).
 * Insérer l'id texte dans la colonne UUID provoque
 * « invalid input syntax for type uuid » et fait échouer TOUTE l'activation
 * (cause racine de `abonnements` vide depuis le début, audit 2026-06-13).
 *
 * Mapping nom PLAN_CONFIG → nom table `plans` :
 *   Starter → Découverte · Pro → Performance · Elite → Elite
 *   Test    → (aucune ligne en base) → retourne `null` : la ligne d'audit
 *             `abonnements` est alors simplement sautée, SANS bloquer
 *             l'activation de l'accès (qui vit dans `profiles`).
 */
const PLAN_NOM_TO_PLANS_NOM: Record<string, string> = {
  Starter: "Découverte",
  Pro: "Performance",
  Elite: "Elite",
};

export async function resolvePlanUuid(plan: { nom: string }): Promise<string | null> {
  const plansNom = PLAN_NOM_TO_PLANS_NOM[plan.nom];
  if (!plansNom) return null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("plans")
    .select("id")
    .eq("nom", plansNom)
    .maybeSingle();

  return (data?.id as string | undefined) ?? null;
}
