import { describe, it, expect } from "vitest";
import { analyserMusique } from "./musique";

describe("analyserMusique — 5 dernières courses, de la plus récente à la plus ancienne", () => {
  it("IMAGE D'ATALANTE : 2-3-2-2-8 → 4 fois dans les 3 premiers, sans faute", () => {
    expect(analyserMusique("2a3a2a2a8a4a0a4a6a4a")).toEqual({
      courses: 5, victoires: 0, top3: 4, top5: 4, fautes: 0, derniereGagnee: false,
    });
  });

  it("JUSTICIA SMART : 4-0-D-D-D → 3 fautes ; 0 = non placé", () => {
    expect(analyserMusique("4a0aDaDaDa5aDa5a4a4a")).toEqual({
      courses: 5, victoires: 0, top3: 0, top5: 1, fautes: 3, derniereGagnee: false,
    });
  });

  it("ignore les marqueurs d'année", () => {
    expect(analyserMusique("9a2a1a1a3a4a1a0a(25)6a")).toEqual({
      courses: 5, victoires: 2, top3: 4, top5: 4, fautes: 0, derniereGagnee: false,
    });
    expect(analyserMusique("(25)1a2a")).toEqual({
      courses: 2, victoires: 1, top3: 2, top5: 2, fautes: 0, derniereGagnee: true,
    });
  });

  it("monté et attelé mêlés (JOIE DE LA COTE)", () => {
    expect(analyserMusique("4a5m2a3a6a5a8a3a4a3m")).toEqual({
      courses: 5, victoires: 0, top3: 2, top5: 4, fautes: 0, derniereGagnee: false,
    });
  });

  it("galop et obstacle : A (arrêté) et T (tombé) sont des fautes", () => {
    expect(analyserMusique("1p3pAh2sTs")).toEqual({
      courses: 5, victoires: 1, top3: 3, top5: 3, fautes: 2, derniereGagnee: true,
    });
  });

  it("une lettre inconnue compte comme course, ni place ni faute", () => {
    expect(analyserMusique("Rp2a")).toEqual({
      courses: 2, victoires: 0, top3: 1, top5: 1, fautes: 0, derniereGagnee: false,
    });
  });

  it("vide, absente ou illisible → null", () => {
    expect(analyserMusique("")).toBeNull();
    expect(analyserMusique(null)).toBeNull();
    expect(analyserMusique(undefined)).toBeNull();
    expect(analyserMusique("abc")).toBeNull();
    expect(analyserMusique("(25)")).toBeNull();
  });
});
