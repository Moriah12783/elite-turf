import { describe, it, expect } from "vitest";
import { normalizeLonaciReunions, nomHippodromeReference, type LonaciReunion } from "./lonaci-api";
import { computeLonaciEnrichment } from "./sync/lonaci-enrich";
import { canonicalHippodrome } from "./sync/hippodrome-canonical";

// Extrait RÉEL du flux LONACI du 25/09/2026 (heures en GMT, comme le flux).
const reunion = (libelle: string, nReunion: number, racedt: string, nationale = 0): LonaciReunion => ({
  nReunion,
  libelle,
  rd: racedt,
  races: [{
    course_number: 4,
    libelle: "PRIX AUSTRIA",
    racedt,
    int_National_Number: nationale,
    libelleJeux: {},
    partants: [],
    distance: 2850,
    statut_course: "",
  }],
});

describe("nomHippodromeReference — noms LONACI ramenés au nom de référence en base", () => {
  // Doublons mesurés en base au 25/09/2026 (copie LONACI à l'heure GMT) :
  // Paris-Vincennes 117 courses, Pornichet 22, Mauquenchy 16.
  it("les 3 noms LONACI qui créaient des doublons", () => {
    expect(nomHippodromeReference("Paris-Vincennes")).toBe("Vincennes");
    expect(nomHippodromeReference("PARIS-VINCENNES")).toBe("Vincennes");
    expect(nomHippodromeReference("Pornichet")).toBe("Pornichet-La Baule");
    expect(nomHippodromeReference("Mauquenchy")).toBe("Rouen-Mauquenchy");
  });

  it("laisse intacts les noms déjà identiques à la référence", () => {
    expect(nomHippodromeReference("Nantes")).toBe("Nantes");
    expect(nomHippodromeReference("Saint-Cloud")).toBe("Saint-Cloud");
    expect(nomHippodromeReference("Anfa")).toBe("Anfa");
  });
});

describe("normalizeLonaciReunions — applique le nom de référence", () => {
  it("« PARIS-VINCENNES » devient « Vincennes » ; les autres gardent leur forme", () => {
    const out = normalizeLonaciReunions([
      reunion("PARIS-VINCENNES", 1, "2026-09-25 18:15:00", 1),
      reunion("SAINT-CLOUD", 4, "2026-09-25 15:28:00"),
    ]);
    expect(out[0].hippodrome).toBe("Vincennes");
    expect(out[0].nationale).toBe(1);
    expect(out[1].hippodrome).toBe("Saint-Cloud");
  });

  it("ne touche pas à l'heure : le flux reste en GMT à ce stade", () => {
    const out = normalizeLonaciReunions([reunion("PARIS-VINCENNES", 1, "2026-09-25 18:15:00", 1)]);
    expect(out[0].heureDepart).toBe("18:15:00");
  });
});

describe("enrichissement : la Nationale 1 atterrit sur la VRAIE course", () => {
  // En base : la réunion Geny « Vincennes » (heure de Paris) ET la copie
  // LONACI « Paris-Vincennes ». Avant : la LONACI retrouvait sa propre copie ;
  // la vraie course restait « non jouable Afrique », sans Nationale.
  it("R1C4 Nationale 1 → course « Vincennes », pas la copie", () => {
    const lonaci = normalizeLonaciReunions([reunion("PARIS-VINCENNES", 1, "2026-09-25 18:15:00", 1)]);
    const hippoCanonMap = new Map<string, string>([
      [canonicalHippodrome("Vincennes"), "hip-vincennes"],
      [canonicalHippodrome("Paris-Vincennes"), "hip-copie"],
    ]);
    const { updates } = computeLonaciEnrichment(
      {
        date: "2026-09-25",
        lonaciCourses: lonaci.map((c) => ({
          hippodrome: c.hippodrome, nReunion: c.nReunion, numeroCourse: c.numeroCourse, nationale: c.nationale,
        })),
        genyCourses: [
          { id: "vraie", hippodrome_id: "hip-vincennes", numero_reunion: 1, numero_course: 4, pays: "France" },
          { id: "copie", hippodrome_id: "hip-copie",     numero_reunion: 1, numero_course: 4, pays: "France" },
        ],
        hippoCanonMap,
      },
      { guardMinReunions: 1, guardMinCoverage: 0.5 },
    );
    expect(updates).toContainEqual({ id: "vraie", jouable_afrique: true, nationale: 1 });
    // Programme complet → la copie, non rapprochée, perd ses drapeaux.
    expect(updates).toContainEqual({ id: "copie", jouable_afrique: false, nationale: null });
  });
});
