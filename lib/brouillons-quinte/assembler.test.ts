import { describe, it, expect } from "vitest";
import { controlerDonneesPmu, assemblerBrouillons, type EntreeAssemblage } from "./assembler";
import { trouverCourseArgon, type CourseArgon } from "./argon";
import { PARTICIPANTS } from "./__fixtures__/gobelins";
import { ARGON_JSON, CIBLE_THEMIS, CTX_THEMIS } from "./__fixtures__/themis";

/** Partants de la base tels que la route les lit (numéro + nom). */
const BASE = PARTICIPANTS.map((p) => ({ numero: p.numero, nom_cheval: p.nom }));

describe("controlerDonneesPmu", () => {
  it("vraies données du 07/10 → aucune objection", () => {
    expect(controlerDonneesPmu(BASE, PARTICIPANTS)).toBeNull();
  });

  it("noms de la base écrits autrement (minuscules) → toujours reconnus", () => {
    const base = PARTICIPANTS.map((p) => ({ numero: p.numero, nom_cheval: p.nom.toLowerCase() }));
    expect(controlerDonneesPmu(base, PARTICIPANTS)).toBeNull();
  });

  it("PMU injoignable", () => {
    expect(controlerDonneesPmu(BASE, null)).toBe("pmu_injoignable");
  });

  it("autres chevaux → course non reconnue (aucune sélection)", () => {
    const autres = ["ALPHA", "BRAVO", "CHARLIE", "DELTA"].map((nom, i) => ({ numero: i + 1, nom_cheval: nom }));
    expect(controlerDonneesPmu(autres, PARTICIPANTS)).toBe("course_pmu_non_reconnue");
  });

  it("la favorite du PMU absente de la base → partants incohérents (le classement du marché serait faux)", () => {
    expect(controlerDonneesPmu(BASE.filter((b) => b.numero !== 17), PARTICIPANTS)).toBe("partants_incoherents");
  });

  it("numéros décalés entre la base et le PMU → partants incohérents", () => {
    const decale = PARTICIPANTS.map((p) => ({ numero: (p.numero % 18) + 1, nom_cheval: p.nom }));
    expect(controlerDonneesPmu(decale, PARTICIPANTS)).toBe("partants_incoherents");
  });

  it("le non-partant du PMU absent de la base ne gêne pas", () => {
    expect(controlerDonneesPmu(BASE.filter((b) => b.numero !== 12), PARTICIPANTS)).toBeNull();
  });

  it("toutes les cotes à 1,2 → factices", () => {
    expect(controlerDonneesPmu(BASE, PARTICIPANTS.map((p) => ({ ...p, cote: 1.2 })))).toBe("cotes_factices");
  });

  it("moins de 8 cotes → indisponibles", () => {
    const parts = PARTICIPANTS.map((p, i) => (i < 5 ? p : { ...p, cote: null }));
    expect(controlerDonneesPmu(BASE, parts)).toBe("cotes_indisponibles");
  });
});


/** La course du Prix Thémis lue chez Argon (vraie réponse du 16/10/2026). */
function argonThemis(): CourseArgon {
  const r = trouverCourseArgon(ARGON_JSON, CIBLE_THEMIS);
  if (!r.ok) throw new Error(r.raison);
  return r.course;
}

function assembler(entree: Partial<EntreeAssemblage> = {}) {
  return assemblerBrouillons({ courseId: "course-themis", ctx: CTX_THEMIS, argon: argonThemis(), allocations: null, ...entree });
}

describe("assemblerBrouillons — Prix Thémis du 16/10/2026 (édition T-90 d'Argon)", () => {
  const r = assembler();
  if (!r.ok) throw new Error(`assemblage refusé : ${r.raison}`);

  it("PRO : 3-6-12-13 + 7-4, pivot 3, confiance ELEVE (5 étoiles), source ARGON, non publié", () => {
    expect(r.pro.selection).toEqual([3, 6, 12, 13, 7, 4]);
    expect(r.pro.selection_detail).toEqual([
      { number: 3, role: "BASE", name: "EMINENT KRONOS", pivot: true },
      { number: 6, role: "BASE", name: "DOMENIK JET" },
      { number: 12, role: "BASE", name: "JALENDRA DE MALAC" },
      { number: 13, role: "BASE", name: "COLBERT WF" },
      { number: 7, role: "OUTSIDER", name: "KEROSEN DU GERS" },
      { number: 4, role: "OUTSIDER", name: "KISS ME AGAIN" },
    ]);
    expect(r.pro).toMatchObject({
      course_id: "course-themis", niveau_acces: "PRO", type_pari: "QUINTE_PLUS",
      confiance: "ELEVE", source: "ARGON", publie: false, date_publication: null, auteur_id: null,
    });
  });

  it("ELITE : 3-6-12-13 + values 11-14 + associés 7-4, rôles ASSOCIE, aucun couplé", () => {
    expect(r.elite.selection).toEqual([3, 6, 12, 13, 11, 14, 7, 4]);
    expect(r.elite.selection_detail).toEqual([
      { number: 3, role: "BASE", name: "EMINENT KRONOS", pivot: true },
      { number: 6, role: "BASE", name: "DOMENIK JET" },
      { number: 12, role: "BASE", name: "JALENDRA DE MALAC" },
      { number: 13, role: "BASE", name: "COLBERT WF" },
      { number: 11, role: "OUTSIDER", name: "READLY LAVEC" },
      { number: 14, role: "OUTSIDER", name: "KAMEHAMEHA" },
      { number: 7, role: "ASSOCIE", name: "KEROSEN DU GERS" },
      { number: 4, role: "ASSOCIE", name: "KISS ME AGAIN" },
    ]);
    expect(JSON.stringify(r.elite.selection_detail)).not.toContain("couple");
    expect(r.elite).toMatchObject({ niveau_acces: "ELITE", source: "ARGON", publie: false });
  });

  it("résumé : avis d'Argon (scellée à 16:45, 5 étoiles, decision recopiée) et allocation du jour 68 000", () => {
    expect(r.resume.argon).toEqual({
      lockGmt: "16:45",
      argon8: [
        { numero: 3, nom: "EMINENT KRONOS" }, { numero: 6, nom: "DOMENIK JET" }, { numero: 12, nom: "JALENDRA DE MALAC" },
        { numero: 13, nom: "COLBERT WF" }, { numero: 7, nom: "KEROSEN DU GERS" }, { numero: 4, nom: "KISS ME AGAIN" },
        { numero: 11, nom: "READLY LAVEC" }, { numero: 14, nom: "KAMEHAMEHA" },
      ],
      etoiles: 5,
      deconseillee: false,
      decision: "⭐ COUPLE MAITRE: 3 (NC) - 6 (4e 🔵) · 🎯 SNIPER: N°12 (NC)",
      nonPartants: [],
    });
    expect(r.resume.allocationJour).toBe(68000);
    expect(r.resume.confiance).toBe("ELEVE");
    expect(r.resume.elite.associes.map((c) => c.numero)).toEqual([7, 4]);
    expect(r.resume.releve).toBe("18h15");
  });

  it("tableau : « Value Pro · Associé » pour 7 et 4, « Value Elite » pour 11 et 14", () => {
    const retenu = (n: number) => r.resume.partants.find((l) => l.numero === n)!.retenu;
    expect([3, 6, 12, 13].map(retenu)).toEqual(["Base ⭐", "Base", "Base", "Base"]);
    expect([7, 4].map(retenu)).toEqual(["Value Pro · Associé", "Value Pro · Associé"]);
    expect([11, 14].map(retenu)).toEqual(["Value Elite", "Value Elite"]);
    expect(retenu(1)).toBeNull();
  });

  it("tableau : ordre du marché (cote croissante, à égalité le numéro)", () => {
    expect(r.resume.partants.slice(0, 6).map((l) => [l.numero, l.rang])).toEqual([[3, 1], [6, 2], [4, 3], [7, 4], [12, 5], [11, 6]]);
  });

  it("textes identiques aux brouillons (resume.textes)", () => {
    expect(r.resume.textes).toEqual({ courte: r.pro.analyse_courte, pro: r.pro.analyse_texte, elite: r.elite.analyse_texte });
    expect(r.elite.analyse_texte).toContain("LES ASSOCIÉS");
    expect(r.pro.analyse_texte).not.toContain("LES ASSOCIÉS");
  });

  it("un non-partant (n°6) : nonPartants [6] dans le résumé, Elite à 7 chevaux", () => {
    const parts = CTX_THEMIS.participants.map((p) => (p.numero === 6 ? { ...p, nonPartant: true } : p));
    const np = assembler({ ctx: { ...CTX_THEMIS, participants: parts } });
    if (!np.ok) throw new Error(np.raison);
    expect(np.pro.selection).toEqual([3, 12, 13, 7, 4, 11]);
    expect(np.elite.selection).toEqual([3, 12, 13, 7, 11, 14, 4]);
    expect(np.resume.argon.nonPartants).toEqual([{ numero: 6, nom: "DOMENIK JET" }]);
  });

  it("trois non-partants : argon_partants_insuffisants", () => {
    const parts = CTX_THEMIS.participants.map((p) => ([6, 7, 4].indexOf(p.numero) !== -1 ? { ...p, nonPartant: true } : p));
    expect(assembler({ ctx: { ...CTX_THEMIS, participants: parts } })).toEqual({ ok: false, raison: "argon_partants_insuffisants" });
  });

  it("cheval retenu sans cote PMU : cotes_indisponibles (aucun « Xe du marché » inventé)", () => {
    const parts = CTX_THEMIS.participants.map((p) => (p.numero === 14 ? { ...p, cote: null } : p));
    expect(assembler({ ctx: { ...CTX_THEMIS, participants: parts } })).toEqual({ ok: false, raison: "cotes_indisponibles" });
  });

  it("course déconseillée et 3 étoiles : repris dans le résumé, confiance MOYEN", () => {
    const d = assembler({ argon: { ...argonThemis(), deconseillee: true, etoiles: 3 } });
    if (!d.ok) throw new Error(d.raison);
    expect(d.resume.argon.deconseillee).toBe(true);
    expect(d.pro.confiance).toBe("MOYEN");
  });
});
