import { describe, it, expect } from "vitest";
import {
  isRadarPublishableStatus,
  shapeRadarFromConsensus,
  pickFavoriMarche,
  snapshotRowFromRadar,
  type RadarVedette,
} from "./radar-vedette";

describe("isRadarPublishableStatus — tout sauf un consensus rejeté", () => {
  it("laisse passer draft, reviewed et published ; bloque le seul rejected", () => {
    // Un `draft` DOIT passer : le pipeline dépose vers 10h et la relecture
    // humaine vient bien plus tard. L'exiger laissait le Radar vide toute la
    // matinée (constaté en prod le 08/08). Le garde-fou est le rejet explicite.
    expect(isRadarPublishableStatus("draft")).toBe(true);
    expect(isRadarPublishableStatus("reviewed")).toBe(true);
    expect(isRadarPublishableStatus("published")).toBe(true);
    expect(isRadarPublishableStatus("rejected")).toBe(false);
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

describe("snapshotRowFromRadar — scellement quotidien du Radar", () => {
  const RADAR: RadarVedette = {
    hippodrome:    "CABOURG",
    course:        "R1C4",
    nbPartants:    16,
    nbSources:     29,
    typePariLabel: "Quinté+",
    base:          [9, 8, 12, 11],
    value:         [13, 10, 5],
    coup:          [14],
    favori:        { numero: 9, citations: 29, tauxPct: 100 },
    favoriMarche:  { numero: 8, cote: 3.4 },
  };

  it("fige la sélection affichée + le contexte du calcul, en origine live", () => {
    const row = snapshotRowFromRadar(RADAR, {
      dateCourse:     "2026-08-07",
      typePari:       "QUINTE_PLUS",
      courseId:       "abc-123",
      selection:      [9, 8, 12, 11, 13, 10, 5, 14],
      nonPartants:    [7],
      cotesUtilisees: { "9": 4.5, "8": 3.4 },
    });
    expect(row.date_course).toBe("2026-08-07");
    expect(row.origine).toBe("live");
    expect(row.reunion_course).toBe("R1C4");
    expect(row.hippodrome).toBe("CABOURG");
    expect(row.type_pari).toBe("QUINTE_PLUS");
    expect(row.nb_partants).toBe(16);
    expect(row.nb_sources).toBe(29);
    expect(row.course_id).toBe("abc-123");
    expect(row.base).toEqual([9, 8, 12, 11]);
    expect(row.value).toEqual([13, 10, 5]);
    expect(row.coup).toEqual([14]);
    expect(row.selection).toEqual([9, 8, 12, 11, 13, 10, 5, 14]);
    expect(row.favori_presse).toEqual({ numero: 9, citations: 29, tauxPct: 100 });
    expect(row.favori_marche).toEqual({ numero: 8, cote: 3.4 });
    expect(row.cotes_utilisees).toEqual({ "9": 4.5, "8": 3.4 });
  });

  it("déduplique les non-partants (brouillon + table partants signalent souvent les mêmes)", () => {
    const row = snapshotRowFromRadar(RADAR, {
      dateCourse: "2026-08-07", typePari: null, courseId: null,
      selection: [], nonPartants: [7, 3, 7, 3, 15], cotesUtilisees: {},
    });
    expect(row.non_partants).toEqual([7, 3, 15]);
  });
});
