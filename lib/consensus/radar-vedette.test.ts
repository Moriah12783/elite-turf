import { describe, it, expect } from "vitest";
import { isRadarPublishableStatus, shapeRadarFromConsensus, pickFavoriMarche } from "./radar-vedette";

describe("isRadarPublishableStatus — validation humaine avant exposition", () => {
  it("autorise uniquement reviewed et published", () => {
    expect(isRadarPublishableStatus("reviewed")).toBe(true);
    expect(isRadarPublishableStatus("published")).toBe(true);
    expect(isRadarPublishableStatus("draft")).toBe(false);
    expect(isRadarPublishableStatus("rejected")).toBe(false);
    expect(isRadarPublishableStatus(null)).toBe(false);
  });
});
import type { ConsensusResult, PartantScored } from "./engine";

describe("pickFavoriMarche — plus basse cote PMU (jamais le 1,2 LONACI)", () => {
  it("prend la plus basse cote source=pmu ; ignore lonaci + non-partants", () => {
    const rows = [
      { numero: 1, cote: 24,  cote_source: "pmu",    non_partant: false },
      { numero: 3, cote: 5,   cote_source: "pmu",    non_partant: false },
      { numero: 4, cote: 1.2, cote_source: "lonaci", non_partant: false }, // placeholder → ignoré
      { numero: 6, cote: 5.6, cote_source: "pmu",    non_partant: false },
      { numero: 9, cote: 2,   cote_source: "pmu",    non_partant: true },   // NP → ignoré
    ];
    expect(pickFavoriMarche(rows)).toEqual({ numero: 3, cote: 5 });
  });

  it("aucune cote PMU fiable → null (rien plutôt qu'une fausse info)", () => {
    expect(pickFavoriMarche([{ numero: 1, cote: 1.2, cote_source: "lonaci", non_partant: false }])).toBeNull();
    expect(pickFavoriMarche([])).toBeNull();
    expect(pickFavoriMarche(null)).toBeNull();
  });
});

function scored(over: Partial<PartantScored>): PartantScored {
  return {
    numero: 0, citations: 0, bases: 0, tauxCitation: 0, cote: null,
    categorie: "OUTSIDER", scoreConsensus: 0, nonPartant: false, ...over,
  };
}

function mkResult(over: Partial<ConsensusResult>): ConsensusResult {
  return {
    nbSources: 29,
    partants: [],
    topCites: [], topFavoris: [], topOutsiders: [], topTocards: [],
    elite: { base: [], value: [], coup: [], selection: [] },
    pro: { base: [], value: [], coup: [], selection: [] },
    seuilBase: 9,
    ...over,
  };
}

const PARTANTS = [
  scored({ numero: 9, citations: 29, tauxCitation: 1 }),
  scored({ numero: 8, citations: 28, tauxCitation: 28 / 29 }),
  scored({ numero: 4, citations: 30, tauxCitation: 1, nonPartant: true }), // NP très cité → ignoré
];

describe("shapeRadarFromConsensus — consensus → Radar", () => {
  it("prend la sélection PRO (base/value/coup) + méta course", () => {
    const r = shapeRadarFromConsensus(
      mkResult({
        pro: { base: [9, 8, 12, 11], value: [13, 10], coup: [14], selection: [9, 8, 12, 11, 13, 10, 14] },
        partants: PARTANTS,
      }),
      { hippodrome: "PORNICHET", course: "R1C5", nbPartants: 14, typePari: "QUINTE_PLUS" },
    )!;
    expect(r.base).toEqual([9, 8, 12, 11]);
    expect(r.value).toEqual([13, 10]);
    expect(r.coup).toEqual([14]);
    expect(r.hippodrome).toBe("PORNICHET");
    expect(r.course).toBe("R1C5");
    expect(r.nbPartants).toBe(14);
    expect(r.nbSources).toBe(29);
    expect(r.typePariLabel).toBe("Quinté+");
  });

  it("favori = le plus cité PARMI LES PARTANTS (un non-partant est ignoré)", () => {
    const r = shapeRadarFromConsensus(
      mkResult({ pro: { base: [9], value: [], coup: [], selection: [9] }, partants: PARTANTS }),
      {},
    )!;
    // n°4 a 30 citations mais est non-partant → favori = n°9 (29/29 = 100 %)
    expect(r.favori).toEqual({ numero: 9, citations: 29, tauxPct: 100 });
  });

  it("null / sélection PRO vide → null (repli, jamais de chiffres inventés)", () => {
    expect(shapeRadarFromConsensus(null, {})).toBeNull();
    expect(shapeRadarFromConsensus(undefined, {})).toBeNull();
    expect(shapeRadarFromConsensus(mkResult({ pro: { base: [], value: [], coup: [], selection: [] } }), {})).toBeNull();
  });

  it("type_pari inconnu → libellé de repli neutre", () => {
    const r = shapeRadarFromConsensus(
      mkResult({ pro: { base: [1], value: [], coup: [], selection: [1] }, partants: [scored({ numero: 1, citations: 5, tauxCitation: 0.5 })] }),
      { typePari: "XYZ" },
    )!;
    expect(r.typePariLabel).toBe("La course vedette");
    expect(r.favori).toEqual({ numero: 1, citations: 5, tauxPct: 50 });
  });
});
