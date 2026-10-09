/**
 * lib/seo/cles-acteurs.ts
 *
 * Identité des chevaux, jockeys et entraîneurs à travers les graphies des
 * sources. `partants` garde le nom brut de chaque source : Geny (casse mixte,
 * accents, poids parfois collé au jockey, glyphe d'icône en fin de nom de
 * cheval jusqu'au 04/10/2026), format PMU relayé par LONACI (MAJUSCULES sans
 * accents, initiales compactées « PC.BOUDOT », entraîneur suffixé « (S) »),
 * saisie admin (chevaux en majuscules). Mesure du 09/10/2026 : 15 419 chevaux,
 * 1 119 jockeys et 1 151 entraîneurs écrits de plusieurs façons.
 *
 * - Clé d'un cheval = son slug (déjà l'identité publique /chevaux/<slug>).
 * - Clé d'une personne = slug sans tirets (initiales compactées ou non), sans
 *   poids ni « (S) ». « (S) » est un statut PMU des entraîneurs de galop : il
 *   apparaît en cours d'année pour un même entraîneur et Geny écrit les mêmes
 *   personnes sans. « (T) »/« (G) » (Geny) séparent au contraire des homonymes
 *   (« B. Lefèvre (G) » monte en obstacle, « B. Lefèvre (T) » drive au trot) :
 *   on les garde.
 *
 * ⚠️ Miroir SQL : `public.slug_acteur` et `public.cle_personne`
 * (supabase/migrations/20261009_cles_acteurs.sql) calculent les mêmes clés
 * dans les colonnes générées `partants.cheval_cle/jockey_cle/entraineur_cle`.
 * Toute modification ici doit être reportée là (et inversement).
 *
 * Pur, sans I/O.
 */

import { slugify } from "@/lib/seo/slugs";
import type { EntiteType } from "@/lib/seo/acteurs";

/** Glyphes d'icônes (zone à usage privé Unicode) collés par Geny. */
const GLYPHES_PRIVES = /[-]/g;
/** Poids collé au jockey par Geny : « C. Demuro 57,5 ». */
const POIDS_FIN = /\s+\d+(?:[.,]\d+)?\s*$/;
/** Statut PMU des entraîneurs de galop : « M.SEROR (S) ». */
const STATUT_PMU = /\s*\(S\)\s*$/;
/** Dernière parenthèse du nom : homonyme « (T) », « (G) », pays… */
const SUFFIXE = /\s*\(([^()]*)\)\s*$/;

export function cleCheval(nom: string | null | undefined): string {
  return slugify(nom);
}

export function clePersonne(nom: string | null | undefined): string {
  if (!nom) return "";
  let base = nom.replace(POIDS_FIN, "").replace(STATUT_PMU, "");
  const m = SUFFIXE.exec(base);
  const suffixe = m ? slugify(m[1]) : "";
  if (m) base = base.slice(0, m.index);
  const coeur = slugify(base).replace(/-/g, "");
  if (!coeur) return "";
  // Le tiret isole le suffixe : « A. Leduc (T) » ≠ « A. Leduct ».
  return suffixe ? `${coeur}-${suffixe}` : coeur;
}

export function cleActeur(type: EntiteType, nom: string | null | undefined): string {
  return type === "chevaux" ? cleCheval(nom) : clePersonne(nom);
}

/** Nom affichable : sans glyphe, poids ni statut PMU. Ne touche jamais à la casse. */
export function nettoyerNomActeur(type: EntiteType, nom: string | null | undefined): string {
  if (!nom) return "";
  let s = nom.replace(GLYPHES_PRIVES, "").replace(/ /g, " ");
  if (type !== "chevaux") s = s.replace(POIDS_FIN, "").replace(STATUT_PMU, "");
  return s.replace(/\s+/g, " ").trim();
}

/** Casse mixte = au moins une majuscule ET une minuscule (« Stan Le Grand »). */
function casseMixte(s: string): boolean {
  return /\p{Lu}/u.test(s) && /\p{Ll}/u.test(s);
}

/**
 * Graphie affichée d'un acteur (décision D1 de Steph, 09/10/2026) : la casse
 * mixte d'abord (forme presse, avec ses accents), la plus fréquente ; à défaut,
 * la graphie de la source telle quelle — jamais de casse recalculée (« IZIO
 * D'ECHAL » ne devient pas « Izio D'echal »). Les graphies identiques une fois
 * nettoyées sont comptées ensemble.
 */
export function choisirGraphie(
  type: EntiteType,
  graphies: Iterable<[string, number]>,
): string {
  const comptes = new Map<string, number>();
  for (const [brut, n] of Array.from(graphies)) {
    const nom = nettoyerNomActeur(type, brut);
    if (nom) comptes.set(nom, (comptes.get(nom) ?? 0) + n);
  }
  let meilleur = "";
  let meilleurRang: [number, number] = [-1, -1];
  for (const [nom, n] of Array.from(comptes.entries())) {
    const rang: [number, number] = [casseMixte(nom) ? 1 : 0, n];
    const mieux = rang[0] !== meilleurRang[0] ? rang[0] > meilleurRang[0]
      : rang[1] !== meilleurRang[1] ? rang[1] > meilleurRang[1]
      // Égalité parfaite : ordre alphabétique, pour un résultat stable d'une nuit à l'autre.
      : nom.localeCompare(meilleur, "fr") < 0;
    if (mieux) { meilleur = nom; meilleurRang = rang; }
  }
  return meilleur;
}
