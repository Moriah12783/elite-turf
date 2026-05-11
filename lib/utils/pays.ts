/**
 * lib/utils/pays.ts
 *
 * Source unique pour la liste des pays Elite Turf + leurs indicatifs
 * téléphoniques internationaux (E.164).
 *
 * Avant : la liste était dupliquée dans `inscription/page.tsx` (22 pays
 * avec indicatifs) et `ProfileEditForm.tsx` (16 noms sans indicatifs).
 * Difficile de maintenir cohérence quand on ajoute/retire un pays.
 *
 * Ordre : Afrique francophone d'abord (cibles principales Elite Turf),
 * puis Europe/Amérique, puis "Autre" en dernier.
 *
 * Usage :
 *   import { PAYS_OPTIONS, INDICATIF_BY_PAYS, estPrefixSeul, getPaysNoms } from "@/lib/utils/pays";
 */

export interface PaysOption {
  /** Nom affiché dans le select (ex: "Côte d'Ivoire") */
  nom:        string;
  /** Indicatif téléphonique E.164 avec le + (ex: "+225"). Vide pour "Autre". */
  indicatif:  string;
}

/**
 * Liste complète des pays supportés par Elite Turf.
 * Source of truth — toute UI qui affiche un select de pays DOIT importer d'ici.
 */
export const PAYS_OPTIONS: PaysOption[] = [
  // ── Afrique francophone (cible principale) ────────────────────────────
  { nom: "Côte d'Ivoire",        indicatif: "+225" },
  { nom: "Sénégal",              indicatif: "+221" },
  { nom: "Cameroun",             indicatif: "+237" },
  { nom: "Burkina Faso",         indicatif: "+226" },
  { nom: "Mali",                 indicatif: "+223" },
  { nom: "Bénin",                indicatif: "+229" },
  { nom: "Togo",                 indicatif: "+228" },
  { nom: "Guinée",               indicatif: "+224" },
  { nom: "Guinée-Bissau",        indicatif: "+245" },
  { nom: "Niger",                indicatif: "+227" },
  { nom: "Tchad",                indicatif: "+235" },
  { nom: "Congo Brazzaville",    indicatif: "+242" },
  { nom: "RD Congo",             indicatif: "+243" },
  { nom: "Gabon",                indicatif: "+241" },
  { nom: "Centrafrique",         indicatif: "+236" },
  { nom: "Madagascar",           indicatif: "+261" },

  // ── Maghreb ───────────────────────────────────────────────────────────
  { nom: "Maroc",                indicatif: "+212" },
  { nom: "Tunisie",              indicatif: "+216" },

  // ── DROM/COM ──────────────────────────────────────────────────────────
  { nom: "La Réunion",           indicatif: "+262" },

  // ── Europe + Amérique du Nord (diaspora) ──────────────────────────────
  { nom: "France",               indicatif: "+33"  },
  { nom: "Belgique",             indicatif: "+32"  },
  { nom: "Canada",               indicatif: "+1"   },

  // ── Fallback ──────────────────────────────────────────────────────────
  { nom: "Autre",                indicatif: ""     },
];

/**
 * Map pays → indicatif pour lookup O(1).
 * Dérivée de PAYS_OPTIONS pour rester synchro automatiquement.
 */
export const INDICATIF_BY_PAYS: Record<string, string> = Object.fromEntries(
  PAYS_OPTIONS.map((p) => [p.nom, p.indicatif]),
);

/**
 * Liste des noms de pays uniquement (sans indicatifs).
 * Utilisée par les UI qui ne gèrent pas le téléphone (ex: édition de profil
 * où on change juste le pays affiché).
 */
export function getPaysNoms(): string[] {
  return PAYS_OPTIONS.map((p) => p.nom);
}

/**
 * Vérifie si la valeur actuelle d'un téléphone est "juste un préfixe vide"
 * (ex: "+225", "+225 ", "+33"). Utilisé par l'UX d'inscription : si oui, on
 * peut le remplacer en changeant de pays ; sinon on respecte la saisie user.
 */
export function estPrefixSeul(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) return true;
  return /^\+\d{1,4}\s*$/.test(trimmed);
}
