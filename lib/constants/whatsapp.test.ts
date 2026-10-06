import { describe, it, expect } from "vitest";
import { messageWhatsappDepuis, numeroWhatsappLisible, whatsappUrl } from "./whatsapp";

describe("numeroWhatsappLisible — le numéro à vérifier avant de payer", () => {
  it("numéro français groupé par deux, espaces insécables", () => {
    const attendu = "+33 6 44 68 67 20";
    expect(numeroWhatsappLisible("+33644686720")).toBe(attendu);
    expect(numeroWhatsappLisible("+33 6 44 68 67 20")).toBe(attendu);
  });

  it("autre format : affiché tel quel", () => {
    expect(numeroWhatsappLisible("+2250700000000")).toBe("+2250700000000");
  });
});

describe("messageWhatsappDepuis — d'où écrit le visiteur", () => {
  it("indique la page pays d'où vient le contact", () => {
    expect(messageWhatsappDepuis("/pronostics-pmu-burkina-faso")).toBe(
      "Bonjour Elite Turf, je souhaite plus d'informations sur vos pronostics. (Page : elite-turf.fr/pronostics-pmu-burkina-faso)",
    );
  });

  it("accueil, ou chemin inconnu → « accueil »", () => {
    for (const chemin of ["/", "", null, undefined]) {
      expect(messageWhatsappDepuis(chemin)).toContain("(Page : elite-turf.fr (accueil))");
    }
  });

  it("le message passe encodé dans le lien wa.me", () => {
    expect(whatsappUrl(messageWhatsappDepuis("/quinte-plus"))).toContain("elite-turf.fr%2Fquinte-plus");
  });
});
