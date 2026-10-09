import { describe, it, expect } from "vitest";
import { resoudreCoursePmu, deciderLigne, doublons, FIN_RAPPORTS_GENY } from "./pmu-rapports-remplacement";
import type { RapportsPMU } from "./geny-rapports-parser";

// Programme PMU du 07/06/2026, réduit : Strasbourg est R12 au PMU, R9 en base.
const PMU = new Map([
  ["1|1", { arrivee: [2, 7, 4, 6, 1], rangs: [1, 2, 3, 4, 5] }],
  ["12|1", { arrivee: [2, 10, 11, 5, 8], rangs: [1, 2, 3, 4, 5] }],
  ["11|1", { arrivee: [3, 1, 9, 4, 2], rangs: [1, 2, 3, 4, 5] }],
  ["10|1", { arrivee: [3, 1, 9, 6, 7], rangs: [1, 2, 3, 4, 5] }],
]);

describe("resoudreCoursePmu — quelle course PMU a notre arrivée ?", () => {
  it("notre R/C concorde → cette course", () => {
    expect(resoudreCoursePmu([2, 7, 4, 6], 1, 1, PMU)).toEqual({ etat: "trouvee", R: 1, C: 1 });
  });

  it("réunion numérotée autrement en base → la course PMU de même numéro qui a notre arrivée", () => {
    expect(resoudreCoursePmu([2, 10, 11, 5], 9, 1, PMU)).toEqual({ etat: "trouvee", R: 12, C: 1 });
  });

  it("aucune course PMU du jour n'a notre arrivée → introuvable", () => {
    expect(resoudreCoursePmu([8, 5, 3], 9, 1, PMU)).toEqual({ etat: "introuvable" });
  });

  it("deux courses PMU ont nos 3 premiers, aucune n'est notre R/C → ambiguë", () => {
    expect(resoudreCoursePmu([3, 1, 9], 9, 1, PMU)).toEqual({ etat: "ambigue" });
  });

  it("notre R/C fait partie des courses qui concordent → on garde notre R/C", () => {
    expect(resoudreCoursePmu([3, 1, 9], 11, 1, PMU)).toEqual({ etat: "trouvee", R: 11, C: 1 });
  });

  it("programme PMU indisponible → on ne conclut rien", () => {
    expect(resoudreCoursePmu([2, 7, 4], 1, 1, new Map())).toEqual({ etat: "pmu_indisponible" });
  });
});

describe("doublons — deux lignes de la base pour une seule course PMU", () => {
  it("même jour, même course PMU → les deux lignes", () => {
    const d = doublons([
      { id: "a", date: "2026-10-03", resolution: { etat: "trouvee", R: 10, C: 7 } },
      { id: "b", date: "2026-10-03", resolution: { etat: "trouvee", R: 10, C: 7 } },
      { id: "c", date: "2026-10-03", resolution: { etat: "trouvee", R: 9, C: 7 } },
      { id: "d", date: "2026-10-04", resolution: { etat: "trouvee", R: 10, C: 7 } },
      { id: "e", date: "2026-10-03", resolution: { etat: "introuvable" } },
    ]);
    expect(Array.from(d).sort()).toEqual(["a", "b"]);
  });
});

const GENY = "2026-06-07";
const PMU_ERE = "2026-10-04";
const fantome: RapportsPMU = { tierce: { ordre: 900, desordre: 8.54 }, quinte_plus: { ordre: 900 }, simple_gagnant: 8.54 };
const officiel: RapportsPMU = {
  simple_gagnant: 5.8, couple_gagnant: 32.3,
  combinaisons: { source: "internet", lignes: [] },
};
const trouvee = { etat: "trouvee" as const, R: 1, C: 8 };

describe("deciderLigne — ère Geny (jusqu'au " + FIN_RAPPORTS_GENY + ")", () => {
  it("course retrouvée au PMU → rapports remplacés par ceux du PMU", () => {
    expect(deciderLigne({ date: GENY, existant: fantome, resolution: trouvee, frais: officiel, doublon: false }))
      .toEqual({ action: "remplacer", rapports: officiel });
  });

  it("déjà identiques au PMU → rien à faire", () => {
    expect(deciderLigne({ date: GENY, existant: officiel, resolution: trouvee, frais: officiel, doublon: false }).action)
      .toBe("inchange");
  });

  it("invérifiable (aucune course PMU, ambiguë, doublon, PMU sans rapport exploitable) → vidé", () => {
    expect(deciderLigne({ date: GENY, existant: fantome, resolution: { etat: "introuvable" }, frais: null, doublon: false }).action).toBe("vider");
    expect(deciderLigne({ date: GENY, existant: fantome, resolution: { etat: "ambigue" }, frais: null, doublon: false }).action).toBe("vider");
    expect(deciderLigne({ date: GENY, existant: fantome, resolution: trouvee, frais: officiel, doublon: true }).action).toBe("vider");
    expect(deciderLigne({ date: GENY, existant: fantome, resolution: trouvee, frais: null, doublon: false }).action).toBe("vider");
  });

  it("réseau : programme ou rapports PMU indisponibles → réessayer, jamais vider", () => {
    expect(deciderLigne({ date: GENY, existant: fantome, resolution: { etat: "pmu_indisponible" }, frais: null, doublon: false }).action).toBe("reessayer");
    expect(deciderLigne({ date: GENY, existant: fantome, resolution: trouvee, frais: "indisponible", doublon: false }).action).toBe("reessayer");
  });
});

describe("deciderLigne — ère PMU (après le " + FIN_RAPPORTS_GENY + ")", () => {
  const sansCombinaisons: RapportsPMU = { simple_gagnant: 5.8, couple_gagnant: 32.3 };

  it("mêmes montants, seule la clé `combinaisons` manque → rien à faire", () => {
    expect(deciderLigne({ date: PMU_ERE, existant: sansCombinaisons, resolution: trouvee, frais: officiel, doublon: false }).action)
      .toBe("inchange");
  });

  it("montant différent (Quinté+ « Ordre + Tirelire ») → remplacé", () => {
    const tirelire: RapportsPMU = { quinte_plus: { ordre: 117619.4, desordre: 182.4 } };
    const juste: RapportsPMU = { quinte_plus: { ordre: 17619.4, desordre: 182.4 }, combinaisons: { source: "internet", lignes: [] } };
    expect(deciderLigne({ date: PMU_ERE, existant: tirelire, resolution: trouvee, frais: juste, doublon: false }))
      .toEqual({ action: "remplacer", rapports: juste });
  });

  it("invérifiable → laissé tel quel (ces rapports viennent déjà du PMU)", () => {
    expect(deciderLigne({ date: PMU_ERE, existant: sansCombinaisons, resolution: { etat: "introuvable" }, frais: null, doublon: false }).action).toBe("laisser");
    expect(deciderLigne({ date: PMU_ERE, existant: sansCombinaisons, resolution: trouvee, frais: officiel, doublon: true }).action).toBe("laisser");
  });
});
