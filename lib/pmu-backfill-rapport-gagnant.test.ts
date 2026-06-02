import { describe, it, expect } from "vitest";
import {
  planBackfillRapportGagnant,
  type BackfillRow,
} from "./pmu-backfill-rapport-gagnant";

/**
 * Tests de la décision PURE : à partir des lignes déjà récupérées, que
 * remplit-on (toUpdate) et que skippe-t-on (skipped + raison) ?
 * L'IO (fetch/update Supabase) n'est pas testé ici — c'est de la glue.
 */
describe("planBackfillRapportGagnant", () => {
  it("remplit un gagnant calculable (QUINTÉ+ désordre)", () => {
    const rows: BackfillRow[] = [
      {
        id: "p1",
        type_pari: "QUINTE_PLUS",
        resultat: "GAGNANT",
        rapport_gagnant: null,
        course: {
          libelle: "Prix X",
          arrivees: [{ rapports_pmu: { quinte_plus: { desordre: 120 } } as never }],
        },
      },
    ];
    const { toUpdate, skipped } = planBackfillRapportGagnant(rows, false);
    expect(skipped).toHaveLength(0);
    expect(toUpdate).toEqual([
      { id: "p1", rapport: 120, libelle: "Prix X", typePari: "QUINTE_PLUS", resultat: "GAGNANT" },
    ]);
  });

  it("skip ceux déjà remplis quand includeAll=false", () => {
    const rows: BackfillRow[] = [
      {
        id: "p1",
        type_pari: "QUINTE_PLUS",
        resultat: "GAGNANT",
        rapport_gagnant: 50,
        course: {
          libelle: "X",
          arrivees: [{ rapports_pmu: { quinte_plus: { desordre: 120 } } as never }],
        },
      },
    ];
    const { toUpdate, skipped } = planBackfillRapportGagnant(rows, false);
    expect(toUpdate).toHaveLength(0);
    expect(skipped[0].reason).toBe("already filled");
  });

  it("includeAll=true recalcule même les déjà remplis", () => {
    const rows: BackfillRow[] = [
      {
        id: "p1",
        type_pari: "QUINTE_PLUS",
        resultat: "GAGNANT",
        rapport_gagnant: 50,
        course: {
          libelle: "X",
          arrivees: [{ rapports_pmu: { quinte_plus: { desordre: 120 } } as never }],
        },
      },
    ];
    const { toUpdate } = planBackfillRapportGagnant(rows, true);
    expect(toUpdate).toHaveLength(1);
    expect(toUpdate[0].rapport).toBe(120);
  });

  it("skip si pas de rapports_pmu (arrivée absente)", () => {
    const rows: BackfillRow[] = [
      {
        id: "p1",
        type_pari: "QUINTE_PLUS",
        resultat: "GAGNANT",
        rapport_gagnant: null,
        course: { libelle: "X", arrivees: [] },
      },
    ];
    const { toUpdate, skipped } = planBackfillRapportGagnant(rows, false);
    expect(toUpdate).toHaveLength(0);
    expect(skipped[0].reason).toBe("no rapports JSONB");
  });

  it("skip si aucun rapport applicable (Tiercé PARTIEL = pas de bonus)", () => {
    const rows: BackfillRow[] = [
      {
        id: "p1",
        type_pari: "TIERCE",
        resultat: "PARTIEL",
        rapport_gagnant: null,
        course: {
          libelle: "X",
          arrivees: [{ rapports_pmu: { tierce: { desordre: 10 } } as never }],
        },
      },
    ];
    const { toUpdate, skipped } = planBackfillRapportGagnant(rows, false);
    expect(toUpdate).toHaveLength(0);
    expect(skipped[0].reason).toBe("no applicable rapport");
  });

  it("normalise course/arrivees en tableau OU objet (quirk Supabase)", () => {
    const rows: BackfillRow[] = [
      {
        id: "p1",
        type_pari: "QUINTE_PLUS",
        resultat: "GAGNANT",
        rapport_gagnant: null,
        // course en tableau + arrivees en objet simple
        course: [{ libelle: "X", arrivees: { rapports_pmu: { quinte_plus: { desordre: 99 } } as never } }],
      },
    ];
    const { toUpdate } = planBackfillRapportGagnant(rows, false);
    expect(toUpdate[0].rapport).toBe(99);
  });

  it("liste vide → rien à faire", () => {
    const { toUpdate, skipped } = planBackfillRapportGagnant([], false);
    expect(toUpdate).toHaveLength(0);
    expect(skipped).toHaveLength(0);
  });
});
