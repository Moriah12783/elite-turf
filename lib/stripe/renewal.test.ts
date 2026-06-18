import { describe, it, expect } from "vitest";
import {
  isRenewalInvoice,
  renewalTxRef,
  unixToISO,
  recurringFromDuree,
  extractSubscriptionId,
} from "./renewal";

describe("isRenewalInvoice", () => {
  it("traite subscription_cycle comme un renouvellement", () => {
    expect(isRenewalInvoice("subscription_cycle")).toBe(true);
  });
  it("ignore la 1ère facture (subscription_create) et les autres raisons", () => {
    expect(isRenewalInvoice("subscription_create")).toBe(false);
    expect(isRenewalInvoice("manual")).toBe(false);
    expect(isRenewalInvoice("")).toBe(false);
    expect(isRenewalInvoice(null)).toBe(false);
    expect(isRenewalInvoice(undefined)).toBe(false);
  });
});

describe("renewalTxRef", () => {
  it("produit une référence stable par facture", () => {
    expect(renewalTxRef("in_123")).toBe("ET-STRIPE-INV-in_123");
  });
  it("deux fois la même facture → même référence (idempotence)", () => {
    expect(renewalTxRef("in_abc")).toBe(renewalTxRef("in_abc"));
  });
});

describe("unixToISO", () => {
  it("convertit un timestamp Stripe (secondes) en ISO", () => {
    expect(unixToISO(1_700_000_000)).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });
  it("retourne null si vide / invalide", () => {
    expect(unixToISO(0)).toBeNull();
    expect(unixToISO(null)).toBeNull();
    expect(unixToISO(undefined)).toBeNull();
  });
});

describe("extractSubscriptionId", () => {
  it("lit le champ plat invoice.subscription (anciennes versions)", () => {
    expect(extractSubscriptionId({ subscription: "sub_123" })).toBe("sub_123");
  });
  it("lit invoice.parent.subscription_details.subscription (API basil 2025+)", () => {
    expect(
      extractSubscriptionId({
        parent: { subscription_details: { subscription: "sub_456" } },
      }),
    ).toBe("sub_456");
  });
  it("retourne null si aucune subscription (facture hors abonnement)", () => {
    expect(extractSubscriptionId({})).toBeNull();
    expect(extractSubscriptionId({ subscription: null })).toBeNull();
    expect(extractSubscriptionId({ parent: null })).toBeNull();
    expect(extractSubscriptionId(null)).toBeNull();
    expect(extractSubscriptionId(undefined)).toBeNull();
  });
});

describe("recurringFromDuree", () => {
  it("Starter 7 jours → day × 7", () => {
    expect(recurringFromDuree(7)).toEqual({ interval: "day", interval_count: 7 });
  });
  it("Pro / Elite 30 jours → day × 30", () => {
    expect(recurringFromDuree(30)).toEqual({ interval: "day", interval_count: 30 });
  });
  it("borne le minimum à 1 jour", () => {
    expect(recurringFromDuree(0)).toEqual({ interval: "day", interval_count: 1 });
  });
});
