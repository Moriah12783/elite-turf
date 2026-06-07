/**
 * Source UNIQUE : quelles courses on GARDE (scraping + affichage) et lesquelles
 * on MET EN AVANT.
 *
 * Audience = France + un peu Europe + DOM-TOM/Outre-mer + Maghreb + Afrique
 * francophone. On EXCLUT donc uniquement le **lointain étranger** (Asie,
 * Amériques, Océanie, Afrique non-francophone) qui n'intéresse pas l'audience.
 * **Tout le reste est gardé** (France provinciale + Europe incluses) — important
 * pour le SEO long-tail : chaque course = une page indexable (cf. sitemap.ts).
 *
 * Les hippodromes « vedettes » et les paris nationaux sont **mis en avant**
 * (tri / badge), PAS exclusifs.
 *
 * `hippodromes.pays` étant inexploitable (tout = "France", y compris Sha Tin),
 * on s'appuie sur des listes de noms normalisés.
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

/**
 * Hippodromes LOINTAINS à EXCLURE (hors zone d'intérêt de l'audience).
 * On garde l'Europe (UK, Irlande, Pays-Bas, Scandinavie…) et le Maghreb.
 * On exclut Asie / Golfe / Amériques / Océanie / Afrique non-francophone.
 */
export const HIPPODROMES_LOINTAINS: ReadonlySet<string> = new Set(
  [
    // Hong Kong / Asie / Singapour
    "Sha Tin", "Happy Valley", "Kranji",
    "Tokyo", "Nakayama", "Kyoto", "Hanshin", "Chukyo",
    "Sapporo", "Hakodate", "Niigata", "Fukushima", "Kokura",
    // Golfe
    "Meydan", "Jebel Ali",
    // Amérique du Nord
    "Churchill Downs", "Gulfstream", "Santa Anita", "Aqueduct", "Belmont",
    "Saratoga", "Keeneland", "Del Mar", "Woodbine",
    // Amérique du Sud
    "Concepcion", "Santiago", "Valparaiso", "San Isidro", "Palermo",
    // Océanie (Australie)
    "Kalgoorlie", "Bunbury", "Northam", "Geraldton", "Toowoomba", "Albany",
    "Randwick", "Flemington", "Caulfield", "Rosehill", "Moonee Valley",
    "Eagle Farm", "Doomben",
    // Afrique non-francophone (Afrique du Sud)
    "Kenilworth", "Greyville", "Turffontein", "Durbanville", "Fairview",
    "Vaal", "Scottsville",
  ].map(normHippodrome),
);

export function isHippodromeLointain(nom: string | null | undefined): boolean {
  return HIPPODROMES_LOINTAINS.has(normHippodrome(nom));
}

/** Hippodromes VEDETTES (FR + Maroc) — pour la MISE EN AVANT (tri/badge). */
export const HIPPODROMES_PRIORITAIRES: ReadonlySet<string> = new Set(
  [
    // ── France (plat / trot / obstacle vedettes) ──
    "Vincennes", "ParisLongchamp", "Auteuil", "Chantilly", "Saint-Cloud",
    "Deauville", "Maisons-Laffitte", "Cagnes-sur-Mer", "Compiègne", "Vichy",
    "Lyon-Parilly", "Caen", "Enghien", "Marseille-Borély", "Marseille-Vivaux",
    "Strasbourg", "Nantes", "Toulouse", "Le Croisé-Laroche", "Laval", "Pau",
    "Bordeaux-Le Bouscat",
    // ── Maroc ──
    "Casablanca-Anfa", "Casablanca", "Anfa", "Rabat",
  ].map(normHippodrome),
);

export function isHippodromePrioritaire(nom: string | null | undefined): boolean {
  return HIPPODROMES_PRIORITAIRES.has(normHippodrome(nom));
}

/** Paris « nationaux » PMU : marquent la (les) grande(s) course(s) du jour. */
export const PARIS_NATIONAUX = ["QUINTE_PLUS", "QUARTE_PLUS", "QUARTE", "TIERCE"];

export function hasPariNational(paris: readonly string[] | null | undefined): boolean {
  return Array.isArray(paris) && paris.some((p) => PARIS_NATIONAUX.includes(p));
}

export interface EligibiliteCourse {
  hippodromeNom: string | null | undefined;
  /** Conservé pour compat appelants (non utilisé par l'éligibilité actuelle). */
  nbPartants?: number | null;
  /** True si la course a un pronostic publié → gardée quoi qu'il arrive. */
  aPronostic?: boolean;
  /** True si la course propose un pari national (Quinté+/Quarté+/Tiercé). */
  aPariNational?: boolean;
}

/**
 * GARDÉE (scraping + affichage) si :
 *   - elle a un pronostic publié (garde-fou), OU
 *   - son hippodrome n'est PAS lointain (France, Europe, Maghreb, DOM-TOM…).
 * → on n'exclut QUE le lointain étranger.
 */
export function isCourseEligible(c: EligibiliteCourse): boolean {
  return c.aPronostic === true || !isHippodromeLointain(c.hippodromeNom);
}

/**
 * MISE EN AVANT (tri en tête / badge) — pas un filtre :
 *   hippodrome vedette OU course à pari national (la grande course du jour).
 */
export function isCourseVedette(c: EligibiliteCourse): boolean {
  return isHippodromePrioritaire(c.hippodromeNom) || c.aPariNational === true;
}
