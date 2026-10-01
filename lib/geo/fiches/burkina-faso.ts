/**
 * Fiche Burkina Faso — registre de faits sourcés (cf. ./types.ts).
 *
 * Recherche documentaire du 01/10/2026 (verifiePar: "recherche") : site de la
 * LONAB (lonab.bf), Journal hippique PMU'B (PDF officiels), presse nationale
 * (Sidwaya, repris par allAfrica). À valider par Steph, qui connaît le terrain.
 *
 * Non publié faute de source :
 * - jeu PMU'B en ligne ou sur mobile (LONABET = paris sportifs et jeux
 *   virtuels ; seule mention « téléphone portable » : lefaso.net, 2010) ;
 * - règle générale d'heure limite (seule l'heure d'« arrêt des jeux » de chaque
 *   course figure au Journal hippique — 10 min avant le départ sur les journaux
 *   des 30/09, 01/10 et 03/10/2026, mais aucune règle écrite) ;
 * - formule ou mise à 1 000 F (aucune sur la page PMU'B : mises de base 200,
 *   300 et 500 FCFA) ;
 * - paris ECD (Trio, Jumelé, Simple — page lonab.bf/fr/node/29, citation à
 *   relever) ;
 * - calendrier des jeux par jour de /fr/pmub : PÉRIMÉ (les mercredis de
 *   septembre 2026 étaient des 4+1, pas des Tiercés).
 */
import type { FichePays } from "./types";

const LE = "2026-10-01";

export const burkinaFaso: FichePays = {
  slug: "burkina-faso",
  fuseau: "Africa/Ouagadougou",
  deviseNative: "XOF",

  operateur: {
    valeur: { nom: "Loterie Nationale Burkinabè (LONAB)", site: "https://www.lonab.bf" },
    source: "https://www.lonab.bf/fr/node/4626",
    extrait: "la Loterie Nationale Burkinabè (LONAB) a le plaisir d’informer son aimable clientèle qu’elle offre une superbe cagnotte au PMU’B",
    verifieLe: LE,
    verifiePar: "recherche",
  },

  modesDeJeu: {
    valeur: ["guichet"],
    source: "https://www.lonab.bf/fr/pmub",
    extrait: "Bien vérifier l’exactitude de vos tickets avant de quitter les points de vente.",
    verifieLe: LE,
    verifiePar: "recherche",
  },

  heureLimite: {
    valeur: "Le Journal hippique PMU'B de la LONAB indique, course par course, l'heure d'« arrêt des jeux ».",
    source: "https://www.lonab.bf/sites/default/files/2026-09/JH_PMU_DU_01-10-2026.pdf",
    extrait: "ARRÊT DES JEUX EST FIXÉ : 11h 45mn DÉPART DE LA COURSE : 11h 55mn",
    verifieLe: LE,
    verifiePar: "recherche",
  },

  reunionsProposees: {
    valeur: ["Courses hippiques françaises (paris PMU'B et ECD)"],
    source: "https://www.lonab.bf/en/node/42",
    extrait: "sur l’hippodrome d’Auteuil en France, les courses de la réunion N 1 du dimanche 24 avril 2022 sont annulées. Par conséquent, elle invite les parieurs ECD et PMU’B",
    verifieLe: LE,
    verifiePar: "recherche",
  },

  parisLocaux: {
    valeur: [
      { nom: "Tiercé", description: "Trouvez les 3 premiers arrivants de la course et gagnez. Mise de base : 200 FCFA. Gains : ordre et désordre." },
      { nom: "Quarté", description: "Trouvez les 4 premiers arrivants de la course et gagnez. Mise de base : 200 FCFA. Gains : ordre et désordre." },
      { nom: "4+1", description: "Trouvez les 5 premiers arrivants de la course et gagnez. Les 4 premiers de l'arrivée plus un cheval autre que le cinquième donnent droit au Bonus. Mise de base : 300 FCFA. Gains : ordre, désordre et bonus." },
      { nom: "Couplé", description: "Trouvez 2 des 3 premiers arrivants de la course et gagnez : couplé gagnant, couplé placé A, B et C. Mise de base : 500 FCFA." },
      { nom: "Formules (types de paris)", description: "Combinaisons simples (CS) : au tiercé de 3 à 12 chevaux, au quarté de 4 à 12, au 4+1 de 5 à 12, au couplé de 2 à 6. Combinaisons complètes en pari unitaire (C C). Combinaisons dans le champ, en champ total ou en champ réduit." },
    ],
    source: "https://www.lonab.bf/fr/pmub",
    extrait: "Les mises de bases : Tiercé et Quarté : 200 FCFA 4+1: 300 FCFA Couplé : 500 FCFA",
    verifieLe: LE,
    verifiePar: "recherche",
  },

  vocabulaire: {
    valeur: { "4+1": "Le pari sur les cinq premiers de la course, que la presse burkinabè appelle aussi Quinté." },
    source: "https://fr.allafrica.com/stories/202601120327.html",
    extrait: "a misé la somme de 1 200 F CFA au 4+1 (Quinté) du 24 décembre 2025",
    verifieLe: LE,
    verifiePar: "recherche",
  },

  editionGuichet: false,
  faq: [],
};
