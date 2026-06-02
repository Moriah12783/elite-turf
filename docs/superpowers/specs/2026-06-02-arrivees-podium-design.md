# Spec — Refonte visuelle des arrivées (« Podium nommé »)

- **Date** : 2026-06-02
- **Statut** : Design approuvé en chat (Stéphane, 2026-06-02)
- **Type** : Refonte UI de la page Arrivées (`/arrivees/[date]`). Lisibilité mobile + desktop.

## 1. Problème

Sur `/arrivees/[date]`, chaque course affiche son arrivée en petites puces `1. 4 · 2. 2 · 3. 5 …` (l.410-429) où **le rang (« 1. ») et le n° de cheval (« 4 ») se ressemblent** (même taille, police mono, faible contraste) → illisible au premier coup d'œil, surtout sur mobile. De plus, **les noms des chevaux sont déjà chargés** (`partants.nom_cheval`) mais **non affichés** dans la liste par course.

## 2. Décision validée

Adopter un **« podium nommé »** : le **vainqueur ressort** (dossard + nom en doré), les places 2-5 sont **clairement classées** (médailles top 3, rang en label, dossard dans un rond distinct du n°). Composant **réutilisable** appliqué **aux lignes par course ET à la carte Quinté+** (harmonisation validée).

## 3. Architecture (réutilisation, $0)

- **`lib/courses/arrivee.ts`** *(nouveau)* — fonction pure `buildArriveePodium(arrivee: number[], partants: { numero: number; nom_cheval?: string | null }[]): PodiumPlace[]` où `PodiumPlace = { rank: number; numero: number; nom: string | null }`. Mappe chaque n° d'arrivée à son nom (null si introuvable). **Testable.**
- **`components/arrivees/ArriveePodium.tsx`** *(nouveau)* — composant présentation (server component). Props `{ arrivee: number[]; partants: {...}[]; compact?: boolean }`. Rend le podium. Pas de logique hors `buildArriveePodium`.
- **`app/(public)/arrivees/[date]/page.tsx`** *(modifié)* — remplace les **2** rendus d'arrivée (lignes par course `compact` + carte Quinté+ non-compact) par `<ArriveePodium />`. Les sections **rapports** restent inchangées (synthèse 3 dividendes par ligne ; grille Quinté+ Ordre/Désordre/Bonus dans la carte).

## 4. UI / UX (le podium)

- **🥇 1ᵉʳ — Vainqueur** : ligne mise en avant. Dossard **rond doré** (n° du cheval) + label `1ᵉʳ` + **NOM en doré gras**. Visible mobile **et** desktop.
- **🥈 2ᵉ · 🥉 3ᵉ** : dossards ronds teintés (argent/bronze) + label rang + nom. Nom **toujours** visible si `compact=false` (carte Quinté+) ; **masqué sur mobile** (`hidden sm:inline`) si `compact=true` (lignes par course, pour rester dense).
- **4ᵉ · 5ᵉ** : dossards ronds neutres + label rang (pas de nom).
- **+N** : si `arrivee.length > 5`, pastille « +N » (le détail complet est sur la fiche course, déjà liée).
- **Distinction place / dossard** : rang = petit label doré (`1ᵉʳ`, `2ᵉ`…) ; n° de cheval = chiffre **dans un rond** → plus de confusion possible.
- **Médailles** : emoji 🥇🥈🥉 sur le top 3 (validé par l'aperçu choisi) — repère visuel instantané.
- Charte or/sombre conservée. Aucune promesse de gain.

## 5. Responsive

- **Mobile** : vainqueur nommé (1 ligne) + dossards classés 2-5 (1 ligne, wrap). Compact.
- **Desktop** : noms 2ᵉ/3ᵉ affichés en plus.

## 6. Cas limites

- **Nom introuvable** (partant absent) → afficher le dossard seul (nom `null` → on n'affiche rien à la place du nom).
- **Arrivée < 5** chevaux → afficher ce qui existe (pas de cases vides).
- **Arrivée vide** → le composant n'est pas rendu (déjà filtré côté page : `finies` = arrivée non vide).

## 7. Non-objectifs (YAGNI)

- ❌ Pas de refonte des **rapports** (logique de synthèse conservée).
- ❌ Pas de changement des données / requêtes / SEO (JSON-LD inchangé).
- ❌ Pas de page admin (uniquement la page publique).

## 8. Tests

- **Unitaire** : `buildArriveePodium` (Vitest) — ordre des rangs (1..N), mapping n°→nom, nom `null` si partant absent, arrivée courte.
- **Composant** : présentation pure → `tsc --noEmit` + non-régression suite existante + **vérif visuelle**.

## 9. Fichiers impactés

- **+ `lib/courses/arrivee.ts`** (+ `lib/courses/arrivee.test.ts`)
- **+ `components/arrivees/ArriveePodium.tsx`**
- **~ `app/(public)/arrivees/[date]/page.tsx`** (2 remplacements)

## 10. Garde-fou opérationnel

Worktree isolé `feat/arrivees-podium` (depuis `origin/main` post-#143), livré en **une PR**.
