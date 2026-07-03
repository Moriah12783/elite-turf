import { describe, it, expect } from "vitest";
import { smsAlerteJourBody } from "./sms-alerte-jour";

describe("smsAlerteJourBody", () => {
  it("contient le message, le lien espace abonné et le STOP 1-clic avec le token", () => {
    const b = smsAlerteJourBody("abcd1234abcd1234");
    expect(b.toLowerCase()).toContain("analyses du jour");
    expect(b).toContain("elite-turf.fr/pronostics");
    expect(b).toContain("Stop: elite-turf.fr/stop?t=abcd1234abcd1234");
  });

  it("est en ASCII strict (GSM-7, pas d'accent qui gonflerait les segments)", () => {
    const b = smsAlerteJourBody("t");
    // eslint-disable-next-line no-control-regex
    expect(/^[\x00-\x7F]*$/.test(b)).toBe(true);
  });
});
