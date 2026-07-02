import { describe, it, expect } from "vitest";
import { validateConsensusBlock, seuilBase } from "./validate";

/**
 * FIXTURES RÉELLES (contrat de données v2.4).
 *
 * BLOC_0107_CORRIGE : bloc réel du Google Doc « Consensus à coller — 01-07
 * Enghien R1C8 (corrigé) » (Drive Elite Turf). 33 sources · 15 partants ·
 * Σ citations = 264 = 33×8 · Σ bases = 33.
 */
const BLOC_0107_CORRIGE = `7 33 12
8 33 10
4 32 10
11 29 1
13 27 0
6 26 0
9 26 0
15 23 0
5 20 0
1 6 0
14 4 0
3 2 0
10 2 0
12 1 0`;

/**
 * BLOC_3006_7SOURCES : reconstitué depuis le rapport réel du 30/06 (grille
 * dégradée, 7 sources) — invariants d'origine respectés : 1 et 10 cités 7/7,
 * 13 pilier (4 bases), 8 cité 1 fois, 5 non listé (0 citation),
 * Σ citations = 56 = 7×8 · Σ bases = 7 · 13 partants (Vichy).
 */
const BLOC_3006_7SOURCES = `1 7 1
10 7 1
13 6 4
6 6 0
11 6 1
12 5 0
9 5 0
2 4 0
4 4 0
7 3 0
3 2 0
8 1 0`;

/** Bloc réel du 29/06 (Clairefontaine) — ANCIEN format 2 colonnes, non conforme v2.4. */
const BLOC_2906_LEGACY_2COL = `7 29
8 27
3 26
9 26
11 26`;

describe("seuilBase (R01)", () => {
  it("seuil relatif + plancher : 33→10, 29→9, 7→3, 5→3", () => {
    expect(seuilBase(33)).toBe(10);
    expect(seuilBase(29)).toBe(9);
    expect(seuilBase(7)).toBe(3);
    expect(seuilBase(5)).toBe(3);
  });
});

describe("validateConsensusBlock — fixtures réelles", () => {
  it("1. ligne « 3 2 144 12 » (bug du 01/07) → E01 avec message cote", () => {
    const texte = BLOC_0107_CORRIGE.replace("3 2 0", "3 2 144 12");
    const r = validateConsensusBlock({ nbPartants: 15, nbSources: 33, texte });
    expect(r.ok).toBe(false);
    const e01 = r.errors.filter((e) => e.code === "E01");
    expect(e01.length).toBe(1);
    expect(e01[0].message).toContain("cote");
    expect(e01[0].message).toContain("01/07");
    expect(r.partants).toEqual([]); // rien n'est produit sur bloc invalide
  });

  it("2. bloc corrigé du 01/07 (33 sources, Σ=264, Σbases=33) → ok, sans warning", () => {
    const r = validateConsensusBlock({ nbPartants: 15, nbSources: 33, texte: BLOC_0107_CORRIGE });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.partants.length).toBe(14);
    expect(r.seuil_base).toBe(10);
    expect(r.echantillon_reduit).toBe(false);
  });

  it("4. Σ citations = 263 sur 33 sources → E05", () => {
    // retire la ligne « 12 1 0 » → Σ = 263
    const texte = BLOC_0107_CORRIGE.split("\n").filter((l) => l !== "12 1 0").join("\n");
    const r = validateConsensusBlock({ nbPartants: 15, nbSources: 33, texte });
    expect(r.ok).toBe(false);
    const e05 = r.errors.filter((e) => e.code === "E05");
    expect(e05.length).toBe(1);
    expect(e05[0].message).toContain("263");
    expect(e05[0].message).toContain("264");
  });

  it("5. numéro 16 sur 15 partants → E02", () => {
    const texte = BLOC_0107_CORRIGE.replace("15 23 0", "16 23 0");
    const r = validateConsensusBlock({ nbPartants: 15, nbSources: 33, texte });
    expect(r.errors.some((e) => e.code === "E02" && e.message.includes("16"))).toBe(true);
  });

  it("6. bloc 7 sources du 30/06 → ok + warning E07 (ack requis) + echantillon_reduit", () => {
    const r = validateConsensusBlock({ nbPartants: 13, nbSources: 7, texte: BLOC_3006_7SOURCES });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === "E07" && w.requires_ack)).toBe(true);
    expect(r.echantillon_reduit).toBe(true);
    expect(r.seuil_base).toBe(3);
  });

  it("ancien format 2 colonnes (29/06) → E01 (2 valeurs, format v2.4)", () => {
    const r = validateConsensusBlock({ nbPartants: 16, nbSources: 29, texte: BLOC_2906_LEGACY_2COL });
    expect(r.ok).toBe(false);
    expect(r.errors.every((e) => e.code === "E01")).toBe(true);
    expect(r.errors[0].message).toContain("3 entiers");
  });
});

describe("validateConsensusBlock — règles unitaires", () => {
  it("E03 : doublon de numéro", () => {
    const texte = BLOC_0107_CORRIGE + "\n7 2 0";
    const r = validateConsensusBlock({ nbPartants: 15, nbSources: 33, texte });
    expect(r.errors.some((e) => e.code === "E03")).toBe(true);
  });

  it("E04 : bases > citations (le « 144 bases » en 3 colonnes) → bloquant", () => {
    const texte = BLOC_0107_CORRIGE.replace("3 2 0", "3 2 144");
    const r = validateConsensusBlock({ nbPartants: 15, nbSources: 33, texte });
    expect(r.errors.some((e) => e.code === "E04" && e.message.includes("144"))).toBe(true);
  });

  it("E04 : citations > nb_sources → bloquant", () => {
    const r = validateConsensusBlock({ nbPartants: 15, nbSources: 5, texte: "7 6 1" });
    expect(r.errors.some((e) => e.code === "E04")).toBe(true);
  });

  it("E06 : Σ bases > nb_sources → bloquant ; < → warning ack", () => {
    const trop = validateConsensusBlock({ nbPartants: 15, nbSources: 33, texte: BLOC_0107_CORRIGE.replace("7 33 12", "7 33 13") });
    expect(trop.errors.some((e) => e.code === "E06")).toBe(true);
    const moins = validateConsensusBlock({ nbPartants: 15, nbSources: 33, texte: BLOC_0107_CORRIGE.replace("7 33 12", "7 33 11") });
    expect(moins.ok).toBe(true);
    expect(moins.warnings.some((w) => w.code === "E06" && w.requires_ack)).toBe(true);
  });

  it("E01 : cote décimale (« 7 33 4.6 12 ») → message cote", () => {
    const r = validateConsensusBlock({ nbPartants: 15, nbSources: 33, texte: "7 33 4.6 12" });
    expect(r.errors.some((e) => e.code === "E01" && e.message.includes("cote"))).toBe(true);
  });

  it("E01 : nombre négatif en tête de ligne → erreur explicite (pas de skip silencieux)", () => {
    const r = validateConsensusBlock({ nbPartants: 15, nbSources: 33, texte: "-3 2 1\n" + BLOC_0107_CORRIGE });
    expect(r.errors.some((e) => e.code === "E01" && e.message.includes("-3"))).toBe(true);
  });

  it("E00 : nb_partants / nb_sources manquants → bloquant", () => {
    expect(validateConsensusBlock({ nbPartants: 0, nbSources: 33, texte: "7 33 12" }).ok).toBe(false);
    expect(validateConsensusBlock({ nbPartants: 15, nbSources: 0, texte: "7 33 12" }).ok).toBe(false);
  });

  it("ignore prose, en-têtes, méta et lignes vides (mais pas les lignes de données fautives)", () => {
    const texte = `Date : 2026-07-01\nHippodrome : Enghien\nNb sources : 33\n# commentaire\n\n${BLOC_0107_CORRIGE}\n(Cheval 2 = 0 citation, non listé.)`;
    const r = validateConsensusBlock({ nbPartants: 15, nbSources: 33, texte });
    expect(r.ok).toBe(true);
    expect(r.partants.length).toBe(14);
  });
});
