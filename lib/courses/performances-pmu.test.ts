import { describe, it, expect } from "vitest";
import performancesJson from "@/lib/brouillons-quinte/__fixtures__/pmu-performances-20261012-R1C4.json";
import courseJson from "@/lib/brouillons-quinte/__fixtures__/pmu-course-20261007-R1C1.json";
import {
  lirePerformancesPmu, lireAllocationCoursePmu, libellePlace, allocationEnMilliers, auNiveauDuJour,
  type ChevalPerformances,
} from "./performances-pmu";
import { preparerAllocations } from "./allocations-course";

// Le PMU date une course à minuit, heure de Paris : lue en UTC, elle tomberait la veille.
const PARIS = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" });
const jour = (ms: number | null) => (ms === null ? null : PARIS.format(ms));

describe("lirePerformancesPmu — vraie réponse PMU, Quinté+ du 12/10/2026 (n°3, 4 et 7)", () => {
  const chevaux = lirePerformancesPmu(performancesJson);
  const cheval = (n: number) => chevaux.find((c) => c.numero === n)!;

  it("un cheval par partant de la réponse, avec son nom", () => {
    expect(chevaux.map((c) => [c.numero, c.nom])).toEqual([[3, "MORPHEWAN"], [4, "PLATA D OCTOBRE"], [7, "SOUS INFLUENCE"]]);
  });

  it("n°4 : date, hippodrome, allocation et place de ses 5 dernières courses, la plus récente d'abord", () => {
    expect(cheval(4).courses.map((c) => [jour(c.date), c.hippodrome, c.allocation, c.place, c.statut])).toEqual([
      ["2026-09-21", "VICHY", 19200, 1, "PLACE"],
      ["2026-09-03", "VICHY", 19200, 5, "PLACE"],
      ["2026-08-03", "VICHY", 16300, 1, "PLACE"],
      ["2026-07-21", "VICHY", 15400, 1, "PLACE"],
      ["2026-06-20", "MARSEILLE PONT DE VIVAUX", 16300, 4, "PLACE"],
    ]);
  });

  it("n°3 : des courses mieux dotées, avec des places plus lointaines", () => {
    expect(cheval(3).courses.map((c) => [c.allocation, c.place, c.statut])).toEqual([
      [96000, 6, "NON_PLACE"], [13700, 1, "PLACE"], [50900, 4, "PLACE"], [72000, 7, "NON_PLACE"], [96000, 13, "NON_PLACE"],
    ]);
  });

  it("n°7 : 4 courses connues seulement", () => {
    expect(cheval(7).courses).toHaveLength(4);
  });

  it("courses dans le désordre : remises de la plus récente à la plus ancienne", () => {
    const [c] = lirePerformancesPmu({ participants: [{ numPmu: 1, nomCheval: "A", coursesCourues: [
      { date: 1000, allocation: 10000 }, { date: 3000, allocation: 30000 }, { date: 2000, allocation: 20000 },
    ] }] });
    expect(c.courses.map((x) => x.allocation)).toEqual([30000, 20000, 10000]);
  });

  // Formes relevées le 12/10/2026 sur 322 courses passées (6 courses du programme).
  it("cheval disqualifié, arrêté ou tombé : pas de place chiffrée, le statut est gardé", () => {
    const lui = (place: unknown) => ({ date: 1, allocation: 20000, participants: [{ itsHim: false, place: { place: 1 } }, { itsHim: true, place }] });
    const [c] = lirePerformancesPmu({ participants: [{ numPmu: 2, nomCheval: "B", coursesCourues: [
      lui({ place: null, rawValue: "AI", statusArrivee: "DISQUALIFIE_POUR_ALLURE_IRREGULIERE" }),
      lui({ place: null, rawValue: "AR", statusArrivee: "ARRETE" }),
      lui({ place: null, rawValue: "TB", statusArrivee: "TOMBE" }),
    ] }] });
    expect(c.courses.map((x) => [x.place, x.statut])).toEqual([
      [null, "DISQUALIFIE_POUR_ALLURE_IRREGULIERE"], [null, "ARRETE"], [null, "TOMBE"],
    ]);
  });

  it("champs absents → null ; cheval sans course connue → liste vide (il reste affiché)", () => {
    const chevaux2 = lirePerformancesPmu({ participants: [{ numPmu: 5, coursesCourues: [{}] }, { numPmu: 6 }] });
    expect(chevaux2).toEqual([
      { numero: 5, nom: null, courses: [{ date: null, hippodrome: null, allocation: null, place: null, statut: null }] },
      { numero: 6, nom: null, courses: [] },
    ]);
  });

  it("réponse vide ou illisible → aucun cheval", () => {
    expect(lirePerformancesPmu(null)).toEqual([]);
    expect(lirePerformancesPmu({})).toEqual([]);
    expect(lirePerformancesPmu({ participants: [{ numPmu: "x" }] })).toEqual([]);
  });
});

describe("lireAllocationCoursePmu", () => {
  it("allocation de la course du jour — vraie réponse PMU du 07/10/2026 (Prix des Gobelins)", () => {
    expect(lireAllocationCoursePmu(courseJson)).toBe(59000);
  });

  it("absente ou illisible → null", () => {
    expect(lireAllocationCoursePmu(null)).toBeNull();
    expect(lireAllocationCoursePmu({})).toBeNull();
    expect(lireAllocationCoursePmu({ montantPrix: "abc" })).toBeNull();
    expect(lireAllocationCoursePmu({ montantPrix: 0 })).toBeNull();
  });
});

describe("libellePlace", () => {
  it("place chiffrée", () => {
    expect(libellePlace({ place: 1, statut: "PLACE" })).toBe("1er");
    expect(libellePlace({ place: 2, statut: "PLACE" })).toBe("2e");
    expect(libellePlace({ place: 13, statut: "NON_PLACE" })).toBe("13e");
  });

  it("sans place : disqualifié, arrêté, tombé, non placé", () => {
    expect(libellePlace({ place: null, statut: "DISQUALIFIE_POUR_ALLURE_IRREGULIERE" })).toBe("Disq.");
    expect(libellePlace({ place: null, statut: "ARRETE" })).toBe("Arrêté");
    expect(libellePlace({ place: null, statut: "TOMBE" })).toBe("Tombé");
    expect(libellePlace({ place: null, statut: "NON_PLACE" })).toBe("Non placé");
  });

  it("statut inconnu ou absent : tiret, jamais une place inventée", () => {
    expect(libellePlace({ place: null, statut: null })).toBe("—");
    expect(libellePlace({ place: null, statut: "AUTRE_CHOSE" })).toBe("—");
  });
});

describe("allocationEnMilliers et auNiveauDuJour", () => {
  it("milliers d'euros arrondis", () => {
    expect(allocationEnMilliers(19200)).toBe("19 k€");
    expect(allocationEnMilliers(50900)).toBe("51 k€");
    expect(allocationEnMilliers(96000)).toBe("96 k€");
  });

  it("moins de 1 000 €", () => {
    expect(allocationEnMilliers(400)).toBe("<1 k€");
  });

  it("au niveau du jour : allocation au moins égale à celle du jour", () => {
    expect(auNiveauDuJour(50900, 50900)).toBe(true);
    expect(auNiveauDuJour(96000, 50900)).toBe(true);
    expect(auNiveauDuJour(19200, 50900)).toBe(false);
  });

  it("allocation ou allocation du jour inconnue : jamais mis en avant", () => {
    expect(auNiveauDuJour(null, 50900)).toBe(false);
    expect(auNiveauDuJour(96000, null)).toBe(false);
  });
});

describe("preparerAllocations", () => {
  const chevaux = lirePerformancesPmu(performancesJson);
  const NOMS = ["Morphewan", "Plata d'Octobre", "Sous Influence"];

  it("nos chevaux reconnus : chevaux triés par numéro, allocation du jour, pas de message", () => {
    const r = preparerAllocations(NOMS, chevaux.slice().reverse(), 50900);
    expect(r.message).toBeNull();
    expect(r.allocationJour).toBe(50900);
    expect(r.chevaux.map((c) => c.numero)).toEqual([3, 4, 7]);
  });

  it("autres chevaux que les nôtres : rien n'est affiché (ce serait une autre course)", () => {
    const r = preparerAllocations(["ALPHA", "BRAVO", "CHARLIE"], chevaux, 50900);
    expect(r.chevaux).toEqual([]);
    expect(r.message).toBe("Les données PMU de cette course n'ont pas pu être identifiées avec certitude.");
  });

  it("moins de 3 partants connus en base : on ne peut pas l'affirmer → rien", () => {
    expect(preparerAllocations(["MORPHEWAN"], chevaux, 50900).chevaux).toEqual([]);
  });

  it("aucune course passée connue : message, pas de tableau vide", () => {
    const sans: ChevalPerformances[] = chevaux.map((c) => ({ ...c, courses: [] }));
    const r = preparerAllocations(NOMS, sans, 50900);
    expect(r.chevaux).toEqual([]);
    expect(r.message).toBe("Le PMU ne donne pas l'historique des partants de cette course.");
  });

  it("allocation du jour inconnue : les chevaux restent affichés", () => {
    const r = preparerAllocations(NOMS, chevaux, null);
    expect(r.allocationJour).toBeNull();
    expect(r.chevaux).toHaveLength(3);
  });
});
