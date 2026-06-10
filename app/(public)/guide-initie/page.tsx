/**
 * /guide-initie — page serveur fine.
 *
 * Récupère les compteurs publics réels (téléchargements du guide, table leads)
 * et les passe au composant client (formulaire). Évite tout fetch côté client
 * (anti-pattern corrigé en P1) et tout placeholder codé en dur (audit P5).
 */

import GuideInitieClient from "./GuideInitieClient";
import { getPublicCounters } from "@/lib/metrics/public-counters";

export const revalidate = 3600; // compteur rafraîchi au plus 1×/heure

export default async function GuideInitiePage() {
  const { guideDownloads } = await getPublicCounters();
  return <GuideInitieClient parieursFormes={guideDownloads} />;
}
