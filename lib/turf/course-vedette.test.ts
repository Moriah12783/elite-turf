import { describe, it, expect } from "vitest";
import { pickCoursesVedettes, pickCourseVedette, type CourseForVedette } from "./course-vedette";

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
