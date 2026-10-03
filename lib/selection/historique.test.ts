import { describe, it, expect } from "vitest";
import {
  couverture, ligneCourse, dansPeriode, periodeValide, correspond,
  boutonsPeriodes, periodeParDefaut, totaux, type PhotoSelection,
} from "./historique";

const marche12: Record<string, number> = {
  "1": 2.5, "2": 3, "3": 4, "4": 5, "5": 7, "6": 9, "7": 11, "8": 14, "9": 18, "10": 22, "11": 30, "12": 45,
};

const photo = (o: Partial<PhotoSelection> = {}): PhotoSelection => ({
  courseId: "c1",
  numeros: [1, 2, 3, 4, 5, 6, 7, 8],
  cotesMarche: marche12,
  nbPartants: 12,
  sourceCotes: "csv",
  priseLe: "2026-10-03T13:05:00Z",
  departPrevu: "2026-10-03T13:15:00Z",
  date: "2026-10-03",
  heure: "15:15:00",
  hippodrome: "ParisLongchamp",
  reunion: 1,
  numeroCourse: 4,
  libelle: "Qatar Prix de la Place des Vosges",
  arrivee: [],
  ...o,
});

describe("couverture — ce que la sélection contient de l'arrivée", () => {
  it("gagnant, 3 premiers et 5 premiers présents dans la sélection", () => {
    expect(couverture([1, 2, 3, 4, 5, 6, 7, 8], [3, 9, 1, 2, 4])).toEqual({
      gagnant: true, troisPremiers: 2, cinqPremiers: 4, nCinq: 5,
    });
  });

  it("gagnant absent", () => {
    expect(couverture([1, 2, 3], [9, 1, 2, 3, 4])?.gagnant).toBe(false);
  });

  it("arrivée de 4 chevaux : le « 5 premiers » porte sur 4", () => {
    expect(couverture([1, 2, 3, 4, 5, 6, 7, 8], [3, 1, 2, 4])).toMatchObject({ cinqPremiers: 4, nCinq: 4 });
  });

  it("rien à juger sans les 3 premiers de l'arrivée, ni sans sélection", () => {
    expect(couverture([1, 2, 3], [3, 1])).toBeNull();
    expect(couverture([], [3, 1, 2])).toBeNull();
  });
});

describe("ligneCourse — la sélection face aux favoris PMU du même instant", () => {
  it("marché = les plus petites cotes de la photo, autant que de chevaux sélectionnés", () => {
    const l = ligneCourse(photo({ numeros: [2, 4, 6, 8, 10, 12, 1, 3], arrivee: [4, 2, 6, 1, 3] }));
    expect(l.marche).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(l.couvSelection).toMatchObject({ gagnant: true, troisPremiers: 3, cinqPremiers: 5 });
    expect(l.couvMarche).toMatchObject({ gagnant: true, troisPremiers: 3, cinqPremiers: 5 });
  });

  it("sélection de 6 chevaux (petit champ) → 6 favoris", () => {
    expect(ligneCourse(photo({ numeros: [1, 2, 3, 4, 5, 6] })).marche).toHaveLength(6);
  });

  it("à cote égale, le plus petit numéro d'abord", () => {
    const l = ligneCourse(photo({ numeros: [1, 2], cotesMarche: { "7": 3, "2": 3, "5": 2 } }));
    expect(l.marche).toEqual([5, 2]);
  });

  it("photo prise 10 minutes avant le départ prévu", () => {
    expect(ligneCourse(photo()).minutesAvant).toBe(10);
    expect(ligneCourse(photo({ departPrevu: null })).minutesAvant).toBeNull();
  });

  it("sans arrivée : pas de couverture", () => {
    const l = ligneCourse(photo());
    expect(l.couvSelection).toBeNull();
    expect(l.couvMarche).toBeNull();
  });
});

describe("périodes : un jour, un mois ou tout l'historique", () => {
  it("dansPeriode", () => {
    expect(dansPeriode("2026-10-03", "2026-10-03")).toBe(true);
    expect(dansPeriode("2026-10-02", "2026-10-03")).toBe(false);
    expect(dansPeriode("2026-10-02", "2026-10")).toBe(true);
    expect(dansPeriode("2026-09-30", "2026-10")).toBe(false);
    expect(dansPeriode("2026-09-30", "tout")).toBe(true);
    expect(dansPeriode(null, "tout")).toBe(false);
  });

  it("periodeValide : AAAA-MM-JJ, AAAA-MM ou « tout »", () => {
    for (const p of ["2026-10-03", "2026-10", "tout"]) expect(periodeValide(p)).toBe(true);
    for (const p of [undefined, "", "2026-1", "hier", "2026-10-03x"]) expect(periodeValide(p)).toBe(false);
  });

  it("boutons : aujourd'hui et hier toujours présents, puis les jours, les mois et tout", () => {
    const dates = ["2026-10-03", "2026-10-03", "2026-10-01", "2026-09-30"];
    expect(boutonsPeriodes(dates, "2026-10-03", "2026-10-02")).toEqual([
      { periode: "2026-10-03", libelle: "Aujourd'hui (10-03)", n: 2 },
      { periode: "2026-10-02", libelle: "Hier (10-02)", n: 0 },
      { periode: "2026-10-01", libelle: "10-01", n: 1 },
      { periode: "2026-09-30", libelle: "09-30", n: 1 },
      { periode: "2026-10", libelle: "2026-10", n: 3 },
      { periode: "2026-09", libelle: "2026-09", n: 1 },
      { periode: "tout", libelle: "Tout l'historique", n: 4 },
    ]);
  });

  it("au plus 12 jours en boutons (les plus récents)", () => {
    const dates = Array.from({ length: 20 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
    const jours = boutonsPeriodes(dates, "2026-10-03", "2026-10-02").filter((b) => b.periode.length === 10);
    expect(jours).toHaveLength(12);
    expect(jours[2].periode).toBe("2026-09-20");
  });

  it("période par défaut : aujourd'hui s'il a des photos, sinon le dernier jour photographié", () => {
    expect(periodeParDefaut(["2026-10-03", "2026-10-02"], "2026-10-03")).toBe("2026-10-03");
    expect(periodeParDefaut(["2026-10-01", "2026-10-02"], "2026-10-03")).toBe("2026-10-02");
    expect(periodeParDefaut([], "2026-10-03")).toBe("2026-10-03");
  });
});

describe("correspond — recherche par hippodrome, réunion, course ou épreuve", () => {
  const p = photo();
  it("hippodrome, sans tenir compte des majuscules, accents ni espaces", () => {
    expect(correspond(p, "longchamp")).toBe(true);
    expect(correspond(p, "Paris Longchamp")).toBe(true);
    expect(correspond(p, "vincennes")).toBe(false);
  });

  it("code de course exact : R1C4, r1c4, R1 C4 — et R1C1 ne trouve pas R1C10", () => {
    expect(correspond(p, "R1C4")).toBe(true);
    expect(correspond(p, "r1 c4")).toBe(true);
    expect(correspond(photo({ numeroCourse: 10 }), "R1C1")).toBe(false);
  });

  it("nom de l'épreuve", () => {
    expect(correspond(p, "place des vosges")).toBe(true);
  });

  it("recherche vide : tout passe", () => {
    expect(correspond(p, "  ")).toBe(true);
  });
});

describe("totaux — courses avec arrivée de la période affichée", () => {
  it("compte gagnant dedans, 3 premiers tous dedans, 5 premiers tous dedans", () => {
    const lignes = [
      ligneCourse(photo({ arrivee: [1, 2, 3, 4, 5] })),          // tout dedans
      ligneCourse(photo({ arrivee: [9, 1, 2, 3, 4] })),          // gagnant absent
      ligneCourse(photo({ arrivee: [1, 2, 3] })),                // arrivée courte
      ligneCourse(photo()),                                       // sans arrivée
    ];
    expect(totaux(lignes)).toEqual({
      n: 3,
      nCinq: 2,
      selection: { gagnant: 2, troisPremiers: 2, cinqPremiers: 1 },
      marche:    { gagnant: 2, troisPremiers: 2, cinqPremiers: 1 },
    });
  });
});
