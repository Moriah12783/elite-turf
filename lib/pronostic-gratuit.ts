/**
 * lib/pronostic-gratuit.ts
 *
 * Fonctions partagées pour la sélection automatique du pronostic gratuit quotidien.
 * Utilisées par :
 *   - app/api/admin/pronostic-gratuit/route.ts (POST)
 *   - app/api/cron/pronostic-gratuit/route.ts  (GET cron)
 *   - app/(admin)/admin/pronostic-gratuit/page.tsx (Server Component)
 */

/** Score une course selon son intérêt pour le pronostic gratuit du jour */
export function scoreCourse(c: any): number {
  let score = 0;
  const paris: string[] = c.paris_disponibles || [];

  // Critère principal : Tiercé disponible mais PAS Quinté+ (garde l'exclusivité Pro)
  if (paris.includes("TIERCE") || paris.includes("TIERCE_ORDRE")) score += 10;
  if (!paris.includes("QUINTE_PLUS")) score += 8;
  // Quarté = bon niveau sans être le plus complexe
  if (paris.includes("QUARTE_PLUS") || paris.includes("QUARTE")) score += 3;

  // Nombre de partants idéal 8-12 (ni trop simple, ni trop complexe)
  const nb = c.nb_partants || 0;
  if (nb >= 8 && nb <= 12) score += 5;
  else if (nb >= 7 && nb <= 14) score += 2;

  // Départ en après-midi (13h-16h Paris) = meilleur pour le public africain
  const h = parseInt((c.heure_depart || "12:00").slice(0, 2));
  if (h >= 13 && h <= 16) score += 4;
  else if (h >= 12 && h <= 17) score += 2;

  return score;
}

/** Sélectionne les 5 meilleurs chevaux selon les cotes PMU */
export function buildSelection(partants: any[]): number[] {
  // Trier par cote croissante (favoris en tête), ignorer ceux sans cote
  const avecCote = [...partants]
    .filter((p: any) => p.cote && Number(p.cote) > 0)
    .sort((a: any, b: any) => Number(a.cote) - Number(b.cote));

  const sansCote = partants.filter((p: any) => !p.cote || Number(p.cote) <= 0);

  const ordered = [...avecCote, ...sansCote];
  return ordered.slice(0, 5).map((p: any) => p.numero).sort((a: number, b: number) => a - b);
}

/** Génère une analyse courte automatique pour le pronostic gratuit */
export function generateAnalyse(course: any, partants: any[], selection: number[]): string {
  const hippodrome = course.hippodrome?.nom || "hippodrome";
  const distance   = course.distance_metres ? ` sur ${course.distance_metres}m` : "";
  const categorie  = course.categorie ? course.categorie.toLowerCase() : "plat";
  const terrain    = course.terrain
    ? ` — terrain ${course.terrain.toLowerCase().replace(/_/g, " ")}`
    : "";
  const nb = course.nb_partants || "?";

  const selectedPartants = partants
    .filter((p: any) => selection.includes(p.numero))
    .sort((a: any, b: any) => Number(a.cote || 99) - Number(b.cote || 99));

  const top3 = selectedPartants
    .slice(0, 3)
    .map((p: any) => `n°${p.numero} ${p.nom_cheval}`)
    .join(", ");

  return (
    `Course de ${categorie} à ${hippodrome}${distance} (${nb} partants${terrain}). ` +
    `Notre sélection du jour : ${top3}${selectedPartants.length > 3 ? " et 2 compléments." : "."} ` +
    `Résultat vérifiable ce soir sur Geny.`
  );
}
