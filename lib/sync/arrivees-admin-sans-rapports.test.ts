/**
 * Formulaire manuel de /admin/arrivees : « Pré-remplir Geny »
 * (POST /api/admin/arrivees/prefill-from-geny) puis « Enregistrer »
 * (POST /api/admin/arrivees).
 *
 * Audit du 09/10/2026 : les rapports lus sur Geny étaient faux. Décision de
 * Steph (09/10/2026) : dans ce formulaire, les rapports sont en LECTURE SEULE.
 * Ils viennent du seul PMU (runPmuRapportsSync), qui n'écrit que dans un
 * `rapports_pmu` vide. Donc :
 *   - le pré-remplissage ne renvoie plus de rapports Geny ;
 *   - l'enregistrement n'écrit jamais `rapports_pmu` (clé ABSENTE : ni rapport
 *     Geny, ni remise à vide d'un rapport PMU arrivé après l'ouverture de la
 *     page), ni les colonnes legacy `rapport_quinte/quarte/tierce`.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const etat = vi.hoisted(() => ({
  upserts: [] as Record<string, unknown>[],
}));

const COURSE = {
  id:                "c-quinte",
  geny_url:          "/partants-pmu/2026-06-01-test_c1663299",
  statut:            "TERMINE",
  date_course:       "2026-06-01",
  heure_depart:      "15:15:00",
  numero_reunion:    1,
  numero_course:     3,
  paris_disponibles: ["QUINTE_PLUS", "QUARTE_PLUS", "TIERCE"],
  partants:          null,
};

function requete(table: string) {
  const resultat = () => (table === "courses" ? { data: COURSE, error: null } : { data: null, error: null });
  const chaine: any = {
    select: () => chaine,
    eq:     () => chaine,
    update: () => chaine,
    single: () => Promise.resolve(resultat()),
    upsert: (lignes: Record<string, unknown> | Record<string, unknown>[]) => {
      etat.upserts.push(...(Array.isArray(lignes) ? lignes : [lignes]));
      return Promise.resolve({ error: null });
    },
    then: (ok: any, ko: any) => Promise.resolve({ data: null, error: null }).then(ok, ko),
  };
  return chaine;
}

vi.mock("@/lib/auth/checkAdminAuth", () => ({ requireAdminAuth: async () => null }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: (table: string) => requete(table) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { POST as enregistrer } from "../../app/api/admin/arrivees/route";
import { POST as preRemplir } from "../../app/api/admin/arrivees/prefill-from-geny/route";
import { parseRapportsPMU } from "./geny-rapports-parser";

// Vraie page Geny d'un Quinté+ : elle CONTIENT des rapports (Quinté+, Tiercé…).
const PAGE_GENY = readFileSync(
  fileURLToPath(new URL("./__fixtures__/geny-quinte-1663299.html", import.meta.url)),
  "utf8",
);

function requeteJson(chemin: string, corps: unknown) {
  return new NextRequest(`http://localhost${chemin}`, {
    method:  "POST",
    headers: { "content-type": "application/json" },
    body:    JSON.stringify(corps),
  });
}

describe("« Pré-remplir Geny » (prefill-from-geny)", () => {
  beforeEach(() => vi.stubGlobal("fetch", async () => new Response(PAGE_GENY, { status: 200 })));
  afterEach(() => vi.unstubAllGlobals());

  it("renvoie l'arrivée et le commentaire lus sur Geny", async () => {
    const res = await preRemplir(requeteJson("/api/admin/arrivees/prefill-from-geny", { course_id: COURSE.id }));
    const corps = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(corps.arrivee)).toBe(true);
    expect(corps.arrivee.length).toBeGreaterThanOrEqual(3);
    expect("commentaire" in corps).toBe(true);
  });

  it("ne renvoie aucun rapport, même quand la page Geny en affiche", async () => {
    expect(parseRapportsPMU(PAGE_GENY).quinte_plus).toBeDefined(); // précondition
    const res = await preRemplir(requeteJson("/api/admin/arrivees/prefill-from-geny", { course_id: COURSE.id }));
    const corps = await res.json();
    expect("rapports" in corps).toBe(false);
  });
});

describe("« Enregistrer » (POST /api/admin/arrivees)", () => {
  beforeEach(() => { etat.upserts = []; });

  it("écrit l'arrivée et le commentaire saisis", async () => {
    const res = await enregistrer(requeteJson("/api/admin/arrivees", {
      course_id:     COURSE.id,
      ordre_arrivee: [4, 9, 12, 7, 1],
      commentaire:   "  Course menée de bout en bout.  ",
    }));
    expect(res.status).toBe(200);
    expect(etat.upserts).toHaveLength(1);
    const [ligne] = etat.upserts;
    expect(ligne.course_id).toBe(COURSE.id);
    expect(ligne.ordre_arrivee).toEqual([4, 9, 12, 7, 1]);
    expect(ligne.commentaire).toBe("Course menée de bout en bout.");
  });

  it("n'écrit aucun rapport, même si la requête en contient", async () => {
    await enregistrer(requeteJson("/api/admin/arrivees", {
      course_id:     COURSE.id,
      ordre_arrivee: [4, 9, 12, 7, 1],
      rapports_pmu:  { quinte_plus: { ordre: 12345.6 }, tierce: { ordre: 321 } },
    }));
    const [ligne] = etat.upserts;
    expect("rapports_pmu" in ligne).toBe(false);
    expect("rapport_quinte" in ligne).toBe(false);
    expect("rapport_quarte" in ligne).toBe(false);
    expect("rapport_tierce" in ligne).toBe(false);
  });

  it("ne remet pas à vide un rapport PMU écrit après l'ouverture de la page", async () => {
    // Page ouverte avant la synchro PMU : l'ancien formulaire renvoyait `rapports_pmu: null`.
    await enregistrer(requeteJson("/api/admin/arrivees", {
      course_id:     COURSE.id,
      ordre_arrivee: [4, 9, 12, 7, 1],
      rapports_pmu:  null,
    }));
    const [ligne] = etat.upserts;
    expect("rapports_pmu" in ligne).toBe(false);
  });
});
