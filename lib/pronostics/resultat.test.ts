import { describe, it, expect } from "vitest";
import { calculerResultat, fenetreComparaison } from "./resultat";

describe("fenetreComparaison", () => {
  // ⚠️ LE BOGUE HISTORIQUE : le code testait `includes("quinté")` — AVEC accent —
  // alors que la base stocke « QUINTE_PLUS », « QUARTE », « TIERCE » SANS accent.
  // Ces trois branches ne se déclenchaient donc jamais et la fenêtre était
  // décidée par la seule taille de la sélection.
  it("reconnaît les libellés RÉELLEMENT stockés en base, sans accent", () => {
    expect(fenetreComparaison("QUINTE_PLUS", 8)).toBe(5);
    expect(fenetreComparaison("QUARTE", 8)).toBe(4);
    expect(fenetreComparaison("TIERCE", 8)).toBe(3);
  });

  it("reconnaît aussi les libellés accentués et la casse libre", () => {
    expect(fenetreComparaison("Quinté+", 6)).toBe(5);
    expect(fenetreComparaison("Quarté+", 6)).toBe(4);
    expect(fenetreComparaison("Tiercé", 6)).toBe(3);
    expect(fenetreComparaison("quinte_plus", 6)).toBe(5);
  });

  it("retombe sur la taille de la sélection quand le type est inconnu", () => {
    expect(fenetreComparaison("", 6)).toBe(5);
    expect(fenetreComparaison(null, 4)).toBe(4);
    expect(fenetreComparaison(undefined, 2)).toBe(3);
  });

  it("ne confond pas QUARTE et QUINTE", () => {
    expect(fenetreComparaison("QUARTE", 3)).toBe(4);
    expect(fenetreComparaison("QUINTE_PLUS", 3)).toBe(5);
  });
});

describe("calculerResultat", () => {
  it("rend PERDANT sur une sélection ou une arrivée vide", () => {
    expect(calculerResultat([], [1, 2, 3, 4, 5], "QUINTE_PLUS")).toBe("PERDANT");
    expect(calculerResultat([1, 2, 3], [], "TIERCE")).toBe("PERDANT");
  });

  describe("Quinté+ — les 5 premiers doivent être dans la sélection", () => {
    it("GAGNANT quand le top 5 est entièrement couvert par 8 chevaux", () => {
      expect(calculerResultat([1, 2, 3, 4, 5, 6, 7, 8], [3, 1, 5, 2, 4], "QUINTE_PLUS")).toBe("GAGNANT");
    });
    it("PARTIEL à 3 chevaux trouvés sur 5", () => {
      expect(calculerResultat([1, 2, 3, 9, 10], [1, 2, 3, 7, 8], "QUINTE_PLUS")).toBe("PARTIEL");
    });
    it("PERDANT à 2 chevaux trouvés", () => {
      expect(calculerResultat([1, 2, 11, 12, 13], [1, 2, 7, 8, 9], "QUINTE_PLUS")).toBe("PERDANT");
    });
  });

  describe("Tiercé — c'est le PODIUM qui compte, pas le top 5", () => {
    // Régression réelle du 08/05/2026 R1C1 : l'ancienne règle jugeait ce Tiercé
    // sur le top 5 et le déclarait PARTIEL. Le podium 6-3-7 est pourtant
    // intégralement dans la sélection : c'est un Tiercé GAGNANT.
    it("GAGNANT quand le podium est couvert (cas 08/05/2026 R1C1)", () => {
      expect(calculerResultat([1, 6, 7, 3, 2, 8], [6, 3, 7, 2, 5], "TIERCE")).toBe("GAGNANT");
    });

    // Cas inverse du 09/05/2026 R5C4 : l'ancienne règle le donnait GAGNANT.
    // Le 9, deuxième, n'est pas dans la sélection → le tiercé n'est pas couvert.
    it("PARTIEL quand un cheval du podium manque (cas 09/05/2026 R5C4)", () => {
      expect(calculerResultat([8, 3, 5, 4, 7, 1], [7, 9, 5, 3, 4], "TIERCE")).toBe("PARTIEL");
    });

    it("PERDANT quand aucun cheval du podium n'est trouvé", () => {
      expect(calculerResultat([10, 11, 12], [1, 2, 3, 4, 5], "TIERCE")).toBe("PERDANT");
    });

    it("GAGNANT sur un Tiercé sec exactement couvert", () => {
      expect(calculerResultat([4, 9, 2], [9, 2, 4, 7, 1], "TIERCE")).toBe("GAGNANT");
    });
  });

  describe("Quarté", () => {
    it("GAGNANT quand le top 4 est couvert par 6 chevaux", () => {
      expect(calculerResultat([1, 2, 3, 4, 5, 6], [3, 1, 4, 2, 9], "QUARTE")).toBe("GAGNANT");
    });
    it("PARTIEL à 3 sur 4", () => {
      expect(calculerResultat([1, 2, 3, 10], [1, 2, 3, 9, 8], "QUARTE")).toBe("PARTIEL");
    });
  });

  describe("sélection plus courte que la fenêtre", () => {
    // On ne peut pas exiger 5 chevaux trouvés d'une sélection qui n'en compte
    // que 4 : la cible est le maximum atteignable, pas la taille de la fenêtre.
    it("GAGNANT quand une sélection de 4 couvre tout ce qu'elle peut du top 5", () => {
      expect(calculerResultat([1, 2, 3, 4], [1, 2, 3, 4, 9], "QUINTE_PLUS")).toBe("GAGNANT");
    });
    it("GAGNANT quand 2 chevaux sont tous deux dans le top 3", () => {
      expect(calculerResultat([5, 7], [5, 7, 1, 2, 3], "SIMPLE")).toBe("GAGNANT");
    });
  });

  it("ne compte jamais deux fois le même cheval", () => {
    // Sélection mal saisie {1, 1, 2, 2, 9} : elle ne contient réellement que
    // 3 chevaux, dont 2 seulement figurent au top 5. Compter les doublons
    // ferait croire à 4 trouvés et remonterait le résultat à PARTIEL.
    expect(calculerResultat([1, 1, 2, 2, 9], [1, 2, 3, 4, 5], "QUINTE_PLUS")).toBe("PERDANT");
  });
});
