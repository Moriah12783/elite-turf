/**
 * Fiche Mali — registre de faits sourcés (cf. ./types.ts).
 * Aucun fait vérifié pour l'instant : les blocs qui en dépendent restent masqués.
 */
import type { FichePays } from "./types";

export const mali: FichePays = {
  slug: "mali",
  fuseau: "Africa/Bamako",
  deviseNative: "XOF",
  editionGuichet: false,
  faq: [],
};
