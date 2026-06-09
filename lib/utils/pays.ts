/**
 * lib/utils/pays.ts
 *
 * Source unique pour la liste des pays Elite Turf + leurs indicatifs
 * téléphoniques internationaux (E.164).
 *
 * Toute UI qui affiche un select de pays DOIT importer d'ici
 * (inscription, édition de profil…) pour rester cohérente.
 *
 * Ordre : Afrique francophone d'abord (cibles principales Elite Turf), puis
 * reste de l'Afrique, Maghreb, DROM/COM, Europe, Amériques, Moyen-Orient,
 * Asie/Océanie, et "Autre" en dernier (filet).
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
 * Liste des pays supportés par Elite Turf (source of truth).
 * Couverture large pour limiter les inscriptions en "Autre" : toute l'Afrique,
 * toute l'Europe, les Amériques et les principaux pays de diaspora.
 */
export const PAYS_OPTIONS: PaysOption[] = [
  // ── Afrique francophone (cible principale, en tête) ───────────────────
  { nom: "Côte d'Ivoire",            indicatif: "+225" },
  { nom: "Sénégal",                  indicatif: "+221" },
  { nom: "Cameroun",                 indicatif: "+237" },
  { nom: "Burkina Faso",             indicatif: "+226" },
  { nom: "Mali",                     indicatif: "+223" },
  { nom: "Bénin",                    indicatif: "+229" },
  { nom: "Togo",                     indicatif: "+228" },
  { nom: "Guinée",                   indicatif: "+224" },
  { nom: "Guinée-Bissau",            indicatif: "+245" },
  { nom: "Niger",                    indicatif: "+227" },
  { nom: "Tchad",                    indicatif: "+235" },
  { nom: "Congo Brazzaville",        indicatif: "+242" },
  { nom: "RD Congo",                 indicatif: "+243" },
  { nom: "Gabon",                    indicatif: "+241" },
  { nom: "Centrafrique",             indicatif: "+236" },
  { nom: "Madagascar",               indicatif: "+261" },
  { nom: "Mauritanie",               indicatif: "+222" },
  { nom: "Djibouti",                 indicatif: "+253" },
  { nom: "Comores",                  indicatif: "+269" },
  { nom: "Burundi",                  indicatif: "+257" },
  { nom: "Rwanda",                   indicatif: "+250" },

  // ── Maghreb ───────────────────────────────────────────────────────────
  { nom: "Maroc",                    indicatif: "+212" },
  { nom: "Algérie",                  indicatif: "+213" },
  { nom: "Tunisie",                  indicatif: "+216" },

  // ── DROM / COM ────────────────────────────────────────────────────────
  { nom: "La Réunion",               indicatif: "+262" },
  { nom: "Guadeloupe",               indicatif: "+590" },
  { nom: "Martinique",               indicatif: "+596" },
  { nom: "Guyane",                   indicatif: "+594" },
  { nom: "Mayotte",                  indicatif: "+262" },
  { nom: "Nouvelle-Calédonie",       indicatif: "+687" },
  { nom: "Polynésie française",      indicatif: "+689" },

  // ── Reste de l'Afrique ────────────────────────────────────────────────
  { nom: "Nigéria",                  indicatif: "+234" },
  { nom: "Ghana",                    indicatif: "+233" },
  { nom: "Afrique du Sud",           indicatif: "+27"  },
  { nom: "Kenya",                    indicatif: "+254" },
  { nom: "Tanzanie",                 indicatif: "+255" },
  { nom: "Ouganda",                  indicatif: "+256" },
  { nom: "Éthiopie",                 indicatif: "+251" },
  { nom: "Angola",                   indicatif: "+244" },
  { nom: "Mozambique",               indicatif: "+258" },
  { nom: "Zambie",                   indicatif: "+260" },
  { nom: "Zimbabwe",                 indicatif: "+263" },
  { nom: "Botswana",                 indicatif: "+267" },
  { nom: "Namibie",                  indicatif: "+264" },
  { nom: "Liberia",                  indicatif: "+231" },
  { nom: "Sierra Leone",             indicatif: "+232" },
  { nom: "Gambie",                   indicatif: "+220" },
  { nom: "Cap-Vert",                 indicatif: "+238" },
  { nom: "Guinée équatoriale",       indicatif: "+240" },
  { nom: "Égypte",                   indicatif: "+20"  },
  { nom: "Libye",                    indicatif: "+218" },

  // ── Europe ────────────────────────────────────────────────────────────
  { nom: "France",                   indicatif: "+33"  },
  { nom: "Belgique",                 indicatif: "+32"  },
  { nom: "Suisse",                   indicatif: "+41"  },
  { nom: "Luxembourg",               indicatif: "+352" },
  { nom: "Allemagne",                indicatif: "+49"  },
  { nom: "Royaume-Uni",              indicatif: "+44"  },
  { nom: "Irlande",                  indicatif: "+353" },
  { nom: "Pays-Bas",                 indicatif: "+31"  },
  { nom: "Espagne",                  indicatif: "+34"  },
  { nom: "Portugal",                 indicatif: "+351" },
  { nom: "Italie",                   indicatif: "+39"  },
  { nom: "Autriche",                 indicatif: "+43"  },
  { nom: "Suède",                    indicatif: "+46"  },
  { nom: "Norvège",                  indicatif: "+47"  },
  { nom: "Danemark",                 indicatif: "+45"  },
  { nom: "Finlande",                 indicatif: "+358" },
  { nom: "Pologne",                  indicatif: "+48"  },
  { nom: "Hongrie",                  indicatif: "+36"  },
  { nom: "Roumanie",                 indicatif: "+40"  },
  { nom: "Bulgarie",                 indicatif: "+359" },
  { nom: "Grèce",                    indicatif: "+30"  },
  { nom: "République tchèque",       indicatif: "+420" },
  { nom: "Ukraine",                  indicatif: "+380" },
  { nom: "Turquie",                  indicatif: "+90"  },

  // ── Amériques ─────────────────────────────────────────────────────────
  { nom: "Canada",                   indicatif: "+1"   },
  { nom: "États-Unis",               indicatif: "+1"   },
  { nom: "Haïti",                    indicatif: "+509" },
  { nom: "Brésil",                   indicatif: "+55"  },

  // ── Moyen-Orient / Golfe (diaspora travailleurs) ──────────────────────
  { nom: "Émirats arabes unis",      indicatif: "+971" },
  { nom: "Arabie saoudite",          indicatif: "+966" },
  { nom: "Qatar",                    indicatif: "+974" },
  { nom: "Liban",                    indicatif: "+961" },

  // ── Asie / Océanie ────────────────────────────────────────────────────
  { nom: "Chine",                    indicatif: "+86"  },
  { nom: "Inde",                     indicatif: "+91"  },
  { nom: "Australie",                indicatif: "+61"  },

  // ── Fallback ──────────────────────────────────────────────────────────
  { nom: "Autre",                    indicatif: ""     },
];

/**
 * Map pays → indicatif pour lookup O(1).
 * Dérivée de PAYS_OPTIONS pour rester synchro automatiquement.
 * (NB : si 2 pays partagent un indicatif, ex. Canada/États-Unis en +1, la
 * dernière entrée gagne — sans impact, on ne fait que pré-remplir le préfixe.)
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
