/**
 * Détection pays côté serveur via header Cloudflare CF-IPCountry.
 *
 * Cloudflare Workers ajoute automatiquement `CF-IPCountry` à chaque request,
 * basé sur la géolocalisation IP du visiteur. Pas besoin d'API externe.
 *
 * Usage server component :
 *   import { headers } from "next/headers";
 *   import { detectCountryFromHeaders } from "@/lib/geo/detect-country";
 *
 *   const country = detectCountryFromHeaders(headers());
 *   // country: Country | null
 *
 * Si pas de header (dev local, request sans CF) → fallback null → on affiche
 * en EUR par défaut. C'est OK : un Français qui voit EUR en gros, c'est attendu.
 */

import { COUNTRY_BY_CODE, type Country } from "./countries";

/** Lit le header CF-IPCountry et renvoie le Country correspondant. */
export function detectCountryFromHeaders(
  h: Headers | { get(name: string): string | null },
): Country | null {
  const code = h.get("cf-ipcountry") || h.get("CF-IPCountry");
  if (!code) return null;
  const upper = code.toUpperCase();
  return COUNTRY_BY_CODE[upper] ?? null;
}
