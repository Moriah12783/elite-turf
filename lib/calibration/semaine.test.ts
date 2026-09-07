import { describe, it, expect } from "vitest";
import { lundiDeLaSemaine, lundiSemainePrecedente, dimancheDeLaSemaine, estUnLundi, toIsoDate, libelleSemaine } from "./semaine";

describe("semaine ISO (UTC)", () => {
  it("trouve le lundi de la semaine courante, y compris depuis un dimanche", () => {
    expect(toIsoDate(lundiDeLaSemaine(new Date("2026-09-07T09:40:00Z")))).toBe("2026-09-07"); // lundi
    expect(toIsoDate(lundiDeLaSemaine(new Date("2026-09-10T23:59:00Z")))).toBe("2026-09-07"); // jeudi
    expect(toIsoDate(lundiDeLaSemaine(new Date("2026-09-13T12:00:00Z")))).toBe("2026-09-07"); // dimanche
  });

  it("scelle la semaine précédente complète, jamais la semaine en cours", () => {
    expect(lundiSemainePrecedente(new Date("2026-09-07T09:40:00Z"))).toBe("2026-08-31");
    expect(lundiSemainePrecedente(new Date("2026-09-14T09:40:00Z"))).toBe("2026-09-07");
    expect(lundiSemainePrecedente(new Date("2026-09-13T23:00:00Z"))).toBe("2026-08-31");
  });

  it("calcule le dimanche et valide un lundi", () => {
    expect(dimancheDeLaSemaine("2026-08-31")).toBe("2026-09-06");
    expect(estUnLundi("2026-08-31")).toBe(true);
    expect(estUnLundi("2026-09-01")).toBe(false);
    expect(estUnLundi("2026-02-30")).toBe(false);
    expect(estUnLundi("n'importe quoi")).toBe(false);
    expect(estUnLundi(undefined)).toBe(false);
  });

  it("produit un libellé lisible", () => {
    expect(libelleSemaine("2026-08-31")).toBe("du 31 août au 6 septembre 2026");
  });
});
