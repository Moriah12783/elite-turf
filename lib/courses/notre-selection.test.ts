import { describe, it, expect } from "vitest";
import { buildNotreSelection, shouldShowNotreSelectionPromo } from "./notre-selection";
import type { PartantEnrichi } from "./stats-types";

/** Fabrique un PartantEnrichi complet (tous champs requis) pour les tests. */
function p(over: Partial<PartantEnrichi>): PartantEnrichi {
  return {
    id: over.id ?? String(over.numero ?? 1),
    numero: over.numero ?? 1,
    nom_cheval: over.nom_cheval ?? `Cheval ${over.numero ?? 1}`,
    jockey: over.jockey ?? null,
    entraineur: over.entraineur ?? null,
    cote: over.cote ?? null,
    musique: over.musique ?? null,
    poids_kg: over.poids_kg ?? null,
    stats_cheval: over.stats_cheval ?? null,
    stats_jockey: over.stats_jockey ?? null,
    stats_entraineur: over.stats_entraineur ?? null,
    forme_musique: over.forme_musique ?? null,
    score_composite: over.score_composite ?? 0,
    score_breakdown: over.score_breakdown ?? { cote: 0, vict_cheval: 0, forme_musique: 0, vict_jockey: 0 },
    badges: over.badges ?? { vedette: false, value_bet: false, favori: false },
  };
}

describe("buildNotreSelection — v2, classement par la cote PMU", () => {
  it("les 8 plus petites cotes, dans l'ordre, rangs 1..8 (la note composite ne classe plus)", () => {
    const cotes = [12, 3.5, 40, 7, 2.1, 25, 9, 5.5, 18, 31, 4.2, 15];
    // note composite volontairement inverse de la cote : elle ne doit plus rien décider
    const field = cotes.map((cote, i) => p({ numero: i + 1, cote, score_composite: cote / 100 }));
    const sel = buildNotreSelection(field);
    expect(sel.map((s) => s.cote)).toEqual([2.1, 3.5, 4.2, 5.5, 7, 9, 12, 15]);
    expect(sel.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("à cote égale, la note composite départage", () => {
    const field = [
      p({ numero: 1, cote: 4, score_composite: 0.2 }),
      p({ numero: 2, cote: 4, score_composite: 0.6 }),
      p({ numero: 3, cote: 2, score_composite: 0 }),
      p({ numero: 4, cote: 9, score_composite: 0.9 }),
    ];
    expect(buildNotreSelection(field).map((s) => s.numero)).toEqual([3, 2, 1, 4]);
  });

  it("« Favori marché » = la plus petite cote", () => {
    const field = [p({ numero: 1, cote: 8 }), p({ numero: 2, cote: 2.1 }), p({ numero: 3, cote: 5 }), p({ numero: 4, cote: 11 })];
    const sel = buildNotreSelection(field);
    expect(sel[0]).toMatchObject({ numero: 2, label: "Favori marché" });
    expect(sel.filter((s) => s.label === "Favori marché")).toHaveLength(1);
  });

  it("étiquettes d'information : forme, driver, entraîneur, outsider, sinon « Bien coté »", () => {
    const field = [
      p({ numero: 1, cote: 2 }),
      p({ numero: 2, cote: 4, forme_musique: { top3: 3, courses: 4, ratio: 0.75 } }),
      p({ numero: 3, cote: 5, jockey: "J.M. BAZIRE" }),
      p({ numero: 4, cote: 6, entraineur: "A. Fabre" }),
      p({ numero: 5, cote: 14 }),
      p({ numero: 6, cote: 7 }),
      p({ numero: 7, cote: 8, forme_musique: { top3: 2, courses: 2, ratio: 1 } }), // 2 courses : trop peu pour « Bonne forme »
    ];
    const label = (n: number) => buildNotreSelection(field).find((s) => s.numero === n)?.label;
    expect(label(2)).toBe("Bonne forme");
    expect(label(3)).toBe("Driver reconnu");
    expect(label(4)).toBe("Entraîneur reconnu");
    expect(label(5)).toBe("Outsider");
    expect(label(6)).toBe("Bien coté");
    expect(label(7)).toBe("Bien coté");
  });

  it("sans cote fiable (Maroc, J+1) → pas de sélection plutôt qu'une liste au hasard", () => {
    const field = Array.from({ length: 10 }, (_, i) => p({ numero: i + 1, cote: null, score_composite: (10 - i) / 10 }));
    expect(buildNotreSelection(field)).toEqual([]);
  });

  it("moins de la moitié du champ coté → pas de sélection", () => {
    const field = Array.from({ length: 10 }, (_, i) => p({ numero: i + 1, cote: i < 4 ? i + 2 : null }));
    expect(buildNotreSelection(field)).toEqual([]);
  });

  it("champ coté mais incomplet : les chevaux sans cote sont écartés", () => {
    const field = [p({ numero: 1, cote: 3 }), p({ numero: 2, cote: null }), p({ numero: 3, cote: 6 }), p({ numero: 4, cote: 9 })];
    expect(buildNotreSelection(field).map((s) => s.numero)).toEqual([1, 3, 4]);
  });

  it("champ vide → []", () => {
    expect(buildNotreSelection([])).toEqual([]);
  });
});

describe("shouldShowNotreSelectionPromo", () => {
  const item = { rank: 1, numero: 6, nom: "X", jockey: null, cote: 3.2, label: "Bien coté" as const };
  it("affiche dès qu'une sélection existe (visible pour tous, abonnés inclus)", () => {
    expect(shouldShowNotreSelectionPromo([item])).toBe(true);
  });
  it("masque si la sélection est vide", () => {
    expect(shouldShowNotreSelectionPromo([])).toBe(false);
  });
});
