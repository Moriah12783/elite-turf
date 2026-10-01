import { describe, it, expect } from "vitest";
import { construireBandeau, MESSAGES_ELITE_TURF, type CourseBandeau } from "./bandeau";

const course = (id: string, r: number, n: number, heure: string, extra: Partial<CourseBandeau> = {}): CourseBandeau => ({
  id, numero_reunion: r, numero_course: n, heure_depart: heure, statut: "PROGRAMME",
  arrivee_officielle: null, nb_partants: 12, hippodrome: { nom: "Auteuil" }, ...extra,
});

// Situation réelle du 01/10/2026 vers 16h (heure de Paris).
const jour = [
  course("c1", 1, 1, "13:55:00", { statut: "TERMINE", arrivee_officielle: [15, 3, 14, 1, 9, 7] }),
  course("c3", 1, 3, "15:05:00", { statut: "TERMINE", arrivee_officielle: [10, 1, 6, 9, 5] }),
  course("c5", 1, 5, "16:15:00", { nb_partants: 14 }),
  course("c6", 1, 6, "16:50:00", { nb_partants: 0 }),
  course("a2", 4, 2, "12:00:00", { hippodrome: { nom: "Argentan" } }), // déjà partie, sans arrivée
];
const SEIZE_H = 16 * 60;

describe("construireBandeau — uniquement des données réelles du jour", () => {
  it("arrivées les plus récentes d'abord, puis les prochains départs", () => {
    const items = construireBandeau({ courses: jour, pronostics: [], maintenantMinutesParis: SEIZE_H });
    expect(items.map((i) => `${i.label} | ${i.result}`)).toEqual([
      "R1C3 Auteuil | 🏁 Arrivée : 10 - 1 - 6 - 9 - 5",
      "R1C1 Auteuil | 🏁 Arrivée : 15 - 3 - 14 - 1 - 9",
      "R1C5 Auteuil | 🕐 16:15 (Paris) · 14 partants",
      "R1C6 Auteuil | 🕐 16:50 (Paris)",
    ]);
  });

  it("une course déjà partie sans arrivée connue n'est pas annoncée « à venir »", () => {
    const items = construireBandeau({ courses: jour, pronostics: [], maintenantMinutesParis: SEIZE_H });
    expect(items.some((i) => i.label.includes("Argentan"))).toBe(false);
  });

  it("un pronostic par course, même publié en Elite ET en Pro (plus de doublon)", () => {
    const items = construireBandeau({
      courses: jour,
      pronostics: [
        { course_id: "c5", type_pari: "QUINTE_PLUS", resultat: null },
        { course_id: "c5", type_pari: "QUINTE_PLUS", resultat: null },
      ],
      maintenantMinutesParis: SEIZE_H,
    });
    const pronos = items.filter((i) => i.label.startsWith("⭐"));
    expect(pronos).toHaveLength(1);
    expect(pronos[0]).toMatchObject({ label: "⭐ R1C5 Auteuil", result: "Quinté+ · pronostic publié (abonnés)" });
  });

  it("pronostic gagnant : dit seulement ce que la base établit", () => {
    const items = construireBandeau({
      courses: jour,
      pronostics: [{ course_id: "c1", type_pari: "QUINTE_PLUS", resultat: "GAGNANT" }],
      maintenantMinutesParis: SEIZE_H,
    });
    expect(items.find((i) => i.label === "⭐ R1C1 Auteuil")).toMatchObject({ result: "Quinté+ · pronostic gagnant", status: "win" });
  });

  it("aucune donnée du jour → aucun élément inventé", () => {
    expect(construireBandeau({ courses: [], pronostics: [], maintenantMinutesParis: SEIZE_H })).toEqual([]);
  });
});

describe("MESSAGES_ELITE_TURF — des messages vrais, sans faux direct", () => {
  it("aucun message ne prétend à du temps réel ni à une course précise", () => {
    for (const m of MESSAGES_ELITE_TURF) {
      expect(`${m.label} ${m.result}`).not.toMatch(/temps réel|live|R\d|Vincennes|Longchamp|Chantilly|chaque Quinté/i);
    }
  });
});
