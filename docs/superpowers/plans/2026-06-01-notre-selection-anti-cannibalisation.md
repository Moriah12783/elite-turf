# « Notre sélection » — anti-cannibalisation : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Masquer « Notre sélection » (onglet + bandeau + encart) pour un visiteur qui a déjà accès au pronostic premium publié de la course. Visible pour tous ailleurs.

**Architecture:** Calcul `viewerHasAccessiblePremiumPronostic` dans `page.tsx` (réutilise `canAccess`), gate les blocs promo + passe une prop `hideNotreSelection` à `CourseTabsClient` (qui retire l'onglet). Aucune nouvelle logique en lib.

**Tech Stack:** Next.js 14 (server + client component), TypeScript.

**Confirmé en BDD** : `niveau_acces` ∈ {GRATUIT, PRO, ELITE} (pas de "STARTER") → `canAccess` couvre tous les cas.

---

### Task 1 : `CourseTabsClient` — prop + retrait conditionnel de l'onglet

**Files:** Modify `components/courses/CourseTabsClient.tsx`

- [ ] **Step 1 — Prop dans l'interface** : après `notreSelection?: NotreSelectionItem[];` :
```tsx
  notreSelection?: NotreSelectionItem[];
  /** Masquer entièrement "Notre sélection" (onglet) — ex. sur une course dont
   *  le visiteur a déjà le pronostic premium (anti-cannibalisation). */
  hideNotreSelection?: boolean;
}
```

- [ ] **Step 2 — Signature** : après `notreSelection = [],` :
```tsx
  notreSelection = [],
  hideNotreSelection = false,
}: Props) {
```

- [ ] **Step 3 — Filtrer l'onglet** : remplacer la fin du tableau `tabs` :
```tsx
    { id: "stats",     label: "Statistiques",       icon: BarChart3 },
  ];
```
par :
```tsx
    { id: "stats",     label: "Statistiques",       icon: BarChart3 },
  ].filter((t) => !(t.id === "selection" && hideNotreSelection));
```

---

### Task 2 : `page.tsx` — calcul + gating

**Files:** Modify `app/(public)/courses/[id]/page.tsx`

- [ ] **Step 1 — Calcul** : après `const isSubscribed = ...` (ligne 228) :
```ts
  const isSubscribed = ["STARTER", "PRO", "ELITE"].includes(userSubscription);
  // Anti-cannibalisation : si le visiteur a accès au pronostic premium publié
  // de cette course, on lui masque la « Notre sélection » gratuite (clone du
  // produit payé). Visible pour tous ailleurs.
  const viewerHasAccessiblePremiumPronostic =
    !!pronosticPublie &&
    pronosticPublie.niveau_acces !== "GRATUIT" &&
    canAccess(pronosticPublie.niveau_acces, userSubscription);
```

- [ ] **Step 2 — Gate des 2 blocs promo** : remplacer **les deux** occurrences de :
```tsx
            {shouldShowNotreSelectionPromo(notreSelection) && (
```
par :
```tsx
            {shouldShowNotreSelectionPromo(notreSelection) && !viewerHasAccessiblePremiumPronostic && (
```

- [ ] **Step 3 — Prop onglet** : remplacer :
```tsx
              notreSelection={notreSelection}
            />
```
par :
```tsx
              notreSelection={notreSelection}
              hideNotreSelection={viewerHasAccessiblePremiumPronostic}
            />
```

---

### Task 3 : Vérif + PR

- [ ] **Typecheck** : `Set-Location C:\Users\HP\etf-wt-ns-promo; npx tsc --noEmit` → 0 erreur.
- [ ] **Non-régression** : `npx -y vitest run` → suite verte (21).
- [ ] **Commit** :
```bash
git add components/courses/CourseTabsClient.tsx "app/(public)/courses/[id]/page.tsx"
git commit -m "feat(courses): masquer 'Notre selection' sur les courses a pronostic premium accessible"
```
- [ ] **Push + PR**.
- [ ] **Vérif visuelle** : abonné PRO sur course PRO → pas d'onglet/bandeau/encart « Notre sélection » ; visiteur sur la même course → visible ; course sans pronostic → visible pour l'abonné.

---

## Self-review
- **Couverture spec** : calcul règle ✓ (T2.S1) · gate promo banner+sidebar ✓ (T2.S2) · retrait onglet ✓ (T1+T2.S3) · matrice respectée (réutilise canAccess + guard GRATUIT) ✓.
- **Placeholders** : aucun.
- **Cohérence** : `hideNotreSelection` (prop T1) = passé en T2.S3 ; `viewerHasAccessiblePremiumPronostic` défini T2.S1, utilisé T2.S2/S3.
