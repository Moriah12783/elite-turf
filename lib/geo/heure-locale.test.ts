import { describe, it, expect } from "vitest";
import { heureLocaleDepuisParis, instantDepuisParis } from "./heure-locale";

// La France passe à l'heure d'hiver le dimanche 25/10/2026 : Paris passe de
// UTC+2 à UTC+1, donc une course à 15:15 (Paris) part une heure plus tard en
// heure africaine après le 25/10.
const AVANT = "2026-10-24";
const APRES = "2026-10-26";

describe("heureLocaleDepuisParis — départ à 15:15, heure de Paris", () => {
  const cas: [string, string, string, string][] = [
    // fuseau,               avant 25/10, après 25/10, pays
    ["Africa/Ouagadougou",   "13:15",     "14:15",     "Burkina Faso (UTC+0)"],
    ["Africa/Abidjan",       "13:15",     "14:15",     "Côte d'Ivoire (UTC+0)"],
    ["Africa/Dakar",         "13:15",     "14:15",     "Sénégal (UTC+0)"],
    ["Africa/Ndjamena",      "14:15",     "15:15",     "Tchad (UTC+1)"],
    ["Africa/Douala",        "14:15",     "15:15",     "Cameroun (UTC+1)"],
    ["Africa/Casablanca",    "14:15",     "15:15",     "Maroc hors Ramadan (UTC+1)"],
    ["Indian/Antananarivo",  "16:15",     "17:15",     "Madagascar (UTC+3)"],
    ["Indian/Reunion",       "17:15",     "18:15",     "La Réunion (UTC+4)"],
  ];

  for (const [fuseau, avant, apres, pays] of cas) {
    it(`${pays} : ${avant} le 24/10, ${apres} le 26/10`, () => {
      expect(heureLocaleDepuisParis(AVANT, "15:15:00", fuseau)).toEqual({ heure: avant, date: AVANT, autreJour: false });
      expect(heureLocaleDepuisParis(APRES, "15:15", fuseau)).toEqual({ heure: apres, date: APRES, autreJour: false });
    });
  }

  it("Paris lui-même ne bouge pas", () => {
    expect(heureLocaleDepuisParis(AVANT, "15:15", "Europe/Paris")?.heure).toBe("15:15");
    expect(heureLocaleDepuisParis(APRES, "15:15", "Europe/Paris")?.heure).toBe("15:15");
  });
});

describe("cas particuliers", () => {
  it("course tardive : le lendemain à La Réunion", () => {
    expect(heureLocaleDepuisParis(APRES, "23:30", "Indian/Reunion"))
      .toEqual({ heure: "02:30", date: "2026-10-27", autreJour: true });
  });

  it("Maroc pendant le Ramadan 2027 : UTC+0, même heure que l'Afrique de l'Ouest", () => {
    // 20/02/2027 : Paris en UTC+1 ; Maroc en UTC+0 pendant le Ramadan (tzdata).
    expect(heureLocaleDepuisParis("2027-02-20", "15:00", "Africa/Casablanca")?.heure).toBe("14:00");
    expect(heureLocaleDepuisParis("2027-02-20", "15:00", "Africa/Dakar")?.heure).toBe("14:00");
  });

  it("jamais d'heure devinée : date, heure ou fuseau illisibles → null", () => {
    expect(heureLocaleDepuisParis("2026-13-40", "15:15", "Africa/Dakar")).toBeNull();
    expect(heureLocaleDepuisParis(APRES, null, "Africa/Dakar")).toBeNull();
    expect(heureLocaleDepuisParis(APRES, "midi", "Africa/Dakar")).toBeNull();
    expect(heureLocaleDepuisParis(APRES, "15:15", "Afrique/Inconnue")).toBeNull();
  });

  it("instant UTC exact de part et d'autre du changement d'heure", () => {
    expect(new Date(instantDepuisParis(AVANT, "15:15")!).toISOString()).toBe("2026-10-24T13:15:00.000Z");
    expect(new Date(instantDepuisParis(APRES, "15:15")!).toISOString()).toBe("2026-10-26T14:15:00.000Z");
  });
});
