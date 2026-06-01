# Spec — « Notre sélection » : anti-cannibalisation sur les courses premium

- **Date** : 2026-06-01
- **Statut** : Design approuvé en chat (Stéphane, 2026-06-01)
- **Type** : Règle de monétisation (visibilité conditionnelle). Restreinte aux courses avec pronostic premium. Suite de #139–#142.

## 1. Problème

Sur une course qui a un **pronostic premium PRO/STARTER (8 chevaux)**, la « Notre sélection » gratuite (8 chevaux) est **quasi-identique**. Constaté en live (Prix de Saint-Menoux) : pronostic PRO = `12·9·14·10·7·6·13·15`, sélection gratuite = `7·14·15·9·12·6·10·13` → **même ensemble de 8 chevaux**.

Conséquence : l'abonné **PRO/STARTER** qui a payé voit gratuitement le même résultat → *« pourquoi je paie ? »* → **friction / churn**. (L'ELITE reçoit 6 chevaux → plus sélectif → différencié, pas concerné.)

**Cause** : free et premium reposent sur un scoring proche → ils convergent. **Problème restreint** : ne touche que les ~3 courses premium/jour (sur 30–60).

## 2. Décision validée (Q&A)

**Règle unifiée** : si le visiteur a **accès** au pronostic premium publié de la course, on lui **masque** la « Notre sélection » gratuite (**onglet + bandeau + encart**). Sinon, visible pour tous.
**Périmètre** : tous les pronostics premium (**Starter / Pro / Elite**).

## 3. Architecture (réutilisation, $0)

- **`app/(public)/courses/[id]/page.tsx`** *(modifié)* — nouveau calcul, réutilisant la fonction `canAccess` déjà présente dans le fichier :
  ```ts
  const viewerHasAccessiblePremiumPronostic =
    !!pronosticPublie &&
    pronosticPublie.niveau_acces !== "GRATUIT" &&
    canAccess(pronosticPublie.niveau_acces, userSubscription);
  ```
  - **Bandeau + encart** : gate = `shouldShowNotreSelectionPromo(notreSelection) && !viewerHasAccessiblePremiumPronostic`.
  - **Onglet** : passer `hideNotreSelection={viewerHasAccessiblePremiumPronostic}` à `CourseTabsClient`.
- **`components/courses/CourseTabsClient.tsx`** *(modifié)* — nouvelle prop `hideNotreSelection?: boolean` (défaut `false`). Quand `true`, l'entrée `{ id: "selection", … }` est **retirée** du tableau `tabs` (le rendu conditionnel `activeTab === "selection"` devient inatteignable). Aucune autre logique touchée.
- **Inchangé** : `buildNotreSelection`, `shouldShowNotreSelectionPromo(items)` (reste `items.length > 0`), `canAccess` (réutilisé tel quel — pas de refactor dans ce dépôt concurrent).

## 4. Matrice de comportement (la sélection gratuite est-elle visible ?)

| Course | Visiteur / Gratuit | STARTER | PRO | ELITE |
|---|---|---|---|---|
| **Sans pronostic** (~57/j) | ✅ visible | ✅ | ✅ | ✅ |
| Pronostic **GRATUIT** | ✅ | ✅ | ✅ | ✅ |
| Pronostic **PRO/STARTER** (8) | ✅ (premium verrouillé → upsell) | ❌ masquée | ❌ masquée | ❌ masquée |
| Pronostic **ELITE** (6) | ✅ (ELITE verrouillé → upsell) | ✅ | ✅ | ❌ masquée |

→ La valeur ajoutée (sélection sur toutes les autres courses) est **conservée** ; la friction (clone du premium payé) **disparaît**.

## 5. Cas limites

- **Sélection vide** (pas de partants) : comportement inchangé (bandeau/encart déjà masqués). L'onglet n'apparaît de toute façon pas sur une course premium-accessible.
- **Aucun pronostic publié** : `viewerHasAccessiblePremiumPronostic = false` → visible pour tous.
- `activeTab` ne peut jamais valoir `"selection"` si l'onglet est retiré (défaut `"partants"`, pas de deep-link) → pas d'état cassé.

## 6. Non-objectifs (YAGNI)

- ❌ Pas de modif du **contenu** premium (différencier base/joker/confiance = chantier de fond séparé, à part).
- ❌ Pas de modif de `buildNotreSelection` ni `shouldShowNotreSelectionPromo`.
- ❌ Pas de refactor de `canAccess`.

## 7. Tests

- Logique = **wiring** dans `page.tsx` (réutilise `canAccess`). Pas de nouveau test unitaire (présentation/wiring ; env Vitest `node`). Vérif = **`tsc --noEmit`** + **suite existante verte** + **visuel**.
- **Vérif visuelle** : abonné PRO sur une course PRO → pas d'onglet / bandeau / encart « Notre sélection » ; visiteur sur la même course → visible (+ premium verrouillé) ; course sans pronostic → visible même pour l'abonné.

## 8. Fichiers impactés

- **~ `app/(public)/courses/[id]/page.tsx`** — calcul + gating (promo + prop onglet).
- **~ `components/courses/CourseTabsClient.tsx`** — prop `hideNotreSelection`, retrait conditionnel de l'onglet.

## 9. Garde-fou opérationnel (dépôt multi-agents)

Worktree isolé `feat/ns-hide-on-premium` (depuis `origin/main` post-#142), livré en **une PR**.
