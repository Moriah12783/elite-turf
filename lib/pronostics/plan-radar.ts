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
 * DEUX SOURCES, par ordre de richesse :
 *  1. `plan_de_jeu` (pronostics ELITE) → pivot (banker) + base + value_picks.
 *  2. Repli `selection_detail` (présent sur ~tous les pronos) → on s'appuie sur
 *     les RÔLES posés par nos experts : BASE/APPUI/COMPLEMENT = le socle,
 *     le reste (OUTSIDER…) = la value. Même découpage que `ProSelectionBlock`
 *     déjà utilisé sur la fiche détail. Validé PO : « chances régulières »
 *     et « base » désignent bien le même socle jouable.
 *
 * ⚠️ ANTI-FABRICATION — règles strictes :
 *  - Les effectifs viennent du PRONOSTIC, jamais d'un quota imposé : on
 *    n'invente pas une hiérarchie que l'expert n'a pas donnée.
 *  - Le « coup » = la plus HAUTE COTE RÉELLE (règle du tocard du Radar).
 *    Sans cote fiable → `null`, le bloc est masqué plutôt que rempli au hasard.
 *  - Sans plan de jeu NI rôles exploitables → `null` : l'appelant garde
 *    l'affichage existant.
 *
 * PUR (aucune I/O), testé.
 */

/** Rôles considérés comme le SOCLE jouable (cf. ProSelectionBlock). */
const ROLES_SOCLE = ["BASE", "APPUI", "COMPLEMENT"];

export interface PlanDeJeuLike {
  banker?:      { number?: number | null } | null;
  quinte_plan?: { base?: number[] | null } | null;
  value_picks?: Array<{ number?: number | null }> | null;
}

export interface SelectionDetailLike {
  number?: number | null;
  role?:   string | null;
}

export interface PlanRadarInput {
  /** Sélection publiée (ordre de mérite). */
  selection:        number[];
  /** `pronostics.plan_de_jeu` (surtout sur les pronostics ELITE). */
  planDeJeu?:       PlanDeJeuLike | null;
  /** `pronostics.selection_detail` — repli quand il n'y a pas de plan de jeu. */
  selectionDetail?: SelectionDetailLike[] | null;
  /** Cotes réelles par n° de dossard (pour désigner le coup). */
  cotes?:           Record<number, number | null | undefined> | null;
}

export interface PlanRadar {
  /** Le « banker » : pivot du jeu, mis en avant d'une étoile. `null` en repli. */
  pivot:  number | null;
  /** Les incontournables du pronostic. */
  base:   number[];
  /** Les chevaux à cote intéressante. */
  value:  number[];
  /** Le pari d'audace : plus haute cote réelle. `null` si cote inconnue. */
  coup:   number | null;
  /** D'où vient la structure — utile pour les tests et le debug. */
  source: "plan" | "roles";
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

/** Plus haute cote réelle parmi `pool`. `null` si aucune cote exploitable. */
function plusHauteCote(pool: number[], cotes: Record<number, number | null | undefined>): number | null {
  let best: number | null = null;
  let max = -Infinity;
  for (const n of pool) {
    const c = Number(cotes[n]);
    if (!Number.isFinite(c) || c <= 0) continue;
    if (c > max) { max = c; best = n; }
  }
  return best;
}

/**
 * Construit la structure Radar d'un pronostic premium.
 * Renvoie `null` si rien d'exploitable (→ l'appelant garde l'affichage existant).
 */
export function buildPlanRadar(input: PlanRadarInput): PlanRadar | null {
  const selection = Array.isArray(input.selection)
    ? input.selection.filter((n) => Number.isFinite(Number(n))).map(Number)
    : [];
  if (selection.length === 0) return null;

  const cotes = input.cotes ?? {};
  const plan = input.planDeJeu ?? null;

  // ── 1. Voie riche : le plan de jeu de l'expert ────────────────────────
  if (plan) {
    const base = cleanNumbers(plan.quinte_plan?.base, selection);
    const valueRaw = Array.isArray(plan.value_picks) ? plan.value_picks.map((v) => v?.number) : [];
    const baseSet = new Set(base);
    const value = cleanNumbers(valueRaw, selection).filter((n) => !baseSet.has(n));

    if (base.length > 0 || value.length > 0) {
      const bankerNum = Number(plan.banker?.number);
      const pivot = Number.isFinite(bankerNum) && selection.indexOf(bankerNum) !== -1 ? bankerNum : null;
      // Le coup se prend dans le CHAMP (hors base et hors value) : on ne
      // dépouille jamais les value_picks choisis par l'expert.
      const placed = new Set([...base, ...value]);
      const coup = plusHauteCote(selection.filter((n) => !placed.has(n)), cotes);
      return { pivot, base, value, coup, source: "plan" };
    }
  }

  // ── 2. Repli : les rôles posés par l'expert dans selection_detail ─────
  const detail = Array.isArray(input.selectionDetail) ? input.selectionDetail : [];
  if (detail.length === 0) return null;

  const socle: number[] = [];
  const autres: number[] = [];
  const inSelection = new Set(selection);
  const seen: Record<number, boolean> = {};
  for (const it of detail) {
    const n = Number(it?.number);
    if (!Number.isFinite(n) || !inSelection.has(n) || seen[n]) continue;
    seen[n] = true;
    const role = String(it?.role ?? "").toUpperCase();
    (ROLES_SOCLE.indexOf(role) !== -1 ? socle : autres).push(n);
  }
  if (socle.length === 0 && autres.length === 0) return null;

  // Ici le coup se prend parmi les outsiders (le tocard), et sort de la value
  // pour n'apparaître qu'une fois.
  const coup = plusHauteCote(autres, cotes);
  const value = coup != null ? autres.filter((n) => n !== coup) : autres;

  return { pivot: null, base: socle, value, coup, source: "roles" };
}
