import { describe, it, expect } from "vitest";
import { lignesHistorique, idFormuleAbonne, STATUTS_AFFICHES, type TransactionBrute } from "./historique-paiements";

/** `toLocaleString("fr-FR")` sépare les milliers par une espace fine insécable. */
const espaces = (s: string) => s.replace(/[  ]/g, " ");

const base: TransactionBrute = {
  id: "t1",
  montant_fcfa: 42637,
  montant_devise: null,
  devise: "EUR",
  methode: "STRIPE",
  statut: "SUCCES",
  reference_operateur: "ET-STRIPE-abcdef123456",
  metadata: { plan_id: "starter", provider: "stripe" },
  date_transaction: "2026-09-12T10:15:00+00:00",
};

describe("historique des paiements de l'espace membre", () => {
  it("ne montre que les paiements passés et les remboursements", () => {
    expect(STATUTS_AFFICHES).toEqual(["SUCCES", "REMBOURSE"]);
  });

  it("carte : montant en euros (65 €), libellé lisible, formule", () => {
    const [l] = lignesHistorique([base]);
    expect(l).toMatchObject({ moyen: "Carte bancaire", formule: "Pack Starter", statut: "Payé", reference: "EF123456" });
    expect(espaces(l.montant)).toBe("65 €");
  });

  it("Orange Money / Wave activé depuis l'admin : montant payé en FCFA", () => {
    const [l] = lignesHistorique([
      {
        ...base,
        devise: "XOF",
        methode: "WAVE",
        montant_fcfa: 99500,
        reference_operateur: "ET-MM-WAVE-20261015100000-a1b2",
        metadata: { source: "admin_mobile_money", formule: "pro" },
      },
    ]);
    expect(l).toMatchObject({ moyen: "Wave", formule: "Pack Pro", reference: "000-A1B2" });
    expect(espaces(l.montant)).toBe("99 500 FCFA");
  });

  it("montant en devise enregistré : il prime sur la conversion", () => {
    const [l] = lignesHistorique([{ ...base, methode: "WESTERN_UNION", montant_devise: 65 }]);
    expect(l.moyen).toBe("Western Union");
    expect(espaces(l.montant)).toBe("65 €");
  });

  it("remboursement, moyen inconnu, formule absente : rien d'inventé", () => {
    const [l] = lignesHistorique([
      { ...base, statut: "REMBOURSE", methode: "AUTRE", metadata: null, reference_operateur: null },
    ]);
    expect(l).toMatchObject({ statut: "Remboursé", moyen: "AUTRE", formule: null, reference: null });
  });
});

describe("formule affichée dans « Votre plan »", () => {
  it("noms de la table plans (Découverte, Performance, Elite)", () => {
    expect(idFormuleAbonne("Découverte", "STARTER")).toBe("starter");
    expect(idFormuleAbonne("Performance", "PRO")).toBe("pro");
    expect(idFormuleAbonne("Elite", "ELITE")).toBe("elite");
  });

  it("sans ligne d'abonnement : le statut du profil", () => {
    expect(idFormuleAbonne(null, "PRO")).toBe("pro");
    expect(idFormuleAbonne(undefined, "STARTER")).toBe("starter");
  });

  it("ni l'un ni l'autre : aucune formule", () => {
    expect(idFormuleAbonne(null, "GRATUIT")).toBeNull();
    expect(idFormuleAbonne("Inconnu", "EXPIRE")).toBeNull();
  });
});
