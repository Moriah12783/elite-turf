/**
 * Bouton « 🪄 Tout pré-remplir & publier » de /admin/arrivees
 * (POST /api/admin/arrivees/batch-prefill-from-geny).
 *
 * Audit du 09/10/2026 : les rapports lus sur Geny étaient faux (Tiercé et
 * Quinté+ sur des courses qui n'en ont pas, montants d'un autre opérateur).
 * Comme la synchro horaire (ligneArrivee, lib/sync/geny-arrivees.ts), le
 * pré-remplissage garde l'arrivée et le commentaire, et n'écrit AUCUN rapport :
 * ils viennent du seul PMU (runPmuRapportsSync), qui n'écrit que dans un
 * `rapports_pmu` vide. Un rapport Geny écrit ici bloquerait donc le PMU pour
 * toujours.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const etat = vi.hoisted(() => ({
  upserts: [] as Record<string, unknown>[],
}));

// Course Quinté+ passée, sans arrivée : éligible au pré-remplissage.
const COURSE = {
  id:                "c-quinte",
  numero_reunion:    1,
  numero_course:     3,
  libelle:           "Prix de test",
  heure_depart:      "15:15:00",
  geny_url:          "/partants-pmu/2026-06-01-test_c1663299",
  paris_disponibles: ["QUINTE_PLUS", "QUARTE_PLUS", "TIERCE"],
  partants:          null,
};

function requete(table: string) {
  const chaine: any = {
    select: () => chaine,
    eq:     () => chaine,
    is:     () => chaine,
    not:    () => chaine,
    upsert: (lignes: Record<string, unknown> | Record<string, unknown>[]) => {
      etat.upserts.push(...(Array.isArray(lignes) ? lignes : [lignes]));
      return Promise.resolve({ error: null });
    },
    then: (ok: any, ko: any) =>
      Promise.resolve(table === "courses" ? { data: [COURSE], error: null } : { data: null, error: null })
        .then(ok, ko),
  };
  return chaine;
}

vi.mock("@/lib/auth/checkAdminAuth", () => ({ requireAdminAuth: async () => null }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: (table: string) => requete(table) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { POST } from "../../app/api/admin/arrivees/batch-prefill-from-geny/route";
import { parseRapportsPMU } from "./geny-rapports-parser";

// Vraie page Geny d'un Quinté+ : elle CONTIENT des rapports (Quinté+, Tiercé…).
const PAGE_GENY = readFileSync(
  fileURLToPath(new URL("./__fixtures__/geny-quinte-1663299.html", import.meta.url)),
  "utf8",
);

async function preRemplir() {
  const req = new NextRequest("http://localhost/api/admin/arrivees/batch-prefill-from-geny", {
    method:  "POST",
    headers: { "content-type": "application/json" },
    body:    JSON.stringify({ date: "2026-06-01" }),
  });
  const res = await POST(req);
  return res.json();
}

describe("batch-prefill-from-geny — ce que le bouton écrit dans `arrivees`", () => {
  beforeEach(() => {
    etat.upserts = [];
    vi.stubGlobal("fetch", async () => new Response(PAGE_GENY, { status: 200 }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("publie l'arrivée et le commentaire lus sur Geny", async () => {
    const reponse = await preRemplir();
    expect(reponse.succeeded).toBe(1);
    expect(etat.upserts).toHaveLength(1);
    const [ligne] = etat.upserts;
    expect(ligne.course_id).toBe("c-quinte");
    expect(Array.isArray(ligne.ordre_arrivee)).toBe(true);
    expect((ligne.ordre_arrivee as number[]).length).toBeGreaterThanOrEqual(3);
    expect("commentaire" in ligne).toBe(true);
  });

  it("n'écrit aucun rapport, même quand la page Geny en affiche", async () => {
    expect(parseRapportsPMU(PAGE_GENY).quinte_plus).toBeDefined(); // précondition
    await preRemplir();
    const [ligne] = etat.upserts;
    expect("rapports_pmu" in ligne).toBe(false);
    expect("rapport_quinte" in ligne).toBe(false);
    expect("rapport_quarte" in ligne).toBe(false);
    expect("rapport_tierce" in ligne).toBe(false);
  });
});
