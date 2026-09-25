import { describe, it, expect } from "vitest";
import { augmentParisFromNationale, gmtVersParis, lonaciVersProgramme } from "./lonaci-programme";
import type { NormalizedLonaciCourse } from "@/lib/lonaci-api";

describe("augmentParisFromNationale — Nationale LONACI → paris Elite", () => {
  it("Nationale 1 → force QUINTE_PLUS (sinon la course vedette ne se détecte pas)", () => {
    // LONACI liste souvent QNC3=QUINTE (pas QNPC3=QUINTE_PLUS) sur une Nat.1.
    const r = augmentParisFromNationale(["QUINTE", "TIERCE"], 1);
    expect(r).toContain("QUINTE_PLUS");
    expect(r).toContain("TIERCE");
  });

  it("Nationale 2 → QUARTE_PLUS ; Nationale 3 → TIERCE", () => {
    expect(augmentParisFromNationale([], 2)).toContain("QUARTE_PLUS");
    expect(augmentParisFromNationale([], 3)).toContain("TIERCE");
  });

  it("course normale (nationale 0) → paris inchangés, aucun QUINTE_PLUS forcé", () => {
    const r = augmentParisFromNationale(["SIMPLE_GAGNANT"], 0);
    expect(r).not.toContain("QUINTE_PLUS");
    expect(r).toContain("SIMPLE_GAGNANT");
  });

  it("dédoublonne (QUINTE_PLUS déjà présent → une seule occurrence)", () => {
    const r = augmentParisFromNationale(["QUINTE_PLUS", "QUINTE_PLUS"], 1);
    expect(r.filter((p) => p === "QUINTE_PLUS").length).toBe(1);
  });
});

// LONACI publie ses heures en GMT (Abidjan). Vérifié le 25/09/2026 sur l'API
// officielle PMU : Prix Austria = 20:15 heure de Paris = 18:15 GMT (flux LONACI).
describe("gmtVersParis — la base est à l'heure de Paris", () => {
  it("heure d'été : +2 h (Prix Austria 18:15 GMT → 20:15 Paris)", () => {
    expect(gmtVersParis("2026-09-25", "18:15:00")).toEqual({ date: "2026-09-25", heure: "20:15:00" });
  });

  it("heure d'hiver : +1 h", () => {
    expect(gmtVersParis("2026-01-15", "13:50:00")).toEqual({ date: "2026-01-15", heure: "14:50:00" });
  });

  it("jours de changement d'heure", () => {
    // 29/03/2026 : passage à l'heure d'été à 01:00 GMT.
    expect(gmtVersParis("2026-03-29", "00:30:00")).toEqual({ date: "2026-03-29", heure: "01:30:00" });
    expect(gmtVersParis("2026-03-29", "12:00:00")).toEqual({ date: "2026-03-29", heure: "14:00:00" });
    // 25/10/2026 : retour à l'heure d'hiver à 01:00 GMT.
    expect(gmtVersParis("2026-10-25", "12:00:00")).toEqual({ date: "2026-10-25", heure: "13:00:00" });
  });

  it("passe au lendemain quand il le faut", () => {
    expect(gmtVersParis("2026-09-25", "22:30:00")).toEqual({ date: "2026-09-26", heure: "00:30:00" });
  });

  it("n'invente rien : heure absente (00:00:00) ou illisible → inchangée", () => {
    expect(gmtVersParis("2026-09-25", "00:00:00")).toEqual({ date: "2026-09-25", heure: "00:00:00" });
    expect(gmtVersParis("pas-une-date", "18:15:00")).toEqual({ date: "pas-une-date", heure: "18:15:00" });
  });
});

describe("lonaciVersProgramme — ce que la voie de secours LONACI écrit en base", () => {
  const base: NormalizedLonaciCourse = {
    hippodrome: "Vincennes", pays: "France", nReunion: 1, numeroCourse: 4,
    libelle: "PRIX AUSTRIA", dateCourse: "2026-09-25", heureDepart: "18:15:00",
    distance: 2850, nbPartants: 18, nationale: 1, parisDisponibles: ["QUINTE"], parisLonaciCodes: [],
  };

  it("heure convertie à l'heure de Paris, nom de référence, Quinté+ marqué", () => {
    const [c] = lonaciVersProgramme([base], "2026-09-25");
    expect(c.hippodromeName).toBe("Vincennes");
    expect(c.heureDepart).toBe("20:15:00");
    expect(c.dateCourse).toBe("2026-09-25");
    expect(c.parisDisponibles).toContain("QUINTE_PLUS");
  });

  it("garde le filtre France/Maroc et la date demandée", () => {
    const autres = lonaciVersProgramme([
      { ...base, pays: "Sénégal" },
      { ...base, dateCourse: "2026-09-26" },
    ], "2026-09-25");
    expect(autres).toHaveLength(0);
  });
});
