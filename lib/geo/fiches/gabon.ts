/**
 * Fiche Gabon — registre de faits sourcés (cf. ./types.ts).
 * Aucun fait vérifié pour l'instant : les blocs qui en dépendent restent masqués.
 */
import type { FichePays } from "./types";

export const gabon: FichePays = {
  slug: "gabon",
  fuseau: "Africa/Libreville",
  deviseNative: "XAF",
  editionGuichet: false,
  faq: [],
};
