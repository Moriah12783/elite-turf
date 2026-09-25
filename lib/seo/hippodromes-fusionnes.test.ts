import { describe, it, expect } from "vitest";
import { redirectionHippodromeFusionne } from "./hippodromes-fusionnes";

describe("redirectionHippodromeFusionne — fiches doublons LONACI fusionnées le 25/09/2026", () => {
  it("fiche hippodrome : ancienne adresse → fiche de référence", () => {
    expect(redirectionHippodromeFusionne("/hippodromes/paris-vincennes")).toBe("/hippodromes/vincennes");
    expect(redirectionHippodromeFusionne("/hippodromes/pornichet")).toBe("/hippodromes/pornichet-la-baule");
    expect(redirectionHippodromeFusionne("/hippodromes/mauquenchy")).toBe("/hippodromes/rouen-mauquenchy");
  });

  it("guide blog de l'hippodrome : même redirection", () => {
    expect(redirectionHippodromeFusionne("/blog/decouvrir-hippodrome/paris-vincennes"))
      .toBe("/blog/decouvrir-hippodrome/vincennes");
  });

  it("tolère la barre finale", () => {
    expect(redirectionHippodromeFusionne("/hippodromes/paris-vincennes/")).toBe("/hippodromes/vincennes");
  });

  it("ne touche à rien d'autre", () => {
    expect(redirectionHippodromeFusionne("/hippodromes/vincennes")).toBeNull();
    expect(redirectionHippodromeFusionne("/hippodromes/paris-vincennes-bis")).toBeNull();
    expect(redirectionHippodromeFusionne("/hippodromes")).toBeNull();
    expect(redirectionHippodromeFusionne("/courses/paris-vincennes")).toBeNull();
    expect(redirectionHippodromeFusionne("/hippodromes/constructor")).toBeNull();
  });
});
