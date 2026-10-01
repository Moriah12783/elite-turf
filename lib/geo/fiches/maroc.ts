/**
 * Fiche Maroc — registre de faits sourcés (cf. ./types.ts).
 * Aucun fait vérifié pour l'instant : les blocs qui en dépendent restent masqués.
 */
import type { FichePays } from "./types";

export const maroc: FichePays = {
  slug: "maroc",
  fuseau: "Africa/Casablanca",
  deviseNative: "MAD",
  editionGuichet: false,
  faq: [],
};
