import { describe, expect, it } from "vitest";
import {
  RECENTS_COUNT,
  buildPeriodeTabs,
  filterByPeriode,
  moisLabel,
  resolvePeriode,
} from "./periode-filter";

// Helper : génère un pronostic minimal avec une date_course donnée.
const mk = (dateCourse: string) => ({ course: { date_course: dateCourse } });

// Jeu de données proche de la réalité (175 répartis sur plusieurs mois).
function dataset() {
  const out: any[] = [];
  // 7 en juin 2026
  for (let i = 1; i <= 7; i++) out.push(mk(`2026-06-0${i}`));
  // 81 en mai 2026
  for (let i = 0; i < 81; i++) out.push(mk(`2026-05-${String((i % 28) + 1).padStart(2, "0")}`));
  // 54 en avril 2026
  for (let i = 0; i < 54; i++) out.push(mk(`2026-04-${String((i % 28) + 1).padStart(2, "0")}`));
  // Tri desc (juin avant mai avant avril) — comme la page
  return out.sort((a, b) => b.course.date_course.localeCompare(a.course.date_course));
}

describe("moisLabel()", () => {
  it("formate correctement en français", () => {
    expect(moisLabel("2026-05")).toBe("Mai 2026");
    expect(moisLabel("2026-01")).toBe("Janvier 2026");
    expect(moisLabel("2025-12")).toBe("Décembre 2025");
  });
  it("renvoie l'entrée brute si invalide", () => {
    expect(moisLabel("bogus")).toBe("bogus");
    expect(moisLabel("2026-13")).toBe("2026-13");
  });
});

describe("resolvePeriode()", () => {
  it("accepte tout / YYYY-MM / défaut recents", () => {
    expect(resolvePeriode("tout")).toBe("tout");
    expect(resolvePeriode("2026-04")).toBe("2026-04");
    expect(resolvePeriode(undefined)).toBe("recents");
    expect(resolvePeriode("n'importe quoi")).toBe("recents");
  });
});

describe("filterByPeriode()", () => {
  const data = dataset(); // 142 total

  it("recents → RECENTS_COUNT premiers", () => {
    expect(filterByPeriode(data, "recents")).toHaveLength(RECENTS_COUNT);
    expect(filterByPeriode(data, undefined)).toHaveLength(RECENTS_COUNT);
  });

  it("tout → tous", () => {
    expect(filterByPeriode(data, "tout")).toHaveLength(data.length);
  });

  it("YYYY-MM → uniquement ce mois", () => {
    expect(filterByPeriode(data, "2026-06")).toHaveLength(7);
    expect(filterByPeriode(data, "2026-05")).toHaveLength(81);
    expect(filterByPeriode(data, "2026-04")).toHaveLength(54);
  });

  it("mois sans données → liste vide", () => {
    expect(filterByPeriode(data, "2026-01")).toHaveLength(0);
  });
});

describe("buildPeriodeTabs()", () => {
  const data = dataset();
  const tabs = buildPeriodeTabs(data);

  it("commence par Récents et finit par Tout", () => {
    expect(tabs[0].key).toBe("recents");
    expect(tabs[tabs.length - 1].key).toBe("tout");
  });

  it("liste les mois entre les deux, ordre desc", () => {
    const moisKeys = tabs.slice(1, -1).map((t) => t.key);
    expect(moisKeys).toEqual(["2026-06", "2026-05", "2026-04"]);
  });

  it("counts corrects par onglet", () => {
    const byKey = Object.fromEntries(tabs.map((t) => [t.key, t.count]));
    expect(byKey["recents"]).toBe(RECENTS_COUNT);
    expect(byKey["2026-06"]).toBe(7);
    expect(byKey["2026-05"]).toBe(81);
    expect(byKey["2026-04"]).toBe(54);
    expect(byKey["tout"]).toBe(data.length);
  });

  it("Récents plafonne au total si historique court", () => {
    const petit = [mk("2026-06-01"), mk("2026-06-02")]; // 2 seulement
    const t = buildPeriodeTabs(petit);
    expect(t[0].count).toBe(2); // pas RECENTS_COUNT
  });
});
