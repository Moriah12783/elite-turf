import { describe, it, expect } from "vitest";
import { ligneArrivee } from "./geny-arrivees";

describe("ligneArrivee — ce que la synchro Geny écrit dans `arrivees`", () => {
  const ligne = ligneArrivee({ courseId: "c1", arrivee: [4, 9, 12], rangs: null, commentaire: "Récit" });

  it("arrivée, rangs et commentaire", () => {
    expect(ligne.course_id).toBe("c1");
    expect(ligne.ordre_arrivee).toEqual([4, 9, 12]);
    expect(ligne.rangs).toBeNull();
    expect(ligne.commentaire).toBe("Récit");
  });

  // Audit du 09/10/2026 : les rapports lus sur Geny étaient faux (paris
  // inexistants, montants d'un autre opérateur). Les rapports viennent du seul
  // PMU (runPmuRapportsSync), qui n'écrase jamais un rapport existant : la clé
  // doit être ABSENTE, sinon l'upsert remettrait à vide un rapport PMU déjà écrit.
  it("ne contient jamais `rapports_pmu`", () => {
    expect("rapports_pmu" in ligne).toBe(false);
  });
});
