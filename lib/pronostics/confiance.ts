/**
 * lib/pronostics/confiance.ts
 *
 * La confiance d'un pronostic est stockée en TEXTE (FAIBLE, MOYEN, ELEVE,
 * TRES_ELEVE). L'accueil et la page Quinté+ la traitaient comme un nombre sur 5
 * (« Confiance ELEVE/5 », étoiles vides) depuis mars 2026 ; corrigé le 02/10/2026.
 */
import { CONFIDENCE_CONFIG, type Confidence } from "@/types";

export interface NiveauConfiance {
  label: string;
  etoiles: number;
  max: number;
}

/** PUR : niveau stocké → libellé et étoiles (sur 4). null si inconnu. */
export function niveauConfiance(valeur: unknown): NiveauConfiance | null {
  const conf = CONFIDENCE_CONFIG[String(valeur ?? "") as Confidence];
  return conf ? { label: conf.label, etoiles: conf.stars, max: 4 } : null;
}
