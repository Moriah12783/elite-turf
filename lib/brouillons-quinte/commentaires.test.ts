import { describe, it, expect } from "vitest";
import { analyseCourte, analyseComplete, heureGmt, MOTS_INTERDITS, type ChevalCommente, type ContexteCourse } from "./commentaires";
import { CTX, PARTICIPANTS } from "./__fixtures__/gobelins";

const c = (numero: number, rang: number): ChevalCommente => ({
  numero, rang, nom: PARTICIPANTS.find((p) => p.numero === numero)!.nom,
});
const BASE = [c(17, 1), c(16, 2), c(5, 3)];
const VALUES_PRO = [c(13, 4), c(10, 5), c(15, 6)];
const VALUES_ELITE = [c(15, 6), c(18, 7), c(11, 8)];
const PRO = analyseComplete(CTX, "PRO", BASE, VALUES_PRO, []);
const ELITE = analyseComplete(CTX, "ELITE", BASE, VALUES_ELITE, []);
/** Variante avec un écarté, pour la phrase « n'est pas retenue ». */
const ELITE_ECARTE = analyseComplete(CTX, "ELITE", BASE, VALUES_ELITE, [c(10, 5)]);
/** Le n°12 remis partant : le groupe reculé redevient la suite 10 à 18. */
const AVEC_12 = PARTICIPANTS.map((p) => (p.numero === 12 ? { ...p, nonPartant: false } : p));

describe("analyseCourte", () => {
  it("Quinté+ du 07/10/2026 (n°12 non partant : les reculés ne forment plus une suite)", () => {
    expect(analyseCourte(CTX, BASE[0])).toBe(
      "Trot attelé, 2 875 m, 17 partantes. Pivot : IMAGE D'ATALANTE (n°17, F. NIVARD), favorite. 8 partantes partent avec 25 m de recul.",
    );
  });

  it("groupe reculé en suite : les numéros sont cités", () => {
    expect(analyseCourte({ ...CTX, participants: AVEC_12 }, BASE[0])).toBe(
      "Trot attelé, 2 875 m, 18 partantes. Pivot : IMAGE D'ATALANTE (n°17, F. NIVARD), favorite. Les n°10 à 18 partent avec 25 m de recul.",
    );
  });

  it("160 caractères au plus, quel que soit le pivot", () => {
    for (const p of PARTICIPANTS) {
      expect(analyseCourte(CTX, { numero: p.numero, nom: p.nom, rang: 1 }).length).toBeLessThanOrEqual(160);
    }
  });

  it("trop long : la phrase de recul part d'abord, jamais de mot coupé", () => {
    const t = analyseCourte(CTX, { numero: 17, rang: 1, nom: "X".repeat(70) });
    expect(t.length).toBeLessThanOrEqual(160);
    expect(t).not.toContain("recul");
    expect(t).toContain(`Pivot : ${"X".repeat(70)} (n°17, F. NIVARD), favorite.`);
  });

  it("encore trop long : le driver part ensuite", () => {
    const t = analyseCourte(CTX, { numero: 17, rang: 1, nom: "X".repeat(110) });
    expect(t).toBe(`Pivot : ${"X".repeat(110)} (n°17), favorite.`);
  });
});

describe("analyseComplete — Pro du 07/10/2026", () => {
  it("la course", () => {
    expect(PRO).toContain("Quinté+ du mercredi 7 octobre 2026 : Prix des Gobelins, Enghien (R1C1), départ 11h55 GMT (13h55 heure de Paris).");
    expect(PRO).toContain("Trot attelé, 2 875 m, 17 partantes de 7 à 8 ans.");
    expect(PRO).toContain("Les n°10, 11 et 13 à 18 partent 25 m derrière, sur 2 900 m.");
  });

  it("la base, pivot en tête", () => {
    expect(PRO).toContain("⭐ n°17 IMAGE D'ATALANTE — driver F. NIVARD, entraîneur D. CHERBONNEL. Favorite du marché. Dans les 3 premières 4 fois sur ses 5 dernières courses, sans faute. Notre pivot.");
    expect(PRO).toContain("n°16 JAIN MAB — driver A. BARRIER, entraîneur A. BUISSON. 2e du marché. Dans les 5 premières 3 fois sur 5, sans faute.");
    expect(PRO).toContain("n°5 JEUNE ORANGE COTON — driver A. ANDRE, entraîneur Antonin ANDRE. 3e du marché. A gagné 1 de ses 5 dernières courses ; 2 fautes sur ses 5 dernières courses.");
  });

  it("les values", () => {
    expect(PRO).toContain("n°13 IDOLE ELDE — driver M. MOTTIER, entraîneur N. LEMETAYER. 4e du marché. A gagné 2 de ses 5 dernières courses, sans faute.");
    expect(PRO).toContain("n°10 JUSTICIA SMART — driver M. ABRIVARD, entraîneur J. DUBREIL. 5e du marché. 3 fautes sur ses 5 dernières courses.");
    expect(PRO).toContain("n°15 IXELLE BLEUE — driver TH. BRIAND, entraîneur Antoine TRIHOLLET. 6e du marché. A gagné 1 de ses 5 dernières courses ; 1 faute sur ses 5 dernières courses.");
  });

  it("à savoir", () => {
    expect(PRO).toContain("Cotes PMU relevées à 11h55 GMT, indicatives : elles évoluent jusqu'au départ. Le jeu comporte des risques : jouez responsable.");
  });

  it("sections dans l'ordre, rien de propre à l'Elite", () => {
    const i = ["LA COURSE", "LA BASE", "LES VALUES", "À SAVOIR"].map((t) => PRO.indexOf(t));
    expect(i.every((x) => x >= 0)).toBe(true);
    expect(i).toEqual(i.slice().sort((a, b) => a - b));
    expect(PRO).not.toContain("Retenue pour sa cote");
    expect(PRO).not.toContain("n'est pas retenue");
  });
});

describe("analyseComplete — Elite du 07/10/2026", () => {
  it("values retenues pour leur cote", () => {
    expect(ELITE).toContain("n°15 IXELLE BLEUE — driver TH. BRIAND, entraîneur Antoine TRIHOLLET. 6e du marché. A gagné 1 de ses 5 dernières courses ; 1 faute sur ses 5 dernières courses. Retenue pour sa cote parmi nos 8.");
    expect(ELITE).toContain("n°18 JOIE DE LA COTE — driver E. RAFFIN, entraîneur S. LALOUM. 7e du marché. Dans les 3 premières 2 fois sur ses 5 dernières courses, sans faute. Retenue pour sa cote parmi nos 8.");
    expect(ELITE).toContain("n°11 JALOUZ D'OLIVERIE — driver L. BAUDOUIN, entraîneur J.M. BAUDOUIN. 8e du marché. Dans les 3 premières 3 fois sur ses 5 dernières courses, sans faute. Retenue pour sa cote parmi nos 8.");
  });

  it("aucun écarté ce jour-là : pas de phrase « n'est pas retenue »", () => {
    expect(ELITE).not.toContain("n'est pas retenue");
  });

  it("un écarté est nommé, avec ses fautes", () => {
    expect(ELITE_ECARTE).toContain("n°10 JUSTICIA SMART (5e du marché) n'est pas retenue : 3 fautes sur ses 5 dernières courses.");
  });
});

describe("distances (phrase de recul seulement s'il y a plusieurs distances)", () => {
  it("une seule distance : aucune phrase de recul", () => {
    const ctx = { ...CTX, participants: PARTICIPANTS.map((p) => ({ ...p, distance: 2875 })) };
    expect(analyseCourte(ctx, BASE[0])).not.toContain("recul");
    expect(analyseComplete(ctx, "PRO", BASE, VALUES_PRO, [])).not.toContain("derrière");
  });

  it("un seul cheval reculé : « Le n°… part »", () => {
    const ctx = { ...CTX, participants: PARTICIPANTS.map((p) => ({ ...p, distance: p.numero === 18 ? 2900 : 2875 })) };
    expect(analyseCourte(ctx, BASE[0])).toContain("Le n°18 part avec 25 m de recul.");
    expect(analyseComplete(ctx, "PRO", BASE, VALUES_PRO, [])).toContain("Le n°18 part 25 m derrière, sur 2 900 m.");
  });

  it("trois distances : rien dans l'analyse courte, une phrase par groupe dans la complète", () => {
    const parts = PARTICIPANTS.map((p) => ({ ...p, distance: p.numero <= 9 ? 2875 : p.numero <= 14 ? 2900 : 2925 }));
    const ctx = { ...CTX, participants: parts };
    expect(analyseCourte(ctx, BASE[0])).not.toContain("recul");
    const t = analyseComplete(ctx, "PRO", BASE, VALUES_PRO, []);
    expect(t).toContain("Les n°10, 11, 13 et 14 partent 25 m derrière, sur 2 900 m.");
    expect(t).toContain("Les n°15 à 18 partent 50 m derrière, sur 2 925 m.");
  });

  it("le n°12 remis partant : « Les n°10 à 18 » dans l'analyse complète", () => {
    expect(analyseComplete({ ...CTX, participants: AVEC_12 }, "PRO", BASE, VALUES_PRO, [])).toContain("Les n°10 à 18 partent 25 m derrière, sur 2 900 m.");
  });
});

describe("garanties (spec §7)", () => {
  const TEXTES = [PRO, ELITE, ELITE_ECARTE, analyseCourte(CTX, BASE[0])];

  it("aucun numéro absent des données", () => {
    const connus = PARTICIPANTS.map((p) => p.numero);
    for (const t of TEXTES) {
      const re = /n°(\d+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t)) !== null) expect(connus).toContain(Number(m[1]));
    }
  });

  it("chaque cheval cité porte son nom PMU", () => {
    for (const t of [PRO, ELITE, ELITE_ECARTE]) {
      const lignes = t.split("\n").filter((l) => /^(⭐ )?n°\d+ /.test(l));
      expect(lignes.length).toBeGreaterThanOrEqual(6);
      for (const l of lignes) {
        const m = l.match(/^(?:⭐ )?n°(\d+) (.+?)(?: —| \(|\.)/);
        expect(m).not.toBeNull();
        expect(m![2]).toBe(PARTICIPANTS.find((p) => p.numero === Number(m![1]))!.nom);
      }
    }
  });

  it("le n°12, non partant, n'est jamais cité", () => {
    for (const t of TEXTES) {
      expect(t).not.toContain("JUNON");
      expect(/n°12\b/.test(t)).toBe(false);
    }
  });

  it("aucun mot interdit", () => {
    for (const t of TEXTES) {
      const bas = t.toLowerCase();
      for (const mot of MOTS_INTERDITS) expect(bas).not.toContain(mot);
    }
  });

  it("heureGmt", () => {
    expect(heureGmt(Date.parse("2026-10-07T09:05:00Z"))).toBe("09h05");
  });
});

describe("Review Focus — données incomplètes ou différentes", () => {
  it("réponse « course » du PMU absente : ni discipline ni libellé driver/jockey ; distance tirée des partants", () => {
    const sansCourse: ContexteCourse = { ...CTX, coursePmu: null };
    const courte = analyseCourte(sansCourse, BASE[0]);
    expect(courte).toBe("2 875 m, 17 partants. Pivot : IMAGE D'ATALANTE (n°17, F. NIVARD), favorite. 8 partants partent avec 25 m de recul.");
    const t = analyseComplete(sansCourse, "PRO", BASE, VALUES_PRO, []);
    expect(t).toContain("2 875 m, 17 partants de 7 à 8 ans.");
    expect(t).toContain("⭐ n°17 IMAGE D'ATALANTE — F. NIVARD, entraîneur D. CHERBONNEL. Favorite du marché.");
    expect(t).not.toMatch(/driver|jockey|Trot|Plat/);
  });

  it("driver ou entraîneur absent : ligne propre", () => {
    const parts = PARTICIPANTS.map((p) => {
      if (p.numero === 17) return { ...p, driver: null, entraineur: null };
      if (p.numero === 16) return { ...p, entraineur: null };
      return p;
    });
    const ctx = { ...CTX, participants: parts };
    const t = analyseComplete(ctx, "PRO", BASE, VALUES_PRO, []);
    expect(t).toContain("⭐ n°17 IMAGE D'ATALANTE. Favorite du marché.");
    expect(t).toContain("n°16 JAIN MAB — driver A. BARRIER. 2e du marché.");
    expect(t).not.toContain("— ,");
    expect(t).not.toContain("null");
    expect(analyseCourte(ctx, BASE[0])).toContain("Pivot : IMAGE D'ATALANTE (n°17), favorite.");
  });

  it("champ mixte : formes masculines", () => {
    const parts = PARTICIPANTS.map((p) => ({ ...p, sexe: "MALES" }));
    const mixte: ContexteCourse = { ...CTX, coursePmu: { ...CTX.coursePmu!, conditionSexe: null }, participants: parts };
    expect(analyseCourte(mixte, BASE[0])).toBe(
      "Trot attelé, 2 875 m, 17 partants. Pivot : IMAGE D'ATALANTE (n°17, F. NIVARD), favori. 8 partants partent avec 25 m de recul.",
    );
    const t = analyseComplete(mixte, "ELITE", BASE, VALUES_ELITE, [c(10, 5)]);
    expect(t).toContain("Favori du marché. Dans les 3 premiers 4 fois sur ses 5 dernières courses");
    expect(t).toContain("Retenu pour sa cote parmi nos 8.");
    expect(t).toContain("n°10 JUSTICIA SMART (5e du marché) n'est pas retenu : 3 fautes");
    expect(t).not.toMatch(/premières|Retenue|Favorite|partantes/);
  });

  it("musique absente : pas de phrase de forme", () => {
    const parts = PARTICIPANTS.map((p) => (p.numero === 13 ? { ...p, musique: null } : p));
    const t = analyseComplete({ ...CTX, participants: parts }, "PRO", BASE, VALUES_PRO, []);
    expect(t).toContain("n°13 IDOLE ELDE — driver M. MOTTIER, entraîneur N. LEMETAYER. 4e du marché.\n");
  });
});
