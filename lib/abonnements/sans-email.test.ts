import { describe, it, expect } from "vitest";
import {
  segmentAdresse,
  adresseTechnique,
  estAdresseTechnique,
  premierRangLibre,
  telephoneInternational,
  memeNumero,
} from "./sans-email";

// Noms FICTIFS uniquement : jamais de donnée d'abonné dans les tests.

describe("adresse technique d'un abonné sans e-mail (décision de Steph du 10/11/2026)", () => {
  it("prenom.nom@elite-turf.fr, en minuscules et sans accents", () => {
    expect(adresseTechnique("Éloïse", "Testeur")).toBe("eloise.testeur@elite-turf.fr");
    expect(adresseTechnique("  JEAN  ", " Exemple ")).toBe("jean.exemple@elite-turf.fr");
  });

  it("prénom ou nom composé : espaces et tirets deviennent « - », apostrophes supprimées", () => {
    expect(adresseTechnique("Jean Baptiste", "N'Exemple")).toBe("jean-baptiste.nexemple@elite-turf.fr");
    expect(adresseTechnique("Marie-Ange", "De  La   Test")).toBe("marie-ange.de-la-test@elite-turf.fr");
    expect(adresseTechnique("Zoé", "D’Essai")).toBe("zoe.dessai@elite-turf.fr");
    expect(segmentAdresse("Cœur Æther")).toBe("coeur-aether");
  });

  it("homonyme : prenom.nom2@, prenom.nom3@…", () => {
    expect(adresseTechnique("Jean", "Exemple", 2)).toBe("jean.exemple2@elite-turf.fr");
    expect(adresseTechnique("Jean", "Exemple", 3)).toBe("jean.exemple3@elite-turf.fr");
  });

  it("prénom ET nom obligatoires : sans l'un des deux, pas d'adresse (jamais contact@ ni support@)", () => {
    expect(adresseTechnique("", "Exemple")).toBeNull();
    expect(adresseTechnique("Jean", "   ")).toBeNull();
    expect(adresseTechnique("Jean", "'’")).toBeNull();
  });

  it("premier rang libre parmi les adresses déjà prises (casse ignorée)", () => {
    expect(premierRangLibre("Jean", "Exemple", [])).toBe(1);
    expect(premierRangLibre("Jean", "Exemple", ["Jean.Exemple@elite-turf.fr"])).toBe(2);
    expect(
      premierRangLibre("Jean", "Exemple", ["jean.exemple@elite-turf.fr", "jean.exemple2@elite-turf.fr", "jean.exemple4@elite-turf.fr"]),
    ).toBe(3);
    // Un autre nom qui commence pareil ne prend pas la place.
    expect(premierRangLibre("Jean", "Exemple", ["jean.exemplaire@elite-turf.fr"])).toBe(1);
  });
});

describe("reconnaître une adresse technique (aucun e-mail automatique vers elle)", () => {
  it("prenom.nom@elite-turf.fr et ses homonymes : oui", () => {
    expect(estAdresseTechnique("eloise.testeur@elite-turf.fr")).toBe(true);
    expect(estAdresseTechnique("  Jean-Baptiste.Nexemple2@Elite-Turf.fr ")).toBe(true);
  });

  it("adresse de service sans point (contact@, support@) ou autre domaine : non", () => {
    expect(estAdresseTechnique("contact@elite-turf.fr")).toBe(false);
    expect(estAdresseTechnique("support@elite-turf.fr")).toBe(false);
    expect(estAdresseTechnique("jean.exemple@gmail.com")).toBe(false);
    expect(estAdresseTechnique("jean.exemple@elite-turf.fr.example.com")).toBe(false);
    expect(estAdresseTechnique(null)).toBe(false);
    expect(estAdresseTechnique("")).toBe(false);
  });

  it("toute adresse produite par adresseTechnique est reconnue", () => {
    for (const [p, n, r] of [["Éloïse", "Testeur", 1], ["Jean Baptiste", "N'Exemple", 2], ["Zoé", "D’Essai", 12]] as const) {
      expect(estAdresseTechnique(adresseTechnique(p, n, r))).toBe(true);
    }
  });
});

describe("numéro WhatsApp", () => {
  it("format international normalisé : +indicatif et chiffres seuls", () => {
    expect(telephoneInternational("+226 70 00 00 01")).toBe("+22670000001");
    expect(telephoneInternational("00225 07 00 00 00 01")).toBe("+2250700000001");
    expect(telephoneInternational(" +221-77-000-00-01 ")).toBe("+221770000001");
  });

  it("sans indicatif, trop court ou trop long : refusé (null)", () => {
    expect(telephoneInternational("70 00 00 01")).toBeNull();
    expect(telephoneInternational("+226 7000")).toBeNull();
    expect(telephoneInternational("+1234567890123456")).toBeNull();
    expect(telephoneInternational("")).toBeNull();
  });

  it("même numéro quel que soit le format (8 derniers chiffres)", () => {
    expect(memeNumero("+226 70 00 00 01", "0022670000001")).toBe(true);
    expect(memeNumero("+22670000001", "70 00 00 01")).toBe(true);
    expect(memeNumero("+22670000001", "+22670000002")).toBe(false);
    expect(memeNumero("+22670000001", null)).toBe(false);
    expect(memeNumero("+226 7000", "7000")).toBe(false);
  });
});
