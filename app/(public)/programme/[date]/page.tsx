/**
 * /programme/[date] — Programme courses d'une date donnée.
 *
 * Levier SEO : capter les requêtes long-tail typées
 *   "courses pmu 4 mai 2026"
 *   "programme hippique du jour"
 *   "quinté demain"
 * Concurrents (Geny/Zone-Turf/Paris-Turf) utilisent ce pattern d'URL dépuis des années.
 *
 * Note : page complémentaire de /courses?date=X (UI interactive avec filtres).
 * Ici, URL canonique propre + ISR + schema.org SportsEvent par course.
 *
 * Affichage : ../VueProgramme.tsx (partagé avec la page pilier /programme).
 */

import { Metadata } from "next";
import { sortPageProgramme } from "@/lib/seo/programme-fenetre";
import { unstable_noStore as noStore } from "next/cache";
import {
  isValidDateParam, formatDateLong, formatDateCompact,
  isToday, isFuture, todayParis, generateDateRangeParams,
} from "@/lib/seo/dates";
import { chargerCoursesProgramme } from "../donnees";
import VueProgramme from "../VueProgramme";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface PageProps { params: { date: string } }

export async function generateStaticParams() {
  return generateDateRangeParams();
}

// ISR dynamique selon la position temporelle de la date
export const dynamicParams = true; // dates hors-fenêtre rendues à la volée
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Titres SANS « Elite Turf » : le gabarit de app/layout.tsx (« %s | Elite
  // Turf ») l'ajoute déjà. L'écrire ici produisait « … | Elite Turf | Elite Turf »
  // dans les résultats Google. openGraph.title, lui, ne reçoit pas le gabarit :
  // il garde sa marque.
  if (!isValidDateParam(params.date)) return { title: "Date invalide" };

  if (isToday(params.date)) noStore();
  const courses = await chargerCoursesProgramme(params.date);
  const sort    = sortPageProgramme(params.date, todayParis(), courses.length);

  const dateLong    = formatDateLong(params.date);
  const dateCompact = formatDateCompact(params.date);
  const today       = isToday(params.date);
  const future      = isFuture(params.date);

  const verb = today  ? "du jour"
             : future ? "à venir"
             : "passées";

  // ── Boost CTR : emoji début (signal SERP) + intent commercial fort ──
  // Avant : "Programme courses PMU du jour | Elite Turf"
  // Après : "🏇 Programme PMU du jour · Quinté+, Tiercé, Quarté+ analysés"
  // → emoji 🏇 = signal hippique visible en SERP
  // → "Quinté+, Tiercé, Quarté+" = capture les requêtes types de pari
  // → "analysés" = valeur perçue (vs simple "programme")
  const emoji = today ? "🏇" : future ? "📅" : "🏆";
  const titleSuffix = today
    ? "Quinté+, Tiercé, Quarté+ analysés"
    : future ? "Programme complet à venir"
             : "Résultats et arrivées";

  return {
    title: `${emoji} Programme PMU ${today ? "du jour" : dateCompact} · ${titleSuffix}`,
    // Journée sans course affichable : la page reste servie (la navigation par
    // date fonctionne) mais Google ne l'indexe pas — ces pages vides, quasi
    // identiques d'un jour à l'autre, étaient classées « page en double ».
    ...(sort === "noindex" ? { robots: { index: false, follow: true } } : {}),
    description: `${emoji} Toutes les courses PMU ${verb} (${dateLong}) : Vincennes, Longchamp, Cagnes-sur-Mer, Casablanca, Abidjan. Horaires, partants, cotes et pronostics gratuits Elite Turf.`,
    alternates: { canonical: `${APP_URL}/programme/${params.date}` },
    openGraph: {
      title: `${emoji} Programme PMU ${dateCompact} — Elite Turf`,
      description: `Programme PMU complet du ${dateLong} avec pronostics experts.`,
      url: `${APP_URL}/programme/${params.date}`,
      type: "website",
    },
  };
}

export default function ProgrammePage({ params }: PageProps) {
  // Aujourd'hui : rendu dynamique (statuts et arrivées à jour) — la vue appelle
  // aussi noStore() ; l'appel ici garde la page elle-même dynamique.
  if (isValidDateParam(params.date) && isToday(params.date)) noStore();
  return <VueProgramme date={params.date} />;
}

// ISR 600s pour le futur (programme stable) et le passé (résultats figés).
// Aujourd'hui est rendu full-dynamic via noStore() dans la fonction page,
// pour que les changements de statut (PROGRAMME → TERMINE) et arrivées
// apparaissent sans délai après chaque sync Geny.
export const revalidate = 600;
