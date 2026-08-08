import { describe, it, expect } from "vitest";
import { computeArchiveRow, aggregateArchive, type SnapshotArchiveInput } from "./radar-archive";

function snap(over: Partial<SnapshotArchiveInput>): SnapshotArchiveInput {
  return {
    date_course: "2026-08-07",
    origine: "reconstitution",
    reunion_course: "R1C4",
    hippodrome: "CABOURG",
    type_pari: "QUINTE_PLUS",
    nb_partants: 16,
    nb_sources: 29,
    base: [9, 8, 12, 11],
    value: [13, 10, 5],
    coup: [14],
    selection: [9, 8, 12, 11, 13, 10, 5, 14],
    favori_presse: { numero: 9 },
    favori_marche: { numero: 8 },
    arrivee: [],
    ...over,
  };
}

describe("computeArchiveRow — placés par bloc face au top 5", () => {
  it("compte les placés par bloc et le vainqueur couvert", () => {
    // top5 = 9, 13, 2, 11, 14 → base place 9+11 (2), value place 13 (1), coup place 14 (1)
    const r = computeArchiveRow(snap({ arrivee: [9, 13, 2, 11, 14, 6] }));
    expect(r.top5).toEqual([9, 13, 2, 11, 14]);
    expect(r.placesTop5).toBe(4);
    expect(r.basePlaces).toBe(2);
    expect(r.valuePlaces).toBe(1);
    expect(r.coupPlaces).toBe(1);
    expect(r.vainqueurCouvert).toBe(true); // le n°9 (1er) est dans la sélection
  });

  it("vainqueur non couvert quand le 1er n'est pas dans la sélection", () => {
    const r = computeArchiveRow(snap({ arrivee: [2, 9, 8, 12, 11] }));
    expect(r.vainqueurCouvert).toBe(false);
    expect(r.placesTop5).toBe(4); // 9, 8, 12, 11 placés — mais pas le vainqueur
  });

  it("pas d'arrivée → tout à null, jamais 0 (non jugé ≠ zéro placé)", () => {
    const r = computeArchiveRow(snap({ arrivee: [] }));
    expect(r.placesTop5).toBeNull();
    expect(r.basePlaces).toBeNull();
    expect(r.valuePlaces).toBeNull();
    expect(r.coupPlaces).toBeNull();
    expect(r.vainqueurCouvert).toBeNull();
  });

  it("arrivée PARTIELLE (< 5 classés) → non jugée (ne pas plafonner « x/5 » à tort)", () => {
    // 3-4 numéros seulement : la compter « 3/5 » face à un hasard calculé pour
    // 5 places biaiserait la moyenne vers le bas. On ne juge pas.
    for (const arr of [[9], [9, 8, 12], [9, 8, 12, 11]]) {
      const r = computeArchiveRow(snap({ arrivee: arr }));
      expect(r.placesTop5).toBeNull();
      expect(r.vainqueurCouvert).toBeNull();
    }
  });

  it("hasard borné = taille × min(5, partants) / partants ; null si partants inconnus", () => {
    expect(computeArchiveRow(snap({})).hasardAttendu).toBeCloseTo((8 * 5) / 16, 5);
    // champ de 4 partants : le hasard ne peut pas dépasser la taille (borne min).
    expect(computeArchiveRow(snap({ nb_partants: 4, selection: [1, 2, 3, 4] })).hasardAttendu).toBeCloseTo(4, 5);
    expect(computeArchiveRow(snap({ nb_partants: null })).hasardAttendu).toBeNull();
    expect(computeArchiveRow(snap({ nb_partants: 0 })).hasardAttendu).toBeNull();
  });
});

describe("aggregateArchive — synthèse des courses jugées", () => {
  it("agrège placés, blocs, vainqueur %, 5/5 et hasard moyen (non jugées exclues)", () => {
    const rows = [
      computeArchiveRow(snap({ arrivee: [9, 13, 2, 11, 14] })),   // 4 placés, vainqueur ✓
      computeArchiveRow(snap({ arrivee: [9, 8, 12, 11, 13] })),   // 5 placés (5/5), vainqueur ✓
      computeArchiveRow(snap({ arrivee: [1, 2, 3, 4, 6] })),      // 0 placé
      computeArchiveRow(snap({ arrivee: [] })),                    // non jugée → exclue
    ];
    const agg = aggregateArchive(rows);
    expect(agg.nTotal).toBe(4);
    expect(agg.nJugees).toBe(3);
    expect(agg.placesTotal).toBe(9);
    expect(agg.placesMoyenne).toBeCloseTo(3, 5);
    expect(agg.nCinqSurCinq).toBe(1);
    expect(agg.pctVainqueurCouvert).toBe(67); // 2/3
    expect(agg.base).toEqual({ places: 2 + 4 + 0, slots: 12 });
    expect(agg.value).toEqual({ places: 1 + 1 + 0, slots: 9 });
    expect(agg.coup).toEqual({ places: 1 + 0 + 0, slots: 3 });
    expect(agg.hasardMoyen).toBeCloseTo(2.5, 5);
  });

  it("aucune course jugée → moyennes null, pas de division par zéro", () => {
    const agg = aggregateArchive([computeArchiveRow(snap({ arrivee: [] }))]);
    expect(agg.nJugees).toBe(0);
    expect(agg.placesMoyenne).toBeNull();
    expect(agg.pctVainqueurCouvert).toBeNull();
    expect(agg.hasardMoyen).toBeNull();
  });
});
