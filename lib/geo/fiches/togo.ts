/**
 * Fiche Togo — registre de faits sourcés (cf. ./types.ts).
 * Aucun fait vérifié pour l'instant : les blocs qui en dépendent restent masqués.
 */
import type { FichePays } from "./types";

export const togo: FichePays = {
  slug: "togo",
  fuseau: "Africa/Lome",
  deviseNative: "XOF",
  editionGuichet: false,
  faq: [],
};
