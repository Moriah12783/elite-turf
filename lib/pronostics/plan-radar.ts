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
 *  2. Repli `selection_detail` → on s'appuie sur les RÔLES : BASE/APPUI/COMPLEMENT
 *     = le socle, le reste (OUTSIDER…) = la value. Validé PO : « chances
 *     régulières » et « base » désignent bien le même socle jouable.
 *     Quand l'expert saisit lui-même ses rôles dans l'admin, il peut en plus
 *     DÉSIGNER le coup (rôle COUP) et le pivot (`pivot: true`) — un choix, qui
 *     prime alors sur les heuristiques. Vocabulaire : ./selection-roles.ts.
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

import { ROLES_SOCLE, ROLE_COUP, ROLE_CHAMP, ROLE_ASSOCIE, COUPLE_MAX } from "./selection-roles";
import { canAccess } from "@/lib/auth/access";

export interface PlanDeJeuLike {
  banker?:      { number?: number | null } | null;
  quinte_plan?: { base?: number[] | null } | null;
  value_picks?: Array<{ number?: number | null }> | null;
}

export interface SelectionDetailLike {
  number?: number | null;
  role?:   string | null;
  /** Posé à la main par l'expert : ce cheval est le pivot du jeu. */
  pivot?:  boolean | null;
  /** Posé à la main par l'expert : ce cheval est dans le couplé (plan de jeu Elite). */
  couple?: boolean | null;
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
  /** Plan de jeu Elite : joués avec la base dans le champ réduit. */
  associes: number[];
  /**
   * Plan de jeu Elite : le couplé, EXACTEMENT 2 chevaux, ou vide. Désigné
   * par-dessus les rôles : ces chevaux figurent aussi dans leur niveau.
   */
  couple: number[];
  /**
   * Tout le reste de la sélection publiée.
   *
   * ⚠️ NON NÉGOCIABLE : le bloc REMPLACE la liste des dossards sur la carte.
   * Sans ce champ, un cheval publié mais non mis en avant disparaîtrait de
   * l'affichage — l'abonné verrait moins de chevaux qu'il n'en a payé.
   */
  champ:  number[];
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
 * Les chevaux publiés que le bloc ne met pas en avant. Calculé depuis
 * `selection` (et non depuis les rôles) : c'est la garantie structurelle
 * qu'aucun cheval payé par l'abonné ne peut manquer à l'affichage.
 */
function resteDe(selection: number[], base: number[], value: number[], coup: number | null, associes: number[] = []): number[] {
  const place: Record<number, boolean> = {};
  for (const n of base) place[n] = true;
  for (const n of value) place[n] = true;
  for (const n of associes) place[n] = true;
  if (coup !== null) place[coup] = true;
  return selection.filter((n) => !place[n]);
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
      const placed = new Set(base.concat(value));
      const coup = plusHauteCote(selection.filter((n) => !placed.has(n)), cotes);
      return { pivot, base, value, coup, associes: [], couple: [], champ: resteDe(selection, base, value, coup), source: "plan" };
    }
  }

  // ── 2. Repli : les rôles posés par l'expert dans selection_detail ─────
  const detail = Array.isArray(input.selectionDetail) ? input.selectionDetail : [];
  if (detail.length === 0) return null;

  const socle: number[] = [];
  const autres: number[] = [];
  const champ: number[] = [];
  const associes: number[] = [];
  const coupleMarque: number[] = [];
  const inSelection = new Set(selection);
  const seen: Record<number, boolean> = {};
  let coupExplicite: number | null = null;
  let pivotExplicite: number | null = null;

  for (const it of detail) {
    const n = Number(it?.number);
    if (!Number.isFinite(n) || !inSelection.has(n) || seen[n]) continue;
    seen[n] = true;
    if (it?.pivot === true && pivotExplicite === null) pivotExplicite = n;
    if (it?.couple === true && coupleMarque.length < COUPLE_MAX) coupleMarque.push(n);

    const role = String(it?.role ?? "").toUpperCase();
    if (role === ROLE_COUP) {
      // Le coup DÉSIGNÉ par l'expert prime sur l'heuristique de cote : c'est un
      // choix, pas une déduction. Un seul est mis en avant (ordre = mérite) ;
      // un éventuel second reste en value — aucun cheval perdu.
      if (coupExplicite === null) coupExplicite = n;
      else autres.push(n);
    } else if (role === ROLE_ASSOCIE) {
      associes.push(n);
    } else if (role === ROLE_CHAMP) {
      // Couverture : l'expert l'a laissé dans le jeu sans le mettre en avant.
      // Ni base ni value — mais candidat au coup déduit, comme le champ d'un
      // plan de jeu Elite.
      champ.push(n);
    } else if (ROLES_SOCLE.indexOf(role) !== -1) {
      socle.push(n);
    } else {
      autres.push(n);
    }
  }
  // Un couplé n'a de sens qu'à 2 chevaux : un seul cheval marqué ne s'affiche pas
  // comme couplé (il reste visible dans son niveau).
  const couple = coupleMarque.length === COUPLE_MAX
    ? coupleMarque.slice().sort((a, b) => selection.indexOf(a) - selection.indexOf(b))
    : [];
  if (socle.length === 0 && autres.length === 0 && coupExplicite === null && associes.length === 0 && couple.length === 0) return null;

  // À défaut de coup désigné, on le déduit du tocard (plus haute cote). On le
  // cherche d'abord dans le champ ; sinon parmi les outsiders, d'où il est alors
  // retiré pour n'apparaître qu'une fois.
  const coupChamp = coupExplicite === null ? plusHauteCote(champ, cotes) : null;
  const coup =
    coupExplicite !== null ? coupExplicite
    : coupChamp !== null   ? coupChamp
    : plusHauteCote(autres, cotes);
  const value =
    coupExplicite === null && coupChamp === null && coup !== null
      ? autres.filter((n) => n !== coup)
      : autres;

  return {
    pivot: pivotExplicite,
    base:  socle,
    value,
    coup,
    associes,
    couple,
    champ: resteDe(selection, socle, value, coup, associes),
    source: "roles",
  };
}

/** Niveaux payants : seuls leurs pronostics montrent les rôles. */
const NIVEAUX_AVEC_ROLES = ["STARTER", "PRO", "ELITE"];

/**
 * Le plan à afficher à CE lecteur, ou `null` — porte d'entrée de tous les
 * écrans (carte, accueil, fiche course, fiche détail).
 *
 * Règle de Steph : le ticket structuré (bases, values, associés) reste réservé
 * aux abonnés et ne doit jamais apparaître sur une page publique. D'où deux
 * verrous, en plus de l'accès :
 *  - jamais sur un pronostic GRATUIT : tout visiteur le lit, rôles compris ;
 *  - niveau inconnu → refus, comme `canAccess`.
 *
 * L'accès est recalculé ici à partir de l'abonnement, et non reçu en booléen :
 * un écran ne peut pas ouvrir les rôles par erreur.
 */
export function planRadarAbonne(
  niveau: string | null | undefined,
  abonnement: string,
  input: PlanRadarInput,
): PlanRadar | null {
  const n = String(niveau ?? "");
  if (NIVEAUX_AVEC_ROLES.indexOf(n) === -1 || !canAccess(n, abonnement)) return null;
  return buildPlanRadar(input);
}

export type CleNiveau = "couple" | "base" | "associes" | "value" | "coup" | "champ";

/**
 * Les niveaux non vides du plan, dans l'ordre d'affichage — le même sur tous
 * les écrans, pour que l'abonné retrouve ses repères. Le couplé vient en tête
 * mais double ses chevaux, qui figurent aussi dans leur niveau.
 */
export function tiersDuPlan(plan: PlanRadar): Array<{ cle: CleNiveau; numeros: number[] }> {
  const niveaux: Array<{ cle: CleNiveau; numeros: number[] }> = [
    { cle: "couple",   numeros: plan.couple },
    { cle: "base",     numeros: plan.base },
    { cle: "associes", numeros: plan.associes },
    { cle: "value",    numeros: plan.value },
    { cle: "coup",     numeros: plan.coup !== null ? [plan.coup] : [] },
    { cle: "champ",    numeros: plan.champ },
  ];
  return niveaux.filter((t) => t.numeros.length > 0);
}
