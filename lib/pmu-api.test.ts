import { describe, it, expect } from "vitest";
import { normalizePmuReunions, type PmuReunion } from "./pmu-api";
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
