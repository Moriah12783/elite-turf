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
  const { guideDownloads, tauxGagnant, pronosticsResultes } = await getPublicCounters();
  // Le taux vient de la BASE. La page affichait « 73 % de taux de réussite »
  // en dur, sans source — un chiffre introuvable dans les données (le réel est
  // 44 % de gagnants sur 245 pronostics résultés). Passé en `null` quand
  // l'échantillon est trop mince ou la requête en échec : le badge disparaît
  // alors, plutôt que d'afficher une valeur inventée.
  return (
    <GuideInitieClient
      parieursFormes={guideDownloads}
      tauxGagnant={tauxGagnant}
      pronosticsResultes={pronosticsResultes}
    />
  );
}
