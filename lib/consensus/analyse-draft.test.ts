import { describe, it, expect } from "vitest";
import { buildConsensus } from "./engine";
import { buildAnalyseDraft } from "./analyse-draft";

const result = buildConsensus({
  nbSources: 29,
  partants: [
    { numero: 11, citations: 29, cote: 4.6 },
    { numero: 13, citations: 28, cote: 6.4 },
    { numero: 6, citations: 28, cote: 11.1 },
    { numero: 1, citations: 27, cote: 5.6 },
    { numero: 10, citations: 27, cote: 8.6 },
    { numero: 9, citations: 26, cote: 14.6 },
  ],
});

describe("buildAnalyseDraft", () => {
  it("produit un brouillon factuel + teaser ≤ 160", () => {
    const d = buildAnalyseDraft({
      result,
      selection: [11, 13, 6, 1, 10, 9],
      noms: { 11: "Kanto Avis" },
      statLabel: { 11: "Favori marché", 13: "Bonne forme" },
      divergence: { 11: "BASE", 13: "BASE", 1: "BASE", 10: "BASE", 9: "BASE", 6: "PIEGE" },
      hippodrome: "Vichy",
      typePariLabel: "Quinté+",
    });
    expect(d.analyseCourte.length).toBeLessThanOrEqual(160);
    expect(d.analyseTexte).toContain("11 Kanto Avis"); // nom enrichi
    expect(d.analyseTexte).toContain("Quinté+ : 11 · 13 · 6 · 1 · 10 · 9"); // le champ
    expect(d.analyseTexte).toContain("À surveiller"); // le piège (6)
    expect(d.analyseTexte).toContain("modération"); // prudence toujours présente
  });

  it("teaser adapté : sans value/piège → 'base solide', pas de mention piège", () => {
    const d = buildAnalyseDraft({
      result,
      selection: [11, 13, 1],
      divergence: { 11: "BASE", 13: "BASE", 1: "BASE" },
      typePariLabel: "Tiercé",
    });
    expect(d.analyseCourte).toContain("base solide");
    expect(d.analyseCourte).not.toContain("piège");
    expect(d.analyseTexte).toContain("Tiercé : 11 · 13 · 1");
  });

  it("robuste sans données optionnelles (ni nom, ni stats, ni divergence)", () => {
    const d = buildAnalyseDraft({ result, selection: [11, 13] });
    expect(d.analyseTexte).toContain("n°11");
    expect(d.analyseTexte).toContain("Quinté+ : 11 · 13");
    expect(d.analyseCourte.length).toBeGreaterThan(0);
  });
});
