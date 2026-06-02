# Performances par formule (Élite / Pro-Starter / Gratuit) — Design

**Date :** 2026-06-02
**Page concernée :** `app/(public)/performances/page.tsx`

## Objectif

Permettre à un visiteur de `/performances` de voir le track-record **par formule**
(Élite, Pro/Starter, Gratuit) au lieu d'un seul agrégat global. Une **barre
segmentée** sous le titre :
1. **compare** les formules d'un coup d'œil (chaque pastille affiche taux + volume) ;
2. **re-scope** toute la page (KPIs, graphe mensuel, par type, par hippodrome,
   répartition, historique) sur la formule sélectionnée.

But business : levier de conversion (un prospect voit le record de SA formule) +
preuve que chaque offre performe.

## Contexte & données

- `pronostics.niveau_acces : PronosticLevel = "GRATUIT" | "STARTER" | "PRO" | "ELITE"`
  (cf. `types/index.ts`).
- **Prod (publie=true, mesuré 2026-06-02)** : ELITE 68 (60 %), PRO 64 (64 %),
  GRATUIT 40 (48 %). **Aucun pronostic `STARTER` en base** → le groupe
  « Pro/Starter » = `niveau_acces ∈ {PRO, STARTER}` (STARTER inclus pour le futur).
- Page actuelle : **server component**, fetch **tous** les pronostics publiés une
  fois, calcule tout en mémoire (KPIs, graphe 6 mois, par type, par hippodrome,
  répartition 3 états, historique 30, bandeau 30 j + gains). `revalidate = 600` (ISR).
- ⚠️ **Gains € encore partiels** : les `rapport_gagnant` ne sont pas tous propagés
  (backfill cron `40 22 UTC` introduit par PR #152, 1er passage le soir même). Donc
  le design **mène avec le taux + le volume** (fiables) ; les gains restent affichés
  mais avec une note discrète si la formule a peu de rapports connus.

## Approche retenue

**Barre segmentée via URL param `?formule=`**, server-side, ISR-cachée. On filtre
**en mémoire** la liste déjà chargée → **zéro requête supplémentaire**. Tout le
calcul de stats existant tourne **inchangé** sur la liste filtrée.

Rejeté (YAGNI) :
- Toggle client instantané (un state React + gros refactor du JSX en composant
  client). L'URL param + ISR est assez rapide et bien plus simple/sûr.
- Section comparatif séparée (les pastilles portent déjà la comparaison).
- Courbes multi-séries.

### Formules

| clé (`?formule=`) | label UI        | `niveaux` (filtre)        |
|-------------------|-----------------|---------------------------|
| `tous` (défaut)   | Tous            | `null` (= aucun filtre)   |
| `elite`           | Élite           | `["ELITE"]`               |
| `pro`             | Pro / Starter   | `["PRO", "STARTER"]`      |
| `gratuit`         | Gratuit         | `["GRATUIT"]`             |

Valeur inconnue/absente → `tous`.

### Module pur `lib/performances/tier-stats.ts`

```ts
import type { PronosticLevel } from "@/types";

export type FormuleKey = "tous" | "elite" | "pro" | "gratuit";

export interface Formule {
  key: FormuleKey;
  label: string;
  niveaux: PronosticLevel[] | null; // null = toutes
}

export const FORMULES: Formule[] = [
  { key: "tous",    label: "Tous",          niveaux: null },
  { key: "elite",   label: "Élite",         niveaux: ["ELITE"] },
  { key: "pro",     label: "Pro / Starter", niveaux: ["PRO", "STARTER"] },
  { key: "gratuit", label: "Gratuit",       niveaux: ["GRATUIT"] },
];

export function resolveFormule(raw: string | undefined): Formule;
// → FORMULES match par key, sinon FORMULES[0] (tous)

export interface TierLite { resultat: string; niveau_acces: PronosticLevel | null; }

export function filterByFormule<T extends TierLite>(list: T[], f: Formule): T[];
// → f.niveaux === null ? list : list.filter(p => f.niveaux!.includes(p.niveau_acces))

export interface TierSummary { total: number; termines: number; gagnants: number; taux: number; }

export function summarizeTier<T extends TierLite>(list: T[], f: Formule): TierSummary;
// total = items du tier ; termines = resultat != EN_ATTENTE ;
// gagnants = resultat == GAGNANT ; taux = round(gagnants/termines*100) (0 si termines=0)
```

Pur, sans dépendance Supabase → **testé unitairement**.

### Flux de données (page)

1. Signature : `export default async function PerformancesPage({ searchParams }: { searchParams: { formule?: string } })`.
2. `const formule = resolveFormule(searchParams.formule)`.
3. Fetch **tous** les pronostics publiés (inchangé) → `allPronostics`.
4. `const scoped = filterByFormule(allPronostics, formule)`.
5. **Renommer** la variable `pronostics` (qui alimente déjà toutes les sections)
   pour qu'elle pointe sur `scoped`. Aucune autre ligne de calcul ne change.
6. Pastilles : `FORMULES.map(f => summarizeTier(allPronostics, f))` (toujours
   calculées sur la liste **complète**, indépendantes du filtre).

### Composant `components/performances/FormuleTabs.tsx` (server, présentationnel)

- Props : `active: FormuleKey`, `summaries: { key: FormuleKey; label: string; taux: number; total: number }[]`.
- Rend 4 `<Link>` (Next) :
  - `href` = `formule==="tous" ? "/performances" : "/performances?formule="+key`, `scroll={false}`.
  - Pastille active : fond doré (`bg-gold-primary text-bg-primary`), inactive :
    `bg-bg-elevated text-text-secondary hover:border-gold-primary/30`.
  - Contenu pastille : `label` en gras + sous-ligne `{taux}% · {total}` (si
    `total === 0` → afficher `—` au lieu du taux ; pastille cliquable quand même).
- Pas de `"use client"` : l'état actif vient des `searchParams` (server). Responsive :
  `flex flex-wrap gap-2` (mobile : pastilles s'enroulent).
- Placé **entre `PageHero` et le bandeau 30 j**, dans un conteneur centré
  `max-w-6xl`.

### Honnêteté gains

Dans le bandeau 30 j (déjà présent) : si, pour la formule active, des gagnants
n'ont pas de `rapport_gagnant`, ajouter une note discrète
« rapports en cours de consolidation » (au lieu de laisser croire au sous-total
exhaustif). Calcul : `scoped.filter(GAGNANT && rapport==null).length > 0`.

## Error handling / edge cases

- Formule invalide → `tous` (jamais d'erreur).
- Tier vide (`total === 0`) → pastille affiche `—`, sections affichent leurs
  empty-states existants (« Données disponibles après… »).
- `niveau_acces` null (vieux pronostic) → exclu des tiers nommés, présent dans `tous`.

## Testing

`lib/performances/tier-stats.test.ts` :
- `resolveFormule` : clé valide, clé inconnue → tous, undefined → tous.
- `filterByFormule` : `tous` renvoie tout ; `pro` renvoie PRO **et** STARTER ;
  `elite` exclut PRO.
- `summarizeTier` : taux correct, exclusion `EN_ATTENTE` du dénominateur, liste
  vide → `{0,0,0,0}`.

Pas de test sur le server component (couvert par les helpers purs + `tsc`).

## SEO

`canonical` reste `${APP_URL}/performances`. Les variantes `?formule=` ne sont pas
indexées séparément (query param + canonical les rattache). Pas de changement meta.

## Périmètre des fichiers

- **Créer** `lib/performances/tier-stats.ts` (+ `.test.ts`).
- **Créer** `components/performances/FormuleTabs.tsx`.
- **Modifier** `app/(public)/performances/page.tsx` : signature `searchParams`,
  `resolveFormule` + filtre `scoped`, insertion `<FormuleTabs>`, note gains.

Aucune refonte du visuel existant : on **ajoute une dimension**, on ne casse rien.
