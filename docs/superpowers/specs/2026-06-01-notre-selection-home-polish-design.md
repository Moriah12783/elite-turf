# Spec — « Notre sélection » : doré (distinction) + encart accueil

- **Date** : 2026-06-01
- **Statut** : Design approuvé en chat (Stéphane, 2026-06-01)
- **Type** : Polish visuel (pages course) + section marketing accueil. Suite de #139/#140/#141.

## 1. Objectif

1. **Renforcer la distinction** « sélection gratuite » vs « pronostic premium » sur les pages course → mettre le **texte descriptif en doré** (aujourd'hui gris/discret).
2. **Installer le positionnement « conseil d'abord »** dès la page d'accueil via une **section explicative** : « une sélection gratuite sur chaque course ». Renforce la posture de marque (Elite Turf accompagne tous les parieurs, gratuitement, avant l'abonnement).

## 2. Décisions validées (Q&A)

| Sujet | Décision |
|---|---|
| Doré | Le paragraphe descriptif du bloc promo (`NotreSelectionPromo`, variantes **banner + sidebar**) passe de `text-text-muted` à un **doré lisible** (`text-gold-light`). |
| Encart accueil | **Explicatif / positionnement** — PAS de course ni de numéros spécifiques (générique). |
| Emplacement accueil | **Après** la section « Programme des courses du jour » (`CoursesSection`), avant `HowItWorksSection`. |
| CTA accueil | **« Voir le programme du jour → »** vers **`/courses`**. |
| Ton | Éducatif/conseil, aucune promesse de gain. |

## 3. Architecture (réutilisation, $0)

- **`components/courses/NotreSelectionPromo.tsx`** *(modifié)* — le `<p>` descriptif passe en doré (`text-gold-light`, lisible) dans les 2 variantes. Les mots-clés restent en emphase. Aucune autre logique touchée (l'affichage reste régi par `shouldShowNotreSelectionPromo`).
- **`components/home/NotreSelectionSection.tsx`** *(nouveau)* — section **statique** (server component, sans état), cohérente avec les autres sections d'accueil. Contenu : titre + paragraphe de positionnement + 3 points (« sur toutes les courses / 100 % gratuite / sans inscription ») + CTA `Link` → `/courses`. Style charte (or/sombre, `card-base`).
- **`app/(public)/page.tsx`** *(modifié)* — importer `NotreSelectionSection` et l'insérer **entre `<CoursesSection />` et `<HowItWorksSection />`**.

## 4. UI / UX

- **Doré** : teinte claire et lisible (`text-gold-light`), pas saturée — la distinction premium saute aux yeux sans nuire à la lecture.
- **Section accueil** : pleine largeur, centrée, responsive ; pills « ✓ … » en ligne ; CTA doré.
- **Copy validé** :
  > **✦ Une sélection gratuite sur chaque course**
  > Nos 3 pronostics experts du jour sont réservés aux abonnés. Mais Elite Turf ne s'arrête pas là : sur **chaque course** du programme, vous trouvez **notre sélection gratuite** — une lecture statistique (favoris au marché, drivers et entraîneurs reconnus, forme) pour **structurer vos paris** et **comprendre la course**.
  > *Parce qu'avant tout, nous sommes là pour vous conseiller.*
  > ✓ Sur toutes les courses · ✓ 100 % gratuite · ✓ Sans inscription
  > **〔 Voir le programme du jour → 〕**
- **Aucune promesse de gain.**

## 5. Cas limites

- Section accueil **statique** → toujours affichée (c'est du positionnement de marque, pas de condition d'abonnement ni de données par course).
- Le doré ne modifie **aucune** logique d'affichage (changement de couleur uniquement).

## 6. Non-objectifs (YAGNI)

- ❌ Pas de course en vedette / numéros sur l'accueil (générique assumé).
- ❌ Pas de personnalisation par statut sur la section accueil.
- ❌ Pas de modification de `shouldShowNotreSelectionPromo` (visible pour tous, inchangé).

## 7. Tests

- `NotreSelectionPromo` (doré) et `NotreSelectionSection` = **présentation pure**, sans logique. L'env Vitest est `node` (pas de jsdom) → **pas de test de rendu React** : on s'appuie sur **`tsc --noEmit`** + **vérif visuelle**. (Honnête : pas de test UI, assumé.)
- **Non-régression** : la suite Vitest existante (`lib/**`) doit rester verte.

## 8. Fichiers impactés

- **~ `components/courses/NotreSelectionPromo.tsx`** — texte descriptif en doré (2 variantes).
- **+ `components/home/NotreSelectionSection.tsx`** — nouvelle section accueil.
- **~ `app/(public)/page.tsx`** — insertion de la section après `CoursesSection`.

## 9. Garde-fou opérationnel (dépôt multi-agents)

Worktree isolé `feat/notre-selection-home` (depuis `origin/main` post-#141), livré en **une PR**.
