import { describe, it, expect } from "vitest";
import { heureLocaleDepuisParis, instantDepuisParis } from "./heure-locale";

// La France passe à l'heure d'hiver le dimanche 25/10/2026 : Paris passe de
// UTC+2 à UTC+1, donc une course à 15:15 (Paris) part une heure plus tard en
// heure africaine après le 25/10.
const AVANT = "2026-10-24";
const APRES = "2026-10-26";

// Le Maroc est repassé à l'heure UTC permanente le 20/09/2026 (base horaire
// IANA 2026c, 08/07/2026). Une base plus ancienne — Node 24.14 embarque la
// 2025c — calcule encore UTC+1 : le cas marocain n'est vérifié qu'avec une base
// à jour, il est sauté sinon (plutôt qu'affirmer une heure fausse).
const BASE_HORAIRE = process.versions.tz ?? "";
const BASE_A_JOUR = BASE_HORAIRE >= "2026c";

describe("heureLocaleDepuisParis — départ à 15:15, heure de Paris", () => {
  const cas: [string, string, string, string][] = [
    // fuseau,               avant 25/10, après 25/10, pays
    ["Africa/Ouagadougou",   "13:15",     "14:15",     "Burkina Faso (UTC+0)"],
    ["Africa/Abidjan",       "13:15",     "14:15",     "Côte d'Ivoire (UTC+0)"],
    ["Africa/Dakar",         "13:15",     "14:15",     "Sénégal (UTC+0)"],
    ["Africa/Ndjamena",      "14:15",     "15:15",     "Tchad (UTC+1)"],
    ["Africa/Douala",        "14:15",     "15:15",     "Cameroun (UTC+1)"],
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

  it.runIf(BASE_A_JOUR)(`Maroc : UTC+0 permanent depuis le 20/09/2026 (base horaire ${BASE_HORAIRE})`, () => {
    // Même heure que l'Afrique de l'Ouest, avant comme après le 25/10, et en 2027.
    expect(heureLocaleDepuisParis(AVANT, "15:15", "Africa/Casablanca")?.heure).toBe("13:15");
    expect(heureLocaleDepuisParis(APRES, "15:15", "Africa/Casablanca")?.heure).toBe("14:15");
    expect(heureLocaleDepuisParis("2027-06-15", "15:00", "Africa/Casablanca")?.heure).toBe("13:00");
    // Avant le changement, le Maroc était en UTC+1 : 15:00 Paris (UTC+2) = 14:00.
    expect(heureLocaleDepuisParis("2026-09-01", "15:00", "Africa/Casablanca")?.heure).toBe("14:00");
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
