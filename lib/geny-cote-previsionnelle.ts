/**
 * lib/geny-cote-previsionnelle.ts
 *
 * Conversion "Gains historiques → Cote prévisionnelle" pour les courses J+1.
 *
 * 🎯 Contexte métier (incident 03/06/2026)
 * Pour les courses du LENDEMAIN (J+1), Geny n'a pas encore publié les vraies
 * cotes individuelles. Sa colonne "Dernières cotes" affiche une valeur
 * PLACEHOLDER UNIFORME pour tous les partants d'une même course (ex: 105,2 sur
 * Pontchâteau, 6,2 sur Vincennes, 11,4 sur Cagnes...).
 *
 * Résultat avant ce fix : tous les chevaux affichent la même cote en frontend
 * → totalement trompeur pour les parieurs qui consultent le programme le soir.
 *
 * Décision (option B, 03/06) : remplacer ce placeholder par une cote
 * prévisionnelle calculée depuis les GAINS HISTORIQUES (colonne Geny qui est
 * différenciée par cheval, ex: 16035 € / 18130 € / etc.). C'est une heuristique
 * — "approximative mais utile" — qui sera écrasée par les vraies cotes le matin
 * J (cron enrichir-partants à 9h27 / 11h47 / 13h13 / 15h13).
 *
 * 🧮 Contraintes techniques
 * - DB : `partants.cote = numeric(6,2)` → max 9999.99, min raisonnable ≥ 1.10
 * - JS : retour `number` (avec 2 décimales) ou `null` (si gains insuffisants)
 *
 * 🧪 Données réelles observées sur Pontchâteau J+1 (placeholder Geny: 105,2) :
 *   Mantille Vrie   : 16 035 €
 *   Malice du Gers  : 16 455 €
 *   Macarena        : 18 100 €
 *   Merveille Mika  : 18 130 €
 *
 * Spread relativement étroit (16k–18k) → les 4 chevaux sont d'un niveau
 * comparable. Une formule réaliste produirait des cotes proches (ex: 4–9)
 * sans favori marqué.
 */

/**
 * Calcule une cote prévisionnelle pour un cheval à partir :
 *   - de ses gains historiques (€ cumulés en carrière)
 *   - de la distribution des gains de TOUS les partants de la même course
 *
 * @param gainsCheval        Gains historiques du cheval (en euros), >= 0
 * @param gainsTousPartants  Tableau de TOUS les gains des partants de la course
 *                           (utilisé pour positionner le cheval relativement)
 * @returns Cote prévisionnelle bornée [1.10 .. 99.00], OU null si calcul impossible
 *          (ex: gainsCheval invalide, tableau vide, tous les gains à 0)
 */
export function gainsToProbableCote(
  gainsCheval: number | null | undefined,
  gainsTousPartants: ReadonlyArray<number | null | undefined>,
): number | null {
  // ── Garde-fous d'entrée ────────────────────────────────────────────
  if (gainsCheval == null || !Number.isFinite(gainsCheval) || gainsCheval < 0) {
    return null;
  }
  const valides = gainsTousPartants.filter(
    (g): g is number => typeof g === "number" && Number.isFinite(g) && g >= 0,
  );
  if (valides.length === 0) return null;

  // ── Approche (a) RANG RELATIF — implémentée 03/06/2026 ─────────────
  // Choix : la plus safe en prod (jamais de cote aberrante < 1.5 ou > 99).
  // Logique : on trie tous les gains DESC, on situe le cheval, et on déduit
  // une cote progressive selon sa position.
  //
  // Formule : cote = 2.5 + rang * 1.7
  //   rang 0 (favori) → 2.5
  //   rang 1          → 4.2
  //   rang 2          → 5.9
  //   rang 3          → 7.6
  //   ...
  //   rang 13         → 24.6
  //
  // Tunings : 2.5 (base favori) et 1.7 (palier inter-rang) sont calibrés pour
  // produire des cotes "réalistes" sur un peloton de 8-16 chevaux. À ajuster
  // si retours métier indiquent que les favoris paraissent trop hauts/bas.

  // Si tous les gains sont à 0 (cheval pas encore couru), pas de signal → null
  const tousAZero = valides.every((g) => g === 0);
  if (tousAZero) return null;

  // Tri DESC, indexOf donne le rang (0 = favori)
  const sorted = [...valides].sort((a, b) => b - a);
  const rang = sorted.indexOf(gainsCheval);
  if (rang < 0) return null; // sécurité (ne devrait jamais arriver)

  const cote = 2.5 + rang * 1.7;
  const clamped = Math.max(1.10, Math.min(99.00, cote));
  return Number(clamped.toFixed(2));
}

/**
 * Détecte si une liste de cotes brutes (de Geny) ressemble à un placeholder
 * uniforme — i.e. une valeur identique répétée pour la majorité des partants.
 *
 * Si TRUE → on doit basculer sur la cote prévisionnelle (gainsToProbableCote).
 * Si FALSE → cotes Geny normales, on les garde telles quelles.
 *
 * 🧠 Approche : fréquence du MODE (valeur la plus représentée)
 * Le spread min-max ne suffit pas car Geny peut avoir des outliers :
 *   ex Pontchâteau 04/06/2026 : 12 partants à 105.20 + 1 à 1.10
 *   → spread = 104.10 (trompeur), mais 12/13 = 92% identiques → clairement placeholder
 *
 * Règle : si la valeur la plus fréquente couvre >= 60% des partants ayant une
 * cote, on considère que c'est un placeholder (Geny n'a pas encore les vraies
 * cotes individuelles).
 */
export function detectCotesUniformes(
  cotes: ReadonlyArray<number | null | undefined>,
): boolean {
  const valides = cotes.filter(
    (c): c is number => typeof c === "number" && Number.isFinite(c) && c > 0,
  );
  // < 3 cotes valides → pas assez de matière pour décider, on assume "normal"
  if (valides.length < 3) return false;

  // Compter les occurrences de chaque valeur (arrondi 1 décimale pour absorber
  // les micro-écarts de parsing genre 105.20 vs 105.21).
  const counts = new Map<number, number>();
  for (const c of valides) {
    const k = Math.round(c * 10) / 10;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  // Trouver le mode (valeur la plus fréquente)
  let maxFreq = 0;
  counts.forEach((freq) => {
    if (freq > maxFreq) maxFreq = freq;
  });

  // Si le mode couvre >= 60% des cotes → placeholder Geny détecté
  return maxFreq / valides.length >= 0.6;
}
