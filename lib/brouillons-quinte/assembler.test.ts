import { describe, it, expect } from "vitest";
import { controlerDonneesPmu, assemblerBrouillons } from "./assembler";
import { analyseCourte } from "./commentaires";
import { CTX, CTX_ROUTE, PARTICIPANTS, TOP8 } from "./__fixtures__/gobelins";

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

describe("assemblerBrouillons — Quinté+ du 07/10/2026 au départ", () => {
  const r = assemblerBrouillons({ courseId: "course-1", ctx: CTX_ROUTE, top8: TOP8 });
  if (!r.ok) throw new Error(`assemblage refusé : ${r.raison}`);

  it("Pro : 17 ⭐, 16, 5 en base ; 13, 10, 15 en values", () => {
    expect(r.pro.selection).toEqual([17, 16, 5, 13, 10, 15]);
    expect(r.pro.selection_detail).toEqual([
      { number: 17, role: "BASE", name: "IMAGE D'ATALANTE", pivot: true },
      { number: 16, role: "BASE", name: "JAIN MAB" },
      { number: 5, role: "BASE", name: "JEUNE ORANGE COTON" },
      { number: 13, role: "OUTSIDER", name: "IDOLE ELDE" },
      { number: 10, role: "OUTSIDER", name: "JUSTICIA SMART" },
      { number: 15, role: "OUTSIDER", name: "IXELLE BLEUE" },
    ]);
  });

  it("Elite : même base ; 15, 18, 11 en values", () => {
    expect(r.elite.niveau_acces).toBe("ELITE");
    expect(r.elite.selection).toEqual([17, 16, 5, 15, 18, 11]);
    expect(r.elite.selection_detail!.filter((d) => d.role === "OUTSIDER").map((d) => d.number)).toEqual([15, 18, 11]);
  });

  it("brouillons jamais publiés, origine AUTO-MARCHE, confiance Moyen", () => {
    for (const l of [r.pro, r.elite]) {
      expect(l.publie).toBe(false);
      expect(l.date_publication).toBeNull();
      expect(l.source).toBe("AUTO-MARCHE");
      expect(l.auteur_id).toBeNull();
      expect(l.type_pari).toBe("QUINTE_PLUS");
      expect(l.course_id).toBe("course-1");
      expect(l.confiance).toBe("MOYEN");
    }
  });

  it("textes : analyse courte commune, analyse complète propre à chaque niveau, relevé calculé", () => {
    expect(r.pro.analyse_courte).toBe(analyseCourte(CTX, { numero: 17, nom: "IMAGE D'ATALANTE", rang: 1 }));
    expect(r.elite.analyse_courte).toBe(r.pro.analyse_courte);
    expect(r.pro.analyse_texte).toContain("Cotes PMU relevées à 11h55 GMT");
    expect(r.elite.analyse_texte).toContain("n°11 JALOUZ D'OLIVERIE — driver L. BAUDOUIN, entraîneur J.M. BAUDOUIN. 8e du marché.");
    expect(r.pro.analyse_texte).not.toContain("Retenue pour sa cote");
  });

  it("le n°12, non partant, n'apparaît nulle part", () => {
    for (const l of [r.pro, r.elite]) {
      expect(l.selection).not.toContain(12);
      expect(l.analyse_texte).not.toContain("JUNON");
      expect(l.analyse_courte).not.toContain("JUNON");
    }
  });

  it("tableau des musiques : tous les chevaux, classés par cote, non-partant à la fin", () => {
    const t = r.resume.partants;
    expect(t.map((l) => l.numero)).toEqual([17, 16, 5, 13, 10, 15, 18, 11, 14, 2, 7, 4, 3, 8, 6, 9, 1, 12]);
    expect(t[0]).toEqual({
      numero: 17, nom: "IMAGE D'ATALANTE", nonPartant: false, cote: 3.8, rang: 1, exAequo: false,
      places: ["2", "3", "2", "2", "8", "4", "0"], fautes: 0, retenu: "Base ⭐",
    });
    expect(t[17]).toMatchObject({ numero: 12, nom: "JUNON DE LOU", nonPartant: true, rang: null });
  });

  it("ex-aequo signalés : n°11 (retenu) et n°14 à 15", () => {
    const t = r.resume.partants;
    expect(t.find((l) => l.numero === 11)).toMatchObject({ rang: 8, exAequo: true, retenu: "Value Elite" });
    expect(t.find((l) => l.numero === 14)).toMatchObject({ rang: 9, exAequo: true, retenu: null, places: ["6", "7", "4", "1", "2", "4", "8"] });
  });

  it("le n°2 hors sélection : sa musique sur 7 courses est visible", () => {
    expect(r.resume.partants.find((l) => l.numero === 2)).toMatchObject({
      rang: 10, cote: 23, places: ["2", "1", "5", "7", "0", "2", "3"], fautes: 0, retenu: null,
    });
  });

  it("fautes comptées sur les 7 courses ; chevaux retenus en Pro, en Elite ou dans les deux", () => {
    const ligne = (n: number) => r.resume.partants.find((l) => l.numero === n)!;
    expect(ligne(10)).toMatchObject({ fautes: 4, retenu: "Value Pro" });
    expect(ligne(16).retenu).toBe("Base");
    expect(ligne(13).retenu).toBe("Value Pro");
    expect(ligne(15).retenu).toBe("Value Pro + Elite");
    expect(ligne(18).retenu).toBe("Value Elite");
  });

  it("résumé pour l'e-mail", () => {
    const base = [{ numero: 17, nom: "IMAGE D'ATALANTE" }, { numero: 16, nom: "JAIN MAB" }, { numero: 5, nom: "JEUNE ORANGE COTON" }];
    const { partants: _tableau, textes: _textes, ...resume } = r.resume;
    expect(resume).toEqual({
      jour: "2026-10-07",
      prix: "Prix des Gobelins",
      hippodrome: "Enghien",
      reunion: 1,
      course: 1,
      heureGmt: "11h55",
      releve: "11h55",
      confiance: "MOYEN",
      pro: {
        base,
        values: [{ numero: 13, nom: "IDOLE ELDE" }, { numero: 10, nom: "JUSTICIA SMART" }, { numero: 15, nom: "IXELLE BLEUE" }],
      },
      elite: {
        base,
        values: [{ numero: 15, nom: "IXELLE BLEUE" }, { numero: 18, nom: "JOIE DE LA COTE" }, { numero: 11, nom: "JALOUZ D'OLIVERIE" }],
        ecartes: [],
        completeAvecFautifs: false,
      },
    });
  });

  it("résumé : les textes des brouillons, pour l'essai à blanc", () => {
    expect(r.resume.textes).toEqual({
      courte: r.pro.analyse_courte,
      pro: r.pro.analyse_texte,
      elite: r.elite.analyse_texte,
    });
  });

  it("moins de 8 favoris → refus", () => {
    expect(assemblerBrouillons({ courseId: "x", ctx: CTX_ROUTE, top8: TOP8.slice(0, 7) })).toEqual({ ok: false, raison: "cotes_indisponibles" });
  });
});
