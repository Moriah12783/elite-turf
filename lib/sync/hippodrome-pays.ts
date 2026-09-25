/**
 * Pays d'un hippodrome déduit de son NOM, pour les sources qui ne le donnent
 * pas (la LONACI). Source unique : l'entrée des données LONACI et la home
 * s'en servent toutes les deux.
 *
 * Le 25/09/2026, Settat (186 courses), Khemisset (90) et Meknès (39) étaient
 * enregistrés « France » : la liste d'origine ne connaissait que Marrakech,
 * Casablanca et Anfa. Conséquences publiques : fiche « Hippodrome de Settat
 * (Settat, France) », données structurées envoyées à Google avec le mauvais
 * pays, classement sous la France dans /hippodromes.
 *
 * PUR, ES5-safe.
 */
import { canonicalHippodrome } from "./hippodrome-canonical";

/** Les 7 hippodromes de la SOREC (+ Casablanca, ancien nom d'Anfa ; Kénitra). */
const HIPPODROMES_MAROCAINS = [
  "anfa", "casablanca", "rabat", "eljadida", "settat", "khemisset", "meknes", "marrakech", "kenitra",
];

export function estNomHippodromeMarocain(nom: string | null | undefined): boolean {
  const cle = canonicalHippodrome(nom ?? "");
  if (!cle) return false;
  for (let i = 0; i < HIPPODROMES_MAROCAINS.length; i++) {
    // Inclusion : « Casablanca-Anfa », « Hippodrome de Settat »…
    if (cle.indexOf(HIPPODROMES_MAROCAINS[i]) !== -1) return true;
  }
  return false;
}
