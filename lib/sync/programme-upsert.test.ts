import { describe, it, expect } from "vitest";
import {
  upsertProgrammeCourses,
  type ProgrammeCourse,
  type ProgrammeUpsertClient,
} from "./programme-upsert";

/**
 * Écriture du programme (hippodromes + courses), partagée par les voies PMU.fr,
 * LONACI et GenyBet.
 *
 * ⚠️ Ce qui est testé ici est la REMONTÉE DES ÉCHECS, pas le calcul : historiquement
 * le `{ error }` de supabase-js n'était jamais lu, donc un INSERT refusé (NOT NULL,
 * overflow numérique, RLS…) renvoyait quand même `inserted: N`. Ce faux succès
 * empêchait la chaîne de secours Geny → PMU → LONACI → GenyBet de basculer sur la
 * source suivante : le programme du jour restait vide sans que personne ne le sache.
 *
 * Le client Supabase est injecté (`opts.client`) pour exercer le VRAI
 * `upsertProgrammeCourses` — câblage compris — sans base de données.
 */

// ── Double de test : sous-ensemble de l'API supabase-js réellement appelé ────

interface FakeResponse {
  data?:  unknown[] | null;
  error?: { message: string } | null;
  count?: number | null;
}

interface FakeConfig {
  /** Réponse du SELECT des hippodromes existants. */
  hippodromesSelect?: FakeResponse;
  /** Réponse de l'INSERT des hippodromes manquants (+ .select()). */
  hippodromesInsert?: FakeResponse;
  /** Réponse du SELECT des courses déjà en base. */
  coursesSelect?:     FakeResponse;
  /** Réponse de l'INSERT des nouvelles courses. */
  coursesInsert?:     FakeResponse;
  /** Réponse de l'UPSERT des courses existantes. */
  coursesUpsert?:     FakeResponse;
}

/** Trace des opérations réellement tentées, pour vérifier qu'on s'arrête net. */
type CallLog = string[];

function fakeSupabase(cfg: FakeConfig): { client: ProgrammeUpsertClient; calls: CallLog } {
  const calls: CallLog = [];
  const ok: FakeResponse = { data: [], error: null, count: 0 };

  // Un « thenable » : `await` le résout, et il expose aussi les méthodes de
  // chaînage (.in / .select) comme le query builder de supabase-js.
  function chainable(resp: FakeResponse, extra: Record<string, unknown> = {}) {
    const builder: Record<string, unknown> = {
      in:   () => builder,
      then: (onOk: (r: FakeResponse) => unknown, onErr?: (e: unknown) => unknown) =>
        Promise.resolve(resp).then(onOk, onErr),
      ...extra,
    };
    return builder;
  }

  const client = {
    from(table: string) {
      return {
        select: (_columns: string) => {
          calls.push(`${table}.select`);
          return chainable(table === "hippodromes"
            ? cfg.hippodromesSelect ?? ok
            : cfg.coursesSelect ?? ok);
        },
        insert: (rows: unknown[], _options?: { count?: "exact" }) => {
          calls.push(`${table}.insert(${rows.length})`);
          const resp = table === "hippodromes"
            ? cfg.hippodromesInsert ?? ok
            : cfg.coursesInsert ?? ok;
          // `.insert(...).select(...)` (hippodromes) ou `await .insert(...)` (courses).
          return chainable(resp, { select: (_c: string) => Promise.resolve(resp) });
        },
        upsert: (rows: unknown[], _options?: { count?: "exact" }) => {
          calls.push(`${table}.upsert(${rows.length})`);
          return chainable(cfg.coursesUpsert ?? ok);
        },
      };
    },
  };

  return { client: client as unknown as ProgrammeUpsertClient, calls };
}

// ── Données ─────────────────────────────────────────────────────────────────

function course(over: Partial<ProgrammeCourse> = {}): ProgrammeCourse {
  return {
    hippodromeName:   "Vincennes",
    hippodromePays:   "France",
    dateCourse:       "2026-07-25",
    heureDepart:      "13:50:00",
    numeroReunion:    1,
    numeroCourse:     1,
    libelle:          "Prix de Test",
    distanceMetres:   2700,
    categorie:        "TROT",
    nbPartants:       14,
    parisDisponibles: ["QUINTE_PLUS"],
    ...over,
  };
}

const VINCENNES = { id: "hip-vincennes", nom: "Vincennes", pays: "France" };

/** Course déjà en base, telle que la renvoie le SELECT de `courses`. */
function dbCourse(numeroCourse: number, id: string) {
  return {
    id,
    hippodrome_id:  VINCENNES.id,
    date_course:    "2026-07-25",
    numero_reunion: 1,
    numero_course:  numeroCourse,
  };
}

describe("upsertProgrammeCourses — remontée des échecs d'écriture", () => {
  it("propage l'erreur de l'INSERT des courses au lieu de renvoyer un faux succès", async () => {
    const { client } = fakeSupabase({
      hippodromesSelect: { data: [VINCENNES], error: null },
      coursesInsert: {
        error: { message: 'null value in column "numero_reunion" violates not-null constraint' },
        count: null,
      },
    });

    await expect(
      upsertProgrammeCourses([course({ numeroCourse: 1 }), course({ numeroCourse: 2 })], { client }),
    ).rejects.toThrow(/numero_reunion/);
  });

  it("n'enchaîne pas l'UPSERT quand l'INSERT a échoué (on s'arrête net)", async () => {
    const { client, calls } = fakeSupabase({
      hippodromesSelect: { data: [VINCENNES], error: null },
      coursesSelect:     { data: [dbCourse(2, "course-existante")], error: null },
      coursesInsert:     { error: { message: "numeric field overflow" }, count: null },
    });

    await expect(
      upsertProgrammeCourses([course({ numeroCourse: 1 }), course({ numeroCourse: 2 })], { client }),
    ).rejects.toThrow(/numeric field overflow/);
    expect(calls).not.toContain("courses.upsert(1)");
  });

  it("propage l'erreur de l'UPSERT des courses existantes", async () => {
    const { client } = fakeSupabase({
      hippodromesSelect: { data: [VINCENNES], error: null },
      coursesSelect:     { data: [dbCourse(1, "course-existante")], error: null },
      coursesUpsert:     { error: { message: "permission denied for table courses" }, count: null },
    });

    await expect(
      upsertProgrammeCourses([course({ numeroCourse: 1 })], { client }),
    ).rejects.toThrow(/permission denied/);
  });

  it("propage l'erreur de l'INSERT des hippodromes (sinon les courses sont ignorées en silence)", async () => {
    // Hippodrome absent de la base → INSERT refusé. Sans remontée, hipMap reste
    // vide, toutes les courses sont `continue`-ées et la fonction renvoie
    // `inserted: 0` sans erreur : un faux succès de plus.
    const { client } = fakeSupabase({
      hippodromesSelect: { data: [], error: null },
      hippodromesInsert: { data: null, error: { message: "duplicate key value violates unique constraint" } },
    });

    await expect(
      upsertProgrammeCourses([course()], { client }),
    ).rejects.toThrow(/duplicate key/);
  });

  it("propage l'erreur du SELECT des hippodromes (sinon on recrée des doublons)", async () => {
    const { client } = fakeSupabase({
      hippodromesSelect: { data: null, error: { message: "canceling statement due to statement timeout" } },
    });

    await expect(
      upsertProgrammeCourses([course()], { client }),
    ).rejects.toThrow(/statement timeout/);
  });

  it("propage l'erreur du SELECT des courses existantes (sinon on ré-insère des doublons)", async () => {
    // Un SELECT KO renvoie `data: null` → aucune course connue → tout repart en
    // INSERT, y compris les courses déjà présentes.
    const { client, calls } = fakeSupabase({
      hippodromesSelect: { data: [VINCENNES], error: null },
      coursesSelect:     { data: null, error: { message: "connection reset by peer" } },
    });

    await expect(
      upsertProgrammeCourses([course()], { client }),
    ).rejects.toThrow(/connection reset/);
    expect(calls).not.toContain("courses.insert(1)");
  });
});

describe("upsertProgrammeCourses — comptage fidèle", () => {
  it("compte les lignes réellement écrites (count Supabase), pas celles envoyées", async () => {
    // Anti-fabrication : le rapport reflète ce que la base confirme. Si elle
    // annonce 1 ligne insérée pour 2 envoyées, on rapporte 1 — jamais 2.
    const { client } = fakeSupabase({
      hippodromesSelect: { data: [VINCENNES], error: null },
      coursesSelect:     { data: [dbCourse(3, "course-existante")], error: null },
      coursesInsert:     { error: null, count: 1 },
      coursesUpsert:     { error: null, count: 1 },
    });

    const r = await upsertProgrammeCourses(
      [course({ numeroCourse: 1 }), course({ numeroCourse: 2 }), course({ numeroCourse: 3 })],
      { client },
    );

    expect(r.inserted).toBe(1);
    expect(r.updated).toBe(1);
  });

  it("écriture réussie sans count renvoyé → compte les lignes envoyées", async () => {
    // PostgreSQL est atomique sur un INSERT bulk : sans erreur, les lignes sont
    // écrites. Absence de `count` = en-tête manquant, pas un échec silencieux.
    const { client } = fakeSupabase({
      hippodromesSelect: { data: [VINCENNES], error: null },
      coursesInsert:     { error: null, count: null },
    });

    const r = await upsertProgrammeCourses(
      [course({ numeroCourse: 1 }), course({ numeroCourse: 2 })],
      { client },
    );

    expect(r.inserted).toBe(2);
    expect(r.updated).toBe(0);
  });

  it("cas nominal : nouvelles insérées, existantes mises à jour, hippodromes comptés", async () => {
    const { client, calls } = fakeSupabase({
      hippodromesSelect: { data: [VINCENNES], error: null },
      coursesSelect:     { data: [dbCourse(2, "course-existante")], error: null },
      coursesInsert:     { error: null, count: 1 },
      coursesUpsert:     { error: null, count: 1 },
    });

    const r = await upsertProgrammeCourses(
      [course({ numeroCourse: 1 }), course({ numeroCourse: 2 })],
      { client },
    );

    expect(r).toEqual({ inserted: 1, updated: 1, hippodromes: 1 });
    expect(calls).toContain("courses.insert(1)");
    expect(calls).toContain("courses.upsert(1)");
  });

  it("liste vide → aucun appel à la base", async () => {
    const { client, calls } = fakeSupabase({});
    const r = await upsertProgrammeCourses([], { client });
    expect(r).toEqual({ inserted: 0, updated: 0, hippodromes: 0 });
    expect(calls).toEqual([]);
  });
});
