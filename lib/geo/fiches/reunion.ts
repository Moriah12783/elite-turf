/**
 * Fiche La Réunion — registre de faits sourcés (cf. ./types.ts).
 * Aucun fait vérifié pour l'instant : les blocs qui en dépendent restent masqués.
 */
import type { FichePays } from "./types";

export const reunion: FichePays = {
  slug: "reunion",
  fuseau: "Indian/Reunion",
  deviseNative: "EUR",
  editionGuichet: false,
  faq: [],
};
