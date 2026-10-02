/**
 * Profils officiels de la marque Elite Turf — SOURCE UNIQUE.
 *
 * Utilisée par le pied de page (lien « Suivez-nous ») et par le JSON-LD
 * Organization (`sameAs`, app/layout.tsx), signal d'identification pour Google
 * et les IA. N'ajouter ici qu'un compte qui EXISTE : un lien mort en production
 * fait site inachevé (audit Sprint 1, P4).
 */
export interface ReseauSocial {
  nom: string;
  url: string;
}

export const RESEAUX_SOCIAUX: ReseauSocial[] = [
  // Page communiquée par Steph le 02/10/2026.
  { nom: "Facebook", url: "https://www.facebook.com/profile.php?id=61589172490141" },
];
