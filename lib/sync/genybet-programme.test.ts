import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseGenybetReunions, parseReunionHeaders } from "./genybet-programme";

function loadFixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");
}

const HTML_TODAY = loadFixture("genybet-reunions-sample.html");   // 06-07-2026
const HTML_J1    = loadFixture("genybet-reunions-j1-sample.html"); // 07-07-2026 (J+1)

describe("parseReunionHeaders", () => {
  it("extrait R{n} -> hippodrome + pays (drapeau)", () => {
    const h = parseReunionHeaders(HTML_TODAY);
    expect(h.get(1)?.hippo).toContain("Sables");
    expect(h.get(1)?.pays).toBe("France");
    // Casablanca est relayé avec le drapeau Maroc
    const maroc = Array.from(h.values()).find((r) => r.pays === "Maroc");
    expect(maroc).toBeTruthy();
    expect(maroc?.hippo).toContain("Casablanca");
  });
});

describe("parseGenybetReunions — programme du JOUR (06/07)", () => {
  const courses = parseGenybetReunions(HTML_TODAY, "2026-07-06");

  it("ramène des courses, uniquement France + Maroc", () => {
    expect(courses.length).toBeGreaterThan(10);
    const pays = new Set(courses.map((c) => c.hippodromePays));
    expect(pays).toEqual(new Set(["France", "Maroc"]));
    // Palermo (Italie) est filtré
    expect(courses.some((c) => c.hippodromeName.includes("Palermo"))).toBe(false);
  });

  it("parse la 1re course des Sables (trot attelé, heure, partants)", () => {
    const c1 = courses.find((c) => c.hippodromeName.includes("Sables") && c.numeroReunion === 1 && c.numeroCourse === 1);
    expect(c1).toBeTruthy();
    expect(c1!.libelle).toContain("Courses");     // "Prix des Sociétés des Courses de Vendée"
    expect(c1!.categorie).toBe("TROT");
    expect(c1!.heureDepart).toBe("14:18:00");
    expect(c1!.nbPartants).toBe(10);
    expect(c1!.dateCourse).toBe("2026-07-06");
  });

  it("marque exactement 1 course vedette (Quinté+) = la réunion Quinté du jour", () => {
    const quinte = courses.filter((c) => c.parisDisponibles.includes("QUINTE_PLUS"));
    expect(quinte).toHaveLength(1);
    // Le Quinté du 06/07 est aux Sables-d'Olonne
    expect(quinte[0].hippodromeName).toContain("Sables");
  });
});

describe("parseGenybetReunions — programme J+1 (07/07) : le fix de l'écran noir", () => {
  const courses = parseGenybetReunions(HTML_J1, "2026-07-07");

  it("ramène le programme de DEMAIN (Chantilly présent, Tongres/Belgique filtré)", () => {
    expect(courses.length).toBeGreaterThan(10);
    expect(courses.some((c) => c.hippodromeName.includes("Chantilly"))).toBe(true);
    expect(courses.some((c) => c.hippodromeName.includes("Tongres"))).toBe(false);
    expect(courses.every((c) => c.dateCourse === "2026-07-07")).toBe(true);
  });

  it("parse une course à venir (A_COURIR) : plat, heure, partants", () => {
    const c1 = courses.find((c) => c.hippodromeName.includes("Chantilly") && c.numeroReunion === 1 && c.numeroCourse === 1);
    expect(c1).toBeTruthy();
    expect(c1!.libelle).toContain("Soleil");      // "Prix du Soleil de Bretagne"
    expect(c1!.categorie).toBe("PLAT");
    expect(c1!.heureDepart).toBe("14:18:00");
    expect(c1!.nbPartants).toBe(6);
  });

  it("détecte la vedette Quinté+ de demain (Chantilly), exactement 1", () => {
    const quinte = courses.filter((c) => c.parisDisponibles.includes("QUINTE_PLUS"));
    expect(quinte).toHaveLength(1);
    expect(quinte[0].hippodromeName).toContain("Chantilly");
  });
});

describe("parseGenybetReunions — robustesse", () => {
  it("HTML vide -> tableau vide, sans throw", () => {
    expect(parseGenybetReunions("", "2026-07-06")).toEqual([]);
    expect(parseGenybetReunions("<html>rien</html>", "2026-07-06")).toEqual([]);
  });
});
