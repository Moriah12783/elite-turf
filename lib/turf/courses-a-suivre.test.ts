import { describe, it, expect } from "vitest";
import { pickCoursesASuivre, estHippodromeMarocain, type CourseASuivreCandidate } from "./courses-a-suivre";

const c = (
  id: string, heure: string, extra: Partial<CourseASuivreCandidate> = {},
): CourseASuivreCandidate => ({ id, heure_depart: heure, nationale: null, jouable_afrique: false, hippodrome: { nom: "Salon-de-Provence", pays: "France" }, ...extra });

// Extrait RÉEL du 25/09/2026 (heures telles qu'en base).
const jour25: CourseASuivreCandidate[] = [
  c("arles", "11:00:00"),
  c("cassard", "11:15:00", { hippodrome: { nom: "Nantes", pays: "France" } }),
  c("majd", "13:28:00", { jouable_afrique: true, hippodrome: { nom: "Anfa", pays: "Maroc" } }),
  c("narjisse", "14:03:00", { jouable_afrique: true, hippodrome: { nom: "Anfa", pays: "Maroc" } }),
  c("kervegan", "15:10:00", { nationale: 2, jouable_afrique: true, hippodrome: { nom: "Nantes", pays: "France" } }),
  c("nafaana", "17:20:00", { nationale: 3, jouable_afrique: true, hippodrome: { nom: "Anfa", pays: "Maroc" } }),
  c("austria", "20:15:00", { nationale: 1, jouable_afrique: true, hippodrome: { nom: "Vincennes", pays: "France" } }),
];
const MATIN = 10 * 60; // 10h00 heure de Paris

describe("pickCoursesASuivre — Nationale 2, Nationale 3, Maroc (comme la LONACI)", () => {
  it("25/09 : Nationale 2, Nationale 3, puis une course marocaine — le Quinté+ exclu", () => {
    const r = pickCoursesASuivre(jour25, { exclureId: "austria", maintenantMinutesParis: MATIN });
    expect(r.map((x) => [x.course.id, x.etiquette])).toEqual([
      ["kervegan", "Nationale 2"],
      ["nafaana", "Nationale 3"],
      ["majd", "Maroc"],
    ]);
  });

  it("une course déjà courue n'est pas proposée ; la place revient à une course jouable Afrique à venir", () => {
    const r = pickCoursesASuivre(jour25, { exclureId: "austria", maintenantMinutesParis: 15 * 60 + 55 });
    const ids = r.map((x) => x.course.id);
    expect(ids).not.toContain("kervegan"); // partie à 15:10, courue depuis plus de 40 min
    expect(ids[0]).toBe("nafaana");
    expect(r[0].etiquette).toBe("Nationale 3");
  });

  it("sans étiquette LONACI : les prochaines courses jouables en Afrique, puis les autres", () => {
    const sansLonaci = jour25.map((x) => ({ ...x, nationale: null }));
    const r = pickCoursesASuivre(sansLonaci, { exclureId: "austria", maintenantMinutesParis: MATIN });
    expect(r.map((x) => [x.course.id, x.etiquette])).toEqual([
      ["majd", "Maroc"],
      ["narjisse", "Maroc"],
      ["kervegan", null],
    ]);
  });

  it("au plus 3 courses, jamais la course vedette, jamais une annulée", () => {
    const avecAnnulee = jour25.concat([c("annulee", "12:00:00", { nationale: 2, statut: "ANNULE" })]);
    const r = pickCoursesASuivre(avecAnnulee, { exclureId: "austria", maintenantMinutesParis: MATIN });
    expect(r.length).toBe(3);
    expect(r.map((x) => x.course.id)).not.toContain("austria");
    expect(r.map((x) => x.course.id)).not.toContain("annulee");
  });

  it("journée vide ou tout couru → liste vide", () => {
    expect(pickCoursesASuivre([], { maintenantMinutesParis: MATIN })).toEqual([]);
    expect(pickCoursesASuivre(jour25, { maintenantMinutesParis: 23 * 60 + 59 })).toEqual([]);
  });
});

describe("estHippodromeMarocain", () => {
  it("se fie au pays quand il est juste", () => {
    expect(estHippodromeMarocain({ nom: "Anfa", pays: "Maroc" })).toBe(true);
  });

  it("reconnaît les hippodromes marocains enregistrés à tort « France » (Settat, Khemisset, Meknès)", () => {
    expect(estHippodromeMarocain({ nom: "Settat", pays: "France" })).toBe(true);
    expect(estHippodromeMarocain({ nom: "Khemisset", pays: "France" })).toBe(true);
    expect(estHippodromeMarocain({ nom: "Meknès", pays: "France" })).toBe(true);
    expect(estHippodromeMarocain({ nom: "El Jadida", pays: "France" })).toBe(true);
  });

  it("un hippodrome français reste français", () => {
    expect(estHippodromeMarocain({ nom: "Vincennes", pays: "France" })).toBe(false);
    expect(estHippodromeMarocain(null)).toBe(false);
  });
});
