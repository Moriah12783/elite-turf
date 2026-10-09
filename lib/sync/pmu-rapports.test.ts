import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseRapportsDefinitifs, estCandidate, aCompleterCombinaisons, lignesPrincipales, combinaisonsMultiples, sourceDesRapports, identiteCourse } from "./pmu-rapports";
import { computeRapportGagnant } from "@/lib/pmu-rapports-gagnant";

// Vrais rapports définitifs PMU du Quinté+ du 01/10/2026 (Prix Céréaliste, Auteuil R1C1).
const brut = JSON.parse(
  readFileSync(fileURLToPath(new URL("./__fixtures__/pmu-rapports-definitifs-20261001-R1C1.json", import.meta.url)), "utf8"),
);
const ARRIVEE = [15, 3, 14, 1, 9, 4, 11];

describe("parseRapportsDefinitifs — Quinté+ réel du 01/10/2026", () => {
  const r = parseRapportsDefinitifs(brut, ARRIVEE)!;

  it("Quinté+ « pour 2 € », comme le parser Geny", () => {
    expect(r.quinte_plus).toEqual({ ordre: 26003.8, desordre: 248, bonus4: 7.4, bonus3: 6.2 });
  });

  it("Quarté+ et Tiercé « pour 1 € » (et non pour la mise de base PMU de 1,50 €)", () => {
    expect(r.quarte_plus).toEqual({ ordre: 4127.4, desordre: 81.9, bonus: 16.3 });
    expect(r.tierce).toEqual({ ordre: 646.4, desordre: 98.5 });
  });

  it("simples et couplés, placés dans l'ordre de l'arrivée", () => {
    expect(r.simple_gagnant).toBe(10.4);
    expect(r.simple_place).toEqual([3.7, 1.9, 3.6]);
    expect(r.couple_gagnant).toBe(25.4);
    expect(r.couple_place).toEqual([12.1, 24, 12.3]);
  });

  it("branché sur le calcul des gains existant : GAGNANT = désordre, PARTIEL = bonus 4", () => {
    expect(computeRapportGagnant("QUINTE_PLUS", "GAGNANT", r)).toBe(248);
    expect(computeRapportGagnant("QUINTE_PLUS", "PARTIEL", r)).toBe(7.4);
  });
});

describe("parseRapportsDefinitifs — rien d'inventé", () => {
  it("réponse vide ou illisible → null", () => {
    expect(parseRapportsDefinitifs([], ARRIVEE)).toBeNull();
    expect(parseRapportsDefinitifs({ erreur: true }, ARRIVEE)).toBeNull();
  });

  it("arrivée trop courte : pas de placés ni de couplés placés", () => {
    const r = parseRapportsDefinitifs(brut, [15, 3])!;
    expect(r.simple_place).toBeUndefined();
    expect(r.couple_place).toBeUndefined();
    expect(r.quinte_plus?.desordre).toBe(248);
  });
});

describe("estCandidate — qui reçoit des rapports", () => {
  const base = {
    id: "c1", date_course: "2026-10-01", numero_reunion: 1, numero_course: 1, nationale: 1,
    paris_disponibles: ["QUINTE_PLUS"], arrivee_officielle: [15, 3, 14, 1, 9],
    hippodrome: { pays: "France" }, arrivees: { id: "a1", rapports_pmu: null },
  };
  it("Quinté+ français avec arrivée et sans rapports : oui", () => {
    expect(estCandidate(base, "quinte")).toBe(true);
    expect(estCandidate(base, "toutes")).toBe(true);
  });
  it("rapports déjà présents : jamais écrasés", () => {
    expect(estCandidate({ ...base, arrivees: { id: "a1", rapports_pmu: { tierce: { ordre: 10 } } } }, "toutes")).toBe(false);
  });
  it("course marocaine ou sans arrivée : non", () => {
    expect(estCandidate({ ...base, hippodrome: { pays: "Maroc" } }, "toutes")).toBe(false);
    expect(estCandidate({ ...base, arrivee_officielle: null }, "toutes")).toBe(false);
  });
  it("portée Quinté+ : une course ordinaire est écartée", () => {
    expect(estCandidate({ ...base, nationale: null, paris_disponibles: ["SIMPLE_GAGNANT"] }, "quinte")).toBe(false);
    expect(estCandidate({ ...base, nationale: null, paris_disponibles: ["SIMPLE_GAGNANT"] }, "toutes")).toBe(true);
  });
});

// ── Ex æquo : plusieurs combinaisons payées (08/10/2026) ──────────────────────
const fixture = (nom: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./__fixtures__/${nom}`, import.meta.url)), "utf8"));
// Vrais rapports PMU. Versailles (08/10/2026) : 15 et 16 ex æquo 5es.
// Deauville (30/08/2026) : 4 et 11 ex æquo 1ers, 7 et 16 ex æquo 5es.
// Ville de Paris (21/05/2026) : 3 et 6 ex æquo 3es.
const VERSAILLES = fixture("pmu-rapports-definitifs-20261008-R1C1.json");
const DEAUVILLE = fixture("pmu-rapports-definitifs-20260830-R1C3.json");
const VILLE_DE_PARIS = fixture("pmu-rapports-definitifs-20260521-R1C7.json");
const VILLE_DE_PARIS_PDV = fixture("pmu-rapports-offline-20260521-R1C7.json");

describe("parseRapportsDefinitifs — ex æquo : toutes les combinaisons payées", () => {
  it("Versailles : les deux Quinté+ payés (1-5-8-4-15 et 1-5-8-4-16)", () => {
    const r = parseRapportsDefinitifs(VERSAILLES, [1, 5, 8, 4, 15, 16, 10])!;
    expect(r.combinaisons).toEqual({
      source: "internet",
      lignes: [
        { pari: "QUINTE_PLUS", type: "ordre", combinaison: "1-5-8-4-15", rapport: 6145.8 },
        { pari: "QUINTE_PLUS", type: "ordre", combinaison: "1-5-8-4-16", rapport: 3227.8 },
        { pari: "QUINTE_PLUS", type: "desordre", combinaison: "1-5-8-4-15", rapport: 72.2 },
        { pari: "QUINTE_PLUS", type: "desordre", combinaison: "1-5-8-4-16", rapport: 39.2 },
      ],
    });
    // Les champs historiques restent ceux de la première combinaison.
    expect(r.quinte_plus).toEqual({ ordre: 6145.8, desordre: 72.2, bonus4: 3, bonus3: 2.6 });
  });

  it("Deauville : deux simples gagnants, tiercé et quarté dans les deux ordres", () => {
    const lignes = parseRapportsDefinitifs(DEAUVILLE, [4, 11, 8, 9, 7, 16, 12])!.combinaisons!.lignes;
    expect(lignes.filter((l) => l.pari === "SIMPLE_GAGNANT")).toEqual([
      { pari: "SIMPLE_GAGNANT", combinaison: "4", rapport: 2.1 },
      { pari: "SIMPLE_GAGNANT", combinaison: "11", rapport: 5.1 },
    ]);
    expect(lignes.filter((l) => l.pari === "TIERCE").map((l) => `${l.type} ${l.combinaison}`))
      .toEqual(["ordre 4-11-8", "ordre 11-4-8", "desordre 4-11-8"]);
    expect(lignes.some((l) => l.pari === "SIMPLE_PLACE" || l.pari === "COUPLE_GAGNANT")).toBe(false);
  });

  it("Deauville : l'ordre du Quinté+ n'est pas celui de la Tirelire", () => {
    const r = parseRapportsDefinitifs(DEAUVILLE, [4, 11, 8, 9, 7, 16, 12])!;
    expect(r.quinte_plus?.ordre).toBe(4594.2);     // 2 × 2 297,10 €, et non 2 × 6 070,60 € (Ordre + Tirelire)
    expect(r.combinaisons!.lignes.filter((l) => l.pari === "QUINTE_PLUS" && l.type === "ordre").map((l) => l.rapport))
      .toEqual([4594.2, 4594.2, 4684.2, 4684.2]);
  });

  it("Ville de Paris : quatre placés et cinq couplés placés", () => {
    const lignes = parseRapportsDefinitifs(VILLE_DE_PARIS, [4, 11, 3, 6, 15, 5])!.combinaisons!.lignes;
    expect(lignes.filter((l) => l.pari === "SIMPLE_PLACE").map((l) => l.combinaison)).toEqual(["4", "11", "3", "6"]);
    expect(lignes.filter((l) => l.pari === "COUPLE_PLACE").map((l) => l.combinaison)).toEqual(["4-11", "4-3", "11-3", "4-6", "11-6"]);
  });

  it("sans ex æquo : vérifié, aucune combinaison de plus", () => {
    expect(parseRapportsDefinitifs(brut, ARRIVEE)!.combinaisons).toEqual({ source: "internet", lignes: [] });
  });
});

describe("sourceDesRapports — d'où viennent des rapports déjà en base", () => {
  const internet = lignesPrincipales(VILLE_DE_PARIS, "internet");
  const pdv = lignesPrincipales(VILLE_DE_PARIS_PDV, "points_de_vente");

  it("rapports Geny de la Ville de Paris : prix des points de vente", () => {
    // Valeurs réellement en base pour cette course (21/05/2026, scraping Geny).
    const geny = {
      tierce: { ordre: 147, desordre: 22.6 },
      quarte_plus: { bonus: 4.3, ordre: 290.6, desordre: 20.5 },
      quinte_plus: { ordre: 5139.2, bonus3: 3.4, bonus4: 4, desordre: 96 },
      simple_gagnant: 10.26,
    };
    expect(sourceDesRapports(geny, { internet, points_de_vente: pdv })).toBe("points_de_vente");
  });

  it("rapports PMU internet : internet", () => {
    const r = parseRapportsDefinitifs(VILLE_DE_PARIS, [4, 11, 3, 6, 15, 5])!;
    expect(sourceDesRapports(r, { internet, points_de_vente: pdv })).toBe("internet");
  });

  it("course sans tiercé (rapports PMU internet) : les simples et couplés tranchent", () => {
    const lignes = lignesPrincipales(VERSAILLES, "internet");
    expect(sourceDesRapports({ simple_gagnant: 3, couple_gagnant: 13.1, simple_place: [1.5, 2.4, 1.9] }, { internet: lignes })).toBe("internet");
  });

  it("simples et couplés de Geny : aucune source PMU, rien d'ajouté", () => {
    // Valeurs Geny réellement en base pour la Ville de Paris (21/05/2026).
    const genySimples = { simple_gagnant: 10.26, couple_gagnant: 29.37, simple_place: [2.36, 1.83, 1.31], couple_place: [5.44, 4.31, 6.16] };
    expect(sourceDesRapports(genySimples, { internet, points_de_vente: pdv })).toBeNull();
  });

  it("aucune source ne concorde : null, on n'ajoute rien", () => {
    expect(sourceDesRapports({ tierce: { ordre: 1, desordre: 2 } }, { internet, points_de_vente: pdv })).toBeNull();
  });
});

describe("combinaisonsMultiples — seulement les paris où l'ex æquo multiplie les combinaisons", () => {
  it("points de vente, Ville de Paris : tiercé, quarté, quinté, placés ; pas le simple gagnant", () => {
    const paris = combinaisonsMultiples(lignesPrincipales(VILLE_DE_PARIS_PDV, "points_de_vente")).map((l) => l.pari);
    expect(Array.from(new Set(paris)).sort()).toEqual(["COUPLE_PLACE", "QUARTE_PLUS", "QUINTE_PLUS", "SIMPLE_PLACE", "TIERCE"]);
  });
});

describe("aCompleterCombinaisons — rapports déjà en base d'une course avec ex æquo", () => {
  const base = {
    id: "c1", date_course: "2026-10-08", numero_reunion: 1, numero_course: 1, nationale: 1,
    paris_disponibles: ["QUINTE_PLUS"], arrivee_officielle: [1, 5, 8, 4, 15, 16, 10],
    arrivee_rangs: [1, 2, 3, 4, 5, 5, 7],
    hippodrome: { pays: "France" }, arrivees: { id: "a1", rapports_pmu: { tierce: { ordre: 55.3 } } },
  };
  it("ex æquo et rapports sans combinaisons : oui", () => {
    expect(aCompleterCombinaisons(base)).toBe(true);
  });
  it("combinaisons déjà vérifiées : non", () => {
    expect(aCompleterCombinaisons({ ...base, arrivees: { id: "a1", rapports_pmu: { tierce: { ordre: 55.3 }, combinaisons: { source: "internet", lignes: [] } } } })).toBe(false);
  });
  it("sans ex æquo, sans rapports, ou hors de France : non", () => {
    expect(aCompleterCombinaisons({ ...base, arrivee_rangs: null })).toBe(false);
    expect(aCompleterCombinaisons({ ...base, arrivees: { id: "a1", rapports_pmu: null } })).toBe(false);
    expect(aCompleterCombinaisons({ ...base, hippodrome: { pays: "Maroc" } })).toBe(false);
  });
});

// Audit du 09/10/2026 : la numérotation des réunions en base diffère parfois
// de celle du PMU (07/06 : Strasbourg, Rambouillet et Dax notées « R9 » en
// base, R12/R11/R10 au PMU). Interroger le PMU avec nos R/C peut donc ramener
// les rapports d'une AUTRE course : on ne les écrit que si l'arrivée concorde.
describe("identiteCourse — les rapports PMU sont-ils ceux de notre course ?", () => {
  const pmu = new Map([["1|8", { arrivee: [2, 7, 4, 6, 1, 9], rangs: [1, 2, 3, 3, 5, 6] }]]);

  it("même arrivée (ex æquo compris) → ok", () => {
    expect(identiteCourse([2, 7, 4, 6, 1], 1, 8, pmu)).toBe("ok");
    expect(identiteCourse([2, 7, 6, 4], 1, 8, pmu)).toBe("ok"); // deux 3es dans l'autre ordre
  });

  it("autre arrivée au même R/C → autre_course", () => {
    expect(identiteCourse([6, 2, 4], 1, 8, pmu)).toBe("autre_course");
  });

  it("R/C inconnu du PMU ce jour-là → autre_course", () => {
    expect(identiteCourse([2, 7, 4], 9, 1, pmu)).toBe("autre_course");
  });

  it("programme PMU indisponible (Map vide) → pmu_indisponible, jamais « autre course »", () => {
    expect(identiteCourse([2, 7, 4], 1, 8, new Map())).toBe("pmu_indisponible");
  });

  it("seuls les 3 premiers comptent : une 6e place différente ne change pas la course", () => {
    expect(identiteCourse([2, 7, 4, 6, 1, 11], 1, 8, pmu)).toBe("ok");
  });
});
