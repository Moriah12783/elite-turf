/**
 * lib/rapports-pmu-format.ts
 *
 * Convertit la structure JSONB `rapports_pmu` (issue du parser Geny) en la
 * forme attendue par CourseTabsClient (`Rapport[]` avec `dividendes[]`),
 * en construisant les `combinaison` labels à partir de l'ordre d'arrivée.
 *
 * Cette couche d'adaptation maintient l'API stable côté front même si on
 * change de source de données (Geny scrape → PMU API → autres).
 */

import type { RapportsPMU } from "@/lib/sync/geny-rapports-parser";

export interface Dividende {
  combinaison: string;
  rapport:     number | null;
}

export interface Rapport {
  typePari:   string;
  label:      string;
  dividendes: Dividende[];
}

/** Joint un sous-ensemble de l'arrivée par "-". Renvoie null si arrivée trop courte. */
function joinArrivee(arrivee: number[], n: number): string | null {
  if (arrivee.length < n) return null;
  return arrivee.slice(0, n).join("-");
}

/**
 * Convertit la structure JSONB `rapports_pmu` (issue du parser Geny) en la
 * forme `Rapport[]` attendue par CourseTabsClient.
 *
 * @param rapports JSONB stocké en DB (peut être null)
 * @param arrivee  Array d'arrivée officielle, ex [4, 9, 12, 7, 1]
 */
export function jsonbRapportsToRapportsList(
  rapports: RapportsPMU | null | undefined,
  arrivee: number[],
): Rapport[] {
  if (!rapports) return [];
  const out: Rapport[] = [];

  // ── Simple Gagnant ──────────────────────────────────────────────
  if (typeof rapports.simple_gagnant === "number") {
    const cmb = joinArrivee(arrivee, 1) ?? "1er";
    out.push({
      typePari:   "SIMPLE_GAGNANT",
      label:      "Simple Gagnant",
      dividendes: [{ combinaison: cmb, rapport: rapports.simple_gagnant }],
    });
  }

  // ── Simple Placé (3 montants : 1er, 2e, 3e) ────────────────────
  if (Array.isArray(rapports.simple_place) && rapports.simple_place.length > 0) {
    out.push({
      typePari: "SIMPLE_PLACE",
      label:    "Simple Placé",
      dividendes: rapports.simple_place.map((r, i) => ({
        combinaison: arrivee[i] != null ? String(arrivee[i]) : `${i + 1}e`,
        rapport:     r,
      })),
    });
  }

  // ── Couplé Gagnant ─────────────────────────────────────────────
  if (typeof rapports.couple_gagnant === "number") {
    const cmb = joinArrivee(arrivee, 2) ?? "1-2";
    out.push({
      typePari:   "COUPLE_GAGNANT",
      label:      "Couplé Gagnant",
      dividendes: [{ combinaison: cmb, rapport: rapports.couple_gagnant }],
    });
  }

  // ── Couplé Placé (3 combinaisons : 1-2, 1-3, 2-3) ──────────────
  if (Array.isArray(rapports.couple_place) && rapports.couple_place.length > 0) {
    const labels = arrivee.length >= 3
      ? [`${arrivee[0]}-${arrivee[1]}`, `${arrivee[0]}-${arrivee[2]}`, `${arrivee[1]}-${arrivee[2]}`]
      : ["1-2", "1-3", "2-3"];
    out.push({
      typePari: "COUPLE_PLACE",
      label:    "Couplé Placé",
      dividendes: rapports.couple_place.map((r, i) => ({
        combinaison: labels[i] ?? `combo ${i + 1}`,
        rapport:     r,
      })),
    });
  }

  // ── Trio ───────────────────────────────────────────────────────
  if (typeof rapports.trio === "number") {
    const cmb = joinArrivee(arrivee, 3) ?? "1-2-3";
    out.push({
      typePari:   "TRIO",
      label:      "Trio",
      dividendes: [{ combinaison: cmb, rapport: rapports.trio }],
    });
  }

  // ── 2 sur 4 ────────────────────────────────────────────────────
  if (typeof rapports.deux_sur_quatre === "number") {
    out.push({
      typePari:   "DEUX_SUR_QUATRE",
      label:      "2 sur 4",
      dividendes: [{ combinaison: "2 dans les 4 premiers", rapport: rapports.deux_sur_quatre }],
    });
  }

  // ── Tiercé ─────────────────────────────────────────────────────
  if (rapports.tierce) {
    const dividendes: Dividende[] = [];
    const cmb = joinArrivee(arrivee, 3) ?? "1-2-3";
    if (typeof rapports.tierce.ordre === "number") {
      dividendes.push({ combinaison: `${cmb} (Ordre)`, rapport: rapports.tierce.ordre });
    }
    if (typeof rapports.tierce.desordre === "number") {
      dividendes.push({ combinaison: `${cmb} (Désordre)`, rapport: rapports.tierce.desordre });
    }
    if (dividendes.length > 0) {
      out.push({ typePari: "TIERCE", label: "Tiercé", dividendes });
    }
  }

  // ── Quarté+ ────────────────────────────────────────────────────
  if (rapports.quarte_plus) {
    const dividendes: Dividende[] = [];
    const cmb4 = joinArrivee(arrivee, 4) ?? "1-2-3-4";
    if (typeof rapports.quarte_plus.ordre === "number") {
      dividendes.push({ combinaison: `${cmb4} (Ordre)`, rapport: rapports.quarte_plus.ordre });
    }
    if (typeof rapports.quarte_plus.desordre === "number") {
      dividendes.push({ combinaison: `${cmb4} (Désordre)`, rapport: rapports.quarte_plus.desordre });
    }
    if (typeof rapports.quarte_plus.bonus === "number") {
      dividendes.push({ combinaison: "Bonus 3", rapport: rapports.quarte_plus.bonus });
    }
    if (dividendes.length > 0) {
      out.push({ typePari: "QUARTE_PLUS", label: "Quarté+", dividendes });
    }
  }

  // ── Quinté+ ────────────────────────────────────────────────────
  if (rapports.quinte_plus) {
    const dividendes: Dividende[] = [];
    const cmb5 = joinArrivee(arrivee, 5) ?? "1-2-3-4-5";
    if (typeof rapports.quinte_plus.ordre === "number") {
      dividendes.push({ combinaison: `${cmb5} (Ordre)`, rapport: rapports.quinte_plus.ordre });
    }
    if (typeof rapports.quinte_plus.desordre === "number") {
      dividendes.push({ combinaison: `${cmb5} (Désordre)`, rapport: rapports.quinte_plus.desordre });
    }
    if (typeof rapports.quinte_plus.bonus4 === "number") {
      dividendes.push({ combinaison: "Bonus 4", rapport: rapports.quinte_plus.bonus4 });
    }
    if (typeof rapports.quinte_plus.bonus3 === "number") {
      dividendes.push({ combinaison: "Bonus 3", rapport: rapports.quinte_plus.bonus3 });
    }
    if (dividendes.length > 0) {
      out.push({ typePari: "QUINTE_PLUS", label: "Quinté+", dividendes });
    }
  }

  // ── Multi (4 montants : en 4, 5, 6, 7) ─────────────────────────
  if (rapports.multi) {
    const dividendes: Dividende[] = [];
    if (typeof rapports.multi.en_4 === "number") dividendes.push({ combinaison: "Multi en 4", rapport: rapports.multi.en_4 });
    if (typeof rapports.multi.en_5 === "number") dividendes.push({ combinaison: "Multi en 5", rapport: rapports.multi.en_5 });
    if (typeof rapports.multi.en_6 === "number") dividendes.push({ combinaison: "Multi en 6", rapport: rapports.multi.en_6 });
    if (typeof rapports.multi.en_7 === "number") dividendes.push({ combinaison: "Multi en 7", rapport: rapports.multi.en_7 });
    if (dividendes.length > 0) {
      out.push({ typePari: "MULTI", label: "Multi", dividendes });
    }
  }

  return out;
}
