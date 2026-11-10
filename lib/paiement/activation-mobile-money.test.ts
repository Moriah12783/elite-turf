import { describe, it, expect } from "vitest";
import { PLAN_CONFIG, type Plan } from "@/types";
import {
  palierDeFormule,
  montantFcfa,
  calculerPeriode,
  avertissements,
  referenceMobileMoney,
  motifEmailExact,
  formuleDeTransaction,
  estPaiementCarte,
  niveauAccorde,
  dernierJourAcces,
} from "./activation-mobile-money";

describe("« Valider » (Admin → Paiements) : la formule enregistrée avec le paiement", () => {
  it("metadata.plan_id (Paystack, carte) ou metadata.formule (bouton Activer)", () => {
    expect(formuleDeTransaction({ plan_id: "starter", provider: "paystack" })).toBe("starter");
    expect(formuleDeTransaction({ formule: "elite" })).toBe("elite");
  });

  it("inconnue, absente ou plan de test : null — on ne devine jamais (plus de « Pro 30 jours » par défaut)", () => {
    expect(formuleDeTransaction(null)).toBeNull();
    expect(formuleDeTransaction({})).toBeNull();
    expect(formuleDeTransaction({ plan_id: "test-paystack" })).toBeNull();
    expect(formuleDeTransaction({ plan_id: 42 })).toBeNull();
  });

  it("paiement par carte : jamais validé à la main (checkout abandonné)", () => {
    expect(estPaiementCarte({ methode: "STRIPE", reference_operateur: "ET-STRIPE-x" })).toBe(true);
    expect(estPaiementCarte({ methode: "ORANGE_MONEY", reference_operateur: "ET-STRIPE-x" })).toBe(true);
    expect(estPaiementCarte({ methode: "ORANGE_MONEY", reference_operateur: "ET-A88892" })).toBe(false);
    expect(estPaiementCarte({ methode: "WAVE", reference_operateur: null })).toBe(false);
  });
});

const plan = (id: string) => PLAN_CONFIG.find((p) => p.id === id) as Plan;
const MAINTENANT = new Date("2026-10-15T10:00:00.000Z");

describe("palier et montant d'une formule", () => {
  it("starter → STARTER, pro → PRO, elite → ELITE", () => {
    expect(palierDeFormule("starter")).toBe("STARTER");
    expect(palierDeFormule("pro")).toBe("PRO");
    expect(palierDeFormule("elite")).toBe("ELITE");
  });

  it("montant payé en FCFA = celui affiché (42 500 / 99 500 / 136 500)", () => {
    expect(montantFcfa(plan("starter"))).toBe(42500);
    expect(montantFcfa(plan("pro"))).toBe(99500);
    expect(montantFcfa(plan("elite"))).toBe(136500);
  });
});

describe("période activée (décision de Steph du 06/10 : prolonger depuis la fin)", () => {
  it("abonné encore actif : les jours s'ajoutent après sa date de fin", () => {
    const p = calculerPeriode({ statut: "PRO", expiration: "2026-10-20T00:00:00+00:00" }, 30, MAINTENANT);
    expect(p).toEqual({ debut: "2026-10-15T10:00:00.000Z", fin: "2026-11-19T00:00:00.000Z", prolongation: true, differe: false });
  });

  it("abonné expiré, gratuit ou sans date : à partir de maintenant", () => {
    const attendu = { debut: "2026-10-15T10:00:00.000Z", fin: "2026-10-22T10:00:00.000Z", prolongation: false, differe: false };
    expect(calculerPeriode({ statut: "PRO", expiration: "2026-10-01T00:00:00+00:00" }, 7, MAINTENANT)).toEqual(attendu);
    expect(calculerPeriode({ statut: "EXPIRE", expiration: null }, 7, MAINTENANT)).toEqual(attendu);
    expect(calculerPeriode({ statut: "GRATUIT", expiration: null }, 7, MAINTENANT)).toEqual(attendu);
    expect(calculerPeriode({ statut: null, expiration: null }, 7, MAINTENANT)).toEqual(attendu);
  });

  it("date de fin atteinte pile maintenant : déjà expiré (même règle que effectiveSubscription)", () => {
    const p = calculerPeriode({ statut: "STARTER", expiration: "2026-10-15T10:00:00.000Z" }, 7, MAINTENANT);
    expect(p).toMatchObject({ prolongation: false, fin: "2026-10-22T10:00:00.000Z" });
  });

  it("accès payant SANS date de fin (permanent) : refus, l'activation lui en donnerait une", () => {
    expect(calculerPeriode({ statut: "ELITE", expiration: null }, 30, MAINTENANT)).toEqual({ erreur: "PERMANENT" });
    expect(calculerPeriode({ statut: "ELITE", expiration: null }, 30, MAINTENANT, "demain")).toEqual({ erreur: "PERMANENT" });
  });
});

describe("début « à partir de demain » (décision de Steph du 10/11/2026)", () => {
  it("les N jours se comptent à partir de demain 00h UTC (minuit à Abidjan) : N journées pleines", () => {
    const p = calculerPeriode({ statut: "GRATUIT", expiration: null }, 7, MAINTENANT, "demain");
    expect(p).toEqual({ debut: "2026-10-16T00:00:00.000Z", fin: "2026-10-23T00:00:00.000Z", prolongation: false, differe: true });
  });

  it("activation juste avant minuit : demain = le jour qui suit", () => {
    const p = calculerPeriode({ statut: "EXPIRE", expiration: null }, 7, new Date("2026-10-15T23:59:00.000Z"), "demain");
    expect(p).toMatchObject({ debut: "2026-10-16T00:00:00.000Z", fin: "2026-10-23T00:00:00.000Z" });
  });

  it("abonné encore actif : « demain » sans effet, la période part de sa date de fin", () => {
    const p = calculerPeriode({ statut: "PRO", expiration: "2026-10-20T00:00:00+00:00" }, 30, MAINTENANT, "demain");
    expect(p).toEqual({ debut: "2026-10-15T10:00:00.000Z", fin: "2026-11-19T00:00:00.000Z", prolongation: true, differe: false });
    expect(avertissements({ statut: "PRO", expiration: "2026-10-20T00:00:00+00:00" }, "PRO", MAINTENANT, "demain")).toEqual([
      expect.stringContaining("demain"),
    ]);
  });
});

describe("dernier jour d'accès (abonnements.date_fin, lu par le cron d'expiration)", () => {
  // Le cron coupe à 01h UTC le LENDEMAIN de date_fin (constaté en base le 10/11/2026).
  it("fin à minuit pile : le dernier jour est la veille", () => {
    expect(dernierJourAcces("2026-10-23T00:00:00.000Z")).toBe("2026-10-22");
  });

  it("fin en cours de journée : ce jour-là (comportement inchangé)", () => {
    expect(dernierJourAcces("2026-10-22T10:00:00.000Z")).toBe("2026-10-22");
    expect(dernierJourAcces("2026-11-19T00:00:00.001Z")).toBe("2026-11-19");
  });
});

describe("niveau d'accès accordé (promo : payé Starter, reçoit Elite)", () => {
  it("absent ou vide : le niveau de la formule payée", () => {
    expect(niveauAccorde("STARTER", undefined)).toBe("STARTER");
    expect(niveauAccorde("STARTER", "")).toBe("STARTER");
    expect(niveauAccorde("PRO", null)).toBe("PRO");
  });

  it("niveau égal ou supérieur : accordé", () => {
    expect(niveauAccorde("STARTER", "ELITE")).toBe("ELITE");
    expect(niveauAccorde("STARTER", "PRO")).toBe("PRO");
    expect(niveauAccorde("ELITE", "ELITE")).toBe("ELITE");
  });

  it("niveau inférieur à la formule payée : refus (jamais moins que ce qui est payé)", () => {
    expect(niveauAccorde("ELITE", "STARTER")).toEqual({ erreur: "INFERIEUR" });
    expect(niveauAccorde("PRO", "STARTER")).toEqual({ erreur: "INFERIEUR" });
  });

  it("valeur inconnue : refus, on ne devine pas", () => {
    expect(niveauAccorde("STARTER", "GRATUIT")).toEqual({ erreur: "INCONNU" });
    expect(niveauAccorde("STARTER", "elite")).toEqual({ erreur: "INCONNU" });
    expect(niveauAccorde("STARTER", 3)).toEqual({ erreur: "INCONNU" });
  });
});

describe("avertissements avant confirmation", () => {
  it("passage à une formule inférieure alors qu'il est encore actif", () => {
    const a = avertissements({ statut: "ELITE", expiration: "2026-10-30T00:00:00+00:00" }, "STARTER", MAINTENANT);
    expect(a).toHaveLength(1);
    expect(a[0]).toContain("ELITE");
    expect(a[0]).toContain("STARTER");
  });

  it("même formule, formule supérieure ou abonné inactif : rien à signaler", () => {
    expect(avertissements({ statut: "PRO", expiration: "2026-10-30T00:00:00+00:00" }, "PRO", MAINTENANT)).toEqual([]);
    expect(avertissements({ statut: "STARTER", expiration: "2026-10-30T00:00:00+00:00" }, "ELITE", MAINTENANT)).toEqual([]);
    expect(avertissements({ statut: "ELITE", expiration: "2026-10-01T00:00:00+00:00" }, "STARTER", MAINTENANT)).toEqual([]);
  });
});

describe("référence du paiement enregistré", () => {
  it("préfixe ET-MM, jamais ceux de Paystack (ET-PS-) ni de Stripe (ET-STRIPE-)", () => {
    expect(referenceMobileMoney("WAVE", MAINTENANT, "a1b2")).toBe("ET-MM-WAVE-20261015100000-a1b2");
    expect(referenceMobileMoney("ORANGE_MONEY", MAINTENANT, "a1b2")).toBe("ET-MM-OM-20261015100000-a1b2");
  });
});

describe("recherche du compte par e-mail", () => {
  it("insensible à la casse et aux espaces, caractères spéciaux neutralisés", () => {
    expect(motifEmailExact("  Jean_Dupont%@Exemple.COM ")).toBe("jean\\_dupont\\%@exemple.com");
  });
});
