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

import type { CombinaisonPayee, RapportsPMU } from "@/lib/sync/geny-rapports-parser";

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
 * Ex æquo : le PMU paie plusieurs combinaisons pour un même pari, et les
 * champs historiques n'en gardent qu'une — sous l'étiquette, construite depuis
 * l'arrivée, d'une autre parfois (Ville de Paris, 21/05/2026 : 147 € affiché
 * pour 4-11-3, payé pour 4-11-6). Quand `combinaisons` les donne, chaque
 * combinaison est affichée avec son montant, telle que le PMU la publie.
 */
function aDesCombinaisons(rapports: RapportsPMU, pari: CombinaisonPayee["pari"]): boolean {
  const lignes = rapports.combinaisons ? rapports.combinaisons.lignes : [];
  return lignes.some((l) => l.pari === pari);
}

function combinaisonsPayees(rapports: RapportsPMU, pari: CombinaisonPayee["pari"], type?: "ordre" | "desordre"): Dividende[] {
  const lignes = rapports.combinaisons ? rapports.combinaisons.lignes : [];
  const suffixe = type === "ordre" ? " (Ordre)" : type === "desordre" ? " (Désordre)" : "";
  return lignes
    .filter((l) => l.pari === pari && l.type === type)
    .map((l) => ({ combinaison: `${l.combinaison}${suffixe}`, rapport: l.rapport }));
}

/** Le PMU paie-t-il plusieurs combinaisons pour ce pari (ex æquo) ? */
export function plusieursCombinaisons(rapports: RapportsPMU, pari: CombinaisonPayee["pari"]): boolean {
  return aDesCombinaisons(rapports, pari);
}

export interface CaseRapport {
  label: string;
  value: number;
  accent: boolean;
}

/**
 * Cases de la grille Quinté+ (page des arrivées du jour) : Ordre, Désordre,
 * Bonus 4, Bonus 3. Ex æquo : une case par combinaison payée (« Ordre
 * 1-5-8-4-15 », « Ordre 1-5-8-4-16 »). Valeurs absentes omises.
 */
export function casesQuinte(rapports: RapportsPMU | null | undefined): CaseRapport[] {
  if (!rapports) return [];
  const q = rapports.quinte_plus;
  const multiples = aDesCombinaisons(rapports, "QUINTE_PLUS");
  if (!q && !multiples) return [];
  const out: CaseRapport[] = [];
  const types: ["ordre" | "desordre", string, boolean, number | undefined][] = [
    ["ordre", "Ordre", true, q ? q.ordre : undefined],
    ["desordre", "Désordre", false, q ? q.desordre : undefined],
  ];
  for (const [type, label, accent, valeur] of types) {
    if (multiples) {
      for (const l of (rapports.combinaisons as { lignes: CombinaisonPayee[] }).lignes) {
        if (l.pari === "QUINTE_PLUS" && l.type === type) out.push({ label: `${label} ${l.combinaison}`, value: l.rapport, accent });
      }
    } else if (typeof valeur === "number") {
      out.push({ label, value: valeur, accent });
    }
  }
  if (q && typeof q.bonus4 === "number") out.push({ label: "Bonus 4", value: q.bonus4, accent: false });
  if (q && typeof q.bonus3 === "number") out.push({ label: "Bonus 3", value: q.bonus3, accent: false });
  return out;
}

/**
 * Ordre et Désordre d'un Tiercé, Quarté+ ou Quinté+ : toutes les combinaisons
 * payées si elles sont connues (ex æquo), sinon les champs historiques sous
 * l'étiquette construite depuis l'arrivée.
 */
function ordreDesordre(
  rapports: RapportsPMU,
  pari: CombinaisonPayee["pari"],
  champs: { ordre?: number; desordre?: number } | undefined,
  etiquette: string,
): Dividende[] {
  if (aDesCombinaisons(rapports, pari)) {
    return combinaisonsPayees(rapports, pari, "ordre").concat(combinaisonsPayees(rapports, pari, "desordre"));
  }
  const out: Dividende[] = [];
  if (champs && typeof champs.ordre === "number") out.push({ combinaison: `${etiquette} (Ordre)`, rapport: champs.ordre });
  if (champs && typeof champs.desordre === "number") out.push({ combinaison: `${etiquette} (Désordre)`, rapport: champs.desordre });
  return out;
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
  if (aDesCombinaisons(rapports, "SIMPLE_GAGNANT")) {
    out.push({ typePari: "SIMPLE_GAGNANT", label: "Simple Gagnant", dividendes: combinaisonsPayees(rapports, "SIMPLE_GAGNANT") });
  } else if (typeof rapports.simple_gagnant === "number") {
    const cmb = joinArrivee(arrivee, 1) ?? "1er";
    out.push({
      typePari:   "SIMPLE_GAGNANT",
      label:      "Simple Gagnant",
      dividendes: [{ combinaison: cmb, rapport: rapports.simple_gagnant }],
    });
  }

  // ── Simple Placé (3 montants : 1er, 2e, 3e) ────────────────────
  if (aDesCombinaisons(rapports, "SIMPLE_PLACE")) {
    out.push({ typePari: "SIMPLE_PLACE", label: "Simple Placé", dividendes: combinaisonsPayees(rapports, "SIMPLE_PLACE") });
  } else if (Array.isArray(rapports.simple_place) && rapports.simple_place.length > 0) {
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
  if (aDesCombinaisons(rapports, "COUPLE_GAGNANT")) {
    out.push({ typePari: "COUPLE_GAGNANT", label: "Couplé Gagnant", dividendes: combinaisonsPayees(rapports, "COUPLE_GAGNANT") });
  } else if (typeof rapports.couple_gagnant === "number") {
    const cmb = joinArrivee(arrivee, 2) ?? "1-2";
    out.push({
      typePari:   "COUPLE_GAGNANT",
      label:      "Couplé Gagnant",
      dividendes: [{ combinaison: cmb, rapport: rapports.couple_gagnant }],
    });
  }

  // ── Couplé Placé (3 combinaisons : 1-2, 1-3, 2-3) ──────────────
  if (aDesCombinaisons(rapports, "COUPLE_PLACE")) {
    out.push({ typePari: "COUPLE_PLACE", label: "Couplé Placé", dividendes: combinaisonsPayees(rapports, "COUPLE_PLACE") });
  } else if (Array.isArray(rapports.couple_place) && rapports.couple_place.length > 0) {
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
  if (aDesCombinaisons(rapports, "TRIO")) {
    out.push({ typePari: "TRIO", label: "Trio", dividendes: combinaisonsPayees(rapports, "TRIO") });
  } else if (typeof rapports.trio === "number") {
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

  // ── Tiercé, Quarté+, Quinté+ : ordre et désordre, puis bonus ───
  const tierce = ordreDesordre(rapports, "TIERCE", rapports.tierce, joinArrivee(arrivee, 3) ?? "1-2-3");
  if (tierce.length > 0) out.push({ typePari: "TIERCE", label: "Tiercé", dividendes: tierce });

  const quarte = ordreDesordre(rapports, "QUARTE_PLUS", rapports.quarte_plus, joinArrivee(arrivee, 4) ?? "1-2-3-4");
  if (typeof rapports.quarte_plus?.bonus === "number") quarte.push({ combinaison: "Bonus 3", rapport: rapports.quarte_plus.bonus });
  if (quarte.length > 0) out.push({ typePari: "QUARTE_PLUS", label: "Quarté+", dividendes: quarte });

  const quinte = ordreDesordre(rapports, "QUINTE_PLUS", rapports.quinte_plus, joinArrivee(arrivee, 5) ?? "1-2-3-4-5");
  if (typeof rapports.quinte_plus?.bonus4 === "number") quinte.push({ combinaison: "Bonus 4", rapport: rapports.quinte_plus.bonus4 });
  if (typeof rapports.quinte_plus?.bonus3 === "number") quinte.push({ combinaison: "Bonus 3", rapport: rapports.quinte_plus.bonus3 });
  if (quinte.length > 0) out.push({ typePari: "QUINTE_PLUS", label: "Quinté+", dividendes: quinte });

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
