/**
 * Registre des 12 fiches pays (brief « pages pays » du 01/10/2026, §4).
 * Une fiche par fichier : lib/geo/fiches/{slug}.ts.
 */
import type { FichePays } from "./types";
import { coteDIvoire } from "./cote-d-ivoire";
import { senegal } from "./senegal";
import { cameroun } from "./cameroun";
import { maroc } from "./maroc";
import { mali } from "./mali";
import { burkinaFaso } from "./burkina-faso";
import { tchad } from "./tchad";
import { gabon } from "./gabon";
import { togo } from "./togo";
import { congoBrazzaville } from "./congo-brazzaville";
import { madagascar } from "./madagascar";
import { reunion } from "./reunion";

export const FICHES: FichePays[] = [
  coteDIvoire,
  senegal,
  cameroun,
  maroc,
  mali,
  burkinaFaso,
  tchad,
  gabon,
  togo,
  congoBrazzaville,
  madagascar,
  reunion,
];

export const FICHE_PAR_SLUG: Record<string, FichePays> = {};
for (let i = 0; i < FICHES.length; i++) FICHE_PAR_SLUG[FICHES[i].slug] = FICHES[i];
