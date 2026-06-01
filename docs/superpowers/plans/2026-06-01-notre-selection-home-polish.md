# « Notre sélection » — doré + encart accueil : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Mettre le texte descriptif du bloc promo course en doré (distinction premium), et ajouter une section de positionnement « sélection gratuite sur chaque course » sur l'accueil.

**Architecture:** Modif CSS pure dans `NotreSelectionPromo` + nouvelle section statique d'accueil `NotreSelectionSection` insérée dans `page.tsx`. Aucune logique, $0.

**Tech Stack:** Next.js 14 (server components), Tailwind, lucide-react.

---

## File Structure

- **Modify** `components/courses/NotreSelectionPromo.tsx` — `<p>` descriptif (banner + sidebar) : `text-text-muted` → `text-gold-light/90`, spans emphase → `text-gold-light`.
- **Create** `components/home/NotreSelectionSection.tsx` — section accueil statique (default export).
- **Modify** `app/(public)/page.tsx` — import + insertion après `<CoursesSection />`.

Pas de test unitaire : présentation pure, env Vitest = `node` (pas de rendu React). Vérif = `tsc --noEmit` + suite existante verte + visuel.

---

### Task 1 : Doré sur le bloc promo course

**Files:** Modify `components/courses/NotreSelectionPromo.tsx`

- [ ] **Step 1 — Bandeau** : remplacer le `<p>` descriptif de la variante `banner` :

```tsx
            <p className="text-text-muted text-xs leading-relaxed">
              Notre lecture statistique pour{" "}
              <span className="text-text-secondary font-semibold">structurer vos paris</span> et comprendre la
              course. Différente de nos{" "}
              <span className="text-text-secondary font-semibold">pronostics du jour</span> (analyse experte
              réservée aux abonnés).
            </p>
```
par :
```tsx
            <p className="text-gold-light/90 text-xs leading-relaxed">
              Notre lecture statistique pour{" "}
              <span className="text-gold-light font-semibold">structurer vos paris</span> et comprendre la
              course. Différente de nos{" "}
              <span className="text-gold-light font-semibold">pronostics du jour</span> (analyse experte
              réservée aux abonnés).
            </p>
```

- [ ] **Step 2 — Sidebar** : remplacer le `<p>` descriptif de la variante `sidebar` :

```tsx
        <p className="text-text-muted text-xs leading-relaxed mb-3">
          Lecture statistique pour structurer vos paris. Différente de nos pronostics du jour, réservés aux
          abonnés.
        </p>
```
par :
```tsx
        <p className="text-gold-light/90 text-xs leading-relaxed mb-3">
          Lecture statistique pour structurer vos paris. Différente de nos pronostics du jour, réservés aux
          abonnés.
        </p>
```

- [ ] **Step 3 — Commit** (avec Task 2/3, après typecheck).

---

### Task 2 : Section accueil `NotreSelectionSection`

**Files:** Create `components/home/NotreSelectionSection.tsx`

- [ ] **Step 1 — Créer le composant** (default export, server component) :

```tsx
import Link from "next/link";
import { Sparkles, ArrowRight, Check } from "lucide-react";

/**
 * Section d'accueil « Une sélection gratuite sur chaque course ».
 * Positionnement : Elite Turf accompagne TOUS les parieurs (gratuitement),
 * au-delà des 3 pronostics premium du jour. Statique, sans donnée par course.
 */
export default function NotreSelectionSection() {
  const points = ["Sur toutes les courses", "100 % gratuite", "Sans inscription"];
  return (
    <section className="py-14 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="relative rounded-2xl border border-gold-primary/30 bg-gradient-to-br from-gold-faint/60 via-bg-card to-bg-card overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary to-transparent" />
          <div className="p-7 sm:p-10 text-center">
            <div className="inline-flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-gold-primary" />
              <span className="text-gold-light text-xs font-semibold uppercase tracking-widest">
                Gratuit · sans inscription
              </span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-4">
              Une sélection gratuite sur <span className="text-gold-light">chaque course</span>
            </h2>
            <p className="text-text-secondary text-sm sm:text-base leading-relaxed max-w-2xl mx-auto mb-3">
              Nos 3 pronostics experts du jour sont réservés aux abonnés. Mais Elite Turf ne s&apos;arrête
              pas là : sur <span className="text-text-primary font-semibold">chaque course</span> du
              programme, vous trouvez{" "}
              <span className="text-gold-light font-semibold">notre sélection gratuite</span> — une lecture
              statistique (favoris au marché, drivers et entraîneurs reconnus, forme) pour{" "}
              <span className="text-text-primary font-semibold">structurer vos paris</span> et comprendre la
              course.
            </p>
            <p className="text-text-muted text-sm italic mb-6">
              Parce qu&apos;avant tout, nous sommes là pour vous conseiller.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-7">
              {points.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 text-text-secondary text-sm">
                  <Check className="w-4 h-4 text-status-win flex-shrink-0" />
                  {p}
                </span>
              ))}
            </div>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
            >
              Voir le programme du jour
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2 — Commit** (avec Task 3).

---

### Task 3 : Insertion dans l'accueil

**Files:** Modify `app/(public)/page.tsx`

- [ ] **Step 1 — Import** : après `import CoursesSection from "@/components/home/CoursesSection";`, ajouter :
```tsx
import NotreSelectionSection from "@/components/home/NotreSelectionSection";
```

- [ ] **Step 2 — Insertion** : remplacer :
```tsx
      {/* 4 — Programme des courses du jour */}
      <CoursesSection />

      {/* 5 — Comment ça marche : 4 étapes */}
```
par :
```tsx
      {/* 4 — Programme des courses du jour */}
      <CoursesSection />

      {/* 4b — Sélection gratuite sur chaque course (positionnement conseil) */}
      <NotreSelectionSection />

      {/* 5 — Comment ça marche : 4 étapes */}
```

- [ ] **Step 3 — Typecheck** : `Set-Location C:\Users\HP\etf-wt-ns-promo; npx tsc --noEmit` → 0 erreur.

- [ ] **Step 4 — Non-régression** : `npx -y vitest run` → suite verte (21 tests).

- [ ] **Step 5 — Commit** :
```bash
git add components/courses/NotreSelectionPromo.tsx components/home/NotreSelectionSection.tsx "app/(public)/page.tsx"
git commit -m "feat(home): section 'selection gratuite' + texte promo en dore"
```

---

### Task 4 : PR

- [ ] Push `feat/notre-selection-home` + `gh pr create`.
- [ ] Vérif visuelle : accueil → nouvelle section après le programme ; page course → texte descriptif doré (bandeau + sidebar) ; CTA accueil → `/courses`.

---

## Self-review
- **Couverture spec** : doré banner+sidebar ✓ (T1) · section accueil après CoursesSection ✓ (T3) · CTA /courses ✓ (T2) · copy validé ✓ (T2) · statique/positionnement ✓. 
- **Placeholders** : aucun.
- **Cohérence** : `NotreSelectionSection` default export (T2) = import default (T3). Route `/courses` à confirmer existante avant build.
