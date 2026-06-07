/**
 * Source UNIQUE : quelles courses on garde (scraping + affichage).
 *
 * Le programme PMU/Geny du jour contient beaucoup de courses **étrangères**
 * (Hong Kong, Chili, USA, Irlande…) et de **petits hippodromes locaux FR** qui
 * intéressent peu les visiteurs et alourdissent le scraping de cotes.
 *
 * Le champ `hippodromes.pays` est INEXPLOITABLE (tout est étiqueté "France",
 * y compris Sha Tin / Happy Valley / Concepcion…) → on combine :
 *   - une **liste blanche** d'hippodromes vedettes (FR + Maroc) ;
 *   - une **denylist** d'hippodromes étrangers connus ;
 *   - le signal **pari national** (Quinté+/Quarté+/Tiercé) = grande course du jour.
 *
 * Garde-fou : une course AVEC un pronostic publié reste TOUJOURS éligible
 * (on ne cache/zappe jamais une course qu'on a pronostiquée).
 */

/** Normalise un nom d'hippodrome : minuscule, sans accents/espaces/tirets/apostrophes. */
export function normHippodrome(nom: string | null | undefined): string {
  if (!nom) return "";
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents (diacritiques combinants)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");      // espaces, tirets, apostrophes, points…
}

/** Hippodromes vedettes FR + Maroc (stockés normalisés). */
export const HIPPODROMES_PRIORITAIRES: ReadonlySet<string> = new Set(
  [
    // ── France (plat / trot / obstacle vedettes) ──
    "Vincennes", "ParisLongchamp", "Auteuil", "Chantilly", "Saint-Cloud",
    "Deauville", "Maisons-Laffitte", "Cagnes-sur-Mer", "Compiègne", "Vichy",
    "Lyon-Parilly", "Caen", "Enghien", "Marseille-Borély", "Marseille-Vivaux",
    "Strasbourg", "Nantes", "Toulouse", "Le Croisé-Laroche", "Laval", "Pau",
    "Bordeaux-Le Bouscat",
    // ── Maroc (anticipé — aucune course en base à ce jour) ──
    "Casablanca-Anfa", "Casablanca", "Anfa", "Rabat",
  ].map(normHippodrome),
);

export function isHippodromePrioritaire(nom: string | null | undefined): boolean {
  return HIPPODROMES_PRIORITAIRES.has(normHippodrome(nom));
}

/** Hippodromes étrangers à EXCLURE même s'ils proposent un pari national PMU
 *  (PMU vend parfois du Quinté+ sur de l'international). Principaux connus. */
export const HIPPODROMES_ETRANGERS: ReadonlySet<string> = new Set(
  [
    "Sha Tin", "Happy Valley",                                   // Hong Kong
    "Meydan", "Jebel Ali",                                       // Émirats
    "Concepcion", "Santiago", "Valparaiso",                      // Chili
    "Churchill Downs", "Gulfstream", "Santa Anita", "Aqueduct", "Belmont", "Woodbine", // USA / Canada
    "Curragh", "Leopardstown", "Dundalk",                        // Irlande
    "Wolvega", "Kenilworth", "Greyville",                        // Pays-Bas / Afrique du Sud
  ].map(normHippodrome),
);

export function isHippodromeEtranger(nom: string | null | undefined): boolean {
  return HIPPODROMES_ETRANGERS.has(normHippodrome(nom));
}

/** Paris « nationaux » PMU : marquent la (les) grande(s) course(s) du jour. */
export const PARIS_NATIONAUX = ["QUINTE_PLUS", "QUARTE_PLUS", "QUARTE", "TIERCE"];

export function hasPariNational(paris: readonly string[] | null | undefined): boolean {
  return Array.isArray(paris) && paris.some((p) => PARIS_NATIONAUX.includes(p));
}

/** Seuil de partants : on garde strictement > 10. */
export const MIN_PARTANTS = 10;

export interface EligibiliteCourse {
  hippodromeNom: string | null | undefined;
  nbPartants: number | null | undefined;
  /** True si la course a un pronostic publié → gardée quoi qu'il arrive. */
  aPronostic?: boolean;
  /** True si la course propose un pari national (Quinté+/Quarté+/Tiercé). */
  aPariNational?: boolean;
}

/**
 * Une course est gardée si, dans l'ordre :
 *   1. elle a un pronostic publié (garde-fou) ;
 *   2. sinon, hippodrome étranger (HK, Chili…) → EXCLUE ;
 *   3. sinon, pari national (Quinté+/Quarté+/Tiercé) sur piste FR/Maroc → gardée
 *      (la grande course du jour, même hors liste vedette) ;
 *   4. sinon, hippodrome vedette ET > 10 partants → gardée.
 */
export function isCourseEligible(c: EligibiliteCourse): boolean {
  if (c.aPronostic) return true;
  if (isHippodromeEtranger(c.hippodromeNom)) return false;
  if (c.aPariNational) return true;
  return isHippodromePrioritaire(c.hippodromeNom) && (c.nbPartants ?? 0) > MIN_PARTANTS;
}
