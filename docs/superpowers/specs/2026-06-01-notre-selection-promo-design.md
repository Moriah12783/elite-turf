# Spec — « Notre sélection » comme levier de conversion (bandeau + encart)

- **Date** : 2026-06-01
- **Statut** : Design approuvé en chat (Stéphane, 2026-06-01) — spec à valider avant plan
- **Type** : Feature marketing / conversion. S'appuie sur « Notre sélection » (PR #139, live).

## 1. Problème / Objectif

L'onglet gratuit « Notre sélection » (top 8 stats par course) est **live mais peu visible** : caché dans un onglet, et la sidebar tombe tout en bas sur mobile. Or le trafic Elite Turf est **mobile-first (Afrique francophone)**.

**Objectif** : rendre la sélection visible **d'emblée** pour que le visiteur qui découvre Elite Turf (a) sache qu'il existe une **analyse gratuite sur chaque course**, et (b) soit incité à **s'abonner** au produit premium (pronostics du jour). Levier *freemium* : preuve de valeur gratuite → désir du produit payant.

## 2. Décisions validées (Q&A de cadrage)

| Sujet | Décision |
|---|---|
| Placement | **Bandeau haut** (au-dessus des onglets, pleine largeur) **+ encart sidebar** (sous « Tous les pronostics »). Mobile-first. |
| CTA | Bouton **« → Voir les pronostics du jour »** vers **`/pronostics`** (produit-led : montrer le premium → abonnement). |
| Ciblage | Blocs affichés aux **non-abonnés / visiteurs** ; **masqués pour les abonnés connectés** (anti-bruit). |
| Contenu | Les **8 numéros** de la sélection en pastilles (preuve) + titre « Notre sélection — **gratuite** » + copy de positionnement + CTA. |
| Garde-fou | Si sélection **vide** (pas de partants) → bloc **non affiché**. |
| Discipline | Vocabulaire « gratuit / statistique / structurer », **jamais** « notre pronostic ». Anti-cannibalisation du produit payant. |

## 3. Architecture (réutilisation, déterministe, $0)

- **Donnée** : réutilise `notreSelection: NotreSelectionItem[]` déjà calculée **serveur** dans `page.tsx` (PR #139). **Aucun recalcul.**
- **Règle d'affichage partagée** (DRY) : nouvelle fonction pure `shouldShowNotreSelectionPromo(isSubscribed, items)` dans `lib/courses/notre-selection.ts` → `!isSubscribed && items.length > 0`. Utilisée par les **deux** placements. **Testable.**
- **Nouveau composant** : `components/courses/NotreSelectionPromo.tsx` — props `{ items: NotreSelectionItem[]; variant: "banner" | "sidebar" }`. Présentation pure (server component, sans état) : titre, pastilles numéros, copy, CTA `Link` → `/pronostics`.
- **Intégration `app/(public)/courses/[id]/page.tsx`** :
  - **Bandeau** : `<NotreSelectionPromo items={notreSelection} variant="banner" />` juste **avant** le bloc onglets (`CourseTabsClient`), conditionné par `shouldShowNotreSelectionPromo(isSubscribed, notreSelection)`.
  - **Sidebar** : `<NotreSelectionPromo items={notreSelection} variant="sidebar" />` dans la colonne droite, **sous « Tous les pronostics »**, même condition.
  - `isSubscribed` : réutiliser le calcul existant `["STARTER","PRO","ELITE"].includes(userSubscription)` (déjà présent dans page.tsx).

## 4. UI / UX

- **Bandeau** : carte pleine largeur, **dégradé or/sombre** (charte). Desktop : titre + pastilles à gauche, CTA à droite. Mobile : empilé (titre → pastilles → CTA), toujours visible en haut.
- **Encart sidebar** : carte verticale, même contenu condensé.
- **Pastilles** : numéros ronds (réutiliser le style des pastilles de l'onglet). Le « Favori marché » peut être légèrement souligné.
- **Copy validé** :
  > **Notre sélection — _gratuite_ sur chaque course**
  > 6 · 2 · 10 · 12 · 1 · 8 · 7 · 5
  > Notre lecture statistique pour **structurer vos paris** et **comprendre la course**. Différente de nos **pronostics du jour** (analyse experte, réservée aux abonnés — 3 courses/jour).
  > **〔→ Voir les pronostics du jour〕**
- **Aucune promesse de gain.**

## 5. Cas limites

- Sélection **vide** → les deux blocs masqués.
- **Abonné** connecté → les deux blocs masqués.
- **Mobile** → bandeau haut visible (la sidebar passe en bas, couverte par le bandeau).

## 6. Non-objectifs (YAGNI)

- ❌ Pas de calcul nouveau (réutilise `notreSelection`).
- ❌ Pas de teaser/flou : la sélection est **gratuite par design**.
- ❌ Pas d'encart sur l'accueil / la page Programme (option écartée pour l'instant — pourra suivre).
- ❌ Pas d'A/B test.

## 7. Tests

- **Unitaire** : `shouldShowNotreSelectionPromo` (abonné→false, non-abonné+items→true, non-abonné+vide→false) via Vitest.
- **Composant** `NotreSelectionPromo` : présentation pure. L'env Vitest est `node` (pas de jsdom) → **pas de test de rendu React** ; on s'appuie sur **`tsc --noEmit`** + **vérif visuelle**. (Honnêteté : pas de test unitaire UI ici, c'est assumé vu l'absence d'infra jsdom.)
- **Vérif visuelle** : non-abonné voit le bandeau en haut (mobile + desktop) + l'encart sidebar (desktop) ; abonné ne voit rien ; course sans partants → rien.

## 8. Fichiers impactés

- **+ `components/courses/NotreSelectionPromo.tsx`** : composant bandeau/sidebar.
- **~ `lib/courses/notre-selection.ts`** : ajout `shouldShowNotreSelectionPromo()` (+ test).
- **~ `app/(public)/courses/[id]/page.tsx`** : rendu bandeau (avant onglets) + encart sidebar, conditionnels.

## 9. Garde-fou opérationnel (dépôt multi-agents)

Développé en **worktree isolé** `feat/notre-selection-promo` (depuis `origin/main` à jour, post-#139), livré en **une PR**. Jamais toucher le working tree partagé.
