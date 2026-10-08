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

  it("reconnaît TRIO comme un pari sur les trois premiers", () => {
    expect(fenetreComparaison("TRIO", 8)).toBe(3);
  });

  it("laisse SIMPLE et COUPLE sur le filet de la taille — décision non tranchée", () => {
    // Comportement DOCUMENTÉ, pas souhaité : la fenêtre exacte de ces paris
    // reste à décider. Ce test existe pour qu'un changement soit délibéré.
    expect(fenetreComparaison("SIMPLE", 8)).toBe(5);
    expect(fenetreComparaison("COUPLE", 2)).toBe(3);
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

    // Seuil relevé le 28/07/2026 : un seul cheval du podium ne suffit plus.
    // Avec 8 chevaux joués, trouver 1 place sur 3 n'est pas un « partiel ».
    it("PERDANT avec un SEUL cheval du podium, même sur une large sélection", () => {
      expect(calculerResultat([1, 9, 10, 11, 12, 13, 14, 15], [1, 2, 3, 4, 5], "TIERCE")).toBe("PERDANT");
    });

    it("PARTIEL dès DEUX chevaux du podium trouvés", () => {
      expect(calculerResultat([1, 2, 10, 11, 12], [1, 2, 3, 4, 5], "TIERCE")).toBe("PARTIEL");
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

describe("calculerResultat — ex æquo (dead heat), règle de paiement du PMU", () => {
  // Prix de Versailles, Quinté+ du 08/10/2026. PMU : [[1],[5],[8],[4],[15,16],[10]]
  // → le PMU paie 1-5-8-4-15 ET 1-5-8-4-16.
  const VERSAILLES = [1, 5, 8, 4, 15, 16, 10];
  const RANGS_VERSAILLES = [1, 2, 3, 4, 5, 5, 7];

  it("GAGNANT avec le n°16, 5e ex æquo (le PMU paie 1-5-8-4-16)", () => {
    expect(calculerResultat([1, 5, 8, 4, 16, 9], VERSAILLES, "QUINTE_PLUS", RANGS_VERSAILLES)).toBe("GAGNANT");
  });

  it("sans les rangs, le 16 passe 6e : comportement historique conservé", () => {
    expect(calculerResultat([1, 5, 8, 4, 16, 9], VERSAILLES, "QUINTE_PLUS")).toBe("PARTIEL");
    expect(calculerResultat([1, 5, 8, 4, 16, 9], VERSAILLES, "QUINTE_PLUS", null)).toBe("PARTIEL");
  });

  it("les deux ex æquo ne comptent que pour UNE place : sans le 4, pas de Quinté+", () => {
    // 1, 5, 8 + (15 ou 16) = 4 trouvés sur 5 → PARTIEL, jamais GAGNANT.
    expect(calculerResultat([1, 5, 8, 15, 16, 9, 3], VERSAILLES, "QUINTE_PLUS", RANGS_VERSAILLES)).toBe("PARTIEL");
  });

  it("le pronostic Elite réel de Versailles reste PARTIEL", () => {
    expect(calculerResultat([8, 1, 5, 9, 3, 16, 11, 10], VERSAILLES, "QUINTE_PLUS", RANGS_VERSAILLES)).toBe("PARTIEL");
  });

  it("Tiercé : un 3e ex æquo complète le podium (Prix de la Ville de Paris, 21/05/2026)", () => {
    // PMU : 4, 11, puis 3 et 6 ex æquo 3es.
    const arrivee = [4, 11, 3, 6, 15, 5];
    const rangs = [1, 2, 3, 3, 5, 6];
    expect(calculerResultat([4, 11, 6], arrivee, "TIERCE", rangs)).toBe("GAGNANT");
    expect(calculerResultat([4, 11, 6], arrivee, "TIERCE")).toBe("PARTIEL");
  });

  it("un numéro répété dans une arrivée corrompue ne compte qu'une fois (comme avant)", () => {
    expect(calculerResultat([3, 5, 7, 9, 11], [3, 3, 5, 7, 9], "QUINTE_PLUS")).toBe("PARTIEL");
  });

  it("des rangs incohérents sont ignorés : on juge sur la position", () => {
    expect(calculerResultat([1, 5, 8, 4, 16], VERSAILLES, "QUINTE_PLUS", [1, 2, 3])).toBe("PARTIEL");
  });
});
