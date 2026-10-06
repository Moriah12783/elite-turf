/**
 * Source UNIQUE de vérité pour l'accès aux pronostics selon leur niveau requis
 * et l'abonnement de l'utilisateur.
 *
 * Avant : cette fonction était dupliquée dans 5 fichiers, avec 2 définitions
 * DIVERGENTES (les composants refusaient au pack STARTER l'accès au niveau PRO,
 * les pages le permettaient) → incohérence d'UX et risque de fuite.
 *
 * Modèle « freemium en escalier » (confirmé fondateur, 2026-06-04) :
 *   GRATUIT  →  visible par tous
 *   PRO      →  abonnés STARTER, PRO et ELITE
 *   ELITE    →  abonnés ELITE uniquement (un PRO ne voit PAS l'ELITE)
 *
 * Pourquoi STARTER accède au niveau PRO : en base, AUCUN pronostic n'est tagué
 * niveau "STARTER" (niveau_acces ∈ {GRATUIT, PRO, ELITE} — vérifié : 0 STARTER).
 * Sans cet accès, le pack STARTER ne donnerait QUE du gratuit → aucune valeur.
 * La différenciation STARTER vs PRO porte sur la durée / le volume / le Quinté+
 * / les alertes, pas sur le niveau d'accès des pronostics.
 *
 * Paramètres typés `string` (et non les unions littérales) pour rester un
 * drop-in des 5 copies locales qui mélangeaient `string` et types littéraux.
 *
 * @param niveau  niveau_acces du pronostic ("GRATUIT" | "STARTER" | "PRO" | "ELITE")
 * @param sub     statut_abonnement de l'utilisateur (idem + "EXPIRE")
 * @returns true si l'utilisateur a le droit de voir la sélection/analyse.
 */
export function canAccess(niveau: string, sub: string): boolean {
  if (niveau === "GRATUIT") return true;
  if (niveau === "STARTER") return sub === "STARTER" || sub === "PRO" || sub === "ELITE";
  if (niveau === "PRO")     return sub === "STARTER" || sub === "PRO" || sub === "ELITE";
  if (niveau === "ELITE")   return sub === "ELITE";
  return false; // niveau inconnu → refus par défaut (fail-closed)
}

/** Rang des niveaux, du plus ouvert au plus réservé. */
const RANG_NIVEAU: Record<string, number> = { GRATUIT: 0, STARTER: 1, PRO: 2, ELITE: 3 };

/**
 * Le pronostic à montrer quand une course en a plusieurs de publiés : depuis
 * le 02/10/2026, chaque Quinté+ porte un ELITE et un PRO. Celui du plus haut
 * niveau que l'abonné peut lire ; à défaut, le premier de la liste (carte
 * verrouillée). À niveau égal, l'ordre reçu départage.
 *
 * Avant : le premier venu. Un abonné PRO pouvait tomber sur l'ELITE verrouillé,
 * et un abonné ELITE voyait le PRO (publié quelques secondes après l'ELITE,
 * donc en tête du tri par date), avec d'autres rôles que son propre pronostic.
 */
export function plusHautAccessible<T extends { niveau_acces: string }>(
  pronostics: T[] | null | undefined,
  sub: string,
): T | null {
  const liste = pronostics ?? [];
  let choisi: T | null = null;
  for (const p of liste) {
    if (!canAccess(p.niveau_acces, sub)) continue;
    if (choisi === null || (RANG_NIVEAU[p.niveau_acces] ?? -1) > (RANG_NIVEAU[choisi.niveau_acces] ?? -1)) {
      choisi = p;
    }
  }
  return choisi ?? liste[0] ?? null;
}
