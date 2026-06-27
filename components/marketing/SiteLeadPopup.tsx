"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ExitIntentPopup from "@/components/blog/ExitIntentPopup";

/**
 * Monte le popup de capture (guide gratuit → table `leads` + email du guide)
 * sur TOUT le site public, mais uniquement pour les visiteurs ANONYMES
 * (non connectés) : ce sont eux qui apportent de nouveaux emails au CRM.
 *
 * - Détection anonyme 100 % côté client (auth.getSession lit le cookie, pas
 *   de requête réseau) → aucune dé-optimisation du cache SSG/ISR des pages.
 * - Exclut les pages de conversion / compte / guide où le popup n'a pas sa place.
 * - Le cap de fréquence (7 j) et l'anti-doublon sont gérés dans ExitIntentPopup.
 */
const EXCLUDED_PREFIXES = [
  "/abonnements",
  "/paiement",
  "/connexion",
  "/inscription",
  "/espace",
  "/completer-profil",
  "/guide-gratuit",
  "/guide-initie",
  "/admin",
];

export default function SiteLeadPopup() {
  const pathname = usePathname();
  const [anonymous, setAnonymous] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setAnonymous(!data.session);
      })
      .catch(() => {
        // En cas d'échec, on considère anonyme (cible la plus large, sans risque membre)
        if (active) setAnonymous(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Tant qu'on ne sait pas, ou si l'utilisateur est connecté → ne rien afficher.
  if (anonymous !== true) return null;

  // Pages où le popup serait redondant ou contre-productif.
  if (pathname && EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return <ExitIntentPopup source="popup-site" />;
}
