import { describe, it, expect } from "vitest";
import {
  pickCoursesVedettes, pickCourseVedette, pickQuinteDuJour,
  type CourseForVedette, type CourseQuinteCandidate,
} from "./course-vedette";

const jour: CourseForVedette[] = [
  { id: "p1", hippodrome: "Vincennes", numero_reunion: 1, numero_course: 1, nb_partants: 12, paris_disponibles: [], heure_depart: "12:50" },
  { id: "quinte", hippodrome: "Vincennes", numero_reunion: 1, numero_course: 4, nb_partants: 16, paris_disponibles: ["QUINTE_PLUS", "TIERCE"], heure_depart: "13:47" },
  { id: "tierce", hippodrome: "Compiègne", numero_reunion: 2, numero_course: 3, nb_partants: 10, paris_disponibles: ["TIERCE"], heure_depart: "14:15" },
  { id: "lointain", hippodrome: "Sha Tin", numero_reunion: 9, numero_course: 1, nb_partants: 14, paris_disponibles: ["QUARTE"], heure_depart: "08:00" },
];

describe("pickCoursesVedettes", () => {
  it("élit le Quinté+ du jour en tête", () => {
    const v = pickCoursesVedettes(jour);
    expect(v[0].id).toBe("quinte");
    expect(v[0].pari_principal).toBe("QUINTE_PLUS");
    expect(v[0].raison).toContain("Quinté+");
  });

  it("le Quinté+ bat un Quarté+ même mieux placé en hippodrome", () => {
    const courses: CourseForVedette[] = [
      { id: "q", hippodrome: "Inconnu", numero_reunion: 5, numero_course: 2, nb_partants: 11, paris_disponibles: ["QUINTE_PLUS"], heure_depart: "15:00" },
      { id: "quarte", hippodrome: "Vincennes", numero_reunion: 1, numero_course: 6, nb_partants: 15, paris_disponibles: ["QUARTE_PLUS"], heure_depart: "16:00" },
    ];
    // Quinté+ = 100 ; Quarté+ Vincennes 15 partants = 70 + 15 + 10 = 95
    expect(pickCourseVedette(courses)?.id).toBe("q");
  });

  it("ignore les courses sans pari national", () => {
    const v = pickCoursesVedettes([
      { id: "x", hippodrome: "Vincennes", paris_disponibles: [], nb_partants: 12 },
      { id: "y", hippodrome: "Vincennes", paris_disponibles: null, nb_partants: 12 },
    ]);
    expect(v).toHaveLength(0);
    expect(pickCourseVedette([{ id: "x", paris_disponibles: [] }])).toBeNull();
  });

  it("respecte la limite et trie par score puis heure", () => {
    const v = pickCoursesVedettes(jour, 2);
    expect(v).toHaveLength(2);
    expect(v[0].id).toBe("quinte"); // 100 + prestige 15 + 16 partants 10 = 125
  });

  it("pickCourseVedette renvoie la mieux classée", () => {
    expect(pickCourseVedette(jour)?.id).toBe("quinte");
  });
});

// Extraits RÉELS de la base (heures, paris, étiquettes LONACI), anonymisés en id.
describe("pickQuinteDuJour — la vedette est TOUJOURS le Quinté+ PMU (= Nationale 1)", () => {
  // 25/09/2026 : le cas qui a motivé la correction. La home affichait la 1re
  // course du jour (Prix d'Arles, 11h00, « SIMPLE_GAGNANT ») au lieu du Quinté+.
  const jour25: CourseQuinteCandidate[] = [
    { id: "arles",   heure_depart: "11:00:00", paris_disponibles: ["SIMPLE_GAGNANT", "SIMPLE_PLACE"], nationale: null, jouable_afrique: false },
    { id: "kervegan", heure_depart: "15:10:00", paris_disponibles: ["SIMPLE_GAGNANT", "SIMPLE_PLACE"], nationale: 2, jouable_afrique: true },
    // Quinté MAROCAIN (SOREC, Anfa) : « QUINTE » sans « QUINTE_PLUS ».
    { id: "anfa",    heure_depart: "17:20:00", paris_disponibles: ["TRIO", "QUARTE", "QUINTE", "TIERCE", "MULTI"], nationale: 3, jouable_afrique: true },
    // LE Quinté+ : R1C4 Paris-Vincennes, Prix Austria, Nationale 1.
    { id: "austria", heure_depart: "18:15:00", paris_disponibles: ["QUARTE_PLUS", "QUINTE", "TIERCE", "QUINTE_PLUS"], nationale: 1, jouable_afrique: true },
    // Doublon d'une 2e source (hippodrome « Vincennes », heure décalée de 2 h).
    { id: "austria-doublon", heure_depart: "20:15:00", paris_disponibles: ["QUINTE_PLUS", "QUARTE_PLUS", "TIERCE"], nationale: null, jouable_afrique: false },
  ];

  it("25/09 : élit le Prix Austria (Nationale 1), pas la 1re course du jour", () => {
    expect(pickQuinteDuJour(jour25)?.id).toBe("austria");
  });

  it("ne confond jamais le quinté marocain (« QUINTE ») avec le Quinté+ PMU", () => {
    const sansQuintePlus = jour25.filter((c) => c.id !== "austria" && c.id !== "austria-doublon");
    expect(pickQuinteDuJour(sansQuintePlus)).toBeNull();
  });

  it("l'ordre des lignes ne change rien (le doublon listé avant reste écarté)", () => {
    expect(pickQuinteDuJour(jour25.slice().reverse())?.id).toBe("austria");
  });

  it("13/09 et 23/09 : Nationale 1 suffit, même quand les paris de la course sont incomplets", () => {
    const jour23: CourseQuinteCandidate[] = [
      { id: "argentan", heure_depart: "13:55:00", paris_disponibles: ["SIMPLE_GAGNANT", "SIMPLE_PLACE"], nationale: 1, jouable_afrique: true },
      { id: "khemisset", heure_depart: "16:57:00", paris_disponibles: ["QUARTE", "QUINTE", "TIERCE"], nationale: 3, jouable_afrique: true },
    ];
    expect(pickQuinteDuJour(jour23)?.id).toBe("argentan");
  });

  it("sans étiquette LONACI : le Quinté+ jouable en Afrique, puis le plus tôt", () => {
    const avantLonaci: CourseQuinteCandidate[] = [
      { id: "tard", heure_depart: "20:15:00", paris_disponibles: ["QUINTE_PLUS"], nationale: null, jouable_afrique: null },
      { id: "tot",  heure_depart: "18:15:00", paris_disponibles: ["QUINTE_PLUS"], nationale: null, jouable_afrique: null },
    ];
    expect(pickQuinteDuJour(avantLonaci)?.id).toBe("tot");
    avantLonaci[0].jouable_afrique = true;
    expect(pickQuinteDuJour(avantLonaci)?.id).toBe("tard");
  });

  it("ignore une course annulée", () => {
    expect(pickQuinteDuJour([
      { id: "annule", heure_depart: "15:15:00", paris_disponibles: ["QUINTE_PLUS"], nationale: 1, statut: "ANNULE" },
    ])).toBeNull();
  });

  it("aucun Quinté+ identifiable → null (jamais une course prise au hasard)", () => {
    expect(pickQuinteDuJour([])).toBeNull();
    expect(pickQuinteDuJour([{ id: "x", paris_disponibles: null }])).toBeNull();
  });
});
