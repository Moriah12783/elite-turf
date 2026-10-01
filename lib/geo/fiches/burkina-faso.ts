/**
 * Fiche Burkina Faso — registre de faits sourcés (cf. ./types.ts).
 *
 * Recherche documentaire du 01/10/2026 (verifiePar: "recherche"),
 * validée fait par fait par Steph le 01/10/2026 (verifiePar: "steph") : site de la
 * LONAB (lonab.bf), Journal hippique PMU'B (PDF officiels), presse nationale
 * (Sidwaya, repris par allAfrica).
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
    verifiePar: "steph",
  },

  modesDeJeu: {
    valeur: ["guichet"],
    source: "https://www.lonab.bf/fr/pmub",
    extrait: "Bien vérifier l’exactitude de vos tickets avant de quitter les points de vente.",
    verifieLe: LE,
    verifiePar: "steph",
  },

  heureLimite: {
    valeur: "Le Journal hippique PMU'B de la LONAB indique, course par course, l'heure d'« arrêt des jeux ».",
    source: "https://www.lonab.bf/sites/default/files/2026-09/JH_PMU_DU_01-10-2026.pdf",
    extrait: "ARRÊT DES JEUX EST FIXÉ : 11h 45mn DÉPART DE LA COURSE : 11h 55mn",
    verifieLe: LE,
    verifiePar: "steph",
  },

  reunionsProposees: {
    valeur: ["Courses hippiques françaises (paris PMU'B et ECD)"],
    source: "https://www.lonab.bf/en/node/42",
    extrait: "sur l’hippodrome d’Auteuil en France, les courses de la réunion N 1 du dimanche 24 avril 2022 sont annulées. Par conséquent, elle invite les parieurs ECD et PMU’B",
    verifieLe: LE,
    verifiePar: "steph",
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
    verifiePar: "steph",
  },

  vocabulaire: {
    valeur: { "4+1": "Le pari sur les cinq premiers de la course, que la presse burkinabè appelle aussi Quinté." },
    source: "https://fr.allafrica.com/stories/202601120327.html",
    extrait: "a misé la somme de 1 200 F CFA au 4+1 (Quinté) du 24 décembre 2025",
    verifieLe: LE,
    verifiePar: "steph",
  },

  editionGuichet: false,
  // FAQ validée par Steph le 01/10/2026. Requêtes vérifiées dans l'export
  // Search Console du 01/10 (docs/search-console-reference-pages-pays.md).
  faq: [
    { q: "Qui organise le PMU au Burkina Faso ?",
      a: "La Loterie Nationale Burkinabè (LONAB), avec le PMU'B. Les paris se prennent dans ses points de vente. Nous sommes un service indépendant d'analyse, sans lien avec la LONAB.",
      requeteSource: "burkina faso pmu" },
    { q: "Quelles formules peut-on jouer au PMU'B ?",
      a: "La LONAB propose des combinaisons simples (de 3 à 12 chevaux au Tiercé, de 4 à 12 au Quarté, de 5 à 12 au 4+1, de 2 à 6 au Couplé), des combinaisons complètes et des jeux en champ total ou réduit.",
      requeteSource: "formule sur pmu burkina" },
    { q: "Existe-t-il un pari PMU'B à 1 000 F ?",
      a: "La page PMU'B de la LONAB n'en présente pas : les mises de base y sont de 200 FCFA au Tiercé et au Quarté, 300 FCFA au 4+1 et 500 FCFA au Couplé.",
      requeteSource: "pmu burkina 1000" },
    { q: "Quand publiez-vous vos pronostics pour le Burkina ?",
      a: "Le jour de la course, avant le départ. Au PMU'B, le pari sur les cinq premiers de la course s'appelle le 4+1.",
      requeteSource: "pronostic pmu burkina faso" },
    { q: "Quelles courses peut-on jouer au PMU'B ?",
      a: "Des courses hippiques françaises, avec les paris PMU'B et ECD de la LONAB.",
      requeteSource: "burkina faso turf" },
  ],
};
