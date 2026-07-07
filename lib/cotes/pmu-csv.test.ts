import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseCsvLine, toCote, parsePmuCotesCsv, resolvePmuCote, normalizeHorseName, sameHorse } from "./pmu-csv";

const CSV = readFileSync(fileURLToPath(new URL("./__fixtures__/pmu-cotes-sample.csv", import.meta.url)), "utf8");

describe("parseCsvLine — respecte les guillemets (virgule décimale FR)", () => {
  it("découpe une virgule entre guillemets sans casser la colonne", () => {
    expect(parseCsvLine('a,"5,2",b')).toEqual(["a", "5,2", "b"]);
    expect(parseCsvLine("2026-07-07,R1,C1")).toEqual(["2026-07-07", "R1", "C1"]);
    expect(parseCsvLine('x,"",y')).toEqual(["x", "", "y"]); // champ vide quoté
  });
});

describe("toCote — décimale FR / entière / vide", () => {
  it("virgule → point ; entier ; vide/0/négatif → undefined", () => {
    expect(toCote("9,8")).toBe(9.8);
    expect(toCote('"9,8"')).toBe(9.8);
    expect(toCote("16")).toBe(16);
    expect(toCote("")).toBeUndefined();
    expect(toCote("0")).toBeUndefined();
    expect(toCote(undefined)).toBeUndefined();
  });
});

describe("parsePmuCotesCsv — fixture réelle (471 lignes)", () => {
  const rows = parsePmuCotesCsv(CSV);
  const get = (r: number, c: number, n: number) =>
    rows.find((x) => x.reunion === r && x.course === c && x.num === n);

  it("parse la quasi-totalité des lignes ; réunion/course sans préfixe", () => {
    expect(rows.length).toBeGreaterThan(400);
    expect(rows.every((x) => Number.isInteger(x.reunion) && Number.isInteger(x.course) && Number.isInteger(x.num))).toBe(true);
  });

  it("Chantilly R1C1 n°1 MASTER MAN : directe=4 (prioritaire sur référence 5,2)", () => {
    const p = get(1, 1, 1)!;
    expect(p.cheval).toBe("MASTER MAN");
    expect(p.coteReference).toBe(5.2);
    expect(p.coteDirecte).toBe(4);
    expect(p.nonPartant).toBe(false);
    expect(resolvePmuCote(p)).toBe(4); // directe prioritaire
  });

  it("Chantilly R1C8 n°6 WARAMINI : NP → cote NULL (jamais 1.2 inventé)", () => {
    const p = get(1, 8, 6)!;
    expect(p.statut).toBe("NP");
    expect(p.nonPartant).toBe(true);
    expect(resolvePmuCote(p)).toBeNull();
  });

  it("R1C8 n°4 INGEBORG : la vedette a bien sa vraie cote directe (9,8)", () => {
    expect(resolvePmuCote(get(1, 8, 4)!)).toBe(9.8);
  });

  it("PARTANT sans cote encore publiée → null (le call-site DOIT garder la cote existante, pas écraser)", () => {
    // Distinct d'un NP : nonPartant=false. Le garde-fou côté appelant évite
    // d'écraser une vraie cote LONACI par « — » avant l'ouverture des paris.
    const p = { reunion: 1, course: 1, num: 99, cheval: "LADY GES", statut: "PARTANT", nonPartant: false };
    expect(resolvePmuCote(p)).toBeNull();
    expect(p.nonPartant).toBe(false); // ≠ NP → l'appelant fait `continue`, garde LONACI
  });

  it("CSV vide / en-tête seul → []", () => {
    expect(parsePmuCotesCsv("")).toEqual([]);
    expect(parsePmuCotesCsv("date,reunion,course,num")).toEqual([]);
  });
});

describe("garde-fou nom (anti-décalage) — sameHorse", () => {
  it("normalise accents/ponctuation/casse", () => {
    expect(normalizeHorseName("Ti Amo Bello")).toBe("TIAMOBELLO");
    expect(normalizeHorseName("Nyptia d'Ariane")).toBe("NYPTIADARIANE");
  });
  it("match exact, troncature, variante → true ; noms différents → false", () => {
    expect(sameHorse("TI AMO BELLO", "Ti Amo Bello")).toBe(true);   // casse
    expect(sameHorse("INGEBORG", "INGEBORG")).toBe(true);
    expect(sameHorse("AU DELA DES MERS", "AU DELA DES MER")).toBe(true); // troncature
    expect(sameHorse("MISTER BLACK", "FLASH GIRL")).toBe(false);    // ≠ → skip cote
    expect(sameHorse("", "N'IMPORTE")).toBe(true);                  // nom manquant → ne bloque pas
  });
});
