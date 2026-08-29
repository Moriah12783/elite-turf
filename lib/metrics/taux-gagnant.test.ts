import { describe, it, expect } from "vitest";

/**
 * Verrouille la règle du taux de réussite affiché publiquement.
 *
 * CONTEXTE : la page /guide-initie annonçait « 73 % de taux de réussite »,
 * écrit en dur, sans source — un chiffre introuvable dans les données. Le réel,
 * mesuré le 27/08/2026 : 108 gagnants sur 245 pronostics résultés, soit 44 %.
 *
 * La logique de `getPublicCounters` fait des I/O ; on teste ici la RÈGLE, qui
 * est ce qui compte : sous 20 pronostics résultés, on n'annonce rien.
 */
const SEUIL = 20;

function calculerTaux(gagnants: number, resultes: number): number | null {
  return resultes >= SEUIL ? Math.round((gagnants / resultes) * 100) : null;
}

describe("taux de pronostics gagnants — règle d'affichage", () => {
  it("reproduit le chiffre réel du 27/08/2026", () => {
    expect(calculerTaux(108, 245)).toBe(44);
  });

  it("ne dit RIEN sous 20 pronostics résultés", () => {
    expect(calculerTaux(15, 19)).toBeNull();
    expect(calculerTaux(0, 0)).toBeNull();
    expect(calculerTaux(1, 1)).toBeNull(); // 100 % sur 1 course : vrai, mais absurde à afficher
  });

  it("affiche dès le seuil atteint", () => {
    expect(calculerTaux(10, 20)).toBe(50);
  });

  it("arrondit à l'entier", () => {
    expect(calculerTaux(1, 3)).toBeNull();      // sous le seuil
    expect(calculerTaux(33, 100)).toBe(33);
    expect(calculerTaux(1, 30)).toBe(3);
  });

  // Un taux de 0 % est une information VRAIE : il doit s'afficher, pas
  // disparaître. Ne jamais confondre « zéro » et « pas de donnée ».
  it("0 % s'affiche, il n'est pas confondu avec l'absence", () => {
    expect(calculerTaux(0, 50)).toBe(0);
    expect(calculerTaux(0, 50)).not.toBeNull();
  });
});
