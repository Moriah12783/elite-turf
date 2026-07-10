import { describe, it, expect } from "vitest";
import { computeConsensusHits, aggregateConsensus } from "./consensus-metrics";

describe("computeConsensusHits", () => {
  it("couverture 4/5 + vainqueur couvert ; favori presse placé mais ne gagne pas", () => {
    // arrivée 9-5-15-7-12 ; sélection contient 9,5,15,7 (pas le 12).
    const h = computeConsensusHits({
      selection: [15, 4, 9, 5, 11, 7],
      favoriPresse: 15,
      favoriMarche: 8,
      arrivee: [9, 5, 15, 7, 12],
      typePari: "QUINTE_PLUS",
    });
    expect(h.couverture).toBe(4);
    expect(h.quinteTrouve).toBe(false);
    expect(h.vainqueurHit).toBe(true);      // 9 est dans la sélection
    expect(h.favPresseWin).toBe(false);     // vainqueur = 9, favori presse = 15
    expect(h.favPressePlace).toBe(true);    // 15 est dans le top 5
    expect(h.favMarcheWin).toBe(false);
    expect(h.favMarchePlace).toBe(false);   // 8 hors top 5
    expect(h.convergence).toBe(false);      // 15 ≠ 8
  });

  it("quinté complet + convergence gagnante (presse = marché = vainqueur)", () => {
    const h = computeConsensusHits({
      selection: [3, 7, 8, 1, 5, 14],
      favoriPresse: 3,
      favoriMarche: 3,
      arrivee: [3, 7, 8, 1, 5],
      typePari: "QUINTE_PLUS",
    });
    expect(h.quinteTrouve).toBe(true);
    expect(h.couverture).toBe(5);
    expect(h.convergence).toBe(true);
    expect(h.convergenceWin).toBe(true);
    expect(h.favPresseWin).toBe(true);
    expect(h.favMarcheWin).toBe(true);
  });
});

describe("aggregateConsensus", () => {
  it("dénominateurs par favori connu ; % corrects", () => {
    const a = aggregateConsensus([
      // jour 1 : quinté trouvé, favori presse gagne, favori marché inconnu
      { selection: [1, 2, 3, 4, 5, 6], favoriPresse: 1, favoriMarche: null, arrivee: [1, 2, 3, 4, 5], typePari: "QUINTE_PLUS" },
      // jour 2 : rien couvert, convergence sur le 20 (qui perd)
      { selection: [10, 11, 12], favoriPresse: 20, favoriMarche: 20, arrivee: [9, 8, 7, 6, 5], typePari: "QUINTE_PLUS" },
    ]);
    expect(a.n).toBe(2);
    expect(a.pctQuinte).toBe(50);
    expect(a.pctVainqueur).toBe(50);
    expect(a.nFavPresse).toBe(2);
    expect(a.pctFavPresseWin).toBe(50);       // 1/2 favoris presse gagnent
    expect(a.nFavMarche).toBe(1);             // favori marché connu 1 seule fois
    expect(a.pctFavMarcheWin).toBe(0);
    expect(a.nConvergence).toBe(1);
    expect(a.pctConvergenceWin).toBe(0);
  });

  it("liste vide → tout à zéro", () => {
    expect(aggregateConsensus([]).n).toBe(0);
    expect(aggregateConsensus([]).pctVainqueur).toBe(0);
  });
});
