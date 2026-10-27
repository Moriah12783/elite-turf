import { PLAN_CONFIG, type Plan } from "@/types";

/**
 * Noms des formules : code (PLAN_CONFIG) ↔ table `plans` de la base.
 * Starter → Découverte · Pro → Performance · Elite → Elite.
 * PUR (aucun accès base) : partagé par lib/plans/resolve.ts (code → UUID) et
 * par les e-mails qui partent d'une ligne `abonnements` (UUID → code).
 */
export const PLAN_NOM_TO_PLANS_NOM: Record<string, string> = {
  Starter: "Découverte",
  Pro: "Performance",
  Elite: "Elite",
};

/**
 * PUR : formule de PLAN_CONFIG d'après le nom de la table `plans`
 * (« Performance » → Pro). null si le nom est inconnu : l'appelant n'affiche
 * alors ni nom de formule ni prix, plutôt qu'une valeur inventée.
 */
export function planDepuisNomTable(nomTable: string | null | undefined): Plan | null {
  if (!nomTable) return null;
  const code = Object.keys(PLAN_NOM_TO_PLANS_NOM).find((k) => PLAN_NOM_TO_PLANS_NOM[k] === nomTable);
  if (!code) return null;
  return PLAN_CONFIG.find((p) => p.nom === code && p.actif) ?? null;
}
