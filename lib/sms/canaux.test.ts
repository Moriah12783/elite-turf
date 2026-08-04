import { describe, it, expect } from "vitest";
import { canalSmsActif, drapeauDe, type CanalSms } from "./canaux";

const TOUS: CanalSms[] = ["ALERTE_JOUR", "SEQUENCE", "BIENVENUE"];

describe("canalSmsActif", () => {
  // Le point le plus important : un drapeau absent ne doit JAMAIS ouvrir un
  // canal. C'est ce qui permet de couper un envoi par simple déploiement,
  // sans rien configurer côté Cloudflare, et d'être à l'abri d'un oubli.
  it("est fermé par défaut sur TOUS les canaux quand rien n'est configuré", () => {
    for (const c of TOUS) expect(canalSmsActif(c, {})).toBe(false);
  });

  it("n'accepte que la valeur exacte \"true\"", () => {
    for (const valeur of ["1", "TRUE", "True", "oui", "yes", "on", " true", ""]) {
      expect(canalSmsActif("ALERTE_JOUR", { SMS_ALERTE_JOUR_ENABLED: valeur })).toBe(false);
    }
    expect(canalSmsActif("ALERTE_JOUR", { SMS_ALERTE_JOUR_ENABLED: "true" })).toBe(true);
  });

  it("ouvre uniquement le canal visé, jamais ses voisins", () => {
    const env = { SMS_ALERTE_JOUR_ENABLED: "true" };
    expect(canalSmsActif("ALERTE_JOUR", env)).toBe(true);
    expect(canalSmsActif("SEQUENCE", env)).toBe(false);
    expect(canalSmsActif("BIENVENUE", env)).toBe(false);
  });

  // La décision du 04/08/2026 : seule l'alerte aux abonnés payants survit.
  it("reflète la décision du porteur : alerte ouverte, séquence et bienvenue fermées", () => {
    const prod = {
      SMS_ALERTE_JOUR_ENABLED: "true",
      // SMS_SEQUENCE_ENABLED et SMS_WELCOME_ENABLED volontairement absents
    };
    expect(canalSmsActif("ALERTE_JOUR", prod)).toBe(true);
    expect(canalSmsActif("SEQUENCE", prod)).toBe(false);
    expect(canalSmsActif("BIENVENUE", prod)).toBe(false);
  });
});

describe("drapeauDe", () => {
  it("nomme la variable à poser pour chaque canal", () => {
    expect(drapeauDe("ALERTE_JOUR")).toBe("SMS_ALERTE_JOUR_ENABLED");
    expect(drapeauDe("SEQUENCE")).toBe("SMS_SEQUENCE_ENABLED");
    expect(drapeauDe("BIENVENUE")).toBe("SMS_WELCOME_ENABLED");
  });

  it("donne un nom distinct à chaque canal", () => {
    const noms = TOUS.map(drapeauDe);
    expect(new Set(noms).size).toBe(TOUS.length);
  });
});
