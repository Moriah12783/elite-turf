import { describe, it, expect } from "vitest";
import { dedupeArriveeCourses, groupByCanonicalHippodrome } from "./arrivees-group";

// Deux lignes pour la MÊME course R1C8, une par source :
//  - PMU/LONACI : nom brut « Compiegne », heure UTC 18:15, sans rapports
//  - Geny       : nom propre « Compiègne », heure Paris 20:15, AVEC rapports
const compiegnePmu = {
  numero_reunion: 1, numero_course: 8, heure_depart: "18:15:00",
  hippodrome: { nom: "Compiegne", pays: "France" },
  rapports_pmu: null,
  partants: [{ nom_cheval: "DARK ZEL" }, { nom_cheval: "THE SHADOW" }],
};
const compiegneGeny = {
  numero_reunion: 1, numero_course: 8, heure_depart: "20:15:00",
  hippodrome: { nom: "Compiègne", pays: "France" },
  rapports_pmu: { quinte_plus: { ordre: 16049.6 } },
  partants: [{ nom_cheval: "Dark Zel" }, { nom_cheval: "The Shadow" }],
};

describe("dedupeArriveeCourses", () => {
  it("fusionne les deux variantes d'une même course et garde la ligne avec rapports", () => {
    const out = dedupeArriveeCourses([compiegnePmu, compiegneGeny]);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(compiegneGeny);          // celle avec rapports gagne
    expect(out[0].heure_depart).toBe("20:15:00"); // → heure de Paris conservée
  });

  it("préfère le nom PROPRE (accents/tirets) même sans rapports", () => {
    const plain = {
      numero_reunion: 2, numero_course: 2, heure_depart: "10:06:00",
      hippodrome: { nom: "Le Mont Saint Michel", pays: "France" },
      rapports_pmu: null, partants: [{ nom_cheval: "A" }],
    };
    const propre = {
      numero_reunion: 2, numero_course: 2, heure_depart: "12:06:00",
      hippodrome: { nom: "Le Mont-Saint-Michel", pays: "France" },
      rapports_pmu: null, partants: [{ nom_cheval: "A" }],
    };
    const out = dedupeArriveeCourses([plain, propre]);
    expect(out).toHaveLength(1);
    expect(out[0].hippodrome?.nom).toBe("Le Mont-Saint-Michel");
  });

  it("conserve des courses distinctes de la même réunion", () => {
    const c7 = { ...compiegneGeny, numero_course: 7, heure_depart: "19:33:00" };
    const out = dedupeArriveeCourses([compiegnePmu, compiegneGeny, c7]);
    expect(out).toHaveLength(2);
    expect(out.map((c) => c.numero_course).sort()).toEqual([7, 8]);
  });

  it("liste vide → vide", () => {
    expect(dedupeArriveeCourses([])).toEqual([]);
  });
});

describe("groupByCanonicalHippodrome", () => {
  it("un seul groupe pour les variantes d'orthographe, avec le nom propre", () => {
    const deduped = dedupeArriveeCourses([compiegnePmu, compiegneGeny]);
    const groups = groupByCanonicalHippodrome(deduped);
    expect(groups).toHaveLength(1);
    expect(groups[0].hippodrome?.nom).toBe("Compiègne");
    expect(groups[0].courses).toHaveLength(1);
  });

  it("sépare deux hippodromes réellement différents", () => {
    const enghien = {
      numero_reunion: 4, numero_course: 1, heure_depart: "14:00:00",
      hippodrome: { nom: "Enghien", pays: "France" },
      rapports_pmu: null, partants: [],
    };
    const groups = groupByCanonicalHippodrome([compiegneGeny, enghien]);
    expect(groups).toHaveLength(2);
  });
});
