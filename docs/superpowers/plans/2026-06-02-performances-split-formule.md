# Performances par formule — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une barre segmentée `?formule=` sur `/performances` qui compare (taux+volume par pastille) et re-scope toute la page sur la formule choisie (Tous / Élite / Pro-Starter / Gratuit).

**Architecture:** Server component (inchangé) + URL param. On filtre en mémoire la liste déjà chargée (0 requête en plus) ; le calcul de stats existant tourne sur la liste filtrée. Un module pur testé (`tier-stats.ts`) porte le mapping formule→niveaux + le résumé des pastilles. Un composant présentationnel server (`FormuleTabs`) rend les onglets `<Link>`.

**Tech Stack:** Next.js 14 (App Router, RSC) · TypeScript · Tailwind (tokens custom) · Vitest (env node, `@/` alias).

---

## File Structure

- **Create** `lib/performances/tier-stats.ts` — pur : `FORMULES`, `resolveFormule`, `filterByFormule`, `summarizeTier`.
- **Create** `lib/performances/tier-stats.test.ts` — tests unitaires Vitest.
- **Create** `components/performances/FormuleTabs.tsx` — onglets présentationnels (server).
- **Modify** `app/(public)/performances/page.tsx` — `searchParams`, filtre `scoped`, insertion `<FormuleTabs>`, note gains.

---

## Task 1 : Module pur `tier-stats.ts` (TDD)

**Files:**
- Create: `lib/performances/tier-stats.ts`
- Test: `lib/performances/tier-stats.test.ts`

- [ ] **Step 1 : Écrire le test (rouge)**

Créer `lib/performances/tier-stats.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { resolveFormule, filterByFormule, summarizeTier } from "./tier-stats";

const P = (resultat: string, niveau: string | null) =>
  ({ resultat, niveau_acces: niveau } as { resultat: string; niveau_acces: any });

describe("resolveFormule", () => {
  it("clé valide", () => expect(resolveFormule("elite").key).toBe("elite"));
  it("clé inconnue → tous", () => expect(resolveFormule("xxx").key).toBe("tous"));
  it("undefined → tous", () => expect(resolveFormule(undefined).key).toBe("tous"));
});

describe("filterByFormule", () => {
  const list = [P("GAGNANT", "ELITE"), P("PERDANT", "PRO"), P("GAGNANT", "STARTER"), P("GAGNANT", "GRATUIT")];
  it("tous → toute la liste", () => expect(filterByFormule(list, resolveFormule("tous"))).toHaveLength(4));
  it("pro → PRO + STARTER", () => {
    const r = filterByFormule(list, resolveFormule("pro"));
    expect(r.map((p) => p.niveau_acces).sort()).toEqual(["PRO", "STARTER"]);
  });
  it("elite → ELITE seul", () => expect(filterByFormule(list, resolveFormule("elite"))).toHaveLength(1));
  it("ignore niveau_acces null pour un tier nommé", () =>
    expect(filterByFormule([P("GAGNANT", null)], resolveFormule("elite"))).toHaveLength(0));
});

describe("summarizeTier", () => {
  it("taux = gagnants / terminés (exclut EN_ATTENTE)", () => {
    const list = [P("GAGNANT", "ELITE"), P("PERDANT", "ELITE"), P("EN_ATTENTE", "ELITE")];
    expect(summarizeTier(list, resolveFormule("elite"))).toEqual({ total: 3, termines: 2, gagnants: 1, taux: 50 });
  });
  it("pro agrège PRO + STARTER", () => {
    const list = [P("GAGNANT", "PRO"), P("GAGNANT", "STARTER"), P("PERDANT", "PRO")];
    expect(summarizeTier(list, resolveFormule("pro"))).toEqual({ total: 3, termines: 3, gagnants: 2, taux: 67 });
  });
  it("liste vide → tout 0", () =>
    expect(summarizeTier([], resolveFormule("pro"))).toEqual({ total: 0, termines: 0, gagnants: 0, taux: 0 }));
});
```

- [ ] **Step 2 : Lancer le test (vérifier rouge)**

Run: `npx vitest run lib/performances/tier-stats.test.ts`
Expected: FAIL — `Cannot find module './tier-stats'`.

- [ ] **Step 3 : Implémenter le module**

Créer `lib/performances/tier-stats.ts` :

```ts
/**
 * lib/performances/tier-stats.ts
 *
 * Découpage des performances par formule commerciale (Élite / Pro-Starter /
 * Gratuit) à partir de pronostics.niveau_acces. Pur, testable, sans Supabase.
 * Utilisé par /performances (filtre ?formule= + pastilles de comparaison).
 */
import type { PronosticLevel } from "@/types";

export type FormuleKey = "tous" | "elite" | "pro" | "gratuit";

export interface Formule {
  key: FormuleKey;
  label: string;
  /** niveaux inclus ; null = toutes les formules (aucun filtre). */
  niveaux: PronosticLevel[] | null;
}

export const FORMULES: Formule[] = [
  { key: "tous",    label: "Tous",          niveaux: null },
  { key: "elite",   label: "Élite",         niveaux: ["ELITE"] },
  { key: "pro",     label: "Pro / Starter", niveaux: ["PRO", "STARTER"] },
  { key: "gratuit", label: "Gratuit",       niveaux: ["GRATUIT"] },
];

/** Résout le paramètre ?formule= ; valeur inconnue/absente → "tous". */
export function resolveFormule(raw: string | undefined): Formule {
  return FORMULES.find((f) => f.key === raw) ?? FORMULES[0];
}

/** Forme minimale requise par les helpers (les vraies lignes ont plus de champs). */
export interface TierLite {
  resultat: string | null;
  niveau_acces: PronosticLevel | null;
}

/** Filtre une liste sur les niveaux d'une formule (null = pas de filtre). */
export function filterByFormule<T extends TierLite>(list: T[], f: Formule): T[] {
  if (f.niveaux === null) return list;
  const niveaux = f.niveaux;
  return list.filter((p) => p.niveau_acces != null && niveaux.includes(p.niveau_acces));
}

export interface TierSummary {
  total: number;
  termines: number;
  gagnants: number;
  taux: number; // % gagnants / terminés (0 si aucun terminé)
}

/** Résume une formule : total, terminés (hors EN_ATTENTE), gagnants, taux. */
export function summarizeTier<T extends TierLite>(list: T[], f: Formule): TierSummary {
  const items = filterByFormule(list, f);
  const termines = items.filter((p) => p.resultat !== "EN_ATTENTE").length;
  const gagnants = items.filter((p) => p.resultat === "GAGNANT").length;
  return {
    total: items.length,
    termines,
    gagnants,
    taux: termines > 0 ? Math.round((gagnants / termines) * 100) : 0,
  };
}
```

- [ ] **Step 4 : Lancer le test (vérifier vert)**

Run: `npx vitest run lib/performances/tier-stats.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5 : Commit**

```bash
git add lib/performances/tier-stats.ts lib/performances/tier-stats.test.ts
git commit -m "feat(perf): module pur tier-stats (formule -> niveaux + resume)"
```

---

## Task 2 : Composant `FormuleTabs`

**Files:**
- Create: `components/performances/FormuleTabs.tsx`

- [ ] **Step 1 : Créer le composant**

Créer `components/performances/FormuleTabs.tsx` :

```tsx
/**
 * Barre segmentée des formules sur /performances. Server component
 * présentationnel : l'onglet actif vient des searchParams (pas de state).
 * Chaque pastille affiche taux + volume → la comparaison est visible, et le
 * clic re-scope la page via ?formule=.
 */
import Link from "next/link";
import type { FormuleKey } from "@/lib/performances/tier-stats";

export interface FormuleTabItem {
  key: FormuleKey;
  label: string;
  taux: number;
  total: number;
}

export default function FormuleTabs({
  active,
  items,
}: {
  active: FormuleKey;
  items: FormuleTabItem[];
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-1">
      <p className="text-center text-text-muted text-xs uppercase tracking-wider mb-3">
        Performances par formule
      </p>
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        {items.map((it) => {
          const isActive = it.key === active;
          const href = it.key === "tous" ? "/performances" : `/performances?formule=${it.key}`;
          return (
            <Link
              key={it.key}
              href={href}
              scroll={false}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center min-w-[88px] px-4 py-2.5 rounded-xl border transition-all ${
                isActive
                  ? "bg-gold-primary border-gold-primary text-bg-primary shadow-gold-sm"
                  : "bg-bg-elevated/80 border-border text-text-secondary hover:border-gold-primary/40 hover:text-text-primary"
              }`}
            >
              <span className="text-sm font-bold leading-tight">{it.label}</span>
              <span className={`text-xs mt-0.5 ${isActive ? "text-bg-primary/80" : "text-text-muted"}`}>
                {it.total > 0 ? `${it.taux}% · ${it.total}` : "—"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: exit 0 (aucune erreur).

- [ ] **Step 3 : Commit**

```bash
git add components/performances/FormuleTabs.tsx
git commit -m "feat(perf): composant FormuleTabs (onglets compare + filtre)"
```

---

## Task 3 : Câbler dans `performances/page.tsx`

**Files:**
- Modify: `app/(public)/performances/page.tsx`

- [ ] **Step 1 : Ajouter les imports**

Dans `app/(public)/performances/page.tsx`, après la ligne
`import { buildGenyUrlFromStored, buildGenyUrlAuto } from "@/lib/geny";` (≈ ligne 19), ajouter :

```tsx
import { resolveFormule, filterByFormule, summarizeTier, FORMULES } from "@/lib/performances/tier-stats";
import FormuleTabs from "@/components/performances/FormuleTabs";
```

- [ ] **Step 2 : Recevoir `searchParams`**

Remplacer la signature (≈ ligne 49) :

```tsx
export default async function PerformancesPage() {
  const supabase = createServiceClient();
```

par :

```tsx
export default async function PerformancesPage({
  searchParams,
}: {
  searchParams: { formule?: string };
}) {
  const supabase = createServiceClient();
  const formule = resolveFormule(searchParams.formule);
```

- [ ] **Step 3 : Scoper la liste + construire les pastilles**

Remplacer le bloc (≈ lignes 69-76) :

```tsx
  const pronostics = (allPronostics || []).sort((a: any, b: any) => {
    const dateA = a.course?.date_course || a.date_publication?.split("T")[0] || "";
    const dateB = b.course?.date_course || b.date_publication?.split("T")[0] || "";
    if (dateB !== dateA) return dateB.localeCompare(dateA);
    const heureA = a.course?.heure_depart || a.date_publication || "";
    const heureB = b.course?.heure_depart || b.date_publication || "";
    return heureB.localeCompare(heureA);
  });
```

par :

```tsx
  const allSorted = (allPronostics || []).sort((a: any, b: any) => {
    const dateA = a.course?.date_course || a.date_publication?.split("T")[0] || "";
    const dateB = b.course?.date_course || b.date_publication?.split("T")[0] || "";
    if (dateB !== dateA) return dateB.localeCompare(dateA);
    const heureA = a.course?.heure_depart || a.date_publication || "";
    const heureB = b.course?.heure_depart || b.date_publication || "";
    return heureB.localeCompare(heureA);
  });

  // Liste scopée sur la formule active : alimente TOUTES les sections ci-dessous.
  const pronostics = filterByFormule(allSorted, formule);

  // Pastilles : résumé de CHAQUE formule sur la liste complète (indépendant du filtre).
  const tabItems = FORMULES.map((f) => {
    const s = summarizeTier(allSorted, f);
    return { key: f.key, label: f.label, taux: s.taux, total: s.total };
  });
```

- [ ] **Step 4 : Calculer le flag « gains partiels » (honnêteté)**

Juste après le calcul de `gains30j` (≈ ligne 124,
`const gains30j = prono30j.reduce(...)`), ajouter :

```tsx
  // Vrai tant que des gagnants récents n'ont pas encore leur rapport propagé
  // (backfill cron du soir). Évite de laisser croire à un sous-total exhaustif.
  const gainsPartiels = prono30j.some((p: any) => p.resultat === "GAGNANT" && p.rapport_gagnant == null);
```

- [ ] **Step 5 : Insérer `<FormuleTabs>` après le hero**

Juste après le bloc `<PageHero ... />` (≈ ligne 175, la balise auto-fermante) et
AVANT le commentaire `{/* ── BANDEAU 30 JOURS ... */}`, insérer :

```tsx
      <FormuleTabs active={formule.key} items={tabItems} />
```

- [ ] **Step 6 : Ajouter la note « rapports en cours » dans le bandeau**

Dans le bandeau 30 jours, juste après le `<span>` des gains
(le `{gains30j > 0 && <span ...>💰 +{gains30j.toFixed(0)}€ de rapports cumulés</span>}`, ≈ ligne 184),
ajouter :

```tsx
          {gainsPartiels && (
            <span className="text-text-muted text-xs italic">rapports en cours de consolidation</span>
          )}
```

- [ ] **Step 7 : Typecheck + tests**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx vitest run`
Expected: tous les fichiers passent (dont `tier-stats.test.ts`).

- [ ] **Step 8 : Commit**

```bash
git add "app/(public)/performances/page.tsx"
git commit -m "feat(perf): filtre ?formule= sur /performances (re-scope par formule)"
```

---

## Notes de vérification manuelle (après implémentation)

- `/performances` → barre 4 pastilles, « Tous » actif (doré), pastilles montrent `60% · 68`, etc.
- Clic « Élite » → URL `?formule=elite`, KPIs/graphe/historique recalculés sur ELITE, pas de saut de scroll.
- Clic « Pro / Starter » → inclut bien PRO (et STARTER si présent un jour).
- Mobile : pastilles s'enroulent (flex-wrap), restent lisibles.
