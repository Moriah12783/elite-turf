/**
 * lib/pronostics/selection-roles.ts
 *
 * Source unique du vocabulaire des rôles stockés dans `pronostics.selection_detail`.
 *
 * DEUX ÉMETTEURS, UN SEUL VOCABULAIRE :
 *  - le pipeline IA pose `RunnerRole` = BASE | APPUI | OUTSIDER | COMPLEMENT
 *    (cf. lib/ai-pronostics/types.ts) ;
 *  - l'expert, dans l'admin, pose les 3 rôles du langage Radar ci-dessous.
 *
 * On réutilise volontairement les valeurs existantes quand elles disent déjà la
 * bonne chose (Base → BASE, Value → OUTSIDER) : les lecteurs publics n'ont rien
 * à réapprendre. Seul « le coup » n'avait pas d'équivalent → COUP.
 *
 * ⚠️ `SelectionDetailItem.role` est typé `RunnerRole | string` : COUP compile
 * sans étendre le type du pipeline, qui reste le vocabulaire de l'IA seule.
 */

/** Rôles formant le SOCLE jouable — affichés en « base ». */
export const ROLES_SOCLE = ["BASE", "APPUI", "COMPLEMENT"];

/** Rôle du pari d'audace, posé à la main par l'expert. */
export const ROLE_COUP = "COUP";

/**
 * Couverture : le cheval fait partie du jeu sans être mis en avant.
 *
 * Indispensable et JAMAIS proposé comme bouton : sur la fiche détail, la
 * hiérarchie REMPLACE la liste par mérite (pronostics/[id]/page.tsx). Un cheval
 * de `selection` absent de `selection_detail` disparaîtrait donc de la page.
 * Tout cheval non qualifié par l'expert reçoit ce rôle → aucun cheval perdu.
 */
export const ROLE_CHAMP = "CHAMP";

export interface RoleChoice {
  /** Identifiant interne (clé de rendu, tests). */
  key:   "base" | "value" | "coup";
  /** Ce que l'expert lit dans l'admin. */
  label: string;
  /** Ce qui part en base dans `selection_detail.role`. */
  role:  string;
  /** Aide courte affichée sous le bouton. */
  hint:  string;
}

/**
 * Les 3 choix proposés à l'expert, dans l'ordre d'un plan de jeu.
 * Un cheval sans rôle reste dans la sélection mais n'apparaît dans aucun tier.
 */
export const ROLE_CHOICES: RoleChoice[] = [
  { key: "base",  label: "Base",  role: "BASE",     hint: "Le socle du jeu" },
  { key: "value", label: "Value", role: "OUTSIDER", hint: "Cote intéressante" },
  { key: "coup",  label: "Coup",  role: ROLE_COUP,  hint: "Le pari d'audace" },
];

/** Retrouve le choix admin correspondant à un rôle stocké (null si rôle IA pur). */
export function roleChoiceOf(role: string | null | undefined): RoleChoice | null {
  const r = String(role ?? "").toUpperCase();
  for (const c of ROLE_CHOICES) {
    if (c.role === r) return c;
  }
  return null;
}
