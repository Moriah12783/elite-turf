import { describe, it, expect } from "vitest";
import {
  enMinutes,
  heureCorrigee,
  lireProgrammeFrance,
  memeCourse,
  memesEpreuves,
  memesHippodromes,
  planifierRattrapage,
  type CourseEnBase,
  type CoursePmuFrance,
} from "./pmu-rattrapage";
import { cleRC } from "./pmu-arrivees";

// Valeurs réelles de l'API PMU (Prix d'Orgeval, Enghien R1C4 du 04/07/2026) :
// départ 13:15 UTC = 15:15 à Paris, décalage +2 h (timezoneOffset en ms).
const DEPART_R1C4 = Date.UTC(2026, 6, 4, 13, 15);

const PROGRAMME = {
  programme: {
    reunions: [
      {
        numOfficiel: 1,
        pays: { code: "FRA" },
        hippodrome: { libelleCourt: "ENGHIEN", libelleLong: "HIPPODROME D'ENGHIEN SOISY" },
        courses: [
          {
            numOrdre: 4, libelle: "PRIX D'ORGEVAL", statut: "ARRIVEE_DEFINITIVE_COMPLETE", isArriveeDefinitive: true,
            heureDepart: DEPART_R1C4, timezoneOffset: 7200000,
            ordreArrivee: [[5], [13], [11], [16], [7], [2], [10], [9], [14]],
          },
          {
            // Statut « FIN_COURSE » mais drapeau définitif : arrivée retenue.
            numOrdre: 5, statut: "FIN_COURSE", isArriveeDefinitive: true,
            heureDepart: DEPART_R1C4 + 35 * 60000, timezoneOffset: 7200000,
            ordreArrivee: [[3], [1, 4], [2]],   // ex æquo à la 2e place
          },
          {
            numOrdre: 6, statut: "COURSE_ANNULEE",
            heureDepart: DEPART_R1C4 + 70 * 60000, timezoneOffset: 7200000,
            ordreArrivee: [],
          },
        ],
      },
      {
        numOfficiel: 6,
        pays: { code: "GBR" },
        courses: [
          { numOrdre: 1, statut: "ARRIVEE_DEFINITIVE", heureDepart: DEPART_R1C4, timezoneOffset: 3600000, ordreArrivee: [[1], [2], [3]] },
        ],
      },
    ],
  },
};

describe("lireProgrammeFrance", () => {
  const pmu = lireProgrammeFrance(PROGRAMME);

  it("ne garde que les réunions françaises", () => {
    expect(pmu.has(cleRC(6, 1))).toBe(false);
    expect(pmu.size).toBe(3);
  });

  it("aplatit l'arrivée définitive, donne l'heure de Paris et l'identité de la course", () => {
    expect(pmu.get(cleRC(1, 4))).toEqual({
      arrivee: [5, 13, 11, 16, 7, 2, 10, 9, 14],
      rangs: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      depart: { paris: "15:15", decalageMin: 120 },
      hippodrome: "ENGHIEN",
      hippodromeLong: "HIPPODROME D'ENGHIEN SOISY",
      libelle: "PRIX D'ORGEVAL",
    });
  });

  it("préserve l'ordre d'un ex æquo", () => {
    expect(pmu.get(cleRC(1, 5))?.arrivee).toEqual([3, 1, 4, 2]);
  });

  it("garde le rang partagé d'un ex æquo : 1 et 4 sont 2es, le 2 est 4e", () => {
    expect(pmu.get(cleRC(1, 5))?.rangs).toEqual([1, 2, 2, 4]);
  });

  it("laisse vide l'arrivée d'une course annulée, mais garde son heure", () => {
    expect(pmu.get(cleRC(1, 6))?.arrivee).toEqual([]);
    expect(pmu.get(cleRC(1, 6))?.depart).toEqual({ paris: "16:25", decalageMin: 120 });
  });

  it("renvoie une carte vide sur un payload illisible", () => {
    expect(lireProgrammeFrance(null).size).toBe(0);
    expect(lireProgrammeFrance({ programme: {} }).size).toBe(0);
  });
});

describe("enMinutes", () => {
  it("lit HH:MM et HH:MM:SS", () => {
    expect(enMinutes("13:15:00")).toBe(795);
    expect(enMinutes("9:05")).toBe(545);
  });
  it("rejette l'illisible", () => {
    expect(enMinutes("midi")).toBeNull();
    expect(enMinutes(null)).toBeNull();
    expect(enMinutes("25:00")).toBeNull();
  });
});

describe("heureCorrigee", () => {
  const ETE = { paris: "15:15", decalageMin: 120 };

  it("corrige une heure GMT enregistrée comme heure de Paris", () => {
    expect(heureCorrigee("13:15:00", ETE)).toBe("15:15:00");
  });

  it("garde les minutes programmées malgré un retard au départ", () => {
    expect(heureCorrigee("13:15:00", { paris: "15:19", decalageMin: 120 })).toBe("15:15:00");
  });

  it("ne touche pas une heure déjà à l'heure de Paris (retard compris)", () => {
    expect(heureCorrigee("15:15:00", ETE)).toBeNull();
    expect(heureCorrigee("15:12:00", { paris: "15:17", decalageMin: 120 })).toBeNull();
  });

  it("ne devine rien sur un écart inexpliqué", () => {
    expect(heureCorrigee("14:15:00", ETE)).toBeNull();     // 1 h d'écart en été
    expect(heureCorrigee("12:00:00", ETE)).toBeNull();
  });

  it("refuse sans départ PMU, sans décalage, ou au-delà de minuit", () => {
    expect(heureCorrigee("13:15:00", null)).toBeNull();
    expect(heureCorrigee("13:15:00", { paris: "13:15", decalageMin: 0 })).toBeNull();
    expect(heureCorrigee("23:00:00", { paris: "01:00", decalageMin: 120 })).toBeNull();
  });
});

describe("identité de course", () => {
  it("rapproche les graphies d'un même hippodrome", () => {
    expect(memesHippodromes("Vincennes", "VINCENNES")).toBe(true);
    expect(memesHippodromes("Paris-Vincennes", "VINCENNES")).toBe(true);           // copie de la voie de secours
    expect(memesHippodromes("Le Lion-d'Angers", "LE LION D'ANGERS")).toBe(true);
  });

  it("sépare deux hippodromes distincts", () => {
    expect(memesHippodromes("Compiègne", "FONTAINEBLEAU")).toBe(false);
    expect(memesHippodromes("Enghien", "VINCENNES")).toBe(false);
  });

  it("reconnaît une même épreuve malgré la graphie", () => {
    expect(memesEpreuves("Prix de l'Atlantique", "PRIX DE L'ATLANTIQUE")).toBe(true);
    expect(memesEpreuves("Prix la Bate", "PRIX DE LA FORET DE FONTAINEBLEAU")).toBe(false);
  });

  it("refuse la course PMU de mêmes numéros quand ni l'hippodrome ni l'épreuve ne concordent", () => {
    // Cas réel du 27/03/2026 R3C1 : « Prix de Diane » en base, Prix Massoud au Bouscat au PMU.
    expect(memeCourse(
      { hippodrome: "Chantilly", libelle: "Prix de Diane — Classique Chantilly" },
      { hippodrome: "LE BOUSCAT", hippodromeLong: "HIPPODROME DU BOUSCAT", libelle: "QATAR PRIX MASSOUD" },
    )).toBe(false);
  });
});

describe("planifierRattrapage", () => {
  const IDENTITE = { hippodrome: "ENGHIEN", hippodromeLong: "HIPPODROME D'ENGHIEN SOISY", libelle: "PRIX D'ORGEVAL" };
  const pmu = new Map<string, CoursePmuFrance>([
    [cleRC(1, 4), { arrivee: [5, 13, 11, 16, 7, 2, 10, 9, 14], depart: { paris: "15:15", decalageMin: 120 }, ...IDENTITE }],
    [cleRC(1, 6), { arrivee: [], depart: { paris: "16:25", decalageMin: 120 }, ...IDENTITE, libelle: "PRIX DE LA VILLE" }],
  ]);

  const course = (sur: Partial<CourseEnBase>): CourseEnBase => ({
    id: "c-1",
    numero_reunion: 1,
    numero_course: 4,
    hippodrome: "Enghien",
    libelle: "Prix d'Orgeval",
    heure_depart: "15:15:00",
    paris_disponibles: ["QUINTE_PLUS", "TRIO"],
    arrivee_officielle: null,
    a_ligne_arrivee: false,
    partants: [1, 2, 3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16],
    nb_pronostics: 0,
    ...sur,
  });

  it("ajoute l'arrivée manquante, coupée à 7 chevaux pour un Quinté+", () => {
    const plan = planifierRattrapage([course({})], pmu);
    expect(plan.arrivees).toEqual([{ course_id: "c-1", ordre_arrivee: [5, 13, 11, 16, 7, 2, 10], rangs: null }]);
    expect(plan.ignorees).toEqual([]);
  });

  it("coupe à 6 chevaux hors Quinté+", () => {
    const plan = planifierRattrapage([course({ paris_disponibles: ["TRIO"] })], pmu);
    expect(plan.arrivees[0].ordre_arrivee).toEqual([5, 13, 11, 16, 7, 2]);
  });

  it("n'ajoute rien à une course qui a déjà une arrivée", () => {
    const plan = planifierRattrapage([
      course({ arrivee_officielle: [5, 13, 11, 16, 7] }),
      course({ id: "c-2", a_ligne_arrivee: true }),
    ], pmu);
    expect(plan.arrivees).toEqual([]);
    expect(plan.divergentes).toEqual([]);   // même début : longueur différente seulement
  });

  it("signale sans la réécrire une arrivée contredite par le PMU", () => {
    const plan = planifierRattrapage([course({ arrivee_officielle: [13, 5, 11, 16, 7], a_ligne_arrivee: true })], pmu);
    expect(plan.arrivees).toEqual([]);
    expect(plan.divergentes).toEqual([
      { course_id: "c-1", base: [13, 5, 11, 16, 7], pmu: [5, 13, 11, 16, 7, 2, 10], rangs_pmu: null, a_ligne_arrivee: true, corrigeable: true },
    ]);
  });

  it("ne déclare jamais corrigeable une arrivée qui a pu juger un pronostic", () => {
    const plan = planifierRattrapage([course({ arrivee_officielle: [13, 5, 11, 16, 7], nb_pronostics: 1 })], pmu);
    expect(plan.divergentes).toHaveLength(1);
    expect(plan.divergentes[0].corrigeable).toBe(false);
  });

  it("ne corrige pas quand l'appariement est douteux (numéros PMU hors de nos partants)", () => {
    const plan = planifierRattrapage([course({ arrivee_officielle: [4, 2, 1, 3], partants: [1, 2, 3, 4] })], pmu);
    expect(plan.divergentes).toHaveLength(1);
    expect(plan.divergentes[0].corrigeable).toBe(false);
  });

  it("refuse une arrivée dont un numéro n'est pas parmi nos partants", () => {
    const plan = planifierRattrapage([course({ partants: [1, 2, 3, 5, 7, 11, 13] })], pmu);
    expect(plan.arrivees).toEqual([]);
    expect(plan.ignorees).toEqual([{ course_id: "c-1", motif: "numéros hors partants" }]);
  });

  it("refuse sans partants connus", () => {
    const plan = planifierRattrapage([course({ partants: [] })], pmu);
    expect(plan.ignorees).toEqual([{ course_id: "c-1", motif: "partants inconnus" }]);
  });

  it("ignore une course absente du PMU, annulée ou sans numéro", () => {
    const plan = planifierRattrapage([
      course({ id: "absente", numero_course: 9 }),
      course({ id: "annulee", numero_course: 6 }),
      course({ id: "sans-num", numero_reunion: null }),
    ], pmu);
    expect(plan.arrivees).toEqual([]);
    expect(plan.ignorees).toEqual([
      { course_id: "absente", motif: "absente du PMU" },
      { course_id: "annulee", motif: "arrivée non définitive" },
      { course_id: "sans-num", motif: "sans numéro" },
    ]);
  });

  it("corrige une heure GMT, même pour une course qui a déjà son arrivée", () => {
    const plan = planifierRattrapage([course({ heure_depart: "13:15:00", arrivee_officielle: [5, 13, 11] })], pmu);
    expect(plan.heures).toEqual([{ course_id: "c-1", avant: "13:15:00", apres: "15:15:00" }]);
  });

  it("n'écrit rien sur une course qui n'est pas celle du PMU (mêmes numéros, autre hippodrome, autre épreuve)", () => {
    const plan = planifierRattrapage([
      course({ id: "autre", hippodrome: "Vincennes", libelle: "Prix Alphonse Sourroubille", heure_depart: "13:15:00" }),
      course({ id: "autre-arr", hippodrome: "Vincennes", libelle: "Prix Alphonse Sourroubille", arrivee_officielle: [13, 5, 11, 16, 7] }),
    ], pmu);
    expect(plan.arrivees).toEqual([]);
    expect(plan.heures).toEqual([]);
    expect(plan.divergentes).toEqual([]);
    expect(plan.ignorees).toEqual([{ course_id: "autre", motif: "autre course au PMU" }]);
  });

  it("accepte la copie d'une source secondaire (même épreuve, hippodrome « Paris-Vincennes »)", () => {
    const pmuVincennes = new Map<string, CoursePmuFrance>([
      [cleRC(1, 4), { arrivee: [5, 13, 11, 16, 7, 2, 10], depart: { paris: "15:15", decalageMin: 120 }, hippodrome: "VINCENNES", hippodromeLong: "HIPPODROME DE PARIS-VINCENNES", libelle: "PRIX D'ORGEVAL" }],
    ]);
    const plan = planifierRattrapage([course({ hippodrome: "Paris-Vincennes" })], pmuVincennes);
    expect(plan.arrivees).toHaveLength(1);
  });

  describe("ex æquo", () => {
    // Fixture : 1 et 4 ex æquo 2es (format PMU [[3],[1,4],[2]]).
    const pmuExAequo = new Map<string, CoursePmuFrance>([
      [cleRC(1, 4), { arrivee: [3, 1, 4, 2], rangs: [1, 2, 2, 4], depart: null, ...IDENTITE }],
    ]);
    const PARTANTS = [1, 2, 3, 4, 5];

    it("écrit les rangs avec l'arrivée", () => {
      const plan = planifierRattrapage([course({ partants: PARTANTS })], pmuExAequo);
      expect(plan.arrivees).toEqual([{ course_id: "c-1", ordre_arrivee: [3, 1, 4, 2], rangs: [1, 2, 2, 4] }]);
    });

    it("deux ex æquo dans l'autre ordre ne font pas une divergence", () => {
      const plan = planifierRattrapage([course({ partants: PARTANTS, arrivee_officielle: [3, 4, 1, 2] })], pmuExAequo);
      expect(plan.divergentes).toEqual([]);
    });

    it("un cheval à un autre rang reste une divergence", () => {
      const plan = planifierRattrapage([course({ partants: PARTANTS, arrivee_officielle: [3, 2, 1, 4] })], pmuExAequo);
      expect(plan.divergentes).toHaveLength(1);
      expect(plan.divergentes[0].rangs_pmu).toEqual([1, 2, 2, 4]);
    });
  });
});
