/**
 * lib/pronostics/plan-radar.ts
 *
 * Dérive, à partir d'un pronostic PREMIUM publié, la structure « façon Radar »
 * (base / value / coup + pivot) pour l'afficher aux ABONNÉS dans le même
 * langage visuel que le Radar de la presse — mais avec le VRAI pronostic.
 *
 * Pourquoi : le visiteur gratuit voit un Radar richement structuré, alors que
 * l'abonné payant ne voyait qu'une ligne de numéros. Inversion de valeur perçue.
 *
 * ⚠️ ANTI-FABRICATION — règles strictes :
 *  - Les effectifs (combien de base, combien de value) viennent du PRONOSTIC,
 *    jamais d'un quota imposé : on n'invente pas une hiérarchie que l'expert
 *    n'a pas donnée.
 *  - Le « coup » = la plus HAUTE COTE RÉELLE parmi les chevaux hors base —
 *    exactement la règle du Radar (le tocard). Sans cote fiable → `null`,
 *    le bloc est masqué plutôt que rempli au hasard.
 *  - Si le pronostic n'a pas de `plan_de_jeu`, on ne fabrique PAS de base :
 *    on renvoie `null` et l'appelant retombe sur l'affichage par rôles.
 *
 * PUR (aucune I/O), testé.
 */

export interface PlanDeJeuLike {
  banker?:      { number?: number | null } | null;
  quinte_plan?: { base?: number[] | null } | null;
  value_picks?: Array<{ number?: number | null }> | null;
}

export interface PlanRadarInput {
  /** Sélection publiée (ordre de mérite). */
  selection:      number[];
  /** `pronostics.plan_de_jeu` (présent surtout sur les pronostics ELITE). */
  planDeJeu?:     PlanDeJeuLike | null;
  /** Cotes réelles par n° de dossard (pour désigner le coup). */
  cotes?:         Record<number, number | null | undefined> | null;
}

export interface PlanRadar {
  /** Le « banker » : pivot du jeu, mis en avant d'une étoile. */
  pivot: number | null;
  /** Les incontournables du pronostic. */
  base:  number[];
  /** Les chevaux à cote intéressante retenus par l'expert. */
  value: number[];
  /** Le pari d'audace : plus haute cote réelle hors base. `null` si inconnue. */
  coup:  number | null;
}

/** Numéros valides, dédupliqués, restreints à la sélection, ordre préservé. */
function cleanNumbers(raw: unknown, selection: number[]): number[] {
  if (!Array.isArray(raw)) return [];
  const inSelection = new Set(selection);
  const seen: Record<number, boolean> = {};
  const out: number[] = [];
  for (const v of raw) {
    const n = Number(v);
    if (!Number.isFinite(n) || !inSelection.has(n) || seen[n]) continue;
    seen[n] = true;
    out.push(n);
  }
  return out;
}

/**
 * Construit la structure Radar d'un pronostic premium.
 * Renvoie `null` si le pronostic ne porte pas de plan de jeu exploitable
 * (→ l'appelant garde l'affichage existant, aucune donnée inventée).
 */
export function buildPlanRadar(input: PlanRadarInput): PlanRadar | null {
  const selection = Array.isArray(input.selection)
    ? input.selection.filter((n) => Number.isFinite(Number(n))).map(Number)
    : [];
  if (selection.length === 0) return null;

  const plan = input.planDeJeu ?? null;
  if (!plan) return null;

  // ── Base : telle que l'expert l'a définie (jamais un quota imposé) ──
  const base = cleanNumbers(plan.quinte_plan?.base, selection);

  // ── Value : les value_picks, privés de ceux déjà en base (pas de doublon) ──
  const valueRaw = Array.isArray(plan.value_picks)
    ? plan.value_picks.map((v) => v?.number)
    : [];
  const baseSet = new Set(base);
  const value = cleanNumbers(valueRaw, selection).filter((n) => !baseSet.has(n));

  // Sans base NI value, il n'y a pas de structure à montrer.
  if (base.length === 0 && value.length === 0) return null;

  // ── Pivot : le banker, s'il appartient bien à la sélection ──
  const bankerNum = Number(plan.banker?.number);
  const pivot = Number.isFinite(bankerNum) && selection.indexOf(bankerNum) !== -1
    ? bankerNum
    : null;

  // ── Coup : plus haute cote RÉELLE parmi les chevaux hors base et hors value
  //    (même règle que le tocard du Radar). Sans cote → null (bloc masqué).
  const cotes = input.cotes ?? {};
  const dejaPlace = new Set([...base, ...value]);
  let coup: number | null = null;
  let meilleureCote = -Infinity;
  for (const n of selection) {
    if (dejaPlace.has(n)) continue;
    const c = Number(cotes[n]);
    if (!Number.isFinite(c) || c <= 0) continue;
    if (c > meilleureCote) { meilleureCote = c; coup = n; }
  }

  return { pivot, base, value, coup };
}
