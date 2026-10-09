import { describe, it, expect } from "vitest";
import { dedoublonnerApparitions, type ReperesApparition } from "./apparitions";

type Ligne = ReperesApparition & { id: string };

function ligne(id: string, p: Partial<ReperesApparition>): Ligne {
  return {
    id,
    course_id: id,
    numero: 4,
    date_course: "2026-09-28",
    cheval_cle: "al-khalif-fal",
    termine: false,
    a_arrivee: false,
    maj: null,
    ...p,
  };
}
const dedoublonner = (rows: Ligne[]) => dedoublonnerApparitions(rows, (r) => r).map((r) => r.id);

describe("dedoublonnerApparitions", () => {
  it("même course saisie par deux sources : garde celle qui a l'arrivée (Casablanca R3 / Anfa R9, 28/09)", () => {
    const anfa = ligne("anfa", { termine: false });
    const casa = ligne("casa", { termine: true, a_arrivee: true });
    expect(dedoublonner([anfa, casa])).toEqual(["casa"]);
    expect(dedoublonner([casa, anfa])).toEqual(["casa"]);
  });
  it("une course terminée sans arrivée passe après celle qui en a une", () => {
    expect(dedoublonner([ligne("a", { termine: true }), ligne("b", { termine: true, a_arrivee: true })])).toEqual(["b"]);
  });
  it("à égalité, la ligne de course mise à jour en dernier", () => {
    const vieille = ligne("vieille", { termine: true, a_arrivee: true, maj: "2026-09-28T18:00:00Z" });
    const fraiche = ligne("fraiche", { termine: true, a_arrivee: true, maj: "2026-09-29T08:00:00Z" });
    expect(dedoublonner([vieille, fraiche])).toEqual(["fraiche"]);
  });
  it("dossards différents le même jour : homonymes, on garde les deux", () => {
    expect(dedoublonner([ligne("a", { numero: 4 }), ligne("b", { numero: 7 })])).toEqual(["a", "b"]);
  });
  it("jours différents : deux courses distinctes", () => {
    expect(dedoublonner([ligne("a", {}), ligne("b", { date_course: "2026-10-02" })])).toEqual(["a", "b"]);
  });
  it("cheval sans clé : jamais fusionné", () => {
    expect(dedoublonner([ligne("a", { cheval_cle: "" }), ligne("b", { cheval_cle: "" })])).toEqual(["a", "b"]);
  });
  it("garde l'ordre d'entrée des lignes retenues", () => {
    const rows = [
      ligne("x", { cheval_cle: "x" }),
      ligne("anfa", {}),
      ligne("y", { cheval_cle: "y" }),
      ligne("casa", { termine: true, a_arrivee: true }),
    ];
    expect(dedoublonner(rows)).toEqual(["x", "y", "casa"]);
  });
});
