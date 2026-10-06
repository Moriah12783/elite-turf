import { describe, it, expect } from "vitest";
import { PLAN_CONFIG, type Plan } from "@/types";
import { COUNTRIES, formatPrice } from "@/lib/geo/countries";
import {
  PAYS_MOBILE_MONEY,
  OU_PAYER_MOBILE_MONEY,
  OU_PAYER_MOBILE_MONEY_DEBUT,
  paysMobileMoney,
  formulesMobileMoney,
  montantMobileMoney,
  messageMobileMoney,
  lienMobileMoney,
} from "./mobile-money";

/** `toLocaleString("fr-FR")` sépare les milliers par une espace fine insécable. */
const espaces = (s: string) => s.replace(/[  ]/g, " ");
const plan = (id: string) => PLAN_CONFIG.find((p) => p.id === id) as Plan;

describe("pays où Orange Money et Wave sont acceptés", () => {
  it("les quatre pays annoncés par Steph, dans son ordre", () => {
    expect(PAYS_MOBILE_MONEY.map((p) => p.code)).toEqual(["CI", "ML", "BF", "SN"]);
  });

  it("la phrase « en …, au … » cite les quatre pays", () => {
    expect(OU_PAYER_MOBILE_MONEY).toBe("en Côte d'Ivoire, au Mali, au Burkina Faso et au Sénégal");
    expect(OU_PAYER_MOBILE_MONEY_DEBUT).toBe("En Côte d'Ivoire, au Mali, au Burkina Faso et au Sénégal");
  });

  it("reconnaît un code pays, quelle que soit la casse", () => {
    expect(paysMobileMoney("BF")).toBe("BF");
    expect(paysMobileMoney("sn")).toBe("SN");
    expect(paysMobileMoney(" ci ")).toBe("CI");
  });

  it("refuse les autres pays et les valeurs vides", () => {
    for (const code of ["FR", "TG", "MA", "", null, undefined]) {
      expect(paysMobileMoney(code)).toBeNull();
    }
  });
});

describe("formules et montants", () => {
  it("Starter, Pro, Elite — jamais les plans de test", () => {
    expect(formulesMobileMoney().map((p) => p.id)).toEqual(["starter", "pro", "elite"]);
  });

  it("les montants validés par Steph : 42 500, 99 500 et 136 500 FCFA", () => {
    expect(espaces(montantMobileMoney(plan("starter")))).toBe("42 500 FCFA");
    expect(espaces(montantMobileMoney(plan("pro")))).toBe("99 500 FCFA");
    expect(espaces(montantMobileMoney(plan("elite")))).toBe("136 500 FCFA");
  });

  it("le même montant que celui affiché sur les pages pays", () => {
    for (const p of formulesMobileMoney()) {
      expect(montantMobileMoney(p)).toBe(formatPrice(p.prix_eur, "XOF"));
    }
  });
});

describe("message WhatsApp pré-rempli", () => {
  it("donne la formule, le montant, la durée et le pays", () => {
    expect(espaces(messageMobileMoney(plan("starter"), "BF"))).toBe(
      "Bonjour Elite Turf, je souhaite payer le Pack Starter (42 500 FCFA, 7 jours) par Orange Money ou Wave. " +
        "Pays : Burkina Faso. E-mail de mon compte Elite Turf :",
    );
  });

  it("nomme le pays en toutes lettres", () => {
    expect(messageMobileMoney(plan("elite"), "CI")).toContain("Pays : Côte d'Ivoire.");
    expect(messageMobileMoney(plan("pro"), "SN")).toContain("Pays : Sénégal.");
  });
});

describe("fiches pays (lib/geo/countries.ts) alignées sur cette liste", () => {
  const viaWhatsapp = (code: string) =>
    (COUNTRIES.find((c) => c.code === code)?.paiements ?? []).filter((p) => p.viaWhatsapp).map((p) => p.nom);

  it("Orange Money et Wave marqués « via WhatsApp » dans les quatre pays, sans « bientôt »", () => {
    for (const { code } of PAYS_MOBILE_MONEY) {
      const noms = viaWhatsapp(code);
      expect(noms.some((n) => n.indexOf("Orange Money") === 0), code).toBe(true);
      expect(noms.some((n) => n.indexOf("Wave") === 0), code).toBe(true);
      const pays = COUNTRIES.find((c) => c.code === code);
      expect(pays?.paiements.some((p) => p.viaWhatsapp && p.bientot), code).toBe(false);
    }
  });

  it("aucun autre pays n'est marqué « via WhatsApp »", () => {
    const autres = COUNTRIES.filter((c) => !paysMobileMoney(c.code) && c.paiements.some((p) => p.viaWhatsapp));
    expect(autres.map((c) => c.code)).toEqual([]);
  });
});

describe("lien vers la section de paiement", () => {
  it("pré-coche le pays quand on le connaît", () => {
    expect(lienMobileMoney("BF")).toBe("/abonnements?pays=BF#mobile-money");
  });

  it("sans pays : la section seule", () => {
    expect(lienMobileMoney()).toBe("/abonnements#mobile-money");
  });
});
