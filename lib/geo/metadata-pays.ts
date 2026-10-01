/**
 * Métadonnées des pages pays migrées (brief « pages pays », §3) : titre stable
 * (sans date) et meta description dynamique — course du jour et heure locale
 * de départ, ou texte fixe du pays si la course du jour est inconnue.
 */
import type { Metadata } from "next";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";
import { FICHE_PAR_SLUG } from "@/lib/geo/fiches";
import { EDITO, enteteDuJour, metaDescriptionPays } from "@/lib/geo/contenu-pays";
import { chargerJourQuinte } from "@/lib/geo/donnees-pays";
import { todayParis } from "@/lib/seo/dates";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr";

export async function metadataPagePays(slug: string): Promise<Metadata> {
  const country = COUNTRY_BY_SLUG[slug];
  const edito = EDITO[slug];
  const date = todayParis();
  const jour = await chargerJourQuinte(date);
  const entete = enteteDuJour(edito, FICHE_PAR_SLUG[slug], date, jour.quinte);
  const description = metaDescriptionPays(edito, entete);
  const url = `${APP_URL}/pronostics-pmu-${slug}`;
  return {
    // Le gabarit de app/layout.tsx ajoute « | Elite Turf ».
    title: edito.titre,
    description,
    keywords: country.motsCles,
    alternates: { canonical: url },
    openGraph: {
      title: `${edito.h1} — Elite Turf`,
      description,
      url,
      type: "website",
      siteName: "Elite Turf",
      locale: "fr_FR",
    },
    twitter: { card: "summary_large_image", title: edito.titre, description },
  };
}
