/**
 * lib/sync/hippodrome-cle.ts
 *
 * Clé d'identité d'un hippodrome, utilisée pour RETROUVER une fiche existante
 * avant d'en créer une nouvelle.
 *
 * POURQUOI CE MODULE EXISTE
 * -------------------------
 * `canonicalHippodrome` (voisin) neutralise déjà casse, accents, séparateurs
 * et entités HTML. Ça ne suffisait pas : les 3 et 4 août 2026, quatre
 * hippodromes fantômes ont été créés et ont dupliqué 51 courses.
 *
 *   « Aix-les-Bains [Matinée] »   ≠ « Aix-les-Bains »      → suffixe de source
 *   « Deauville-Clairefontaine »  ≠ « Clairefontaine-Deauville » → ordre inversé
 *
 * Conséquences en cascade : la clé (date, R, C) devenait ambiguë, le résolveur
 * refusait de trancher (à raison), les brouillons consensus restaient
 * orphelins — badge « Course à rattacher » — et les colonnes Stats/Signal de
 * l'atelier se vidaient, faute de course liée d'où tirer les partants.
 *
 * CE QUE CETTE CLÉ TRANCHE, ET CE QU'ELLE NE TRANCHE PAS
 * ------------------------------------------------------
 * Elle règle le MÉCANIQUE : graphie, ponctuation, suffixe entre crochets,
 * ordre des mots.
 *
 * Elle ne règle PAS le métier, et ne doit pas essayer : « Deauville-La
 * Touques » est le même hippodrome que « Deauville », mais
 * « Deauville-Clairefontaine » est un AUTRE champ de courses, à deux
 * kilomètres. Aucune règle syntaxique ne distingue ces deux cas — une
 * comparaison par inclusion les confondrait et fusionnerait à tort.
 *
 * D'où la table d'alias ci-dessous : courte, explicite, relue par un humain.
 * Ce qui n'y figure pas et que la syntaxe ne rapproche pas crée une nouvelle
 * fiche — visible, corrigeable — plutôt qu'un rapprochement deviné.
 *
 * PUR, ES5-safe (aucune itération de Map/Set), testé.
 */

import { canonicalHippodrome, decodeEntities } from "./hippodrome-canonical";

/**
 * Rapprochements que seule la connaissance du terrain permet.
 * Clés ET valeurs sont des clés DÉJÀ normalisées (mots triés, sans suffixe).
 *
 * Pour ajouter une entrée : calculer `cleHippodrome("Nom de la source")` et
 * `cleHippodrome("Nom de référence en base")`, puis mapper l'une vers l'autre.
 */
export const ALIAS_HIPPODROME: Record<string, string> = {
  // « Deauville-La Touques » EST l'hippodrome de Deauville (piste de plat).
  deauvillelatouques: "deauville",
  // Graphie courte apparue le 12/07/2026, doublait 20 courses.
  chatelaillon: "chatelaillonlarochelle",
};

/**
 * Découpe en mots normalisés, sans les segments entre crochets.
 *
 * Les crochets portent une précision de RÉUNION (« [Matinée] »), pas de lieu :
 * les retirer est ce qui empêche un même hippodrome d'exister deux fois selon
 * l'heure de la réunion.
 */
function mots(nom: string): string[] {
  // ⚠️ Décoder AVANT de découper : sinon « d&#039;Angers » se scinde sur le
  // « & » et le « ; », et ne donne pas les mêmes mots que « d'Angers ».
  const decode = decodeEntities(String(nom == null ? "" : nom));
  const sansCrochets = decode.replace(/\[[^\]]*\]/g, " ");
  const bruts = sansCrochets.split(/[^0-9A-Za-zÀ-ÿ]+/);
  const sortie: string[] = [];
  for (let i = 0; i < bruts.length; i++) {
    const m = canonicalHippodrome(bruts[i]);
    if (m) sortie.push(m);
  }
  return sortie;
}

/**
 * Clé d'identité. Deux noms qui la partagent désignent le même hippodrome.
 *
 * Les mots sont TRIÉS : c'est ce qui rend la clé indifférente à l'ordre, et
 * donc « Deauville-Clairefontaine » égal à « Clairefontaine-Deauville ».
 */
export function cleHippodrome(nom: string): string {
  const brute = mots(nom).sort().join("");
  if (!brute) return "";
  const alias = ALIAS_HIPPODROME[brute];
  return alias === undefined ? brute : alias;
}
