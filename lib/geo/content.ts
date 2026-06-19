/**
 * lib/geo/content.ts
 *
 * Contenu éditorial LOCAL et UNIQUE par pays + helpers SEO pour les pages
 * /pronostics-pmu-[pays]. Objectif : dé-dupliquer les 12 landings géo (qui
 * partageaient un contenu templaté) pour qu'elles rankent sur les requêtes
 * géo (« pmu senegal », « pronostic pmu mali »…).
 *
 * ⚠️ Intégrité : tout est FACTUEL (opérateur officiel réel, capitale, vraies
 * villes, devise, contexte). Aucune statistique inventée, aucun chiffre de
 * réussite — cohérent avec la ligne anti-fabrication d'Elite Turf.
 */

import type { Metadata } from "next";
import { type Country } from "@/lib/geo/countries";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr";

/**
 * Paragraphe d'introduction UNIQUE par pays (clé = code ISO).
 * C'est le principal levier de dé-duplication SEO.
 */
export const GEO_INTRO: Record<string, string> = {
  CI: "En Côte d'Ivoire, les courses PMU comptent parmi les paris les plus populaires, d'Abidjan à Bouaké et Yamoussoukro. La LONACI (PMU-CI) opère les paris hippiques sur le territoire, avec les grandes courses françaises comme référence. Elite Turf décrypte chaque jour ces réunions pour les turfistes ivoiriens : cheval de base, outsiders à valeur et conseil de mise.",
  SN: "Au Sénégal, le PMU réunit une large communauté de parieurs, de Dakar à Thiès et Touba. La LONASE est l'opérateur national qui propose les paris sur les courses françaises. Elite Turf publie chaque matin des analyses détaillées — Quinté+, Tiercé, Quarté+ — pensées pour les turfistes sénégalais qui jouent via la LONASE.",
  CM: "Au Cameroun, le PMUC anime les paris hippiques de Yaoundé à Douala et Bafoussam. Les grandes courses françaises restent la référence des parieurs camerounais. Elite Turf analyse chaque jour partants, jockeys et cotes pour aider les turfistes du Cameroun à bâtir leurs Quinté+, Tiercé et Quarté+.",
  MA: "Au Maroc, le pari hippique repose sur la MDJS et la SOREC, qui organise aussi les courses nationales (hippodromes de Casablanca-Anfa et de Rabat). Les parieurs marocains suivent à la fois le turf local et les grandes courses françaises. Elite Turf livre des analyses quotidiennes pour les turfistes du Royaume, de Casablanca à Rabat et Marrakech.",
  ML: "Au Mali, les turfistes suivent passionnément les courses PMU France, de Bamako à Sikasso et Ségou, via les agences agréées et le réseau régional. Elite Turf publie chaque jour ses pronostics experts sur les courses françaises — base, appuis et conseil de mise — pour les parieurs maliens.",
  BF: "Au Burkina Faso, la LONAB (PMU'B) opère les paris hippiques, très suivis de Ouagadougou à Bobo-Dioulasso. Les courses françaises sont la référence des turfistes burkinabè. Elite Turf décrypte chaque matin les réunions du jour pour parier plus malin depuis le Burkina.",
  TD: "Au Tchad, les amateurs de courses suivent le PMU France depuis N'Djamena et les principales villes du pays. Elite Turf met à disposition des turfistes tchadiens des analyses quotidiennes des courses françaises — Quinté+, Tiercé, Quarté+ — avec une méthode claire et transparente.",
  GA: "Au Gabon, les parieurs suivent les courses PMU France depuis Libreville et Port-Gentil. Elite Turf publie chaque jour des analyses détaillées des réunions françaises pour les turfistes gabonais : lecture des partants, des jockeys et des cotes, avec cheval de base et outsiders.",
  TG: "Au Togo, la LONATO encadre les paris hippiques, suivis de Lomé à Kara et Sokodé. Les courses françaises constituent la référence des turfistes togolais. Elite Turf livre chaque matin ses pronostics experts — Quinté+, Tiercé, Quarté+ — pour jouer sereinement via la LONATO ou les agences agréées.",
  CG: "Au Congo, les courses PMU France passionnent les parieurs de Brazzaville à Pointe-Noire. Elite Turf accompagne les turfistes congolais avec des analyses quotidiennes des réunions françaises — partants, cotes et conseil de mise — dans un format clair et transparent.",
  MG: "À Madagascar, le turf est une tradition vivante : les courses PMU France sont suivies d'Antananarivo à Antsirabe et Toamasina. Elite Turf publie chaque jour ses analyses — Quinté+, Tiercé — pour les turfistes malgaches, avec une lecture experte des partants et des cotes.",
  RE: "À La Réunion (974), département français, les turfistes jouent directement via le PMU France. De Saint-Denis à Saint-Pierre, les courses du jour sont suivies avec passion. Elite Turf publie chaque matin ses pronostics experts — Quinté+, Tiercé, Quarté+ — pour les parieurs réunionnais.",
};

/** Meta description UNIQUE par pays (exact-match géo + CTA pour le CTR). */
export const GEO_META_DESC: Record<string, string> = {
  CI: "Pronostic PMU Côte d'Ivoire : Quinté+, Tiercé, Quarté+ analysés chaque jour par nos experts. Courses France + LONACI. Résultats publics, essai gratuit.",
  SN: "Pronostic PMU Sénégal : Quinté+, Tiercé, Quarté+ décryptés chaque matin par nos experts. Courses jouables via LONASE. Analyses transparentes, essai gratuit.",
  CM: "Pronostic PMU Cameroun : analyses expertes Quinté+, Tiercé, Quarté+ chaque jour. Courses France pour les parieurs du PMUC. Résultats publics, essai gratuit.",
  MA: "Pronostic PMU Maroc : Quinté+, Tiercé et courses SOREC analysés chaque jour. Pour les turfistes du Royaume (MDJS). Méthode transparente, essai gratuit.",
  ML: "Pronostic PMU Mali : Quinté+, Tiercé, Quarté+ analysés chaque jour par nos experts. Courses France pour les turfistes maliens. Résultats publics, essai gratuit.",
  BF: "Pronostic PMU Burkina Faso : Quinté+, Tiercé, Quarté+ chaque matin. Courses France pour les parieurs PMU'B / LONAB. Analyses claires, essai gratuit.",
  TD: "Pronostic PMU Tchad : Quinté+, Tiercé, Quarté+ analysés chaque jour. Courses France pour les turfistes tchadiens. Méthode transparente, essai gratuit.",
  GA: "Pronostic PMU Gabon : Quinté+, Tiercé, Quarté+ décryptés chaque jour par nos experts. Courses France pour les parieurs gabonais. Essai gratuit.",
  TG: "Pronostic PMU Togo : Quinté+, Tiercé, Quarté+ chaque matin. Courses France pour les turfistes togolais (LONATO). Analyses transparentes, essai gratuit.",
  CG: "Pronostic PMU Congo : Quinté+, Tiercé, Quarté+ analysés chaque jour. Courses France pour les parieurs de Brazzaville et Pointe-Noire. Essai gratuit.",
  MG: "Pronostic PMU Madagascar : Quinté+, Tiercé, Quarté+ chaque jour par nos experts. Courses France pour les turfistes malgaches. Résultats publics, essai gratuit.",
  RE: "Pronostic PMU Réunion (974) : Quinté+, Tiercé, Quarté+ chaque matin. Jouez via le PMU France. Analyses expertes et transparentes, essai gratuit.",
};

/** Nom du pays avec son article correct après « depuis / au » (grammaire FR). */
function nomApresDepuis(c: Country): string {
  if (c.code === "CI") return `la ${c.nom}`; // depuis la Côte d'Ivoire
  if (c.code === "RE" || c.code === "MG") return c.nom; // depuis La Réunion / Madagascar
  return `le ${c.nom}`; // depuis le Sénégal…
}

/**
 * Métadonnées SEO par pays (exact-match géo + canonical + OG + Twitter).
 * Centralisé pour rester cohérent sur les 12 pages. Le template du root layout
 * ajoute « | Elite Turf » au titre.
 */
export function buildGeoMetadata(country: Country): Metadata {
  const url = `${APP_URL}/pronostics-pmu-${country.slug}`;
  const title = `Pronostic PMU ${country.nom} ${country.drapeau} — Quinté+, Tiercé`;
  const description = GEO_META_DESC[country.code] ?? country.accroche;
  return {
    title,
    description,
    keywords: country.motsCles,
    alternates: { canonical: url },
    openGraph: {
      title: `Pronostic PMU ${country.nom} ${country.drapeau} — Elite Turf`,
      description,
      url,
      type: "website",
      siteName: "Elite Turf",
      locale: "fr_FR",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * FAQ factuelle par pays — réutilisée à l'écran ET en JSON-LD FAQPage
 * (la FAQ visible et la FAQ structurée DOIVENT correspondre, exigence Google).
 */
export function buildGeoFaq(country: Country): { q: string; a: string }[] {
  const op = country.operateurOfficiel;
  const depuis = nomApresDepuis(country);
  const aVenir = country.paiements.filter((p) => p.bientot).map((p) => p.nom);
  return [
    {
      q: `Comment jouer le Quinté+ depuis ${depuis} ?`,
      a: op
        ? `Connectez-vous sur ${op.site} ou rendez-vous dans un point ${op.nom}, choisissez la course du jour et validez votre Quinté+. Consultez d'abord les pronostics Elite Turf pour affiner votre sélection.`
        : `Vous pouvez jouer via les agences agréées ou les sites de paris autorisés. Suivez chaque matin les pronostics PMU France d'Elite Turf pour optimiser vos sélections.`,
    },
    {
      q: `Comment payer mon abonnement Elite Turf depuis ${depuis} ?`,
      a: `Le paiement se fait par carte bancaire (Visa/Mastercard, toutes cartes acceptées), avec activation en moins de 2 minutes.${
        aVenir.length ? ` Les paiements Mobile Money (${aVenir.join(", ")}) seront bientôt disponibles.` : ""
      }`,
    },
    {
      q: `Les pronostics sont-ils adaptés aux parieurs de ${country.nom} ?`,
      a: `Oui. Elite Turf analyse les courses PMU France${
        (country.code === "CI" || country.code === "MA") && op ? ` ainsi que certaines courses locales (${op.nom})` : ""
      }, les plus jouées en Afrique francophone. Nos résultats sont publics et vérifiables sur la page Performances.`,
    },
    {
      q: `Elite Turf est-il l'opérateur de paris ?`,
      a: `Non. Elite Turf est un service indépendant d'analyse et de pronostic. Vous jouez vos paris directement chez votre opérateur${
        op ? ` (${op.nom})` : " agréé"
      } ; Elite Turf ne collecte aucune mise.`,
    },
  ];
}
