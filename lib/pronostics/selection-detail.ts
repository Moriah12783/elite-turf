/**
 * lib/pronostics/selection-detail.ts
 *
 * Construit la valeur écrite dans `pronostics.selection_detail` depuis ce que
 * l'expert a qualifié dans l'admin.
 *
 * DEUX INVARIANTS, tous deux imposés par les consommateurs publics :
 *
 *  1. TOUT OU RIEN. Sur la fiche détail, la hiérarchie REMPLACE la liste par
 *     mérite. Soit on n'écrit rien (null → affichage actuel intact), soit on
 *     écrit une ligne pour CHAQUE cheval de la sélection : chacun est alors
 *     rangé où l'expert l'a voulu, le champ compris.
 *  2. L'ORDRE DE MÉRITE est celui de `selection`, jamais celui des clics.
 *
 * Le champ `name` est OMIS quand on ne connaît pas le nom : la fiche détail
 * s'en sert quand le partant manque, et une chaîne vide y afficherait une
 * ligne blanche.
 *
 * PUR (aucune I/O), testé.
 */
import { ROLE_CHAMP, COUPLE_MAX } from "./selection-roles";

export interface SelectionDetailRow {
  number: number;
  role:   string;
  name?:  string;
  pivot?: boolean;
  /** Dans le couplé du plan de jeu Elite (2 chevaux au plus). */
  couple?: boolean;
}

export interface BuildSelectionDetailInput {
  /** Sélection publiée (ordre de mérite). */
  selection: number[];
  /** Rôle choisi par l'expert, par n° de dossard. Les absents deviennent du champ. */
  roles:     Record<number, string | undefined>;
  /** Le pivot du jeu, s'il a été désigné. */
  pivot?:    number | null;
  /** Le couplé du plan de jeu Elite (2 chevaux au plus). */
  couple?:   number[] | null;
  /** Noms des chevaux connus (partants), par n° de dossard. */
  noms?:     Record<number, string | null | undefined>;
}

/**
 * Renvoie les lignes à stocker, ou `null` si l'expert n'a rien qualifié —
 * auquel cas l'appelant doit écrire `null` en base et laisser l'affichage
 * existant tel quel.
 */
export interface ParsedSelectionRoles {
  roles: Record<number, string>;
  pivot: number | null;
  /** Le couplé déjà stocké (2 chevaux au plus), dans l'ordre de mérite. */
  couple: number[];
  /** Noms déjà stockés — à réinjecter au réenregistrement, sinon on les perd. */
  noms:  Record<number, string>;
}

/**
 * Lecture inverse : recharge dans l'éditeur ce qui est déjà stocké.
 *
 * Les rôles sont repris VERBATIM, y compris ceux que l'admin ne sait pas poser
 * (COMPLEMENT, APPUI… produits par le pipeline). Sans cela, rouvrir puis
 * réenregistrer un pronostic IA rétrograderait silencieusement ses chevaux en
 * champ — une mutation de données invisible.
 */
export function parseSelectionRoles(raw: unknown): ParsedSelectionRoles {
  const out: ParsedSelectionRoles = { roles: {}, pivot: null, couple: [], noms: {} };
  if (!Array.isArray(raw)) return out;
  for (const it of raw) {
    const o = it as { number?: unknown; role?: unknown; pivot?: unknown; couple?: unknown; name?: unknown };
    const n = Number(o?.number);
    if (!Number.isFinite(n)) continue;
    const role = String(o?.role ?? "").trim().toUpperCase();
    if (role && role !== ROLE_CHAMP) out.roles[n] = role;
    if (o?.pivot === true && out.pivot === null) out.pivot = n;
    if (o?.couple === true && out.couple.length < COUPLE_MAX && out.couple.indexOf(n) === -1) out.couple.push(n);
    const nom = typeof o?.name === "string" ? o.name.trim() : "";
    if (nom) out.noms[n] = nom;
  }
  return out;
}

export function buildSelectionDetail(input: BuildSelectionDetailInput): SelectionDetailRow[] | null {
  const selection = Array.isArray(input.selection)
    ? input.selection.filter((n) => Number.isFinite(Number(n))).map(Number)
    : [];
  if (selection.length === 0) return null;

  const roles = input.roles ?? {};
  const noms  = input.noms ?? {};

  // Couplé : seuls les chevaux encore sélectionnés comptent, 2 au plus, dans
  // l'ordre de mérite de la sélection (pas dans l'ordre des clics).
  const coupleSaisi = Array.isArray(input.couple) ? input.couple.map(Number) : [];
  const couple: Record<number, boolean> = {};
  let nbCouple = 0;
  for (const n of selection) {
    if (nbCouple < COUPLE_MAX && coupleSaisi.indexOf(n) !== -1 && !couple[n]) {
      couple[n] = true;
      nbCouple++;
    }
  }

  // Un rôle ne compte que s'il porte sur un cheval réellement sélectionné :
  // retirer un cheval de la sélection doit annuler sa qualification. Un couplé
  // désigné suffit aussi à structurer le pronostic.
  let qualifies = 0;
  for (const n of selection) {
    if (roles[n]) qualifies++;
  }
  if (qualifies === 0 && nbCouple === 0) return null;

  const pivot = Number(input.pivot);
  const pivotValide = Number.isFinite(pivot) && selection.indexOf(pivot) !== -1;

  const seen: Record<number, boolean> = {};
  const rows: SelectionDetailRow[] = [];
  for (const n of selection) {
    if (seen[n]) continue;
    seen[n] = true;
    const row: SelectionDetailRow = { number: n, role: roles[n] || ROLE_CHAMP };
    const nom = typeof noms[n] === "string" ? String(noms[n]).trim() : "";
    if (nom) row.name = nom;
    if (pivotValide && n === pivot) row.pivot = true;
    if (couple[n]) row.couple = true;
    rows.push(row);
  }
  return rows;
}
