import { describe, it, expect } from "vitest";
import { sortPageProgramme, sortPageQuinte, ecartJours, FENETRE_PASSE_JOURS, FENETRE_FUTUR_JOURS } from "./programme-fenetre";

const AUJ = "2026-09-17";

describe("ecartJours", () => {
  it("compte les jours entiers, dans les deux sens", () => {
    expect(ecartJours(AUJ, "2026-09-17")).toBe(0);
    expect(ecartJours(AUJ, "2026-10-12")).toBe(25);
    expect(ecartJours(AUJ, "2026-05-19")).toBe(-121);
  });

  it("traverse les changements d'heure sans décaler d'un jour", () => {
    // Passage à l'heure d'hiver fin octobre : un calcul en heure locale
    // produirait 0,958 jour et un arrondi fragile.
    expect(ecartJours("2026-10-24", "2026-10-26")).toBe(2);
    expect(ecartJours("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("sortPageProgramme — le contenu décide, pas la date", () => {
  // Le cas qui a motivé la correction : 36 courses, 121 jours, renvoyait 404.
  it("une journée passée AVEC des courses reste indexable, même au-delà de 90 jours", () => {
    expect(sortPageProgramme("2026-05-19", AUJ, 36)).toBe("indexable");
    expect(sortPageProgramme("2025-01-01", AUJ, 1)).toBe("indexable");
  });

  it("une journée avec des courses est indexable, qu'elle soit passée, présente ou future", () => {
    expect(sortPageProgramme(AUJ, AUJ, 12)).toBe("indexable");
    expect(sortPageProgramme("2026-09-18", AUJ, 8)).toBe("indexable");
  });

  // L'autre moitié du défaut : 29 pages futures vides servies en doublons.
  it("une journée future SANS course dans la fenêtre est servie mais masquée à Google", () => {
    expect(sortPageProgramme("2026-10-12", AUJ, 0)).toBe("noindex");
    expect(sortPageProgramme(AUJ, AUJ, 0)).toBe("noindex");
  });

  it("une journée passée récente SANS course est servie mais masquée", () => {
    expect(sortPageProgramme("2026-09-01", AUJ, 0)).toBe("noindex");
  });

  it("une journée lointaine SANS course renvoie 404 (pas d'espace d'URL infini)", () => {
    expect(sortPageProgramme("2027-06-01", AUJ, 0)).toBe("introuvable");
    expect(sortPageProgramme("2024-01-01", AUJ, 0)).toBe("introuvable");
  });

  it("les bornes de la fenêtre sont incluses", () => {
    const debut = new Date(Date.parse(AUJ + "T00:00:00Z") - FENETRE_PASSE_JOURS * 86400000).toISOString().slice(0, 10);
    const fin   = new Date(Date.parse(AUJ + "T00:00:00Z") + FENETRE_FUTUR_JOURS * 86400000).toISOString().slice(0, 10);
    const avant = new Date(Date.parse(debut + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
    const apres = new Date(Date.parse(fin + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
    expect(sortPageProgramme(debut, AUJ, 0)).toBe("noindex");
    expect(sortPageProgramme(fin, AUJ, 0)).toBe("noindex");
    expect(sortPageProgramme(avant, AUJ, 0)).toBe("introuvable");
    expect(sortPageProgramme(apres, AUJ, 0)).toBe("introuvable");
  });
});

// Brief SEO du 01/10/2026, bug B1 : 14 dates (28/08 → 30/09) passées en noindex
// parce que le marqueur Quinté+ manquait en base — alors qu'un Quinté+ se court
// chaque jour (la page du 02/09 avait fait 110 clics).
describe("sortPageQuinte — un trou de données ne retire jamais une date passée de Google", () => {
  const AUJ2 = "2026-10-01";

  it("Quinté+ identifié → indexable, passé comme futur", () => {
    expect(sortPageQuinte("2026-09-02", AUJ2, true, 30)).toBe("indexable");
    expect(sortPageQuinte("2026-10-02", AUJ2, true, 31)).toBe("indexable");
  });

  it("date PASSÉE avec des courses mais Quinté+ non identifié → reste indexable (garde-fou)", () => {
    expect(sortPageQuinte("2026-09-02", AUJ2, false, 30)).toBe("indexable");
    expect(sortPageQuinte("2026-07-01", AUJ2, false, 44)).toBe("indexable");
  });

  it("date passée SANS aucune course en base → règle habituelle (noindex proche, 404 lointain)", () => {
    expect(sortPageQuinte("2026-09-20", AUJ2, false, 0)).toBe("noindex");
    expect(sortPageQuinte("2025-01-01", AUJ2, false, 0)).toBe("introuvable");
  });

  it("aujourd'hui ou futur sans Quinté+ identifié → masqué à Google, jamais présenté comme indexable", () => {
    expect(sortPageQuinte(AUJ2, AUJ2, false, 30)).toBe("noindex");
    expect(sortPageQuinte("2026-10-12", AUJ2, false, 0)).toBe("noindex");
  });
});
