/**
 * Fiche Côte d'Ivoire — registre de faits sourcés (cf. ./types.ts).
 *
 * Recherche documentaire du 01/10/2026 (verifiePar: "recherche"),
 * validée fait par fait par Steph le 01/10/2026 (verifiePar: "steph") : site de la
 * LONACI (www.lonaci.ci), plateforme PMU LONACI (pmu.lonacionline.ci), agence
 * de presse AIP, Abidjan.net, KOACI.
 *
 * ⚠️ « pmu.ci » n'existe pas (NXDOMAIN au 01/10/2026) et « PMU-CI » n'apparaît
 * sur aucune page officielle : le site officiel est www.lonaci.ci (sans www :
 * HTTP 503), le jeu en ligne passe par pmu.lonacionline.ci.
 *
 * Non publié faute de source sûre : heure limite (le programme officiel donne
 * les « heures de fermeture », mais c'est un PDF non relevé), code USSD (les
 * sources divergent : *590# ou *590*3#), « courses françaises » en toutes
 * lettres (le programme liste les hippodromes sans le pays), Nationale 1 =
 * Quinté+ du PMU français « par définition » (constaté 46/46 en base, jamais
 * écrit par une source), sens de la Nationale 3, Super Quinté (aucune source
 * de 2026), PICK5 (non décrit).
 */
import type { FichePays } from "./types";

const LE = "2026-10-01";

export const coteDIvoire: FichePays = {
  slug: "cote-d-ivoire",
  fuseau: "Africa/Abidjan",
  deviseNative: "XOF",

  operateur: {
    valeur: { nom: "Loterie Nationale de Côte d’Ivoire (LONACI)", site: "https://www.lonaci.ci" },
    source: "https://www.lonaci.ci/pmu/",
    extrait: "Le PMU (Pari Mutuel Urbain) est le produit LONACI dédié aux paris hippiques, exclusivement organisé sur le territoire national.",
    verifieLe: LE,
    verifiePar: "steph",
    preuves: [
      { source: "https://www.lonaci.ci/mentions-legales/", extrait: "Éditeur du site Loterie Nationale de Côte d’Ivoire (LONACI)" },
      { source: "https://www.lonaci.ci/histoire/", extrait: "La Loterie Nationale de Côte d’Ivoire, en abrégé LONACI, est une Société Anonyme à Participation Financière Publique Majoritaire, créée par la Loi n° 70-208 du 20 mars 1970." },
      { source: "https://www.lonaci.ci/pmu/", extrait: "Suivez les courses et placez vos paris sur la plateforme officielle PMU LONACI." },
    ],
  },

  modesDeJeu: {
    valeur: ["guichet", "en-ligne", "mobile"],
    source: "https://www.aip.ci/cote-divoire-aip-un-parieur-remporte-plus-de-36-millions-fcfa-au-pmu/",
    extrait: "les prises de paris sont disponibles dans les points de vente PMU, sur le site internet de la LONACI ainsi que via le code USSD dédié.",
    verifieLe: LE,
    verifiePar: "steph",
    preuves: [
      { source: "https://www.lonaci.ci/pmu/", extrait: "Pariez au PMU dans le réseau de points agréés LONACI à Abidjan et à l’intérieur du pays." },
      { source: "https://www.lonaci.ci/pmu/", extrait: "Suivez les courses et placez vos paris sur la plateforme officielle PMU LONACI." },
      { source: "https://www.aip.ci/cote-divoire-aip-un-parieur-remporte-plus-de-31-millions-fcfa-au-pmu-de-la-lonaci/", extrait: "Le lancement récent de la plateforme PAYME by LONACI permet désormais aux détenteurs de tickets physiques de recevoir leurs gains directement via mobile money" },
    ],
  },

  reunionsProposees: {
    valeur: ["Réunions du programme PMU LONACI, en France (ex. Auteuil, Paris-Vincennes) et au Maroc (ex. Meknès)"],
    source: "https://pmu.lonacionline.ci/#/turf/home",
    extrait: "Les courses hippiques du jeudi 1 octobre 2026 R1 - Auteuil R4 - Argentan R5 - Cabourg R9 - Meknes",
    verifieLe: LE,
    verifiePar: "steph",
    preuves: [
      { source: "https://www.aip.ci/cote-divoire-aip-un-parieur-remporte-plus-de-36-millions-fcfa-au-pmu/", extrait: "Le Prix d’Amérique Legend Race est la course la plus emblématique du trot attelé mondial. […] elle se déroule chaque année, le dernier dimanche de janvier, à l’hippodrome de Paris-Vincennes." },
    ],
  },

  parisLocaux: {
    valeur: [
      { nom: "Gamme PMU LONACI", description: "Simple, couplé, tiercé, quarté, quinté+, multi ou 2 sur 4, selon le programme du jour." },
      { nom: "Quinté+", description: "Le jeu phare : 5 chevaux, ordre exact ou inexact, plus des bonus 4, 4/5 et 3. Mise de base : 400 FCFA." },
      { nom: "Quinté (« Quinté classique »)", description: "Désigner les cinq premiers chevaux d’une course, dans l’ordre ou dans le désordre. Mise de base : 300 FCFA." },
      { nom: "Couplé placé A, B, C", description: "Couplé placé A (CPA) : 1re et 2e places ; B (CPB) : 1re et 3e ; C (CPC) : 2e et 3e." },
    ],
    source: "https://www.lonaci.ci/pmu/",
    extrait: "Simple, couplé, tiercé, quarté, quinté+, multi ou 2 sur 4 - selon votre intuition et le programme du jour.",
    verifieLe: LE,
    verifiePar: "steph",
    preuves: [
      { source: "https://www.lonaci.ci/pmu/", extrait: "Le jeu phare : 5 chevaux, ordre exact ou inexact, plus des bonus 4, 4/5 et 3." },
      { source: "https://www.aip.ci/cote-divoire-aip-un-parieur-pmu-remporte-plus-de-47-millions-fcfa-en-deux-gains-a-la-lonaci/", extrait: "au Quinté+ de la course Nationale 1 du dimanche 16 août, pour une mise de base de 400 FCFA." },
      { source: "https://www.aip.ci/cote-divoire-aip-deux-parieurs-remportent-plus-de-42-millions-fcfa-au-pmu-lonaci/", extrait: "Le pari Quinté consiste à désigner les cinq premiers chevaux d’une course, dans l’ordre ou dans le désordre." },
      { source: "https://news.abidjan.net/articles/742976/cote-divoire-lonaci-deux-parieurs-au-pmu-alr-remportent-plus-de-65-millions-de-francs-cfa", extrait: "La mise de base est de 400 FCFA, contre 300 FCFA pour le Quinté classique." },
      { source: "https://pmu.lonacionline.ci/#/turf/how-to-play", extrait: "Le couplé placé A (CPA) 1er et 2ème place ; Le couplé placé B (CPB) 1er et 3ème place ; Le couplé placé C (CPC) 2ème et 3ème place." },
    ],
  },

  vocabulaire: {
    valeur: {
      "ALR": "Paris Avant La Réunion : on place ses paris avant le début de la réunion de courses.",
      "PLR": "Paris Pendant La Réunion : on parie au fil de la réunion, course après course.",
      "Nationale 1 (N1)": "La course du PMU ALR support du Quinté+ et du Quinté.",
      "Nationale 2": "La seconde course ALR.",
      "CHAP-CHAP": "Option qui propose automatiquement une combinaison au parieur.",
    },
    source: "https://www.lonaci.ci/pmu/",
    extrait: "Paris Avant La Réunion (ALR) Placez vos paris avant le début de la réunion de courses. […] Paris Pendant La Réunion (PLR) Pariez au fil de la réunion, course après course",
    verifieLe: LE,
    verifiePar: "steph",
    preuves: [
      { source: "https://news.abidjan.net/articles/737596/cote-divoire-loterie-la-lonaci-remet-des-cheques-dun-montant-total-de-plus-de-75-millions-fcfa-a-deux-gagnants-du-pmu", extrait: "Ces deux gagnants ont été enregistrés aux courses nationales 1 ( N1) au PMU ALR sur l'ordre du Quinte + et du Quinte" },
      { source: "https://www.koaci.com/article/2022/05/17/cote-divoire/sport/cote-divoire-pmu-le-grand-prix-dafrique-se-deroulera-pour-la-1ere-fois-en-afrique-27100-millions-fcfa-mis-en-jeu-par-la-lonaci-pour-ses-parieurs_160060.html", extrait: "Elle a annoncé que cette édition du Grand Prix d’Afrique sera proposée aux parieurs en seconde course ALR (Nationale 2)" },
      { source: "https://news.abidjan.net/articles/742976/cote-divoire-lonaci-deux-parieurs-au-pmu-alr-remportent-plus-de-65-millions-de-francs-cfa", extrait: "Pour faciliter le jeu, l’option CHAP-CHAP permet aux parieurs (débutants ou non) de se voir proposer automatiquement une combinaison." },
    ],
  },

  editionGuichet: false,
  // FAQ validée par Steph le 01/10/2026. Requêtes vérifiées dans l'export
  // Search Console du 01/10 (docs/search-console-reference-pages-pays.md).
  faq: [
    { q: "pmu.ci est-il le site officiel du PMU ivoirien ?",
      a: "Non. Le domaine pmu.ci ne répondait pas au 1er octobre 2026. Le PMU ivoirien est un produit de la LONACI (www.lonaci.ci), et le jeu en ligne passe par sa plateforme officielle PMU LONACI.",
      requeteSource: "pmu.ci" },
    { q: "Où jouer au PMU en Côte d'Ivoire ?",
      a: "Dans les points de vente agréés de la LONACI, sur sa plateforme en ligne PMU LONACI ou par code USSD. Nous sommes un service indépendant d'analyse, sans lien avec la LONACI.",
      requeteSource: "pmu cote d'ivoire" },
    { q: "Qu'est-ce que la Nationale 1 de la LONACI ?",
      a: "La course du PMU ALR support du Quinté+ et du Quinté. Nous publions nos pronostics du jour chaque matin entre 8 h 30 et 9 h 30, heure d'Abidjan.",
      requeteSource: "lonaci pronostic du jour" },
    { q: "Quinté+ ou Quinté à la LONACI : quelle différence ?",
      a: "Le Quinté+ (mise de base 400 FCFA) ajoute des bonus 4, 4/5 et 3. Le Quinté classique (mise de base 300 FCFA) se joue sur les cinq premiers, dans l'ordre ou dans le désordre.",
      requeteSource: "lonaci pmu pronostic" },
    { q: "Que veulent dire ALR et PLR ?",
      a: "Paris Avant La Réunion et Paris Pendant La Réunion : ce sont les définitions de la LONACI.",
      requeteSource: "aucune requête dans l'export du 01/10/2026 (top 1 000 du site) — vocabulaire local" },
  ],
};
