/**
 * lib/courses/resolve-course.ts
 *
 * Résolution d'UNE course à partir de (date, réunion, course).
 *
 * POURQUOI CE MODULE EXISTE
 * -------------------------
 * `(date_course, numero_reunion, numero_course)` **n'identifie pas une course**.
 * Vérifié le 28/07/2026 : 429 clés ambiguës portant 991 courses. Deux réunions
 * de province réellement distinctes peuvent porter le même numéro le même jour
 * (Karukéra et Avignon toutes deux en « R8 » le 26/07 ; Graignes, Agen,
 * Carpentras, Rambouillet, Reims… sont concernés). Ce n'est pas un problème de
 * doublon d'hippodrome — ceux-là ont été fusionnés — mais une divergence de
 * numérotation entre nos sources et PMU.
 *
 * Deux comportements dangereux existaient :
 *   - `.limit(1)` → une course prise AU HASARD parmi les candidates, donc un
 *     rattachement silencieux à la mauvaise course (ingest consensus) ;
 *   - `.maybeSingle()` → erreur générique remontée en 502 (passerelle ETPE).
 *
 * Règle retenue : on ne devine JAMAIS. Sans certitude, on renvoie `AMBIGUE` et
 * l'appelant traite le cas explicitement (rattachement manuel, statut dédié).
 *
 * PUR (aucune I/O), testé.
 */

export interface CourseCandidate {
  id:              string;
  hippodrome_nom?: string | null;
}

export type ResolutionCourse =
  | { statut: "TROUVEE";  course: CourseCandidate }
  | { statut: "ABSENTE" }
  | { statut: "AMBIGUE"; candidats: CourseCandidate[] };

/**
 * Signature comparable d'un nom d'hippodrome : sans accents, sans séparateurs,
 * en majuscules. « Châtelaillon-La Rochelle » et « chatelaillon la rochelle »
 * donnent la même signature.
 */
export function signatureHippodrome(nom: string | null | undefined): string {
  return String(nom == null ? "" : nom)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Deux noms désignent-ils le même hippodrome ? On accepte l'inclusion dans un
 * sens ou l'autre : « Deauville » ⊂ « Deauville-La Touques ». Un seuil de
 * longueur évite qu'un fragment trop court ne fasse correspondre n'importe quoi.
 */
export function memeHippodrome(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = signatureHippodrome(a);
  const y = signatureHippodrome(b);
  if (x.length < 4 || y.length < 4) return false;
  return x === y || x.indexOf(y) !== -1 || y.indexOf(x) !== -1;
}

/**
 * Choisit LA course parmi les candidates d'une même clé (date, R, C).
 *
 * `indiceHippodrome` est le nom d'hippodrome connu de l'appelant (présent dans
 * la charge utile du consensus, par exemple). Il ne sert QU'À DÉPARTAGER :
 * s'il ne désigne qu'une seule candidate, celle-ci gagne ; s'il n'en désigne
 * aucune ou plusieurs, on reste sur `AMBIGUE` plutôt que de choisir.
 */
export function resoudreCourseUnique(
  candidats: CourseCandidate[] | null | undefined,
  indiceHippodrome?: string | null,
): ResolutionCourse {
  const liste = Array.isArray(candidats) ? candidats.filter((c) => c && c.id) : [];

  if (liste.length === 0) return { statut: "ABSENTE" };
  if (liste.length === 1) return { statut: "TROUVEE", course: liste[0] };

  if (indiceHippodrome) {
    const compatibles = liste.filter((c) => memeHippodrome(c.hippodrome_nom, indiceHippodrome));
    if (compatibles.length === 1) return { statut: "TROUVEE", course: compatibles[0] };
  }

  return { statut: "AMBIGUE", candidats: liste };
}
