import { describe, it, expect } from "vitest";
import {
  normalizePmuReunions,
  toPmuUrlDate,
  buildProgrammeUrls,
  type PmuReunion,
} from "./pmu-api";
import { canonicalHippodrome } from "./sync/hippodrome-canonical";

/**
 * `normalizePmuReunions` a été écrite pour la forme de l'endpoint
 * `/programmeComplet`. Cet endpoint renvoie désormais HTTP 420 (vérifié le
 * 2026-07-25 sur proxy + direct, clients 1/2/7/61, avec et sans
 * `specialisation`), et le seul endpoint programme encore vivant — `/programme`,
 * celui qu'utilise déjà `lib/sync/pmu-distance.ts` — expose une forme
 * DIFFÉRENTE sur quatre champs :
 *
 *   | champ           | /programmeComplet (ancien) | /programme (vivant, vérifié) |
 *   |-----------------|----------------------------|------------------------------|
 *   | n° de réunion   | `numOrdre`                 | `numExterne`                 |
 *   | pays            | `hippodrome.pays.code`     | `pays.code` (niveau réunion) |
 *   | date            | `dateReunion.date` [a,m,j] | `dateReunion` timestamp ms   |
 *   | catégorie       | `discipline` "TROT_ATTELE" | `discipline` "ATTELE" +      |
 *   |                 |                            | `specialite` "TROT_ATTELE"   |
 *
 * La fonction doit accepter les DEUX formes : l'ancienne reste testée en
 * non-régression (l'endpoint peut revenir), la nouvelle doit fonctionner.
 *
 * Anti-fabrication : aucun numéro de réunion ni aucune date ne doit être
 * inventé. Une réunion dont on ne sait pas lire le numéro ou la date est
 * ignorée, jamais insérée avec une valeur par défaut.
 */

// ── Fixtures fidèles à la réponse réelle du 2026-07-25 ────────────────────

/** Forme `/programme` (vivante). Valeurs relevées en direct sur l'API. */
function reunionLive(over: Record<string, unknown> = {}): PmuReunion {
  return {
    numExterne: 1,
    numOfficiel: 1,
    // 1784930400000 = minuit à PARIS le 25/07/2026, soit 2026-07-24T22:00:00Z.
    // Lu en UTC sans correction, on daterait la réunion au 24 (mauvais jour).
    dateReunion: 1784930400000,
    timezoneOffset: 7_200_000,
    pays: { code: "FRA", libelle: "FRANCE" },
    hippodrome: {
      code: "ENG",
      libelleCourt: "ENGHIEN",
      libelleLong: "HIPPODROME D'ENGHIEN SOISY",
    },
    courses: [
      {
        numOrdre: 1,
        libelle: "PRIX DE VINCENNES",
        heureDepart: 1784978580000,
        distance: 2875,
        nombreDeclaresPartants: 11,
        discipline: "ATTELE",
        specialite: "TROT_ATTELE",
        conditions: "",
        paris: [{ typePari: "QUINTE_PLUS" }],
      },
    ],
    ...over,
  } as unknown as PmuReunion;
}

/** Forme `/programmeComplet` (ancienne) — non-régression. */
function reunionLegacy(over: Record<string, unknown> = {}): PmuReunion {
  return {
    numOrdre: 3,
    dateReunion: { date: [2026, 7, 25] },
    hippodrome: {
      libelleCourt: "VICHY",
      libelleLong: "HIPPODROME DE VICHY",
      pays: { code: "FRA" },
    },
    courses: [
      {
        numOrdre: 2,
        libelle: "PRIX DE BOURBON",
        heureDepart: 1784978580000,
        distance: 2400,
        nombreDeclaresPartants: 10,
        discipline: "TROT_ATTELE",
        conditions: "",
        paris: [{ typePari: "TIERCE" }],
      },
    ],
    ...over,
  } as unknown as PmuReunion;
}

// ── Forme /programme (vivante) ────────────────────────────────────────────

describe("normalizePmuReunions — forme /programme (endpoint vivant)", () => {
  it("lit le numéro de réunion dans numExterne", () => {
    const out = normalizePmuReunions([reunionLive()]);
    expect(out).toHaveLength(1);
    expect(out[0].numeroReunion).toBe(1);
  });

  it("lit le pays au niveau réunion et retient la France", () => {
    const out = normalizePmuReunions([reunionLive()]);
    expect(out).toHaveLength(1);
    expect(out[0].hippodromePays).toBe("France");
  });

  it("date la réunion au jour LOCAL, pas à la veille en UTC", () => {
    const out = normalizePmuReunions([reunionLive()]);
    expect(out[0].dateCourse).toBe("2026-07-25");
  });

  it("classe une course ATTELE en TROT (et non en PLAT)", () => {
    const out = normalizePmuReunions([reunionLive()]);
    expect(out[0].categorie).toBe("TROT");
  });

  it("exclut un pays non autorisé (Espagne)", () => {
    const esp = reunionLive({
      numExterne: 2,
      pays: { code: "ESP", libelle: "Espagne" },
      hippodrome: { code: "SSB", libelleCourt: "SAN SEBASTIAN", libelleLong: "HIPPODROME DE SAN SEBASTIAN ESP" },
    });
    expect(normalizePmuReunions([esp])).toHaveLength(0);
  });

  it("conserve le filtre des courses de moins de 8 partants", () => {
    const petite = reunionLive({
      courses: [{ ...(reunionLive().courses[0] as object), nombreDeclaresPartants: 7 }],
    });
    expect(normalizePmuReunions([petite])).toHaveLength(0);
  });
});

// ── Nom d'hippodrome ──────────────────────────────────────────────────────

describe("normalizePmuReunions — nom d'hippodrome", () => {
  it("utilise libelleCourt, qui se rapproche des noms en base", () => {
    const out = normalizePmuReunions([reunionLive()]);
    expect(out[0].hippodromeName).toBe("ENGHIEN");
    // Le nom retenu doit matcher l'hippodrome EXISTANT en base ("Enghien").
    expect(canonicalHippodrome(out[0].hippodromeName)).toBe(canonicalHippodrome("Enghien"));
  });

  it("n'utilise plus libelleLong, qui créerait un hippodrome en doublon", () => {
    const out = normalizePmuReunions([reunionLegacy()]);
    expect(out[0].hippodromeName).toBe("VICHY");
    expect(canonicalHippodrome(out[0].hippodromeName)).toBe(canonicalHippodrome("Vichy"));
  });

  it("retombe sur libelleLong si libelleCourt est absent", () => {
    const sansCourt = reunionLive({
      hippodrome: { code: "ENG", libelleLong: "HIPPODROME D'ENGHIEN SOISY" },
    });
    expect(normalizePmuReunions([sansCourt])[0].hippodromeName).toBe("HIPPODROME D'ENGHIEN SOISY");
  });
});

// ── Forme /programmeComplet (non-régression) ──────────────────────────────

describe("normalizePmuReunions — forme /programmeComplet (non-régression)", () => {
  it("lit toujours le numéro de réunion dans numOrdre", () => {
    const out = normalizePmuReunions([reunionLegacy()]);
    expect(out).toHaveLength(1);
    expect(out[0].numeroReunion).toBe(3);
  });

  it("lit toujours le pays sous hippodrome.pays", () => {
    expect(normalizePmuReunions([reunionLegacy()])[0].hippodromePays).toBe("France");
  });

  it("lit toujours la date au format [année, mois, jour]", () => {
    expect(normalizePmuReunions([reunionLegacy()])[0].dateCourse).toBe("2026-07-25");
  });

  it("classe toujours TROT_ATTELE en TROT", () => {
    expect(normalizePmuReunions([reunionLegacy()])[0].categorie).toBe("TROT");
  });
});

// ── Anti-fabrication ──────────────────────────────────────────────────────

describe("normalizePmuReunions — anti-fabrication", () => {
  it("ignore une réunion dont le numéro est illisible plutôt que d'en inventer un", () => {
    const sansNum = reunionLive({ numExterne: undefined, numOfficiel: undefined });
    expect(normalizePmuReunions([sansNum])).toHaveLength(0);
  });

  it("ignore une réunion dont la date est illisible plutôt que d'en inventer une", () => {
    const sansDate = reunionLive({ dateReunion: undefined });
    expect(normalizePmuReunions([sansDate])).toHaveLength(0);
  });

  it("ignore une course dont le numéro est illisible", () => {
    const sansNumCourse = reunionLive({
      courses: [{ ...(reunionLive().courses[0] as object), numOrdre: undefined }],
    });
    expect(normalizePmuReunions([sansNumCourse])).toHaveLength(0);
  });

  it("ignore une réunion sans nom d'hippodrome plutôt que d'insérer « Inconnu »", () => {
    const sansNom = reunionLegacy({ hippodrome: { pays: { code: "FRA" } } });
    expect(normalizePmuReunions([sansNom])).toHaveLength(0);
  });

  it("ignore une course sans heure de départ exploitable", () => {
    const sansHeure = reunionLegacy({
      courses: [{ ...(reunionLegacy().courses[0] as object), heureDepart: undefined }],
    });
    expect(normalizePmuReunions([sansHeure])).toHaveLength(0);
  });

  it("n'invente pas de distance : une course sans distance reste à 0", () => {
    const sansDist = reunionLive({
      courses: [{ ...(reunionLive().courses[0] as object), distance: undefined }],
    });
    expect(normalizePmuReunions([sansDist])[0].distanceMetres).toBe(0);
  });
});

// ── Format de date de l'URL PMU ───────────────────────────────────────────

/**
 * L'API PMU attend `DDMMYYYY`. Vérifié le 2026-07-25 :
 * `/programme/25072026` -> 200 ; `/programme/20260725` -> 400 « Requête
 * invalide ». Or `toDateStr()` et les appelants produisent `YYYYMMDD`.
 */
describe("toPmuUrlDate", () => {
  it("convertit YYYYMMDD en DDMMYYYY", () => {
    expect(toPmuUrlDate("20260725")).toBe("25072026");
  });

  it("convertit une date en début de mois sans perdre les zéros", () => {
    expect(toPmuUrlDate("20260101")).toBe("01012026");
  });

  it("refuse une date malformée plutôt que de fabriquer une URL fausse", () => {
    expect(() => toPmuUrlDate("2026-07-25")).toThrow();
    expect(() => toPmuUrlDate("250726")).toThrow();
    expect(() => toPmuUrlDate("")).toThrow();
  });
});

// ── Ordre des URLs du programme ───────────────────────────────────────────

describe("buildProgrammeUrls", () => {
  it("attaque d'abord /programme, le seul endpoint qui répond 200", () => {
    const urls = buildProgrammeUrls("20260725");
    expect(urls[0]).toContain("/programme/25072026");
    expect(urls[0]).not.toContain("/programmeComplet");
  });

  it("date toutes les URLs /programme en DDMMYYYY", () => {
    for (const u of buildProgrammeUrls("20260725")) {
      if (u.indexOf("/programmeComplet/") >= 0) continue;
      expect(u).toContain("/programme/25072026");
      expect(u).not.toContain("20260725");
    }
  });

  it("garde /programmeComplet en dernier recours si PMU le rétablissait", () => {
    const urls = buildProgrammeUrls("20260725");
    const complets = urls.filter((u) => u.indexOf("/programmeComplet/") >= 0);
    expect(complets.length).toBeGreaterThan(0);
    // ...mais jamais avant une URL /programme.
    const premierComplet = urls.findIndex((u) => u.indexOf("/programmeComplet/") >= 0);
    const dernierProgramme = urls.map((u) => u.indexOf("/programmeComplet/") < 0).lastIndexOf(true);
    expect(premierComplet).toBeGreaterThan(dernierProgramme);
  });
});

// ── Alias d'hippodromes PMU -> noms en base ───────────────────────────────

/**
 * `libelleCourt` fait matcher 14 hippodromes sur 18, mais 3 variantes
 * créeraient un DOUBLON en base (vérifié le 2026-07-25 sur les 183
 * hippodromes existants). On les rapproche explicitement plutôt que de
 * relâcher `canonicalHippodrome`, qui est partagé avec LONACI et GenyBet.
 */
describe("normalizePmuReunions — alias d'hippodromes", () => {
  const nomPour = (libelleCourt: string) =>
    normalizePmuReunions([
      reunionLive({ hippodrome: { code: "XXX", libelleCourt } }),
    ])[0]?.hippodromeName;

  it("rapproche CAGNES/MER de « Cagnes-sur-Mer »", () => {
    expect(nomPour("CAGNES/MER")).toBe("Cagnes-sur-Mer");
  });

  it("rapproche MAUQUENCHY de « Rouen-Mauquenchy »", () => {
    expect(nomPour("MAUQUENCHY")).toBe("Rouen-Mauquenchy");
  });

  it("rapproche CLAIREFONTAINE de « Clairefontaine-Deauville »", () => {
    expect(nomPour("CLAIREFONTAINE")).toBe("Clairefontaine-Deauville");
  });

  it("laisse intact un hippodrome qui matche déjà la base", () => {
    expect(nomPour("ENGHIEN")).toBe("ENGHIEN");
    expect(nomPour("VICHY")).toBe("VICHY");
  });

  it("laisse intact un hippodrome réellement inconnu (pas d'alias inventé)", () => {
    expect(nomPour("GUADELOUPE")).toBe("GUADELOUPE");
  });
});
