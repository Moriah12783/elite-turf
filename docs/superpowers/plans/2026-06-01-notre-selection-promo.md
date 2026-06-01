# « Notre sélection » — Levier de conversion : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la sélection gratuite visible d'emblée via un bandeau (haut de page course) + un encart sidebar, pour inciter le visiteur non-abonné à découvrir les pronostics premium.

**Architecture:** Un composant de présentation `NotreSelectionPromo` (variantes `banner`/`sidebar`) réutilisant la donnée `notreSelection` déjà calculée serveur dans `page.tsx` (PR #139). Une règle d'affichage partagée `shouldShowNotreSelectionPromo()` (non-abonné + sélection non vide). Aucun recalcul, $0.

**Tech Stack:** Next.js 14 (App Router, server components), React 18, TypeScript, Tailwind, lucide-react, Vitest.

---

## File Structure

- **Modify** `lib/courses/notre-selection.ts` — ajouter `shouldShowNotreSelectionPromo(isSubscribed, items)` (règle d'affichage pure, réutilisée par les 2 placements).
- **Create** `components/courses/NotreSelectionPromo.tsx` — composant présentation, variantes `banner` (pleine largeur, haut de page) et `sidebar` (carte verticale).
- **Modify** `app/(public)/courses/[id]/page.tsx` — calcul `isSubscribed`, rendu bandeau (avant les onglets) + encart sidebar (sous « Tous les pronostics »), conditionnés.
- **Modify** `lib/courses/notre-selection.test.ts` — tests du helper.

---

### Task 1 : Règle d'affichage `shouldShowNotreSelectionPromo`

**Files:**
- Modify: `lib/courses/notre-selection.ts`
- Test: `lib/courses/notre-selection.test.ts`

- [ ] **Step 1 : Ajouter les tests qui échouent** (à la fin de `lib/courses/notre-selection.test.ts`, avant la dernière `});` de fichier — nouveau bloc `describe`)

```ts
import { buildNotreSelection, shouldShowNotreSelectionPromo } from "./notre-selection";
// ^ remplacer l'import existant `{ buildNotreSelection }` par cette ligne.

describe("shouldShowNotreSelectionPromo", () => {
  const item = { rank: 1, numero: 6, nom: "X", jockey: null, cote: null, label: "Régulier" as const };
  it("affiche pour un non-abonné avec sélection", () => {
    expect(shouldShowNotreSelectionPromo(false, [item])).toBe(true);
  });
  it("masque pour un abonné", () => {
    expect(shouldShowNotreSelectionPromo(true, [item])).toBe(false);
  });
  it("masque si la sélection est vide", () => {
    expect(shouldShowNotreSelectionPromo(false, [])).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer → échec attendu**

Run: `Set-Location C:\Users\HP\etf-wt-ns-promo; npx -y vitest run lib/courses/notre-selection.test.ts`
Expected: FAIL (`shouldShowNotreSelectionPromo is not a function` / export manquant).

- [ ] **Step 3 : Implémenter** (ajouter à la fin de `lib/courses/notre-selection.ts`)

```ts
/**
 * Règle d'affichage des blocs promo « Notre sélection » (bandeau + encart).
 * On les montre au visiteur NON-abonné quand une sélection existe ; on les
 * masque pour un abonné (bruit) et quand la course n'a pas de partants.
 */
export function shouldShowNotreSelectionPromo(
  isSubscribed: boolean,
  items: NotreSelectionItem[],
): boolean {
  return !isSubscribed && items.length > 0;
}
```

- [ ] **Step 4 : Lancer → succès**

Run: `Set-Location C:\Users\HP\etf-wt-ns-promo; npx -y vitest run lib/courses/notre-selection.test.ts`
Expected: PASS (11 tests : 8 existants + 3 nouveaux).

- [ ] **Step 5 : Commit**

```bash
git add lib/courses/notre-selection.ts lib/courses/notre-selection.test.ts
git commit -m "feat(courses): regle shouldShowNotreSelectionPromo (non-abonne + selection non vide)"
```

---

### Task 2 : Composant `NotreSelectionPromo`

**Files:**
- Create: `components/courses/NotreSelectionPromo.tsx`

- [ ] **Step 1 : Créer le composant** (présentation pure, server component — pas de `"use client"`)

```tsx
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import type { NotreSelectionItem } from "@/lib/courses/notre-selection";

/**
 * Bloc promo « Notre sélection » (gratuite) — preuve de valeur + CTA vers le
 * produit premium. Deux variantes : `banner` (pleine largeur, haut de page,
 * mobile-first) et `sidebar` (carte verticale). Ne s'affiche pas si la
 * sélection est vide. Le ciblage (non-abonné) est décidé par l'appelant via
 * `shouldShowNotreSelectionPromo`.
 */
export function NotreSelectionPromo({
  items,
  variant,
}: {
  items: NotreSelectionItem[];
  variant: "banner" | "sidebar";
}) {
  if (!items || items.length === 0) return null;
  const numeros = items.map((i) => i.numero);

  const Pastilles = (
    <div className="flex flex-wrap gap-1.5">
      {numeros.map((n) => (
        <span
          key={n}
          className="w-7 h-7 rounded-full bg-bg-elevated border border-gold-primary/40 text-gold-light text-xs font-bold flex items-center justify-center"
        >
          {n}
        </span>
      ))}
    </div>
  );

  if (variant === "banner") {
    return (
      <div className="mb-4 rounded-2xl border border-gold-primary/30 bg-gradient-to-br from-gold-faint via-bg-elevated to-bg-elevated overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-gold-primary flex-shrink-0" />
              <h3 className="text-text-primary text-sm font-bold">
                Notre sélection — <span className="text-gold-light">gratuite</span> sur chaque course
              </h3>
            </div>
            <div className="mb-2">{Pastilles}</div>
            <p className="text-text-muted text-xs leading-relaxed">
              Notre lecture statistique pour{" "}
              <span className="text-text-secondary font-semibold">structurer vos paris</span> et comprendre la
              course. Différente de nos{" "}
              <span className="text-text-secondary font-semibold">pronostics du jour</span> (analyse experte
              réservée aux abonnés).
            </p>
          </div>
          <Link
            href="/pronostics"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-xs rounded-xl transition-all shadow-gold-sm whitespace-nowrap flex-shrink-0"
          >
            Voir les pronostics du jour <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // variant === "sidebar"
  return (
    <div className="card-base overflow-hidden border border-gold-primary/30">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-gold-primary flex-shrink-0" />
          <h3 className="text-text-primary text-sm font-bold">
            Notre sélection <span className="text-gold-light">gratuite</span>
          </h3>
        </div>
        <div className="mb-3">{Pastilles}</div>
        <p className="text-text-muted text-xs leading-relaxed mb-3">
          Lecture statistique pour structurer vos paris. Différente de nos pronostics du jour, réservés aux
          abonnés.
        </p>
        <Link
          href="/pronostics"
          className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-xs rounded-xl transition-all shadow-gold-sm"
        >
          Voir les pronostics du jour <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Typecheck rapide** (cf. Task 4 — le composant se compile avec son intégration). Pas de commit isolé : commit avec Task 3.

---

### Task 3 : Intégration dans la page course

**Files:**
- Modify: `app/(public)/courses/[id]/page.tsx`

- [ ] **Step 1 : Importer composant + helper**

Remplacer la ligne d'import existante :
```ts
import { buildNotreSelection } from "@/lib/courses/notre-selection";
```
par :
```ts
import { buildNotreSelection, shouldShowNotreSelectionPromo } from "@/lib/courses/notre-selection";
import { NotreSelectionPromo } from "@/components/courses/NotreSelectionPromo";
```

- [ ] **Step 2 : Calculer `isSubscribed` une fois** (juste après `const notreSelection = ...`)

```ts
  const notreSelection = buildNotreSelection(statsEnrichies.partants);
  const isSubscribed = ["STARTER", "PRO", "ELITE"].includes(userSubscription);
```

- [ ] **Step 3 : Rendre le bandeau avant les onglets**

Remplacer :
```tsx
            {/* ── Onglets : Partants / Côtes / Arrivées & Rapports / Statistiques ── */}
            <CourseTabsClient
```
par :
```tsx
            {shouldShowNotreSelectionPromo(isSubscribed, notreSelection) && (
              <NotreSelectionPromo items={notreSelection} variant="banner" />
            )}

            {/* ── Onglets : Partants / Côtes / Arrivées & Rapports / Statistiques ── */}
            <CourseTabsClient
```

- [ ] **Step 4 : Réutiliser `isSubscribed` dans la prop du composant onglets** (DRY)

Remplacer :
```tsx
              isSubscribed={["STARTER","PRO","ELITE"].includes(userSubscription)}
```
par :
```tsx
              isSubscribed={isSubscribed}
```

- [ ] **Step 5 : Rendre l'encart sidebar sous « Tous les pronostics »**

Remplacer :
```tsx
              <Star className="w-4 h-4" />
              Tous les pronostics
            </Link>
          </div>
```
par :
```tsx
              <Star className="w-4 h-4" />
              Tous les pronostics
            </Link>

            {shouldShowNotreSelectionPromo(isSubscribed, notreSelection) && (
              <NotreSelectionPromo items={notreSelection} variant="sidebar" />
            )}
          </div>
```

- [ ] **Step 6 : Commit** (composant + intégration ensemble)

```bash
git add components/courses/NotreSelectionPromo.tsx "app/(public)/courses/[id]/page.tsx"
git commit -m "feat(courses): bandeau + encart 'Notre selection' (levier conversion, masque abonnes)"
```

---

### Task 4 : Vérification + PR

**Files:** —

- [ ] **Step 1 : Typecheck**

Run: `Set-Location C:\Users\HP\etf-wt-ns-promo; npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 2 : Suite de tests complète**

Run: `Set-Location C:\Users\HP\etf-wt-ns-promo; npx -y vitest run`
Expected: PASS (toutes ; notre-selection = 11 tests).

- [ ] **Step 3 : Push + PR**

```bash
git -C C:\Users\HP\etf-wt-ns-promo push -u origin feat/notre-selection-promo
gh pr create --base main --head feat/notre-selection-promo --title "feat: bandeau + encart 'Notre selection' (levier de conversion)" --body-file <résumé>
```

- [ ] **Step 4 : Vérif visuelle** (après déploiement de la PR)
  - **Non-abonné** : ouvrir une course du jour → bandeau coloré en haut (mobile + desktop) avec les 8 numéros + CTA ; encart dans la sidebar (desktop).
  - **Abonné** connecté → aucun des deux blocs.
  - **Course sans partants** → aucun des deux blocs.
  - CTA → `/pronostics`.

---

## Self-review (auteur)

- **Couverture spec** : bandeau haut ✓ (T3.S3) · encart sidebar sous « Tous les pronostics » ✓ (T3.S5) · CTA → /pronostics ✓ (T2) · masquage abonnés ✓ (T1 helper + T3 conditions) · garde sélection vide ✓ (T1 + composant `return null`) · réutilise `notreSelection` sans recalcul ✓ (T3) · 8 numéros en pastilles ✓ (T2) · discipline anti-confusion (« gratuit/statistique », jamais « pronostic ») ✓ (copy T2).
- **Placeholders** : aucun — code complet.
- **Cohérence types** : `shouldShowNotreSelectionPromo(boolean, NotreSelectionItem[])` (T1) = signature utilisée en T3 ; `NotreSelectionPromo({items, variant})` (T2) = props passées en T3 ; `NotreSelectionItem` importé des deux côtés.
- **Risque dépôt concurrent** : worktree isolé `feat/notre-selection-promo`, 1 PR.
