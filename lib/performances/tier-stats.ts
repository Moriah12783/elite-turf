/**
 * lib/performances/tier-stats.ts
 *
 * Découpage des performances par formule commerciale (Élite / Pro-Starter /
 * Gratuit) à partir de pronostics.niveau_acces. Pur, testable, sans Supabase.
 * Utilisé par /performances (filtre ?formule= + pastilles de comparaison).
 */
import type { PronosticLevel } from "@/types";

export type FormuleKey = "tous" | "elite" | "pro" | "gratuit";

export interface Formule {
  key: FormuleKey;
  label: string;
  /** niveaux inclus ; null = toutes les formules (aucun filtre). */
  niveaux: PronosticLevel[] | null;
}

export const FORMULES: Formule[] = [
  { key: "tous",    label: "Tous",          niveaux: null },
  { key: "elite",   label: "Élite",         niveaux: ["ELITE"] },
  { key: "pro",     label: "Pro / Starter", niveaux: ["PRO", "STARTER"] },
  { key: "gratuit", label: "Gratuit",       niveaux: ["GRATUIT"] },
];

/** Résout le paramètre ?formule= ; valeur inconnue/absente → "tous". */
export function resolveFormule(raw: string | undefined): Formule {
  return FORMULES.find((f) => f.key === raw) ?? FORMULES[0];
}

/** Forme minimale requise par les helpers (les vraies lignes ont plus de champs). */
export interface TierLite {
  resultat: string | null;
  niveau_acces: PronosticLevel | null;
}

/** Filtre une liste sur les niveaux d'une formule (null = pas de filtre). */
export function filterByFormule<T extends TierLite>(list: T[], f: Formule): T[] {
  if (f.niveaux === null) return list;
  const niveaux = f.niveaux;
  return list.filter((p) => p.niveau_acces != null && niveaux.includes(p.niveau_acces));
}

export interface TierSummary {
  total: number;
  termines: number;
  gagnants: number;
  taux: number; // % gagnants / terminés (0 si aucun terminé)
}

/** Résume une formule : total, terminés (hors EN_ATTENTE), gagnants, taux. */
export function summarizeTier<T extends TierLite>(list: T[], f: Formule): TierSummary {
  const items = filterByFormule(list, f);
  const termines = items.filter((p) => p.resultat !== "EN_ATTENTE").length;
  const gagnants = items.filter((p) => p.resultat === "GAGNANT").length;
  return {
    total: items.length,
    termines,
    gagnants,
    taux: termines > 0 ? Math.round((gagnants / termines) * 100) : 0,
  };
}
