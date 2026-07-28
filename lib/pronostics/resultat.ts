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
 */
export function calculerResultat(
  selection: number[] | null | undefined,
  arrivee: number[] | null | undefined,
  typePari: string | null | undefined,
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

  const dansLeTop: Record<number, boolean> = {};
  const tete = arr.slice(0, topN);
  for (let i = 0; i < tete.length; i++) dansLeTop[tete[i]] = true;

  let trouves = 0;
  for (let i = 0; i < n; i++) if (dansLeTop[distincts[i]]) trouves++;

  const cible = n < topN ? n : topN;
  if (trouves === cible) return "GAGNANT";

  // Seuil du PARTIEL : trois chevaux sur les fenêtres larges, un seul sur le
  // podium — seuils historiques, inchangés par la correction de la fenêtre.
  const seuilPartiel = topN >= 4 ? 3 : 1;
  if (trouves >= seuilPartiel) return "PARTIEL";
  return "PERDANT";
}
