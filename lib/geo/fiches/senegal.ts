/**
 * Fiche Sénégal — registre de faits sourcés (cf. ./types.ts).
 *
 * Recherche documentaire du 01/10/2026 (verifiePar: "recherche"),
 * validée fait par fait par Steph le 01/10/2026 (verifiePar: "steph") : sources
 * officielles uniquement — site de la LONASE (lonase.sn), sa plateforme en
 * ligne LONASE.BET, programmes PDF officiels.
 *
 * Non publié faute de source : heure limite de prise des paris (les
 * programmes ne donnent que l'heure de départ), USSD / Mobile Money, sens des
 * sigles ALR et PLR (jamais développés par la LONASE, définitions
 * contradictoires sur sa page PMU), courses sénégalaises proposées au pari.
 */
import type { FichePays } from "./types";

const LE = "2026-10-01";

export const senegal: FichePays = {
  slug: "senegal",
  fuseau: "Africa/Dakar",
  deviseNative: "XOF",

  operateur: {
    valeur: { nom: "Loterie Nationale Sénégalaise (LONASE)", site: "https://www.lonase.sn" },
    source: "https://www.lonase.sn/presentation/",
    extrait: "La Loterie Nationale Sénégalaise (LONASE) est une entreprise publique chargée de l'exploitation et de la commercialisation des jeux de loterie et de hasard sur la totalité du territoire sénégalais.",
    verifieLe: LE,
    verifiePar: "steph",
    preuves: [
      { source: "https://www.lonase.sn/presentation/", extrait: "elle exploite en monopole les jeux de hasard, loteries et jeux assimilés sur le territoire national" },
      { source: "https://www.lonase.sn/resultats-pmu/", extrait: "Les résultats des paris hippiques (PMU Sénégal) sont mis à jour après les courses." },
      { source: "https://www.lonase.sn/faq/", extrait: "Les paris en ligne se font via la plateforme LONASE.BET, accessible depuis le bouton « Jouer en ligne » du site." },
    ],
  },

  modesDeJeu: {
    valeur: ["guichet", "en-ligne", "mobile"],
    source: "https://www.lonase.sn/jeux/pmu/",
    extrait: "Validez votre ticket dans le réseau LONASE, puis consultez les résultats et rapports publiés.",
    verifieLe: LE,
    verifiePar: "steph",
    preuves: [
      { source: "https://www.lonase.sn/faq/", extrait: "La LONASE dispose d'un réseau de points de vente partout au Sénégal." },
      { source: "https://lonase.bet/about/faq", extrait: "Cliquez sur Hippique dans le menu principal. Sélectionnez la course sur laquelle vous souhaitez parier." },
      { source: "https://lonase.bet/about/faq", extrait: "Télécharger l'application Android mobile […] Vous allez ensuite être redirigé vers la page vous indiquant les instructions afin de télécharger et d'installer l'application android." },
    ],
  },

  reunionsProposees: {
    valeur: ["Courses du PMU France : programmes ALR 1, ALR 2 et ALR 3, et réunions françaises du jour sur LONASE.BET"],
    source: "https://www.lonase.sn/la-lonase-dans-lala-en-negociation-a-abidjan-vers-un-partenariat-plus-equitable-avec-le-pmu-france/",
    extrait: "le PMU France, principal partenaire technique et commercial dans le domaine des paris hippiques.",
    verifieLe: LE,
    verifiePar: "steph",
    preuves: [
      { source: "https://www.lonase.sn/jeux/pmu/", extrait: "le Prix des Perdrix servira de support à l’ALR2 du jeudi à Cabourg" },
      { source: "https://lonase.bet/horseracing/race/R5C8", extrait: "France […] R1 - AUTEUIL R4 - ARGENTAN R5 - CABOURG" },
    ],
  },

  // Mises de base : celles de LONASE.BET (jeu en ligne) ; aucune mise en point
  // de vente n'a été trouvée. Un pari par entrée, description du guide officiel
  // reprise telle quelle (orthographe seule corrigée : « quel que soit »).
  parisLocaux: {
    valeur: [
      { nom: "Simple ALR Gagnant", description: "Trouver le cheval qui arrive en premier. Mise de base en ligne : 500 FCFA." },
      { nom: "Simple ALR Placé", description: "Trouver un cheval parmi les trois premiers de l'arrivée (1 parmi les 2 premiers chevaux sur les courses de 4 à 7 partants). Mise de base en ligne : 500 FCFA." },
      { nom: "Couplé ALR Gagnant", description: "Trouver les deux premiers chevaux de l'arrivée. Mise de base en ligne : 500 FCFA." },
      { nom: "Couplé ALR Placé", description: "Trouver deux chevaux parmi les trois premiers de l'arrivée. Mise de base en ligne : 500 FCFA." },
      { nom: "Tiercé ALR", description: "Trouver les trois premiers chevaux dans l'ordre exact d'arrivée (rapport Ordre / rapport Désordre). Mise de base en ligne : 300 FCFA." },
      { nom: "Quarté ALR", description: "Trouver les quatre premiers chevaux dans l'ordre, dans le désordre ou les trois premiers quel que soit l'ordre (bonus 3). Mise de base en ligne : 300 FCFA." },
      { nom: "Quinté ALR", description: "Trouver les cinq premiers chevaux de l'arrivée, dans l'ordre, dans le désordre. Mise de base en ligne : 350 FCFA." },
      { nom: "Quinté+ ALR", description: "Trouver les cinq premiers chevaux de l'arrivée, dans l'ordre, dans le désordre. Mise de base en ligne : 350 FCFA." },
      { nom: "Multi ALR", description: "Trouver les quatre premiers chevaux quel que soit l'ordre en ayant joué 4, 5, 6 ou 7 chevaux (Multi en 4, en 5, en 6, en 7). Mise de base en ligne : 500 FCFA." },
      { nom: "Simple PLR Gagnant", description: "Trouver le cheval qui arrive en premier (toutes les courses). Mise de base en ligne : 500 FCFA." },
      { nom: "Simple PLR Placé", description: "Trouver un cheval parmi les trois premiers de l'arrivée (toutes les courses). Mise de base en ligne : 500 FCFA." },
      { nom: "Jumelé PLR Ordre", description: "Pour les courses de 4 à 7 partants, trouver les deux premiers chevaux dans l'ordre exact d'arrivée. Mise de base en ligne : 500 FCFA." },
      { nom: "Jumelé PLR Gagnant", description: "Trouver les deux premiers chevaux de l'arrivée (les 2 premiers chevaux sur les courses de 8 partants et +). Mise de base en ligne : 500 FCFA." },
      { nom: "Jumelé PLR Placé", description: "Trouver deux chevaux parmi les trois premiers de l'arrivée (courses d'au moins 8 partants). Mise de base en ligne : 500 FCFA." },
      { nom: "Trio PLR", description: "Trouver les trois premiers chevaux de l'arrivée pour les courses d'au moins 8 partants et plus. Mise de base en ligne : 500 FCFA." },
    ],
    source: "https://lonase.bet/horseracing/about/bettypes-guide",
    extrait: "Masse de l'ensemble des enjeux collectés par LONASE",
    verifieLe: LE,
    verifiePar: "steph",
    preuves: [
      { source: "https://www.lonase.sn/wp-content/uploads/2026/10/ALR1-DU-JEUDI-01-OCTOBRE-2026.pdf", extrait: "ALR1-Tiercé Quarté Quinté+ Multi" },
      { source: "https://lonase.bet/about/content/gcu", extrait: "Le montant maximum est en fonction des paris, soit entre 20 prises par combinaisons pour la masse séparée et 1 000 000 FCFA pour la masse commune internationale." },
    ],
  },

  vocabulaire: {
    valeur: {
      "ALR 1, ALR 2, ALR 3": "Courses supports des programmes PMU de la LONASE ; l'ALR 1 est la « course événementielle ».",
      "PLR": "Famille de paris de la LONASE proposée sur toutes les courses.",
      "Masse séparée": "Masse des enjeux collectés par la seule LONASE.",
      "Masse Commune Internationale (MCI)": "Masse internationale proposée au PLR ; plus vendue sur l'ALR 1 depuis le 1er décembre 2024.",
      "Couplé / Jumelé": "Le pari sur les deux premiers s'appelle « Couplé » en ALR et « Jumelé » en PLR.",
    },
    source: "https://www.lonase.sn/jeux/pmu/",
    extrait: "Sélectionnez la formule adaptée : ALR, PLR, Couplé, Tiercé, Quarté ou Quinté selon la course.",
    verifieLe: LE,
    verifiePar: "steph",
    preuves: [
      { source: "https://www.lonase.sn/wp-content/uploads/2025/11/ALR2-DU-LUNDI-17-MARS-2025.pdf", extrait: "la commercialisation de la Masse Commune Internationale (MCI) sur la course événementielle ALR1 sera arrêtée." },
      { source: "https://www.lonase.sn/wp-content/uploads/2025/11/ALR2-DU-LUNDI-17-MARS-2025.pdf", extrait: "Toutefois, au PLR, les prises de paris pourront se faire tant pour la Masse séparée que pour la Masse Commune Internationale." },
      { source: "https://lonase.bet/horseracing/about/bettypes-guide", extrait: "Le rapport Jumelé Gagnant" },
    ],
  },

  editionGuichet: false,
  // FAQ validée par Steph le 01/10/2026. « à confirmer » : requête exacte
  // attendue de l'export Search Console de référence.
  faq: [
    { q: "Comment jouer au PMU au Sénégal ?",
      a: "Avec la LONASE (Loterie Nationale Sénégalaise) : dans son réseau de points de vente, sur sa plateforme en ligne LONASE.BET ou avec son application Android. Nous sommes un service indépendant d'analyse, sans lien avec la LONASE.",
      requeteSource: "pmu senegal" },
    { q: "À quelle heure publiez-vous vos pronostics pour le Sénégal ?",
      a: "Chaque matin entre 8 h 30 et 9 h 30, heure de Dakar.",
      requeteSource: "pronostic pmu senegal" },
    { q: "Que sont l'ALR 1, l'ALR 2 et l'ALR 3 de la LONASE ?",
      a: "Les courses supports des programmes PMU de la LONASE ; l'ALR 1 est la course événementielle. Les paris PLR, eux, se jouent sur toutes les courses.",
      requeteSource: "à confirmer (export Search Console)" },
    { q: "Couplé ou Jumelé : quelle différence à la LONASE ?",
      a: "Le pari sur les deux premiers s'appelle Couplé en ALR et Jumelé en PLR.",
      requeteSource: "à confirmer (export Search Console)" },
    { q: "À quelle heure part le Quinté+ du jour, à l'heure de Dakar ?",
      a: "L'heure de départ, à l'heure de Dakar, est affichée en haut de cette page avec la course du jour.",
      requeteSource: "… dakar (à confirmer (export Search Console))" },
  ],
};
