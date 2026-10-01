/**
 * /quinte-plus/[date] — Page dédiée au Quinté+ d'une date.
 *
 * LEVIER SEO #1 : "quinté+ du jour" est la requête Google la plus tapée du turf
 * français (≈ 100k searches/jour selon Ahrefs). Concurrents Geny / Zone-Turf /
 * Paris-Turf monopolisent le top 5 SERP avec des URLs canoniques par date.
 *
 * Stratégie :
 *  - URL canonique propre `/quinte-plus/2026-05-04` au lieu de `/courses/{uuid}`
 *  - ISR : 60s aujourd'hui, 600s futur, 24h passé
 *  - Schema.org SportsEvent + BreadcrumbList
 *  - Si pronostic Elite Turf publié pour la course → highlight dans la page
 *  - Si arrivée disponible (date passée) → afficher arrivée + commentaire
 *  - Sinon → partants + cotes + analyse partants
 *
 * Affichage : ../VueQuintePlus.tsx (partagé avec la page pilier /quinte-plus).
 */

import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import {
  isValidDateParam, formatDateLong, formatDateCompact,
  isToday, todayParis, generateDateRangeParams,
} from "@/lib/seo/dates";
import { sortPageQuinte, type SortPageProgramme } from "@/lib/seo/programme-fenetre";
import { chargerJourQuinte } from "../donnees";
import VueQuintePlus from "../VueQuintePlus";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface PageProps { params: { date: string } }

export async function generateStaticParams() {
  return generateDateRangeParams();
}

export const dynamicParams = true;
// Past dates / future : ISR 600s. Aujourd'hui : noStore() ci-dessous (full-dynamic)
// pour que les arrivées du Quinté+ s'affichent dès la sync Geny → DB sans cache.
export const revalidate    = 600;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (!isValidDateParam(params.date)) return { title: "Date invalide" };
  const dateLong    = formatDateLong(params.date);
  const dateCompact = formatDateCompact(params.date);
  const today       = isToday(params.date);

  // Le Quinté+ du jour → titre précis (« — Prix X, Hippodrome »).
  let quinteTitle = "";
  let hippoName   = "";
  // Requête en échec → aucun noindex, par prudence.
  let sort: SortPageProgramme = "indexable";
  try {
    const jour = await chargerJourQuinte(params.date);
    if (!jour.erreur) {
      sort = sortPageQuinte(params.date, todayParis(), !!jour.quinte, jour.nbCoursesFrance);
      if (jour.quinte) {
        const h = Array.isArray(jour.quinte.hippodrome) ? jour.quinte.hippodrome[0] : jour.quinte.hippodrome;
        quinteTitle = jour.quinte.libelle || "";
        hippoName   = h?.nom || "";
      }
    }
  } catch {}

  const titleSuffix = quinteTitle && hippoName
    ? ` — ${quinteTitle}, ${hippoName}`
    : "";

  // ── Boost CTR : trophée + "gratuit" + appel à action ──
  // Le mot "Quinté+" est très concurrentiel → on doit se démarquer en SERP.
  // Emoji 🏆 = signal "championnat" → ⭐ pour le pronostic Elite Turf.
  // Mention explicite "gratuit" = lève la friction d'achat.
  return {
    title: `🏆 Quinté+ ${today ? "du jour" : `du ${dateCompact}`}${titleSuffix} : pronostic gratuit`,
    description: quinteTitle
      ? `🏆 Pronostic Quinté+ du ${dateLong} : ${quinteTitle} à ${hippoName}. Sélection Elite Turf, partants, cotes en direct, arrivée officielle et rapports PMU.`
      : `🏆 Pronostic Quinté+ gratuit du ${dateLong} : partants, cotes probables, arrivée officielle et rapports. Sélection experte Elite Turf publiée avant le départ.`,
    alternates: { canonical: `${APP_URL}/quinte-plus/${params.date}` },
    ...(sort === "noindex" ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: `🏆 Quinté+ ${dateCompact}${titleSuffix} — Pronostic Elite Turf`,
      description: `Pronostic + partants + arrivée du Quinté+ du ${dateLong}.`,
      url: `${APP_URL}/quinte-plus/${params.date}`,
      type: "website",
    },
  };
}

export default function QuintePlusPage({ params }: PageProps) {
  // Aujourd'hui : rendu dynamique (cotes, partants, arrivée à jour) — la vue
  // appelle aussi noStore() ; l'appel ici garde la page elle-même dynamique.
  if (isValidDateParam(params.date) && isToday(params.date)) noStore();
  return <VueQuintePlus date={params.date} />;
}
