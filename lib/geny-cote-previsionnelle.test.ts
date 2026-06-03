/**
 * Tests pour le module de cote prévisionnelle J+1.
 * Données issues du HTML Geny réel (Prix Pierre Raffre, Pontchâteau, 04/06/2026).
 */

import { describe, expect, it } from "vitest";
import { detectCotesUniformes, gainsToProbableCote } from "./geny-cote-previsionnelle";

describe("detectCotesUniformes()", () => {
  it("détecte le cas 100% uniforme (placeholder pur)", () => {
    expect(detectCotesUniformes([105.2, 105.2, 105.2, 105.2, 105.2])).toBe(true);
  });

  it("détecte le cas Pontchâteau réel : 12×105.2 + 1×1.10 (92% uniforme)", () => {
    const cotes = Array(12).fill(105.2).concat([1.10]);
    expect(detectCotesUniformes(cotes)).toBe(true);
  });

  it("ne détecte PAS des cotes normales différenciées", () => {
    // Cotes types d'une vraie course PMU : favori 2.5, milieu 5-15, outsider 30+
    expect(detectCotesUniformes([2.5, 4.1, 7.2, 8.5, 12.0, 25.0, 31.0])).toBe(false);
  });

  it("ignore les null et les valeurs invalides", () => {
    expect(detectCotesUniformes([105.2, null, undefined, 105.2, 105.2, 105.2])).toBe(true);
  });

  it("renvoie false si < 3 cotes valides (pas assez de matière)", () => {
    expect(detectCotesUniformes([105.2, 105.2])).toBe(false);
    expect(detectCotesUniformes([105.2])).toBe(false);
    expect(detectCotesUniformes([])).toBe(false);
  });

  it("tolère les micro-écarts (arrondi 1 décimale)", () => {
    // Si Geny pousse 105.20 vs 105.21 vs 105.22 → considérés identiques
    expect(detectCotesUniformes([105.20, 105.21, 105.22, 105.19, 105.20])).toBe(true);
  });
});

describe("gainsToProbableCote() — approche rang relatif", () => {
  const gainsPontchateau = [16035, 16455, 18100, 18130];

  it("attribue la cote 2.5 au favori (gains les plus élevés)", () => {
    // Merveille Mika (18130 €) → rang 0 → cote 2.5
    expect(gainsToProbableCote(18130, gainsPontchateau)).toBe(2.5);
  });

  it("attribue 4.20 au 2e (rang 1)", () => {
    // Macarena (18100 €) → rang 1 → cote 4.20
    expect(gainsToProbableCote(18100, gainsPontchateau)).toBe(4.20);
  });

  it("attribue 5.90 au 3e (rang 2)", () => {
    expect(gainsToProbableCote(16455, gainsPontchateau)).toBe(5.90);
  });

  it("attribue 7.60 au dernier (rang 3)", () => {
    expect(gainsToProbableCote(16035, gainsPontchateau)).toBe(7.60);
  });

  it("clamp à 99.00 max sur peloton très large", () => {
    // 60 partants théoriques → rang 59 → 2.5 + 59*1.7 = 102.8 → clamp 99
    const grosPeloton = Array.from({ length: 60 }, (_, i) => i + 1000);
    expect(gainsToProbableCote(1000, grosPeloton)).toBe(99.00);
  });

  it("renvoie null si gains invalides ou tableau vide", () => {
    expect(gainsToProbableCote(null, [16000, 17000])).toBe(null);
    expect(gainsToProbableCote(undefined, [16000, 17000])).toBe(null);
    expect(gainsToProbableCote(-100, [16000, 17000])).toBe(null);
    expect(gainsToProbableCote(16000, [])).toBe(null);
  });

  it("renvoie null si TOUS les partants ont 0 € de gains (pas de signal)", () => {
    // Cas typique : course de jeunes chevaux qui n'ont encore jamais couru
    expect(gainsToProbableCote(0, [0, 0, 0, 0, 0])).toBe(null);
  });

  it("gère le cas d'ex-aequo (2 chevaux avec mêmes gains)", () => {
    // Deux chevaux à 18000, indexOf renvoie la 1re occurrence → rang 0 pour les 2
    // (acceptable : on ne va pas inventer un ordre)
    const cotes = [18000, 18000, 16000, 15000];
    expect(gainsToProbableCote(18000, cotes)).toBe(2.50); // favori
    expect(gainsToProbableCote(16000, cotes)).toBe(5.90); // rang 2
  });
});
