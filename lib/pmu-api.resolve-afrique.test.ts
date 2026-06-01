import { describe, it, expect } from "vitest";
import { resolveAfrique } from "./pmu-api";

describe("resolveAfrique", () => {
  it("priorise l'autoritaire quand jouable_afrique est defini", () => {
    expect(
      resolveAfrique({ jouable_afrique: false, nationale: null, paris_disponibles: ["QUINTE_PLUS"] }),
    ).toEqual({ jouable: false, nationaleLabel: null });
    expect(
      resolveAfrique({ jouable_afrique: true, nationale: 1, paris_disponibles: [] }),
    ).toEqual({ jouable: true, nationaleLabel: "Nationale 1 — Quinté+" });
  });

  it("retombe sur l'heuristique quand jouable_afrique est NULL/absent", () => {
    expect(
      resolveAfrique({ jouable_afrique: null, nationale: null, paris_disponibles: ["QUINTE_PLUS"] }),
    ).toEqual({ jouable: true, nationaleLabel: "Nationale 1 — Quinté+" });
    expect(resolveAfrique({ paris_disponibles: ["SIMPLE_GAGNANT"] })).toEqual({
      jouable: false,
      nationaleLabel: null,
    });
  });
});
