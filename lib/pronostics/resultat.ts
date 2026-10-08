/**
 * lib/pronostics/resultat.ts
 *
 * Notation d'un pronostic contre l'arrivée officielle : GAGNANT / PARTIEL /
 * PERDANT. Source de vérité UNIQUE — ce chiffre est le bilan public du site.
 *
 * POURQUOI CE MODULE EXISTE
 * -------------------------
 * La règle était recopiée dans quatre routes (`sync-resultats`,
 * `backfill-resultats`, `rapport-journalier`, `rapport-journalier/envoyer`) et
 * les copies avaient divergé — celle de `envoyer` avait même perdu sa branche
 * Tiercé. Les quatre portaient le même défaut :
 *
 *     if (tp.includes("quinté") || n >= 5) topN = 5;   // ← accent
 *
 * La comparaison portait sur des libellés ACCENTUÉS alors que la base stocke
 * « QUINTE_PLUS », « QUARTE », « TIERCE » — SANS accent. Ces branches ne se
 * déclenchaient donc jamais : la fenêtre de comparaison était décidée par la
 * seule taille de la sélection, et un Tiercé de 8 chevaux était jugé comme un
 * Quinté+ (top 5 au lieu du podium). Audit du 28/07/2026 : 27 résultats
 * publiés sur 249 étaient faux de ce seul fait.
 *
 * PUR (aucune I/O), testé.
 */

import { groupesArrivee } from "../courses/rangs";

export type ResultatPronostic = "GAGNANT" | "PARTIEL" | "PERDANT";

/** Majuscules sans accents ni séparateurs : « Quinté+ » → « QUINTE ». */
function signature(valeur: string | null | undefined): string {
  return String(valeur == null ? "" : valeur)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

/**
 * Nombre de places de l'arrivée à considérer.
 *
 * Le TYPE DE PARI décide : un Tiercé se juge sur le podium, un Quarté sur les
 * quatre premiers, un Quinté+ sur les cinq. La taille de la sélection n'est
 * qu'un filet de secours pour les enregistrements dont le type est absent ou
 * inconnu (anciens imports, paris simples).
 */
export function fenetreComparaison(
  typePari: string | null | undefined,
  tailleSelection: number,
): number {
  const tp = signature(typePari);
  if (tp.indexOf("QUINTE") !== -1) return 5;
  if (tp.indexOf("QUARTE") !== -1) return 4;
  if (tp.indexOf("TIERCE") !== -1) return 3;
  if (tp.indexOf("TRIO") !== -1) return 3;      // trois premiers, ordre indifférent

  // SIMPLE et COUPLÉ restent sur le filet ci-dessous : leur fenêtre exacte
  // (1 place pour un Simple gagnant, 2 pour un Couplé) est une DÉCISION MÉTIER
  // non tranchée, et aucun pronostic de ce type n'existe en base au 28/07/2026.
  // Le jour où le formulaire admin en produira, il faudra choisir explicitement
  // plutôt que laisser la taille de la sélection décider.
  if (tailleSelection >= 5) return 5;
  if (tailleSelection >= 4) return 4;
  return 3;
}

/**
 * Note un pronostic.
 *
 * GAGNANT = la sélection couvre TOUT ce qu'elle pouvait couvrir de la fenêtre.
 * Concrètement, les `topN` premiers de l'arrivée sont tous dans la sélection.
 * Quand la sélection compte moins de chevaux que la fenêtre (un Simple de deux
 * chevaux jugé sur le podium), la cible est la taille de la sélection : on ne
 * peut pas exiger cinq chevaux trouvés à qui n'en a joué que quatre.
 *
 * ⚠️ « GAGNANT » ne signifie donc PAS « les cinq premiers dans l'ordre ».
 * C'est un critère de champ réduit, et toute communication publique de ce
 * taux doit l'énoncer — sans quoi le chiffre est trompeur.
 *
 * EX ÆQUO (`rangs`, cf. lib/courses/rangs) : on suit la règle de paiement du
 * PMU. Prix de Versailles (08/10/2026), 15 et 16 ex æquo 5es : le PMU paie
 * 1-5-8-4-15 et 1-5-8-4-16. Un cheval ex æquo à la limite compte donc dans la
 * fenêtre, mais un groupe d'ex æquo ne remplit jamais plus de places qu'il
 * n'en reste : jouer 15 ET 16 sans le 4 fait 4 trouvés, pas 5. Sans rangs
 * (ordre strict, historique), chaque cheval est seul à son rang : la règle se
 * réduit exactement à l'ancienne.
 */
export function calculerResultat(
  selection: number[] | null | undefined,
  arrivee: number[] | null | undefined,
  typePari: string | null | undefined,
  rangs?: number[] | null,
): ResultatPronostic {
  const arr = Array.isArray(arrivee) ? arrivee : [];

  // Une sélection saisie deux fois ne doit pas gonfler le score : on la réduit
  // aux chevaux réellement distincts avant tout comptage.
  const distincts: number[] = [];
  const vus: Record<number, boolean> = {};
  const brute = Array.isArray(selection) ? selection : [];
  for (let i = 0; i < brute.length; i++) {
    const c = brute[i];
    if (!vus[c]) { vus[c] = true; distincts.push(c); }
  }

  const n = distincts.length;
  if (n === 0 || arr.length === 0) return "PERDANT";

  const topN = fenetreComparaison(typePari, n);

  // Rang par rang : chaque groupe (un cheval, ou plusieurs ex æquo) apporte
  // ses chevaux joués, dans la limite des places qu'il occupe dans la fenêtre.
  // Un numéro répété dans une arrivée corrompue ne compte qu'une fois.
  let trouves = 0;
  const comptes: Record<number, boolean> = {};
  const groupes = groupesArrivee(arr, rangs);
  for (let g = 0; g < groupes.length && groupes[g].rang <= topN; g++) {
    const places = Math.min(groupes[g].numeros.length, topN - groupes[g].rang + 1);
    let joues = 0;
    for (const numero of groupes[g].numeros) {
      if (vus[numero] && !comptes[numero]) { comptes[numero] = true; joues++; }
    }
    trouves += Math.min(places, joues);
  }

  const cible = n < topN ? n : topN;
  if (trouves === cible) return "GAGNANT";

  // Seuil du PARTIEL : trois chevaux sur les fenêtres larges, DEUX sur le podium.
  //
  // L'ancien seuil du podium était de 1. Il avait un sens tant que la fenêtre
  // suivait la taille de la sélection : elle ne valait 3 que pour des sélections
  // d'au plus 3 chevaux, et trouver 1 cheval du podium avec 3 tickets voulait
  // dire quelque chose. Depuis que la fenêtre vient du type de pari, un Tiercé
  // joué à 8 chevaux passe par cette branche : 1 cheval trouvé sur 8 joués
  // devenait un « partiel », ce qui vide le mot de son sens.
  // Décision du porteur (28/07/2026) : remonter à 2, ce que l'en-tête de
  // sync-resultats documentait déjà — « Tiercé : 2/3 = PARTIEL, <2 = PERDANT ».
  const seuilPartiel = topN >= 4 ? 3 : 2;
  if (trouves >= seuilPartiel) return "PARTIEL";
  return "PERDANT";
}
