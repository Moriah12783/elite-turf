import { describe, it, expect } from "vitest";
import {
  agregerEntites, dedoublonnerLignes, planifierEcritures, stabiliserSlugs,
  type LigneEtl, type EntiteVoulue,
} from "./seo-etl";

function ligne(p: Partial<LigneEtl>): LigneEtl {
  return {
    course_id: "c1", numero: 1, date_course: "2026-09-03", statut: "TERMINE",
    arrivee: [1, 2, 3], rangs: null, maj: null,
    nom_cheval: "Stan Le Grand", jockey: "P.-C. Boudot", entraineur: "D. & P. Prod'homme",
    ...p,
  };
}

describe("agregerEntites", () => {
  // Stan Le Grand : 2 courses Geny + 1 au format PMU (03/09 et 08/10 absentes
  // de sa fiche avant le 09/10/2026).
  const lignes = [
    ligne({ course_id: "a", date_course: "2026-07-22", numero: 8, arrivee: [8, 7, 4] }),
    ligne({ course_id: "b", date_course: "2026-06-18", numero: 11, arrivee: [2, 7, 13, 1, 3, 6, 11] }),
    ligne({ course_id: "c", date_course: "2026-10-08", numero: 16, nom_cheval: "STAN LE GRAND",
      jockey: "Pc.Boudot", entraineur: "D&P.PROD'HOMME (S)",
      arrivee: [1, 5, 8, 4, 15, 16, 10], rangs: [1, 2, 3, 4, 5, 5, 7] }),
  ];

  it("une fiche par clé, toutes graphies confondues", () => {
    const { voulues } = agregerEntites("chevaux", lignes);
    expect(voulues).toHaveLength(1);
    expect(voulues[0]).toMatchObject({
      cle: "stan-le-grand", slug: "stan-le-grand", nom: "Stan Le Grand",
      nb_courses: 3, nb_victoires: 1, nb_places: 1, derniere_course_at: "2026-10-08",
    });
  });

  it("jockeys et entraîneurs : formats PMU et Geny réunis, graphie Geny affichée", () => {
    expect(agregerEntites("jockeys", lignes).voulues).toEqual([
      expect.objectContaining({ slug: "p-c-boudot", nom: "P.-C. Boudot", nb_courses: 3 }),
    ]);
    expect(agregerEntites("entraineurs", lignes).voulues).toEqual([
      expect.objectContaining({ slug: "d-p-prod-homme", nom: "D. & P. Prod'homme", nb_courses: 3 }),
    ]);
  });

  it("victoire d'un co-vainqueur (MUENCHEN, Deauville 30/08, rangs [1,1,…])", () => {
    const { voulues } = agregerEntites("chevaux", [
      ligne({ nom_cheval: "MUENCHEN", numero: 11, arrivee: [4, 11, 8, 9, 7, 16, 12], rangs: [1, 1, 3, 4, 5, 5, 7] }),
      ligne({ course_id: "z", date_course: "2026-09-26", nom_cheval: "Muenchen", numero: 2, arrivee: [1, 2, 4, 5, 3] }),
    ]);
    expect(voulues[0]).toMatchObject({ nom: "Muenchen", nb_courses: 2, nb_victoires: 1, nb_places: 2 });
  });

  it("une course non terminée compte une course, sans résultat", () => {
    const { voulues } = agregerEntites("chevaux", [ligne({ statut: "PROGRAMME", arrivee: null })]);
    expect(voulues[0]).toMatchObject({ nb_courses: 1, nb_victoires: 0, nb_places: 0 });
  });

  it("écarte les « musiques » prises pour un jockey par l'ancien parser", () => {
    const { voulues, ecartees } = agregerEntites("jockeys", [ligne({ jockey: "0h3h7h1h" })]);
    expect(voulues).toEqual([]);
    expect(ecartees).toBe(1);
  });

  it("ignore les noms vides", () => {
    expect(agregerEntites("jockeys", [ligne({ jockey: null }), ligne({ jockey: "  " })]).voulues).toEqual([]);
  });
});

describe("dedoublonnerLignes", () => {
  it("une course saisie deux fois ne compte qu'une fois", () => {
    const geny = ligne({ course_id: "casa", maj: "2026-09-28T19:00:00Z" });
    const autre = ligne({ course_id: "anfa", statut: "PROGRAMME", arrivee: null, nom_cheval: "STAN LE GRAND" });
    const { lignes, ecartees } = dedoublonnerLignes([autre, geny]);
    expect(lignes.map((l) => l.course_id)).toEqual(["casa"]);
    expect(ecartees).toBe(1);
  });
});

describe("stabiliserSlugs", () => {
  const boudot: EntiteVoulue = {
    cle: "pcboudot", slug: "p-c-boudot", nom: "P.-C. Boudot",
    nb_courses: 9, nb_victoires: 2, nb_places: 4, derniere_course_at: "2026-10-08",
  };
  const graphies = new Map([["pcboudot", new Map([["P.-C. Boudot", 5], ["Pc.Boudot", 4]])]]);

  it("garde l'adresse actuelle tant qu'elle est celle d'une graphie de l'acteur", () => {
    // « Pc.Boudot » repasse devant certaines nuits : /jockeys/pc-boudot ne doit pas basculer.
    const [v] = stabiliserSlugs("jockeys", [boudot], [{ slug: "pc-boudot", nom: "Pc.Boudot" }], graphies);
    expect(v).toMatchObject({ slug: "pc-boudot", nom: "P.-C. Boudot" });
  });
  it("une adresse polluée (poids, « (S) ») n'est jamais gardée", () => {
    const [v] = stabiliserSlugs("jockeys",
      [{ ...boudot, cle: "cdemuro", slug: "c-demuro", nom: "C. Demuro" }],
      [{ slug: "c-demuro-56-5", nom: "C. Demuro 56,5" }],
      new Map([["cdemuro", new Map([["C. Demuro", 3], ["C. Demuro 56,5", 2]])]]));
    expect(v.slug).toBe("c-demuro");
  });
  it("graphie disparue des partants : l'adresse suit la graphie choisie", () => {
    const [v] = stabiliserSlugs("jockeys", [boudot], [{ slug: "pc-boudot", nom: "Pc.Boudot" }],
      new Map([["pcboudot", new Map([["P.-C. Boudot", 5]])]]));
    expect(v.slug).toBe("p-c-boudot");
  });
  it("n'empiète jamais sur l'adresse d'un autre acteur", () => {
    const autre: EntiteVoulue = { ...boudot, cle: "autre", slug: "pc-boudot", nom: "Autre" };
    const [v] = stabiliserSlugs("jockeys", [boudot, autre], [{ slug: "pc-boudot", nom: "Pc.Boudot" }], graphies);
    expect(v.slug).toBe("p-c-boudot");
  });
});

describe("planifierEcritures", () => {
  const voulue = (p: Partial<EntiteVoulue>): EntiteVoulue => ({
    cle: "cdemuro", slug: "c-demuro", nom: "C. Demuro",
    nb_courses: 10, nb_victoires: 2, nb_places: 4, derniere_course_at: "2026-10-08", ...p,
  });
  const graphies = new Map([["cdemuro", new Map([["C. Demuro", 5], ["C. Demuro 57,5", 3], ["C.DEMURO", 2]])]]);

  it("supprime les fiches fusionnées et les redirige vers leur clé", () => {
    const plan = planifierEcritures("jockeys",
      [{ slug: "c-demuro", nom: "C. Demuro" }, { slug: "c-demuro-56-5", nom: "C. Demuro 56,5" }],
      [voulue({})], graphies);
    expect(plan.suppressions).toEqual(["c-demuro-56-5"]);
    expect(plan.alias).toEqual(expect.arrayContaining([
      { slug: "c-demuro-56-5", cle: "cdemuro" },
      { slug: "c-demuro-57-5", cle: "cdemuro" },
    ]));
    expect(plan.alias.find((a) => a.slug === "c-demuro")).toBeUndefined();
  });

  it("fiche orpheline (plus aucun partant) : supprimée, sans redirection", () => {
    const plan = planifierEcritures("jockeys", [{ slug: "reserviste-1", nom: "Réserviste 1" }], [voulue({})], graphies);
    expect(plan.suppressions).toEqual(["reserviste-1"]);
    expect(plan.alias.find((a) => a.slug === "reserviste-1")).toBeUndefined();
  });

  it("retire la clé des fiches supprimées et de celles qui changent de titulaire, avant d'écrire", () => {
    const plan = planifierEcritures("jockeys",
      [{ slug: "c-demuro", nom: "C. Demuro" }, { slug: "c-demuro-56-5", nom: "C. Demuro 56,5" },
       { slug: "a-leduc-t", nom: "A. Leduc T" }], // même slug, autre clé (« aleduct »)
      [voulue({}), voulue({ cle: "aleduc-t", slug: "a-leduc-t", nom: "A. Leduc (T)" })], graphies);
    expect(plan.cleARetirer.sort()).toEqual(["a-leduc-t", "c-demuro-56-5"]);
  });

  it("repère les fiches nouvelles et les noms affichés qui changent", () => {
    const plan = planifierEcritures("chevaux",
      [{ slug: "stan-le-grand", nom: "STAN LE GRAND" }],
      [voulue({ cle: "stan-le-grand", slug: "stan-le-grand", nom: "Stan Le Grand" }),
       voulue({ cle: "muenchen", slug: "muenchen", nom: "Muenchen" })],
      new Map());
    expect(plan.nouvelles).toEqual(["muenchen"]);
    expect(plan.renommees).toEqual([{ slug: "stan-le-grand", avant: "STAN LE GRAND", apres: "Stan Le Grand" }]);
    expect(plan.suppressions).toEqual([]);
  });
});
