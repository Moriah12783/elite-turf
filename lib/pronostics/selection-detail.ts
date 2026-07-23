/**
 * lib/pronostics/selection-detail.ts
 *
 * Construit la valeur écrite dans `pronostics.selection_detail` depuis ce que
 * l'expert a qualifié dans l'admin.
 *
 * DEUX INVARIANTS, tous deux imposés par les consommateurs publics :
 *
 *  1. TOUT OU RIEN. Sur la fiche détail, la hiérarchie REMPLACE la liste par
 *     mérite. Un cheval de `selection` absent de `selection_detail` disparaîtrait
 *     de la page. Donc : soit on n'écrit rien (null → affichage actuel intact),
 *     soit on écrit une ligne pour CHAQUE cheval de la sélection.
 *  2. L'ORDRE DE MÉRITE est celui de `selection`, jamais celui des clics.
 *
 * Le champ `name` est OMIS quand on ne connaît pas le nom : `ProSelectionBlock`
 * fait `horse?.nom_cheval ?? it.name ?? \`Cheval n°X\`` — et `??` ne rattrape pas
 * la chaîne vide, qui afficherait une ligne blanche.
 *
 * PUR (aucune I/O), testé.
 */
import { ROLE_CHAMP } from "./selection-roles";

export interface SelectionDetailRow {
  number: number;
  role:   string;
  name?:  string;
  pivot?: boolean;
}

export interface BuildSelectionDetailInput {
  /** Sélection publiée (ordre de mérite). */
  selection: number[];
  /** Rôle choisi par l'expert, par n° de dossard. Les absents deviennent du champ. */
  roles:     Record<number, string | undefined>;
  /** Le pivot du jeu, s'il a été désigné. */
  pivot?:    number | null;
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
  const out: ParsedSelectionRoles = { roles: {}, pivot: null, noms: {} };
  if (!Array.isArray(raw)) return out;
  for (const it of raw) {
    const o = it as { number?: unknown; role?: unknown; pivot?: unknown; name?: unknown };
    const n = Number(o?.number);
    if (!Number.isFinite(n)) continue;
    const role = String(o?.role ?? "").trim().toUpperCase();
    if (role && role !== ROLE_CHAMP) out.roles[n] = role;
    if (o?.pivot === true && out.pivot === null) out.pivot = n;
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

  // Un rôle ne compte que s'il porte sur un cheval réellement sélectionné :
  // retirer un cheval de la sélection doit annuler sa qualification.
  let qualifies = 0;
  for (const n of selection) {
    if (roles[n]) qualifies++;
  }
  if (qualifies === 0) return null;

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
    rows.push(row);
  }
  return rows;
}
