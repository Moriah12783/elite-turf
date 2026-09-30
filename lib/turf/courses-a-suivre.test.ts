import { describe, it, expect } from "vitest";
import { pickCoursesASuivre, estHippodromeMarocain, type CourseASuivreCandidate } from "./courses-a-suivre";

const FR = (nom: string) => ({ nom, pays: "France" });
const MA = (nom: string) => ({ nom, pays: "Maroc" });
const c = (
  id: string, heure: string, extra: Partial<CourseASuivreCandidate> = {},
): CourseASuivreCandidate => ({ id, heure_depart: heure, nationale: null, jouable_afrique: false, hippodrome: FR("Compiegne"), ...extra });

// Extrait RÉEL du 30/09/2026 : pas de Nationale 2, la Nationale 3 est marocaine.
// Avec la règle du 25/09, la liste n'affichait QUE des courses marocaines
// (DAHESS, SAADI, YAKOUTA) — capture de Steph.
const jour30: CourseASuivreCandidate[] = [
  c("steeple", "11:42:00"),
  c("saadi", "13:50:00", { jouable_afrique: true, hippodrome: MA("Khemisset") }),
  c("anjou", "13:55:00", { nationale: 1, jouable_afrique: true, hippodrome: FR("Laval") }),
  c("yakouta", "14:25:00", { jouable_afrique: true, hippodrome: MA("Khemisset") }),
  c("patapain", "14:30:00", { jouable_afrique: true, hippodrome: FR("Laval") }),
  c("tiego", "15:05:00", { jouable_afrique: true, hippodrome: FR("Laval") }),
  c("qadine", "15:10:00", { jouable_afrique: true, hippodrome: MA("Khemisset") }),
  c("bayarcher", "15:22:00"),
  c("dahess", "17:35:00", { nationale: 3, jouable_afrique: true, hippodrome: MA("Khemisset") }),
];
const MIDI = 12 * 60 + 19; // 12h19 heure de Paris

// Extrait RÉEL du 25/09/2026 : Nationale 2 française, Nationale 3 marocaine.
const jour25: CourseASuivreCandidate[] = [
  c("arles", "11:00:00", { hippodrome: FR("Salon-de-Provence") }),
  c("atlantic", "12:18:00", { jouable_afrique: true, hippodrome: FR("Nantes") }),
  c("majd", "15:28:00", { jouable_afrique: true, hippodrome: MA("Anfa") }),
  c("kervegan", "15:10:00", { nationale: 2, jouable_afrique: true, hippodrome: FR("Nantes") }),
  c("nafaana", "19:20:00", { nationale: 3, jouable_afrique: true, hippodrome: MA("Anfa") }),
  c("austria", "20:15:00", { nationale: 1, jouable_afrique: true, hippodrome: FR("Vincennes") }),
];
const MATIN = 10 * 60;

const resume = (r: ReturnType<typeof pickCoursesASuivre>) => r.map((x) => [x.course.id, x.etiquette]);

describe("pickCoursesASuivre — courses PMU France d'abord, UNE course marocaine au plus", () => {
  it("30/09 : deux courses françaises relayées en Afrique, puis la Nationale 3 marocaine", () => {
    expect(resume(pickCoursesASuivre(jour30, { exclureId: "anjou", maintenantMinutesParis: MIDI }))).toEqual([
      ["patapain", "PMU France"],
      ["tiego", "PMU France"],
      ["dahess", "Nationale 3 · Maroc"],
    ]);
  });

  it("25/09 : la Nationale 2 en tête, une course française, puis la Nationale 3 marocaine", () => {
    expect(resume(pickCoursesASuivre(jour25, { exclureId: "austria", maintenantMinutesParis: MATIN }))).toEqual([
      ["kervegan", "Nationale 2"],
      ["atlantic", "PMU France"],
      ["nafaana", "Nationale 3 · Maroc"],
    ]);
  });

  it("jamais plus d'une course marocaine, même quand elles sont les plus proches", () => {
    const r = pickCoursesASuivre(jour30, { exclureId: "anjou", maintenantMinutesParis: MIDI });
    expect(r.filter((x) => estHippodromeMarocain(x.course.hippodrome)).length).toBe(1);
  });

  it("sans Nationale 3 marocaine : la prochaine course marocaine, étiquetée « Maroc »", () => {
    const sansNat3 = jour30.filter((x) => x.id !== "dahess");
    const r = pickCoursesASuivre(sansNat3, { exclureId: "anjou", maintenantMinutesParis: MIDI });
    expect(r[r.length - 1].course.id).toBe("saadi");
    expect(r[r.length - 1].etiquette).toBe("Maroc");
  });

  it("courses relayées en Afrique avant les autres courses françaises", () => {
    const r = pickCoursesASuivre(jour30, { exclureId: "anjou", maintenantMinutesParis: MIDI });
    expect(r.map((x) => x.course.id)).not.toContain("bayarcher"); // Compiègne, non relayée
  });

  it("sans course française à venir : seule la course marocaine reste (pas de remplissage marocain)", () => {
    const soir = pickCoursesASuivre(jour30, { exclureId: "anjou", maintenantMinutesParis: 16 * 60 + 30 });
    expect(resume(soir)).toEqual([["dahess", "Nationale 3 · Maroc"]]);
  });

  it("sans course marocaine : trois courses françaises", () => {
    const sansMaroc = jour30.filter((x) => !estHippodromeMarocain(x.hippodrome));
    const r = pickCoursesASuivre(sansMaroc, { exclureId: "anjou", maintenantMinutesParis: MIDI });
    expect(r.map((x) => x.course.id)).toEqual(["patapain", "tiego", "bayarcher"]);
  });

  it("jamais la course vedette, jamais une annulée, jamais une course déjà courue", () => {
    const avecAnnulee = jour30.concat([c("annulee", "14:00:00", { nationale: 2, statut: "ANNULE", hippodrome: FR("Laval") })]);
    const ids = pickCoursesASuivre(avecAnnulee, { exclureId: "anjou", maintenantMinutesParis: MIDI }).map((x) => x.course.id);
    expect(ids).not.toContain("anjou");
    expect(ids).not.toContain("annulee");
    expect(ids).not.toContain("steeple"); // 11:42 : déjà partie à 12:19, ne se joue plus
  });

  it("journée vide ou tout couru → liste vide", () => {
    expect(pickCoursesASuivre([], { maintenantMinutesParis: MATIN })).toEqual([]);
    expect(pickCoursesASuivre(jour30, { maintenantMinutesParis: 23 * 60 + 59 })).toEqual([]);
  });
});

describe("estHippodromeMarocain", () => {
  it("se fie au pays quand il est juste", () => {
    expect(estHippodromeMarocain({ nom: "Anfa", pays: "Maroc" })).toBe(true);
  });

  it("reconnaît aussi un hippodrome marocain enregistré à tort « France »", () => {
    expect(estHippodromeMarocain({ nom: "Settat", pays: "France" })).toBe(true);
    expect(estHippodromeMarocain({ nom: "Meknès", pays: "France" })).toBe(true);
  });

  it("un hippodrome français reste français", () => {
    expect(estHippodromeMarocain({ nom: "Vincennes", pays: "France" })).toBe(false);
    expect(estHippodromeMarocain(null)).toBe(false);
  });
});
