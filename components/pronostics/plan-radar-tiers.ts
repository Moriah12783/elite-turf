import type { CleNiveau } from "@/lib/pronostics/plan-radar";

/**
 * Libellés et couleurs des niveaux du plan de jeu — SOURCE UNIQUE.
 *
 * Lue par la carte et l'accueil (PlanRadarBlock), la fiche détail et la fiche
 * course (PlanRadarListe), et le guide de l'espace membre (GuideUtilisation) :
 * l'abonné voit les mêmes couleurs partout, et le guide décrit exactement ce
 * qu'il voit.
 *
 * Reprend le langage visuel du Radar de la presse (émeraude = base, bleu =
 * value, doré = coup) : l'abonné retrouve ses repères.
 *
 * Fichier dans `components/` et non dans `lib/` : Tailwind ne lit pas `lib/`,
 * ces classes y seraient purgées du CSS.
 */
export const TIERS: Record<CleNiveau, { label: string; consigne: string; chip: string; text: string }> = {
  couple: {
    label: "Le couplé",
    consigne: "Les 2 chevaux à jouer en couplé",
    chip: "bg-purple-500/10 text-purple-300 border-purple-500/40",
    text: "text-purple-400",
  },
  base: {
    label: "La base",
    consigne: "Nos chevaux les plus solides",
    chip: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
    text: "text-emerald-400",
  },
  associes: {
    label: "Les associés",
    consigne: "À jouer avec la base",
    chip: "bg-teal-500/10 text-teal-300 border-teal-500/40",
    text: "text-teal-400",
  },
  value: {
    label: "La value",
    consigne: "Nos secondes chances",
    chip: "bg-blue-500/10 text-blue-300 border-blue-500/40",
    text: "text-blue-400",
  },
  coup: {
    label: "Le coup",
    consigne: "Notre tentative",
    chip: "bg-gold-faint text-gold-light border-gold-primary/50",
    text: "text-gold-primary",
  },
  // Le champ reste neutre : c'est de la couverture, il ne doit pas capter l'œil.
  champ: {
    label: "Le champ",
    consigne: "Les compléments",
    chip: "bg-bg-elevated text-text-secondary border-border",
    text: "text-text-muted",
  },
};
