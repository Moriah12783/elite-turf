import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseRapportsPMU } from "./geny-rapports-parser";

/**
 * Fixtures = vraies pages Geny /arrivee-et-rapports-pmu?id_course=<ID> capturées
 * le 29/06/2026 (nettoyées : <script>/<style>/<svg>/commentaires retirés ; la
 * nav "Quinté+/Réunions PMU" et les <table id="les..."> sont préservées telles
 * quelles → ces fixtures régressent réellement le bug d'ancrage sur la nav).
 *
 * Valeurs de référence = opérateur PMU (rapport officiel relayé par la LONACI),
 * Quinté+ "pour 2 €", Tiercé/Quarté+ "pour 1 €".
 */
function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");
}

describe("parseRapportsPMU — ancrage par libellé (rapports PMU réels)", () => {
  describe("course Quinté+ réelle 1663299 (Compiègne/Dax, TQQ complet)", () => {
    const r = parseRapportsPMU(fixture("geny-quinte-1663299.html"));

    it("extrait le Quinté+ PMU par libellé (ordre/désordre/bonus), pas la nav ni la dotation", () => {
      expect(r.quinte_plus).toEqual({
        ordre: 13285.4,
        desordre: 203.0,
        bonus4: 8.4,
        bonus3: 6.6,
      });
    });

    it("le désordre Quinté+ est RÉALISTE (~200 €), pas un petit nombre parasite", () => {
      expect(r.quinte_plus?.desordre).toBeGreaterThan(50);
    });

    it("l'ordre Quinté+ n'est PAS la dotation de la course (≠ 600, ≠ 0)", () => {
      expect(r.quinte_plus?.ordre).toBe(13285.4);
    });

    it("extrait le Quarté+ PMU (ordre/désordre/bonus)", () => {
      expect(r.quarte_plus).toEqual({ ordre: 606.8, desordre: 50.7, bonus: 10.6 });
    });

    it("extrait le Tiercé PMU (ordre/désordre)", () => {
      expect(r.tierce).toEqual({ ordre: 215.8, desordre: 36.8 });
    });
  });

  describe("course Quinté+ réelle 1663078 (gros désordre + 'Pas de gagnant')", () => {
    const r = parseRapportsPMU(fixture("geny-quinte-1663078.html"));

    it("extrait le Quinté+ PMU avec un gros désordre (1 006,80 €)", () => {
      expect(r.quinte_plus).toEqual({
        ordre: 120819.8,
        desordre: 1006.8,
        bonus4: 17.0,
        bonus3: 14.6,
      });
    });

    it("extrait le Quarté+ PMU", () => {
      expect(r.quarte_plus).toEqual({ ordre: 10379.8, desordre: 319.4, bonus: 82.9 });
    });
  });

  describe("GATE — course SANS Quinté+ (1663324, steeple 6 partants, bet 'Super 4')", () => {
    const r = parseRapportsPMU(fixture("geny-no-quinte-1663324.html"));

    it("ne FABRIQUE pas de quinte_plus (table lesQuintos absente)", () => {
      expect(r.quinte_plus).toBeUndefined();
    });

    it("ne fabrique pas de tierce (table lesTierces absente)", () => {
      expect(r.tierce).toBeUndefined();
    });

    it("ne confond pas le bet 'Super 4' avec un Quarté+ (pas de ligne Désordre)", () => {
      expect(r.quarte_plus).toBeUndefined();
    });
  });

  describe("GATE — course SANS Quinté+ (1663328)", () => {
    const r = parseRapportsPMU(fixture("geny-no-quinte-1663328.html"));

    it("ne fabrique ni quinte_plus, ni quarte_plus, ni tierce", () => {
      expect(r.quinte_plus).toBeUndefined();
      expect(r.quarte_plus).toBeUndefined();
      expect(r.tierce).toBeUndefined();
    });
  });

  describe("'Pas de gagnant' sur l'ordre → ordre omis, désordre conservé", () => {
    const html = `
      <table id="lesQuintos"><tr><td>
        <div style="height:20px;background-color:#00B050;color:white"><b><i>PMU</i></b></div>
        <table style="width:100%">
          <tr><td class="ncdouble1" width="150" height="20"></td>
              <td class="pts01droite1" align="right">Pas de gagnant</td></tr>
          <tr><td class="ncdouble0" width="150" height="20">D&eacute;sordre</td>
              <td class="pts01droite0" align="right">203,00 &euro;</td></tr>
          <tr><td class="ncdouble1">Bonus 4sur5</td>
              <td class="pts01droite1">8,40 &euro;</td></tr>
          <tr><td class="ncdouble0">Bonus 3</td>
              <td class="pts01droite0">6,60 &euro;</td></tr>
        </table>
      </td></tr></table>`;
    const r = parseRapportsPMU(html);

    it("désordre présent même si l'ordre n'a pas de gagnant", () => {
      expect(r.quinte_plus?.desordre).toBe(203.0);
      expect(r.quinte_plus?.ordre).toBeUndefined();
      expect(r.quinte_plus?.bonus4).toBe(8.4);
      expect(r.quinte_plus?.bonus3).toBe(6.6);
    });
  });

  it("ne lève jamais d'exception sur une page sans rapports", () => {
    expect(() => parseRapportsPMU("<html><body>aucun rapport ici</body></html>")).not.toThrow();
    expect(parseRapportsPMU("").quinte_plus).toBeUndefined();
  });
});
