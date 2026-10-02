import { describe, it, expect } from "vitest";
import { lireCotesPmu, memesPartants, nomCheval } from "./pmu-cotes";
import { delaiRafraichissement, RAFRAICHISSEMENT_LOIN_MS, RAFRAICHISSEMENT_PROCHE_MS } from "./courses/cotes-live";

// Extrait réel de /programme/02102026/R4/C6/participants (Saint-Cloud, 02/10/2026).
const PARTICIPANTS = {
  participants: [
    {
      numPmu: 1, nom: "ZGHARTA", statut: "PARTANT", driver: "O.MURPHY", entraineur: "A.BALDING",
      dernierRapportDirect: { typePari: "SIMPLE_GAGNANT", rapport: 17.0, typeRapport: "DIRECT", indicateurTendance: "-", nombreIndicateurTendance: -11.61, dateRapport: 1790949600000 },
      dernierRapportReference: { typePari: "SIMPLE_GAGNANT", rapport: 16.0, typeRapport: "REFERENCE", indicateurTendance: "+", dateRapport: 1790937000000 },
    },
    { numPmu: 10, nom: "BLUE SKY (IRE)", statut: "NON_PARTANT", driver: "", dernierRapportDirect: null },
    { numPmu: 4, nom: "KELLE BEAUTÉ", statut: "PARTANT", driver: "A.ABRIVARD", dernierRapportDirect: { rapport: 3.4, indicateurTendance: "+", dateRapport: 1790949600000 } },
  ],
};

describe("lireCotesPmu", () => {
  const cotes = lireCotesPmu(PARTICIPANTS);

  it("lit la cote directe, son heure, sa tendance et la cote de référence", () => {
    expect(cotes[0]).toEqual({
      numero: 1, nom: "ZGHARTA", nonPartant: false, cote: 17, coteMaj: 1790949600000,
      tendance: "-", coteReference: 16, jockey: "O.MURPHY",
    });
  });

  it("repère un non-partant et une cote absente", () => {
    expect(cotes[1]).toMatchObject({ numero: 10, nonPartant: true, cote: null, coteMaj: null, tendance: null, jockey: null });
  });

  it("tolère un payload vide ou illisible", () => {
    expect(lireCotesPmu(null)).toEqual([]);
    expect(lireCotesPmu({ participants: "x" })).toEqual([]);
  });
});

describe("identité par les partants", () => {
  it("normalise les noms (accents, suffixe de pays)", () => {
    expect(nomCheval("Kelle Beauté")).toBe("KELLEBEAUTE");
    expect(nomCheval("BLUE SKY (IRE)")).toBe("BLUESKY");
  });

  it("reconnaît la même course", () => {
    expect(memesPartants(["Zgharta", "Kelle Beaute", "Blue Sky"], ["ZGHARTA", "KELLE BEAUTÉ", "BLUE SKY (IRE)", "AUTRE"])).toBe(true);
  });

  it("refuse une autre course de mêmes numéros", () => {
    expect(memesPartants(["Alpha", "Bravo", "Charlie", "Delta"], ["ZGHARTA", "KELLE BEAUTÉ", "BLUE SKY (IRE)"])).toBe(false);
  });

  it("ne tranche pas avec moins de 3 noms connus", () => {
    expect(memesPartants(["Zgharta"], ["ZGHARTA"])).toBe(false);
  });
});

describe("delaiRafraichissement", () => {
  const depart = "2026-10-02T14:20:00.000Z";
  const a = (iso: string) => Date.parse(iso);

  it("30 s dans la dernière demi-heure et jusqu'à 10 min après l'heure prévue", () => {
    expect(delaiRafraichissement(depart, a("2026-10-02T13:55:00Z"))).toBe(RAFRAICHISSEMENT_PROCHE_MS);
    expect(delaiRafraichissement(depart, a("2026-10-02T14:25:00Z"))).toBe(RAFRAICHISSEMENT_PROCHE_MS);
  });

  it("5 min jusqu'à 2 h avant", () => {
    expect(delaiRafraichissement(depart, a("2026-10-02T13:00:00Z"))).toBe(RAFRAICHISSEMENT_LOIN_MS);
  });

  it("rien loin du départ, ni longtemps après", () => {
    expect(delaiRafraichissement(depart, a("2026-10-02T11:00:00Z"))).toBeNull();
    expect(delaiRafraichissement(depart, a("2026-10-02T14:45:00Z"))).toBeNull();
    expect(delaiRafraichissement(null)).toBeNull();
  });
});
