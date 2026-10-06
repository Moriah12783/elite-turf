import { describe, it, expect } from "vitest";
import { COUNTRY_BY_CODE } from "@/lib/geo/countries";
import { buildGeoFaq } from "./content";

const reponsePaiement = (code: string) =>
  buildGeoFaq(COUNTRY_BY_CODE[code]).find((f) => f.q.indexOf("Comment payer") === 0)?.a ?? "";

describe("FAQ pays — « Comment payer mon abonnement ? »", () => {
  it("Mali : Orange Money et Wave via WhatsApp, Moov Money toujours à venir", () => {
    const a = reponsePaiement("ML");
    expect(a).toContain("Vous pouvez aussi payer par Orange Money ou Wave, en francs CFA : écrivez-nous sur WhatsApp");
    expect(a).toContain("Les autres paiements Mobile Money (Moov Money) seront bientôt disponibles.");
  });

  it("Maroc et Tchad (pages témoins) : réponse inchangée", () => {
    expect(reponsePaiement("MA")).toBe(
      "Le paiement se fait par carte bancaire (Visa/Mastercard, toutes cartes acceptées), avec activation en moins de 2 minutes.",
    );
    expect(reponsePaiement("TD")).toBe(
      "Le paiement se fait par carte bancaire (Visa/Mastercard, toutes cartes acceptées), avec activation en moins de 2 minutes. " +
        "Les paiements Mobile Money (Airtel Money TD, Moov Money TD) seront bientôt disponibles.",
    );
  });
});
