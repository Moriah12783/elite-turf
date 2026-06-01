import { describe, it, expect } from "vitest";
import { buildNotreSelection } from "./notre-selection";
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

describe("buildNotreSelection", () => {
  it("retourne au plus 8 chevaux, triés par score décroissant, rangs 1..8", () => {
    const field = Array.from({ length: 12 }, (_, i) =>
      p({ numero: i + 1, score_composite: (12 - i) / 12, cote: i + 2 }));
    const sel = buildNotreSelection(field);
    expect(sel).toHaveLength(8);
    expect(sel[0].numero).toBe(1); // meilleur score_composite
    expect(sel.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("si < 8 partants, retourne tout le champ classé", () => {
    const field = [
      p({ numero: 1, score_composite: 0.5 }),
      p({ numero: 2, score_composite: 0.3 }),
    ];
    const sel = buildNotreSelection(field);
    expect(sel).toHaveLength(2);
    expect(sel[0].numero).toBe(1);
  });

  it("étiquette 'Favori marché' au cheval à la cote la plus courte", () => {
    const field = [
      p({ numero: 1, score_composite: 0.4, cote: 8 }),
      p({ numero: 2, score_composite: 0.9, cote: 2.1 }),
    ];
    const sel = buildNotreSelection(field);
    expect(sel.find((s) => s.numero === 2)?.label).toBe("Favori marché");
  });

  it("bonus driver d'élite : remonte un cheval à score_composite égal", () => {
    const field = [
      p({ numero: 1, score_composite: 0.5, jockey: "Inconnu" }),
      p({ numero: 2, score_composite: 0.5, jockey: "J.M. BAZIRE" }),
    ];
    const sel = buildNotreSelection(field);
    expect(sel[0].numero).toBe(2); // Bazire passe devant
    expect(sel[0].label).toBe("Driver reconnu");
  });

  it("repli sans cote : produit quand même une sélection ordonnée", () => {
    const field = Array.from({ length: 5 }, (_, i) =>
      p({
        numero: i + 1,
        cote: null,
        score_composite: (5 - i) / 10,
        score_breakdown: { cote: 0, vict_cheval: 0.2, forme_musique: 0.1, vict_jockey: 0 },
      }));
    const sel = buildNotreSelection(field);
    expect(sel).toHaveLength(5);
    expect(sel[0].numero).toBe(1);
    expect(sel[0].cote).toBeNull();
  });

  it("champ vide → []", () => {
    expect(buildNotreSelection([])).toEqual([]);
  });
});
