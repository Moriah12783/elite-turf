# LONACI Enrichissement & Dédoublonnage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre `runLonaciSync` enrichisseur (jamais créateur) : marquer les courses Geny existantes `jouable_afrique` + `nationale` via un rapprochement canonique, éliminant tout doublon par construction.

**Architecture:** Un util pur de normalisation canonique des noms d'hippodromes + une fonction pure de calcul des verdicts (testés en isolation), orchestrés par `runLonaciSync` qui ne fait plus que des UPDATE bulk groupés. Le badge public lit l'autoritaire avec fallback heuristique.

**Tech Stack:** TypeScript, Next.js 14, Supabase (`@supabase/supabase-js`), Vitest (nouveau, pour les fonctions pures).

Spec : `docs/superpowers/specs/2026-05-31-lonaci-enrichissement-dedup-design.md`

---

## Task 1 : Setup Vitest (fonctions pures uniquement)

**Files:**
- Modify: `package.json` (devDependency + script `test`)
- Create: `vitest.config.ts`
- Create: `lib/sync/__smoke__.test.ts` (temporaire, supprimé en fin de tâche)

- [ ] **Step 1: Installer vitest**

Run: `npm i -D vitest@^2`
Expected: ajout dans devDependencies, exit 0.

- [ ] **Step 2: Créer `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": new URL("./", import.meta.url).pathname },
  },
});
```

- [ ] **Step 3: Ajouter le script test**

Dans `package.json`, section `scripts`, ajouter : `"test": "vitest run"`.

- [ ] **Step 4: Smoke test**

Create `lib/sync/__smoke__.test.ts` :
```ts
import { describe, it, expect } from "vitest";
describe("smoke", () => { it("works", () => { expect(1 + 1).toBe(2); }); });
```
Run: `npm test`
Expected: 1 passed.

- [ ] **Step 5: Supprimer le smoke test puis commit**

```bash
rm lib/sync/__smoke__.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore(test): setup vitest pour les fonctions pures"
```

---

## Task 2 : Matcher canonique d'hippodrome (TDD)

**Files:**
- Create: `lib/sync/hippodrome-canonical.ts`
- Test: `lib/sync/hippodrome-canonical.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

`lib/sync/hippodrome-canonical.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { canonicalHippodrome } from "./hippodrome-canonical";

describe("canonicalHippodrome", () => {
  it("rapproche les variantes casse/tirets/espaces", () => {
    expect(canonicalHippodrome("SAINT-CLOUD")).toBe("saintcloud");
    expect(canonicalHippodrome("Saint-Cloud")).toBe("saintcloud");
    expect(canonicalHippodrome("La Teste De Buch")).toBe("latestedebuch");
    expect(canonicalHippodrome("La Teste-de-Buch")).toBe("latestedebuch");
  });
  it("retire les accents (LONACI sans accents = Geny avec accents)", () => {
    expect(canonicalHippodrome("Châteaubriant")).toBe("chateaubriant");
    expect(canonicalHippodrome("CHATEAUBRIANT")).toBe("chateaubriant");
    expect(canonicalHippodrome("Compiègne")).toBe("compiegne");
  });
  it("décode les entités HTML (apostrophe)", () => {
    expect(canonicalHippodrome("Le Lion D'angers")).toBe("leliondangers");
    expect(canonicalHippodrome("Le Lion-d&#039;Angers")).toBe("leliondangers");
  });
  it("renvoie vide pour entrée vide", () => {
    expect(canonicalHippodrome("")).toBe("");
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npm test -- hippodrome-canonical`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

`lib/sync/hippodrome-canonical.ts` :
```ts
/**
 * Clé canonique d'un nom d'hippodrome, robuste aux variations de source
 * (accents, casse, tirets/espaces, entités HTML). Sert à rapprocher un
 * hippodrome LONACI d'un hippodrome Geny EXISTANT — sans jamais en créer.
 *
 *   "SAINT-CLOUD" = "Saint-Cloud"        → "saintcloud"
 *   "La Teste De Buch" = "La Teste-de-Buch" → "latestedebuch"
 *   "Châteaubriant" = "CHATEAUBRIANT"     → "chateaubriant"
 *   "Le Lion-d&#039;Angers"               → "leliondangers"
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&#0*39;/g, "'")
    .replace(/&#0*34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

export function canonicalHippodrome(name: string): string {
  return decodeEntities(name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
```

- [ ] **Step 4: Lancer → succès**

Run: `npm test -- hippodrome-canonical`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/sync/hippodrome-canonical.ts lib/sync/hippodrome-canonical.test.ts
git commit -m "feat(sync): matcher canonique d'hippodrome (anti-accents/format)"
```

---

## Task 3 : Logique de verdict d'enrichissement (pure, TDD)

**Files:**
- Create: `lib/sync/lonaci-enrich.ts`
- Test: `lib/sync/lonaci-enrich.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

`lib/sync/lonaci-enrich.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { computeLonaciEnrichment } from "./lonaci-enrich";

const GENY = [
  { id: "c1", hippodrome_id: "h1", numero_reunion: 1, numero_course: 1 },
  { id: "c2", hippodrome_id: "h1", numero_reunion: 1, numero_course: 2 },
  { id: "c3", hippodrome_id: "h2", numero_reunion: 2, numero_course: 1 },
];
const CANON = new Map<string, string>([
  ["vincennes", "h1"],
  ["saintcloud", "h2"],
]);

describe("computeLonaciEnrichment", () => {
  it("marque jouable + nationale les courses rapprochées", () => {
    const r = computeLonaciEnrichment(
      {
        date: "2026-05-31",
        lonaciCourses: [
          { hippodrome: "VINCENNES", nReunion: 1, numeroCourse: 1, nationale: 1 },
          { hippodrome: "Saint-Cloud", nReunion: 2, numeroCourse: 1, nationale: 0 },
        ],
        genyCourses: GENY,
        hippoCanonMap: CANON,
      },
      { guardMinReunions: 99, guardMinCoverage: 1 } // garde-fou désactivé (jamais complet)
    );
    expect(r.updates).toContainEqual({ id: "c1", jouable_afrique: true, nationale: 1 });
    expect(r.updates).toContainEqual({ id: "c3", jouable_afrique: true, nationale: null });
    // c2 non rapprochée et garde-fou non atteint → pas de verdict false
    expect(r.updates.find((u) => u.id === "c2")).toBeUndefined();
    expect(r.report.matched).toBe(2);
  });

  it("corrige (false) les courses non rapprochées si programme complet", () => {
    const r = computeLonaciEnrichment(
      {
        date: "2026-05-31",
        lonaciCourses: [
          { hippodrome: "VINCENNES", nReunion: 1, numeroCourse: 1, nationale: 1 },
          { hippodrome: "VINCENNES", nReunion: 1, numeroCourse: 2, nationale: 0 },
          { hippodrome: "SAINT-CLOUD", nReunion: 2, numeroCourse: 1, nationale: 0 },
        ],
        genyCourses: GENY,
        hippoCanonMap: CANON,
      },
      { guardMinReunions: 2, guardMinCoverage: 0.5 } // atteint → complet
    );
    // toutes rapprochées → aucune correction false, 3 updates true
    expect(r.updates.every((u) => u.jouable_afrique === true)).toBe(true);
    expect(r.report.corrected_false).toBe(0);
  });

  it("compte les hippodromes non rapprochés sans rien créer", () => {
    const r = computeLonaciEnrichment(
      {
        date: "2026-05-31",
        lonaciCourses: [{ hippodrome: "Dakar", nReunion: 1, numeroCourse: 1, nationale: 0 }],
        genyCourses: GENY,
        hippoCanonMap: CANON,
      },
      { guardMinReunions: 99, guardMinCoverage: 1 }
    );
    expect(r.report.unmatched_hippodrome).toBe(1);
    expect(r.updates).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npm test -- lonaci-enrich`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

`lib/sync/lonaci-enrich.ts` :
```ts
import { canonicalHippodrome } from "./hippodrome-canonical";

export interface EnrichInput {
  date: string;
  lonaciCourses: Array<{
    hippodrome: string;
    nReunion: number;
    numeroCourse: number;
    nationale: number; // 0 = pas Nationale, 1/2/3 sinon
  }>;
  genyCourses: Array<{
    id: string;
    hippodrome_id: string;
    numero_reunion: number;
    numero_course: number;
  }>;
  hippoCanonMap: Map<string, string>; // canonique(nom) -> hippodrome_id (existants)
}

export interface EnrichGuard {
  guardMinReunions: number;  // ex: 3
  guardMinCoverage: number;  // ex: 0.5
}

export interface CourseUpdate {
  id: string;
  jouable_afrique: boolean;
  nationale: number | null;
}

export interface EnrichResult {
  updates: CourseUpdate[];
  report: {
    date: string;
    lonaci_total: number;
    matched: number;
    unmatched_hippodrome: number;
    unmatched_course: number;
    corrected_false: number;
    nationales: { n1: number; n2: number; n3: number };
    program_complete: boolean;
  };
}

const courseKey = (hipId: string, r: number, c: number) => `${hipId}|${r}|${c}`;

export function computeLonaciEnrichment(input: EnrichInput, guard: EnrichGuard): EnrichResult {
  const genyByKey = new Map<string, string>(); // key -> course id
  for (const g of input.genyCourses) {
    genyByKey.set(courseKey(g.hippodrome_id, g.numero_reunion, g.numero_course), g.id);
  }

  const matchedIds = new Set<string>();
  const updates: CourseUpdate[] = [];
  let unmatchedHippodrome = 0;
  let unmatchedCourse = 0;
  const nat = { n1: 0, n2: 0, n3: 0 };
  const matchedLonaciReunions = new Set<number>();

  for (const lc of input.lonaciCourses) {
    const hid = input.hippoCanonMap.get(canonicalHippodrome(lc.hippodrome));
    if (!hid) { unmatchedHippodrome++; continue; }
    const cid = genyByKey.get(courseKey(hid, lc.nReunion, lc.numeroCourse));
    if (!cid) { unmatchedCourse++; continue; }
    if (matchedIds.has(cid)) continue;
    matchedIds.add(cid);
    matchedLonaciReunions.add(lc.nReunion);
    const nationale = lc.nationale > 0 ? lc.nationale : null;
    if (nationale === 1) nat.n1++; else if (nationale === 2) nat.n2++; else if (nationale === 3) nat.n3++;
    updates.push({ id: cid, jouable_afrique: true, nationale });
  }

  // Garde-fou : le programme LONACI est-il "complet" ?
  const genyReunions = new Set(input.genyCourses.map((g) => g.numero_reunion));
  const coverage = genyReunions.size === 0 ? 0 : matchedLonaciReunions.size / genyReunions.size;
  const programComplete =
    matchedLonaciReunions.size >= guard.guardMinReunions && coverage >= guard.guardMinCoverage;

  let correctedFalse = 0;
  if (programComplete) {
    for (const g of input.genyCourses) {
      if (!matchedIds.has(g.id)) {
        updates.push({ id: g.id, jouable_afrique: false, nationale: null });
        correctedFalse++;
      }
    }
  }

  return {
    updates,
    report: {
      date: input.date,
      lonaci_total: input.lonaciCourses.length,
      matched: matchedIds.size,
      unmatched_hippodrome: unmatchedHippodrome,
      unmatched_course: unmatchedCourse,
      corrected_false: correctedFalse,
      nationales: nat,
      program_complete: programComplete,
    },
  };
}
```

- [ ] **Step 4: Lancer → succès**

Run: `npm test -- lonaci-enrich`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/sync/lonaci-enrich.ts lib/sync/lonaci-enrich.test.ts
git commit -m "feat(sync): logique pure de verdict enrichissement LONACI (+ garde-fou)"
```

---

## Task 4 : Migration BDD (2 colonnes nullable)

**Files:**
- Create: `supabase/migrations/<timestamp>_courses_jouable_afrique_nationale.sql` (suivre la convention du repo — sinon appliquer via Supabase MCP `apply_migration`)

- [ ] **Step 1: Écrire la migration**

```sql
-- Enrichissement LONACI : colonnes autoritaires "jouable Afrique" + Nationale.
-- Nullable + sans défaut → rétro-compatible (NULL = non évalué → heuristique).
alter table public.courses
  add column if not exists jouable_afrique boolean,
  add column if not exists nationale smallint;

comment on column public.courses.jouable_afrique is
  'Verdict LONACI: NULL=non évalué (fallback heuristique paris_disponibles), true/false=autoritaire';
comment on column public.courses.nationale is
  'Niveau Nationale LONACI (1/2/3), NULL sinon';
```

- [ ] **Step 2: Appliquer**

Via Supabase MCP `apply_migration` (name: `courses_jouable_afrique_nationale`, query = SQL ci-dessus), OU via le pipeline migrations du repo.

- [ ] **Step 3: Vérifier**

Via MCP `execute_sql` :
```sql
select column_name, data_type, is_nullable from information_schema.columns
where table_schema='public' and table_name='courses' and column_name in ('jouable_afrique','nationale');
```
Expected: 2 lignes, `is_nullable = YES`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): courses.jouable_afrique + courses.nationale (enrichissement LONACI)"
```

---

## Task 5 : Refactor `runLonaciSync` → enrich-only

**Files:**
- Modify: `lib/sync/lonaci.ts` (remplacer toute la section "3. Courses" insert/upsert par l'enrichissement)

- [ ] **Step 1: Réécrire `runLonaciSync`**

Remplacer le corps de `runLonaciSync` par une orchestration enrich-only. Signature et retour :
```ts
import { createServiceClient } from "@/lib/supabase/server";
import { fetchLonaciProgramme, normalizeLonaciReunions } from "@/lib/lonaci-api";
import { canonicalHippodrome } from "@/lib/sync/hippodrome-canonical";
import { computeLonaciEnrichment, type CourseUpdate } from "@/lib/sync/lonaci-enrich";

const GUARD = { guardMinReunions: 3, guardMinCoverage: 0.5 };

export interface LonaciSyncResult {
  ok: true;
  date?: string;
  dry_run: boolean;
  report: ReturnType<typeof computeLonaciEnrichment>["report"] | null;
  message?: string;
}

export async function runLonaciSync(opts: { dryRun?: boolean } = {}): Promise<LonaciSyncResult> {
  const dryRun = opts.dryRun ?? false;
  const supabase = createServiceClient();

  // 1. Récupérer + normaliser + filtrer France/Maroc (PAS de courses africaines exclusives)
  const reunions = await fetchLonaciProgramme();
  const all = normalizeLonaciReunions(reunions);
  const lonaciCourses = all.filter((c) => c.pays === "France" || c.pays === "Maroc");

  if (lonaciCourses.length === 0) {
    return { ok: true, dry_run: dryRun, report: null, message: "Aucune course LONACI France/Maroc" };
  }
  const date = lonaciCourses[0].dateCourse;

  // 2. Map canonique des hippodromes EXISTANTS (aucun INSERT)
  const { data: hips } = await supabase.from("hippodromes").select("id, nom");
  const hippoCanonMap = new Map<string, string>();
  for (const h of (hips ?? []) as Array<{ id: string; nom: string }>) {
    hippoCanonMap.set(canonicalHippodrome(h.nom), h.id);
  }

  // 3. Courses Geny existantes de la date
  const { data: gcs } = await supabase
    .from("courses")
    .select("id, hippodrome_id, numero_reunion, numero_course")
    .eq("date_course", date);
  const genyCourses = (gcs ?? []) as Array<{
    id: string; hippodrome_id: string; numero_reunion: number; numero_course: number;
  }>;

  // 4. Verdicts (fonction pure)
  const { updates, report } = computeLonaciEnrichment(
    {
      date,
      lonaciCourses: lonaciCourses.map((c) => ({
        hippodrome: c.hippodrome,
        nReunion: c.nReunion,
        numeroCourse: c.numeroCourse,
        nationale: c.nationale,
      })),
      genyCourses,
      hippoCanonMap,
    },
    GUARD,
  );

  // 5. Écriture (sauf dry-run) : UPDATE groupés par (jouable, nationale)
  if (!dryRun && updates.length > 0) {
    const groups = new Map<string, { jouable_afrique: boolean; nationale: number | null; ids: string[] }>();
    for (const u of updates) {
      const k = `${u.jouable_afrique}|${u.nationale}`;
      const g = groups.get(k) ?? { jouable_afrique: u.jouable_afrique, nationale: u.nationale, ids: [] };
      g.ids.push(u.id);
      groups.set(k, g);
    }
    for (const g of groups.values()) {
      await supabase.from("courses")
        .update({ jouable_afrique: g.jouable_afrique, nationale: g.nationale })
        .in("id", g.ids);
    }
  }

  console.log(`[LONACI Enrich] ${date} dryRun=${dryRun}`, report);
  return { ok: true, date, dry_run: dryRun, report };
}
```
Supprimer les imports/sections désormais inutiles (l'ancienne logique hippodromes/courses insert/upsert, `LonaciSyncResult.nationales`, etc.).

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: 0 erreur (corriger les consommateurs de l'ancien `LonaciSyncResult` si besoin — voir Task 8).

- [ ] **Step 3: Commit**

```bash
git add lib/sync/lonaci.ts
git commit -m "refactor(sync): runLonaciSync enrich-only (zéro INSERT, UPDATE groupés, dryRun)"
```

---

## Task 6 : Helper badge autoritaire `resolveAfrique` (TDD)

**Files:**
- Modify: `lib/pmu-api.ts` (ajouter `resolveAfrique`, garder `isJouableAfrique`/`getNationaleLabel`)
- Test: `lib/pmu-api.resolve-afrique.test.ts`

- [ ] **Step 1: Test qui échoue**

`lib/pmu-api.resolve-afrique.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { resolveAfrique } from "./pmu-api";

describe("resolveAfrique", () => {
  it("priorise l'autoritaire quand jouable_afrique est défini", () => {
    expect(resolveAfrique({ jouable_afrique: false, nationale: null, paris_disponibles: ["QUINTE_PLUS"] }))
      .toEqual({ jouable: false, nationaleLabel: null });
    expect(resolveAfrique({ jouable_afrique: true, nationale: 1, paris_disponibles: [] }))
      .toEqual({ jouable: true, nationaleLabel: "Nationale 1 — Quinté+" });
  });
  it("retombe sur l'heuristique quand jouable_afrique est NULL/absent", () => {
    expect(resolveAfrique({ jouable_afrique: null, nationale: null, paris_disponibles: ["QUINTE_PLUS"] }))
      .toEqual({ jouable: true, nationaleLabel: "Nationale 1 — Quinté+" });
    expect(resolveAfrique({ paris_disponibles: ["SIMPLE_GAGNANT"] }))
      .toEqual({ jouable: false, nationaleLabel: null });
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npm test -- resolve-afrique`
Expected: FAIL (`resolveAfrique` n'existe pas).

- [ ] **Step 3: Implémenter dans `lib/pmu-api.ts`** (après `getNationaleLabel`)

```ts
const NATIONALE_LABELS: Record<number, string> = {
  1: "Nationale 1 — Quinté+",
  2: "Nationale 2 — Quarté+",
  3: "Nationale 3 — Tiercé",
};

/**
 * Verdict "jouable Afrique" + label Nationale pour une course.
 * Priorise l'autoritaire LONACI (colonnes), sinon retombe sur l'heuristique
 * dérivée des paris disponibles. NULL = non évalué → heuristique.
 */
export function resolveAfrique(course: {
  jouable_afrique?: boolean | null;
  nationale?: number | null;
  paris_disponibles?: string[] | null;
}): { jouable: boolean; nationaleLabel: string | null } {
  const paris = course.paris_disponibles ?? [];
  const jouable = course.jouable_afrique ?? isJouableAfrique(paris);
  const nationaleLabel =
    course.nationale != null && NATIONALE_LABELS[course.nationale]
      ? NATIONALE_LABELS[course.nationale]
      : jouable
        ? getNationaleLabel(paris)
        : null;
  return { jouable, nationaleLabel };
}
```

- [ ] **Step 4: Lancer → succès**

Run: `npm test -- resolve-afrique`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pmu-api.ts lib/pmu-api.resolve-afrique.test.ts
git commit -m "feat(badge): resolveAfrique (autoritaire LONACI + fallback heuristique)"
```

---

## Task 7 : Câblage UI du badge

**Files:**
- Modify: `components/courses/CourseCard.tsx`
- Modify: `components/home/CoursesSection.tsx`
- Modify: `components/home/PronosticsSection.tsx`
- Modify: les requêtes Supabase qui alimentent ces composants (ajouter `jouable_afrique, nationale` au `select`)

- [ ] **Step 1: Repérer chaque usage et la requête associée**

Run: `grep -rn "isJouableAfrique\|getNationaleLabel\|select(" components/courses components/home`
Pour chaque composant : (a) remplacer `isJouableAfrique(paris)` + `getNationaleLabel(paris)` par `const { jouable, nationaleLabel } = resolveAfrique(course)` ; (b) s'assurer que l'objet course contient `jouable_afrique`, `nationale`, `paris_disponibles` ; (c) ajouter `jouable_afrique, nationale` dans le `.select(...)` de la requête qui charge ces courses.

- [ ] **Step 2: Appliquer dans `CourseCard.tsx`**

Remplacer (autour des lignes 112 & 193-198) :
```ts
const jouableAfrique  = isJouableAfrique(paris);
const nationaleLabel  = getNationaleLabel(paris);
```
par :
```ts
const { jouable: jouableAfrique, nationaleLabel } = resolveAfrique({
  jouable_afrique: course.jouable_afrique,
  nationale: course.nationale,
  paris_disponibles: paris,
});
```
Mettre à jour l'import : `import { resolveAfrique } from "@/lib/pmu-api";` (retirer les imports devenus inutiles si plus utilisés ailleurs dans le fichier).

- [ ] **Step 3: Idem `CoursesSection.tsx` et `PronosticsSection.tsx`**

Même substitution. Ajouter `jouable_afrique, nationale` aux `.select(...)` des requêtes courses de ces deux fichiers (et de toute requête parente passant `course` à `CourseCard`).

- [ ] **Step 4: Vérifier compilation**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add components/
git commit -m "feat(badge): UI lit le verdict Afrique autoritaire (resolveAfrique + select colonnes)"
```

---

## Task 8 : Gate dryRun (cron + force-sync) & consommateurs de l'ancien type

**Files:**
- Modify: `app/api/cron/lonaci-sync/route.ts`
- Modify: `app/api/admin/force-sync/route.ts` (cible `lonaci`)

- [ ] **Step 1: Cron — gate par variable d'env (rollout)**

Dans `app/api/cron/lonaci-sync/route.ts`, l'appel devient :
```ts
const dryRun = process.env.LONACI_ENRICH_WRITE !== "1"; // écrit seulement si LONACI_ENRICH_WRITE=1
const data = await runLonaciSync({ dryRun });
await logger.finish("success", { ...data, ...(data.report ?? {}) });
return NextResponse.json(data);
```
(Tant que `LONACI_ENRICH_WRITE` n'est pas posée en prod → dry-run automatique = Étape 1 du rollout.)

- [ ] **Step 2: force-sync — passer dryRun depuis le body (test manuel)**

Dans `app/api/admin/force-sync/route.ts`, cible `lonaci` :
```ts
"lonaci": { kind: "direct", cronName: "lonaci-sync", run: () => runLonaciSync({ dryRun: !!bodyDryRun }) },
```
où `bodyDryRun` est lu depuis le body JSON (`const { target, dryRun: bodyDryRun } = await req.json()...`). Défaut `false`.

- [ ] **Step 3: Vérifier compilation (consommateurs de l'ancien LonaciSyncResult)**

Run: `npx tsc --noEmit`
Expected: 0 erreur. Corriger tout accès à `result.total/nationales/inserted` supprimés (ne devrait subsister que force-sync, qui logge `data` génériquement).

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/lonaci-sync/route.ts app/api/admin/force-sync/route.ts
git commit -m "feat(rollout): gate LONACI_ENRICH_WRITE (dry-run par défaut) + dryRun manuel force-sync"
```

---

## Task 9 : Rollout opérationnel (dry-run → activation)

**Files:** aucun (opérationnel). À faire après merge + déploiement.

- [ ] **Step 1: Déployer** la branche (migration + code). `LONACI_ENRICH_WRITE` NON posée → dry-run.
- [ ] **Step 2: Run à blanc** : déclencher `lonaci-sync` (cron ou force-sync), puis lire le rapport :
  ```sql
  select status, details->'report' as report, executed_at
  from cron_logs where cron_name='lonaci-sync' order by executed_at desc limit 3;
  ```
- [ ] **Step 3: Décision** : si `matched` élevé et `unmatched_course` faible → OK. Si `unmatched_course` élevé → LONACI renumérote ⇒ implémenter la clé de repli `(hippodrome_id, date, heure_depart ± tolérance)` (nouvelle itération de Task 3/5) avant activation.
- [ ] **Step 4: Activer** : poser `LONACI_ENRICH_WRITE=1` (env worker principal Cloudflare), redéployer si nécessaire.
- [ ] **Step 5: Vérifier** : prochain run `success` + badges en prod (une course rapprochée affiche 🌍 + Nationale correcte ; **aucun** doublon créé : `select count(*) from courses where date_course = current_date` stable avant/après).

---

## Self-Review (rédacteur)

- **Couverture spec** : §4 modèle → Task 4 ; §5 composants → Tasks 2,3,5,6,7 ; §6 rollout → Tasks 8,9 ; §7 garde-fou → Task 3 ; §8 erreurs → Task 5 (bulk + idempotent) ; UI §5.4 → Task 7. ✓
- **Placeholders** : aucun (code complet pour toutes les fonctions ; Task 7 décrit la substitution exacte, à faire en lisant le contenu courant des 3 composants).
- **Cohérence des types** : `CourseUpdate`, `EnrichInput`, `runLonaciSync({dryRun})`, `resolveAfrique(course)` cohérents entre tasks. `LonaciSyncResult` redéfini en Task 5 (champ `report`/`dry_run`) → consommateurs ajustés en Task 8.
- **Dépendance d'ordre** : Task 1 (vitest) avant 2/3/6 ; Task 2 avant 3 et 5 ; Task 4 (colonnes) avant que les écritures de Task 5 ne soient activées (Task 9) ; Task 6 avant 7.
