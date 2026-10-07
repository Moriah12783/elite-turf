/**
 * Garde-fou des routes /api/admin/* (audit du 07/10/2026).
 *
 * Le middleware ne protège que les PAGES /admin, pas /api/admin : chaque route
 * doit vérifier elle-même son appelant (`requireAdminAuth`, `requireBearerOnly`
 * ou un contrôle équivalent). Treize fichiers ne le faisaient pas : écriture
 * d'arrivées, suppression de courses, remplacement de partants, e-mails…
 *
 * Ce test appelle CHAQUE handler de app/api/admin/**\/route.ts, découvert
 * automatiquement (une nouvelle route est couverte d'office), d'abord comme un
 * inconnu, puis comme un membre connecté qui n'est pas admin. Attendu : un refus
 * (401/403, ou redirection pour les formulaires) SANS lecture ni écriture en
 * base, appel réseau, e-mail ni revalidation.
 *
 * Base, réseau et e-mail sont remplacés par des doublures qui notent chaque
 * accès. Seule la lecture du rôle de l'appelant (profiles, id = lui-même) est
 * permise : c'est le contrôle lui-même.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const etat = vi.hoisted(() => {
  // Lu au chargement de lib/auth/checkAdminAuth.ts : à fixer avant tout import.
  process.env.CRON_SECRET = "secret-cron-de-test";
  return {
    secret:      "secret-cron-de-test",
    utilisateur: null as { id: string; email: string } | null,
    role:        "USER",
    acces:       [] as string[], // lectures/écritures en base hors contrôle du rôle
    effets:      [] as string[], // réseau, e-mail, revalidation
  };
});

const ECRITURES = new Set(["insert", "update", "upsert", "delete"]);

// Requête Supabase factice : chaînable comme la vraie, résolue au `await`.
// Une seule lecture permise : le rôle de l'appelant (profiles, id = lui-même).
function requete(client: string, table: string) {
  const methodes: string[] = [];
  let surSonProfil = false;
  const executer = () => {
    const controleDuRole = table === "profiles" && surSonProfil
      && !methodes.some((m) => ECRITURES.has(m));
    if (controleDuRole) {
      return { data: { id: etat.utilisateur?.id, role: etat.role }, error: null };
    }
    etat.acces.push(`${client} → ${table} (${methodes.join(".")})`);
    return { data: null, error: { message: `accès à ${table} interdit dans ce test` } };
  };
  const chaine: any = new Proxy(function () {}, {
    get(_cible, prop) {
      if (prop === "then") {
        return (ok: any, ko: any) => Promise.resolve(executer()).then(ok, ko);
      }
      return (...args: unknown[]) => {
        methodes.push(String(prop));
        if (prop === "eq" && args[0] === "id" && etat.utilisateur && args[1] === etat.utilisateur.id) {
          surSonProfil = true;
        }
        return chaine;
      };
    },
  });
  return chaine;
}

// Client Supabase factice : `from` → requête factice ; tout le reste
// (auth.admin, rpc, storage…) est noté comme un accès.
function client(nom: string) {
  const interdit = (cible: string): any => new Proxy(function () {}, {
    get: (_c, prop) => (prop === "then" ? undefined : interdit(`${cible}.${String(prop)}`)),
    apply: () => {
      etat.acces.push(`${nom} → ${cible}()`);
      return Promise.resolve({ data: null, error: { message: `${cible} interdit dans ce test` } });
    },
  });
  return new Proxy({} as any, {
    get(_c, prop) {
      if (prop === "from") return (table: string) => requete(nom, table);
      if (prop === "auth") {
        return new Proxy({} as any, {
          get(_a, methode) {
            if (methode === "getUser") {
              return async () => (etat.utilisateur
                ? { data: { user: etat.utilisateur }, error: null }
                : { data: { user: null }, error: { name: "AuthSessionMissingError", message: "Auth session missing!", status: 400 } });
            }
            return interdit(`auth.${String(methode)}`);
          },
        });
      }
      if (prop === "then") return undefined;
      return interdit(String(prop));
    },
  });
}

vi.mock("@/lib/supabase/server", () => ({
  createClient:        async () => client("session"),
  createServiceClient: () => client("service"),
}));
vi.mock("@/lib/supabase/service-client", () => ({
  createServiceClient: () => client("service"),
}));
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidatePath: (chemin: string) => { etat.effets.push(`revalidatePath ${chemin}`); },
  revalidateTag:  (tag: string) => { etat.effets.push(`revalidateTag ${tag}`); },
}));
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendEmail:         async () => { etat.effets.push("sendEmail"); return false; },
  sendEmailDetailed: async () => { etat.effets.push("sendEmailDetailed"); return { ok: false }; },
  sendEmailBatch:    async () => { etat.effets.push("sendEmailBatch"); return { sent: 0, failed: 0, errors: [] }; },
}));

// ── Toutes les routes, découvertes sur le disque ───────────────────────────
const modules = import.meta.glob("../../app/api/admin/**/route.ts", { eager: true }) as Record<string, Record<string, unknown>>;

const METHODES = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type Methode = (typeof METHODES)[number];
type Handler = (req: NextRequest, ctx: { params: Record<string, string> }) => Promise<Response>;

const ID = "00000000-0000-4000-8000-000000000000";

function cheminApi(fichier: string): string {
  return fichier.replace("../../app", "").replace(/\/route\.ts$/, "");
}

const HANDLERS: Array<{ chemin: string; methode: Methode; handler: Handler }> = Object.entries(modules)
  .flatMap(([fichier, mod]) => METHODES
    .filter((m) => typeof mod[m] === "function")
    .map((methode) => ({ chemin: cheminApi(fichier), methode, handler: mod[methode] as Handler })))
  .sort((a, b) => `${a.chemin} ${a.methode}`.localeCompare(`${b.chemin} ${b.methode}`));

async function appeler(chemin: string, methode: Methode, entetes: Record<string, string>) {
  const trouve = HANDLERS.find((h) => h.chemin === chemin && h.methode === methode);
  if (!trouve) throw new Error(`handler introuvable : ${methode} ${chemin}`);
  const url = `http://localhost${chemin.replace(/\[[^\]]+\]/g, ID)}`;
  const avecCorps = methode !== "GET" && methode !== "DELETE";
  const req = new NextRequest(url, {
    method:  methode,
    headers: { ...(avecCorps ? { "content-type": "application/json" } : {}), ...entetes },
    body:    avecCorps ? "{}" : undefined,
  });
  return trouve.handler(req, { params: { id: ID, courseId: ID } });
}

beforeEach(() => {
  etat.utilisateur = null;
  etat.role = "USER";
  etat.acces.length = 0;
  etat.effets.length = 0;
  vi.stubGlobal("fetch", async (url: unknown) => {
    etat.effets.push(`fetch ${String(url)}`);
    throw new Error("réseau interdit dans ce test");
  });
  // Les routes journalisent leurs erreurs : sans intérêt ici.
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const REFUS = [401, 403, 302, 303, 307, 308];

describe("routes /api/admin : un appelant non autorisé est refusé avant toute lecture ou écriture", () => {
  it("les routes sont bien découvertes (sinon ce test ne vérifierait rien)", () => {
    expect(HANDLERS.length).toBeGreaterThan(60);
    expect(HANDLERS.map((h) => `${h.methode} ${h.chemin}`)).toContain("DELETE /api/admin/courses/[id]");
  });

  describe.each([
    {
      appelant: "un inconnu (Bearer erroné)",
      preparer: () => { etat.utilisateur = null; },
      entetes:  { authorization: "Bearer mauvais-secret" },
    },
    {
      appelant: "un membre connecté qui n'est pas admin",
      preparer: () => { etat.utilisateur = { id: "membre-1", email: "membre@example.test" }; etat.role = "USER"; },
      entetes:  {},
    },
  ])("$appelant", ({ preparer, entetes }) => {
    it.each(HANDLERS.map((h) => [`${h.methode} ${h.chemin}`, h.chemin, h.methode] as const))(
      "%s",
      async (_nom, chemin, methode) => {
        preparer();
        const reponse = await appeler(chemin, methode, entetes);
        expect(etat.acces, "lecture ou écriture en base sans contrôle d'accès").toEqual([]);
        expect(etat.effets, "réseau, e-mail ou revalidation sans contrôle d'accès").toEqual([]);
        expect(REFUS, `statut ${reponse.status} : la route n'a pas refusé l'appel`).toContain(reponse.status);
      },
    );
  });
});

describe("routes /api/admin : les appelants légitimes passent toujours le contrôle", () => {
  // cron-worker/src/index.ts (CRON_MAP) : GET + « Authorization: Bearer CRON_SECRET ».
  it.each([
    "/api/admin/sync-resultats",
    "/api/admin/rapport-journalier",
    "/api/admin/backfill-rapport-gagnant",
  ])("le cron-worker (GET, Bearer CRON_SECRET) : %s", async (chemin) => {
    const reponse = await appeler(chemin, "GET", { authorization: `Bearer ${etat.secret}` });
    expect([401, 403], `statut ${reponse.status} : le cron-worker serait refusé`).not.toContain(reponse.status);
  });

  // Pages /admin : fetch du navigateur, cookies de session (routes corrigées le 07/10/2026).
  it.each([
    ["POST", "/api/admin/arrivees"],
    ["DELETE", "/api/admin/arrivees"],
    ["POST", "/api/admin/arrivees/prefill-from-geny"],
    ["POST", "/api/admin/arrivees/batch-prefill-from-geny"],
    ["PATCH", "/api/admin/courses/[id]"],
    ["DELETE", "/api/admin/courses/[id]"],
    ["POST", "/api/admin/courses/[id]/enrichir"],
    ["PUT", "/api/admin/partants/[courseId]"],
    ["POST", "/api/admin/partants/[courseId]/prefill-from-geny"],
    ["POST", "/api/admin/partants/batch-prefill"],
    ["POST", "/api/admin/backfill-resultats"],
    ["GET", "/api/admin/cron-status"],
    ["PATCH", "/api/admin/pronostics/[id]/publie"],
  ] as Array<[Methode, string]>)("l'admin connecté (session) : %s %s", async (methode, chemin) => {
    etat.utilisateur = { id: "admin-1", email: "admin@example.test" };
    etat.role = "ADMIN";
    const reponse = await appeler(chemin, methode, {});
    expect([401, 403], `statut ${reponse.status} : l'admin serait refusé`).not.toContain(reponse.status);
  });
});
