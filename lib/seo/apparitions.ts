/**
 * lib/seo/apparitions.ts
 *
 * Une même course peut exister deux fois dans `courses` (une ligne par source,
 * cf. lib/courses/arrivees-group.ts) : « Casablanca R3C4 » terminée et
 * « Anfa R9C4 » restée au programme, avec les mêmes partants. Mesure du
 * 09/10/2026 : 1 817 couples cheval × jour en double, dont 1 806 avec le même
 * dossard (11 dossards différents = homonymes probables, gardés).
 *
 * Règle commune aux stats (ETL, fiches, blog) : une seule apparition par
 * cheval, jour et dossard — la ligne la plus complète (terminée avec arrivée,
 * puis course mise à jour en dernier).
 *
 * Pur, sans I/O.
 */

export interface ReperesApparition {
  course_id:   string;
  numero:      number;
  date_course: string;
  /** cleCheval(nom_cheval) ; vide = jamais fusionné. */
  cheval_cle:  string;
  /** courses.statut === "TERMINE" */
  termine:     boolean;
  /** arrivée officielle enregistrée (liste non vide) */
  a_arrivee:   boolean;
  /** courses.updated_at */
  maj:         string | null;
}

function score(r: ReperesApparition): number {
  return r.termine && r.a_arrivee ? 2 : r.termine ? 1 : 0;
}

/** true si `a` doit remplacer `b`. */
function meilleure(a: ReperesApparition, b: ReperesApparition): boolean {
  if (score(a) !== score(b)) return score(a) > score(b);
  const ma = a.maj ?? "", mb = b.maj ?? "";
  if (ma !== mb) return ma > mb;
  return a.course_id < b.course_id;
}

export function dedoublonnerApparitions<T>(
  rows: readonly T[],
  reperes: (r: T) => ReperesApparition,
): T[] {
  const retenue = new Map<string, number>(); // clé → index de la ligne retenue
  const garder = new Array<boolean>(rows.length).fill(true);
  rows.forEach((row, i) => {
    const r = reperes(row);
    if (!r.cheval_cle) return;
    const cle = `${r.date_course}|${r.cheval_cle}|${r.numero}`;
    const j = retenue.get(cle);
    if (j === undefined) { retenue.set(cle, i); return; }
    if (meilleure(r, reperes(rows[j]))) {
      garder[j] = false;
      retenue.set(cle, i);
    } else {
      garder[i] = false;
    }
  });
  return rows.filter((_, i) => garder[i]);
}
