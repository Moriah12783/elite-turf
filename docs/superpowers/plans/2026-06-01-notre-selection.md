# « Notre sélection » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un onglet public gratuit « Notre sélection » sur la page course (`/courses/[id]`) — une short-list de 8 chevaux générée à partir des stats de la course (favoris + drivers/entraîneurs reconnus + forme), distincte du pronostic premium.

**Architecture:** Fonction pure `buildNotreSelection(partants)` qui s'appuie sur le `score_composite` déjà calculé par `getCourseStatsEnrichies` + des bonus de réputation (listes curées). Calcul **serveur** dans `page.tsx`, passé en prop au composant client `CourseTabsClient` qui rend un nouvel onglet. Déterministe, $0, aucun appel LLM.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind, Supabase (lecture via `getCourseStatsEnrichies`), Vitest (tests).

---

## File Structure

- **Create** `lib/turf/reputation.ts` — listes curées `ELITE_DRIVERS` / `RECOGNIZED_TRAINERS` + helpers `isEliteDriver` / `isRecognizedTrainer`. Responsabilité unique : réputation des acteurs.
- **Create** `lib/courses/notre-selection.ts` — `buildNotreSelection()` + type `NotreSelectionItem`. Responsabilité unique : produire la sélection 8 à partir des partants enrichis.
- **Create** `lib/courses/notre-selection.test.ts` — tests Vitest de la logique pure.
- **Modify** `app/(public)/courses/[id]/page.tsx` — calculer `notreSelection` et le passer à `CourseTabsClient`.
- **Modify** `components/courses/CourseTabsClient.tsx` — nouvel onglet `"selection"` + composant interne `TabNotreSelection` + bandeau « lecture statistique » + CTA premium.

Note : on **ne touche PAS** à `lib/ai-pronostics/agents/field-analyzer.ts` (dé-duplication de la liste de drivers reportée — évite tout conflit avec le pipeline IA et les sessions concurrentes).

---

### Task 1 : Module réputation

**Files:**
- Create: `lib/turf/reputation.ts`
- Test: `lib/turf/reputation.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// lib/turf/reputation.test.ts
import { describe, it, expect } from "vitest";
import { isEliteDriver, isRecognizedTrainer } from "./reputation";

describe("reputation", () => {
  it("reconnaît un grand driver (sous-chaîne, insensible casse)", () => {
    expect(isEliteDriver("J.M. BAZIRE")).toBe(true);
    expect(isEliteDriver("M. Abrivard")).toBe(true);
    expect(isEliteDriver("Inconnu Dupont")).toBe(false);
    expect(isEliteDriver(null)).toBe(false);
  });
  it("reconnaît un entraîneur reconnu", () => {
    expect(isRecognizedTrainer("A. Fabre")).toBe(true);
    expect(isRecognizedTrainer("Personne")).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer le test → échec attendu**

Run: `npx vitest run lib/turf/reputation.test.ts`
Expected: FAIL (`Cannot find module './reputation'`).

- [ ] **Step 3 : Implémenter**

```ts
// lib/turf/reputation.ts
/**
 * Listes curées de réputation. "Notre sélection" s'en sert pour valoriser les
 * grands drivers/entraîneurs que les stats BDD (jeunes) ne captent pas encore.
 * Match par sous-chaîne, insensible à la casse (les noms BDD sont du type
 * "J.M. BAZIRE", "M. Abrivard").
 */
export const ELITE_DRIVERS: readonly string[] = [
  // Trot
  "bazire", "nivard", "raffin", "abrivard", "gelormini", "lebourgeois",
  "lagadeuc", "thomain", "mottier", "duvaldestin", "ploquin", "barrier", "gosselin",
  // Plat
  "soumillon", "buick", "murphy", "moore", "demuro", "guyon", "lemaire",
  "barzalona", "peslier", "boudot", "doyle", "marquand", "pasquier",
  "mendizabal", "loughnane", "lordan", "lemaitre",
  // Obstacle
  "reveley", "chevillard", "lestrade", "giles", "frost", "zuliani",
];

export const RECOGNIZED_TRAINERS: readonly string[] = [
  // Trot
  "bazire", "roussel", "cuoq", "baudron", "leveque", "desaunette", "guarato", "donio",
  // Plat / Obstacle
  "fabre", "head", "graffard", "rouget", "clement", "martinon", "chappet",
  "delzangles", "botti", "pantall", "bary", "fouin", "collet", "seror", "wattel",
];

function matches(name: string | null | undefined, list: readonly string[]): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return list.some((x) => n.includes(x));
}

export const isEliteDriver = (name: string | null | undefined): boolean =>
  matches(name, ELITE_DRIVERS);
export const isRecognizedTrainer = (name: string | null | undefined): boolean =>
  matches(name, RECOGNIZED_TRAINERS);
```

- [ ] **Step 4 : Lancer le test → succès**

Run: `npx vitest run lib/turf/reputation.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add lib/turf/reputation.ts lib/turf/reputation.test.ts
git commit -m "feat(turf): module reputation drivers/entraineurs (pour Notre selection)"
```

---

### Task 2 : `buildNotreSelection` (logique pure)

**Files:**
- Create: `lib/courses/notre-selection.ts`
- Test: `lib/courses/notre-selection.test.ts`

Rappel types (`lib/courses/stats-types.ts`) : `PartantEnrichi` étend `PartantInput` (`numero`, `nom_cheval`, `jockey?`, `entraineur?`, `cote?`, `musique?`) et ajoute `score_composite: number` (0..1), `score_breakdown: { cote; vict_cheval; forme_musique; vict_jockey }` (contributions, `cote` ∈ [0,0.35]), `forme_musique: { top3; courses; ratio } | null`.

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
// lib/courses/notre-selection.test.ts
import { describe, it, expect } from "vitest";
import { buildNotreSelection } from "./notre-selection";
import type { PartantEnrichi } from "./stats-types";

function p(over: Partial<PartantEnrichi>): PartantEnrichi {
  return {
    id: over.id ?? Math.random().toString(),
    numero: over.numero ?? 1,
    nom_cheval: over.nom_cheval ?? "Cheval",
    jockey: over.jockey ?? null,
    entraineur: over.entraineur ?? null,
    cote: over.cote ?? null,
    musique: over.musique ?? null,
    poids_kg: null,
    stats_cheval: null, stats_jockey: null, stats_entraineur: null,
    forme_musique: over.forme_musique ?? null,
    score_composite: over.score_composite ?? 0,
    score_breakdown: over.score_breakdown ?? { cote: 0, vict_cheval: 0, forme_musique: 0, vict_jockey: 0 },
    badges: { vedette: false, value_bet: false, favori: false },
  } as PartantEnrichi;
}

describe("buildNotreSelection", () => {
  it("retourne au plus 8 chevaux, triés par score décroissant", () => {
    const field = Array.from({ length: 12 }, (_, i) =>
      p({ numero: i + 1, score_composite: (12 - i) / 12, cote: i + 2 }));
    const sel = buildNotreSelection(field);
    expect(sel).toHaveLength(8);
    expect(sel[0].numero).toBe(1);          // meilleur score
    expect(sel.map((s) => s.rank)).toEqual([1,2,3,4,5,6,7,8]);
  });

  it("si < 8 partants, retourne tout le champ", () => {
    const field = [p({ numero: 1, score_composite: 0.5 }), p({ numero: 2, score_composite: 0.3 })];
    expect(buildNotreSelection(field)).toHaveLength(2);
  });

  it("étiquette 'Favori marché' au cheval à la cote la plus courte", () => {
    const field = [
      p({ numero: 1, score_composite: 0.4, cote: 8 }),
      p({ numero: 2, score_composite: 0.9, cote: 2.1 }),
    ];
    const sel = buildNotreSelection(field);
    const fav = sel.find((s) => s.numero === 2);
    expect(fav?.label).toBe("Favori marché");
  });

  it("bonus driver d'élite : remonte un cheval à score égal", () => {
    const field = [
      p({ numero: 1, score_composite: 0.50, jockey: "Inconnu" }),
      p({ numero: 2, score_composite: 0.50, jockey: "J.M. BAZIRE" }),
    ];
    const sel = buildNotreSelection(field);
    expect(sel[0].numero).toBe(2);          // Bazire passe devant
  });

  it("repli sans cote : produit quand même une sélection", () => {
    const field = Array.from({ length: 5 }, (_, i) =>
      p({ numero: i + 1, cote: null,
          score_composite: (5 - i) / 10,
          score_breakdown: { cote: 0, vict_cheval: 0.2, forme_musique: 0.1, vict_jockey: 0 } }));
    const sel = buildNotreSelection(field);
    expect(sel).toHaveLength(5);
    expect(sel[0].numero).toBe(1);
  });

  it("champ vide → []", () => {
    expect(buildNotreSelection([])).toEqual([]);
  });
});
```

- [ ] **Step 2 : Lancer → échec attendu**

Run: `npx vitest run lib/courses/notre-selection.test.ts`
Expected: FAIL (`Cannot find module './notre-selection'`).

- [ ] **Step 3 : Implémenter**

```ts
// lib/courses/notre-selection.ts
import type { PartantEnrichi } from "./stats-types";
import { isEliteDriver, isRecognizedTrainer } from "@/lib/turf/reputation";

export type SelectionLabel =
  | "Favori marché" | "Driver reconnu" | "Entraîneur reconnu"
  | "Bonne forme" | "Outsider value" | "Régulier";

export interface NotreSelectionItem {
  rank:   number;
  numero: number;
  nom:    string;
  jockey: string | null;
  cote:   number | null;
  label:  SelectionLabel;
}

const TARGET_SIZE = 8;
const BONUS_DRIVER  = 0.08;
const BONUS_TRAINER = 0.05;

export function buildNotreSelection(partants: PartantEnrichi[]): NotreSelectionItem[] {
  if (!partants || partants.length === 0) return [];

  const hasCote = partants.some((p) => typeof p.cote === "number" && (p.cote as number) > 0);
  const minCote = hasCote
    ? Math.min(...partants.filter((p) => p.cote).map((p) => p.cote as number))
    : null;

  const scored = partants
    .map((p) => {
      // Base = score_composite ; en repli (pas de cote dans le champ), on retire
      // la contribution cote du composite pour ne pas pénaliser uniformément.
      let score = p.score_composite ?? 0;
      if (!hasCote) score -= p.score_breakdown?.cote ?? 0;
      if (isEliteDriver(p.jockey))        score += BONUS_DRIVER;
      if (isRecognizedTrainer(p.entraineur)) score += BONUS_TRAINER;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored
    .slice(0, Math.min(TARGET_SIZE, scored.length))
    .map(({ p }, i) => ({
      rank:   i + 1,
      numero: p.numero,
      nom:    p.nom_cheval,
      jockey: p.jockey ?? null,
      cote:   p.cote ?? null,
      label:  pickLabel(p, minCote),
    }));
}

function pickLabel(p: PartantEnrichi, minCote: number | null): SelectionLabel {
  const ratio = p.forme_musique?.ratio ?? 0;
  if (minCote !== null && p.cote === minCote)            return "Favori marché";
  if (isEliteDriver(p.jockey))                            return "Driver reconnu";
  if (isRecognizedTrainer(p.entraineur))                  return "Entraîneur reconnu";
  if (ratio >= 0.5)                                       return "Bonne forme";
  if (p.cote != null && p.cote >= 10 && ratio >= 0.3)     return "Outsider value";
  return "Régulier";
}
```

- [ ] **Step 4 : Lancer → succès**

Run: `npx vitest run lib/courses/notre-selection.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5 : Commit**

```bash
git add lib/courses/notre-selection.ts lib/courses/notre-selection.test.ts
git commit -m "feat(courses): buildNotreSelection (top 8 stats + bonus reputation)"
```

---

### Task 3 : Calcul serveur + passage en prop

**Files:**
- Modify: `app/(public)/courses/[id]/page.tsx`

- [ ] **Step 1 : Importer + calculer** (après la ligne `const statsEnrichies = await getCourseStatsEnrichies(partants);`)

Ajouter en haut du fichier (avec les autres imports) :
```ts
import { buildNotreSelection } from "@/lib/courses/notre-selection";
```
Puis juste après `const statsEnrichies = await getCourseStatsEnrichies(partants);` :
```ts
  // « Notre sélection » : top 8 stats (favoris + drivers/entraîneurs reconnus + forme).
  // Déterministe, calculée serveur depuis les partants enrichis.
  const notreSelection = buildNotreSelection(statsEnrichies.partants);
```

- [ ] **Step 2 : Passer la prop à `CourseTabsClient`** (dans le JSX, ajouter la prop)

```tsx
            <CourseTabsClient
              courseId={c.id}
              partants={partants}
              nonPartants={nonPartants}
              arriveeOfficielle={c.arrivee_officielle}
              pronosticSelection={pronosticPublie?.selection}
              statut={c.statut}
              genyUrl={genyUrl}
              isVedette={!!pronosticPublie}
              isSubscribed={["STARTER","PRO","ELITE"].includes(userSubscription)}
              statsEnrichies={statsEnrichies}
              hasPublishedPronostic={!!pronosticPublie}
              notreSelection={notreSelection}
            />
```

- [ ] **Step 3 : Typecheck** (depuis le repo principal, qui a node_modules) — voir Task 5. Pas de commit isolé ici : Task 3 + Task 4 se compilent ensemble (la prop n'existe pas encore côté composant). On commit à la fin de Task 4.

---

### Task 4 : Onglet + composant `TabNotreSelection`

**Files:**
- Modify: `components/courses/CourseTabsClient.tsx`

- [ ] **Step 1 : Importer le type + une icône**

En haut du fichier, ajouter à l'import `lucide-react` l'icône `Sparkles`, et importer le type :
```ts
import type { NotreSelectionItem } from "@/lib/courses/notre-selection";
```

- [ ] **Step 2 : Étendre le type `Tab` + la prop**

```ts
type Tab = "partants" | "selection" | "cotes" | "arrivees" | "stats";
```
Dans `interface Props`, ajouter :
```ts
  /** Sélection stats (8 chevaux) calculée serveur. */
  notreSelection?: NotreSelectionItem[];
```

- [ ] **Step 3 : Composant `TabNotreSelection`** (à ajouter avant `// ── Composant principal ──`)

```tsx
// ── Tab : Notre sélection (lecture statistique gratuite) ────────────────────

const SELECTION_LABEL_STYLE: Record<string, string> = {
  "Favori marché":      "bg-status-win/15 text-status-win border-status-win/30",
  "Driver reconnu":     "bg-gold-faint text-gold-light border-gold-primary/30",
  "Entraîneur reconnu": "bg-gold-faint text-gold-light border-gold-primary/30",
  "Bonne forme":        "bg-blue-500/10 text-blue-400 border-blue-500/30",
  "Outsider value":     "bg-purple-500/10 text-purple-400 border-purple-500/30",
  "Régulier":           "bg-bg-elevated text-text-muted border-border",
};

function TabNotreSelection({ items }: { items: NotreSelectionItem[] }) {
  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center">
        <Sparkles className="w-8 h-8 text-text-muted mx-auto mb-3" />
        <p className="text-text-secondary text-sm font-medium mb-1">Sélection bientôt disponible</p>
        <p className="text-text-muted text-xs">Partants en cours de chargement.</p>
      </div>
    );
  }
  return (
    <div>
      {/* Bandeau : ce n'est PAS le pronostic premium */}
      <div className="m-4 p-3 rounded-xl bg-bg-elevated border border-border flex items-start gap-2">
        <BarChart3 className="w-4 h-4 text-gold-primary flex-shrink-0 mt-0.5" />
        <p className="text-text-muted text-xs leading-relaxed">
          <span className="text-text-secondary font-semibold">Lecture statistique automatique</span> —
          ce n&apos;est pas notre pronostic du jour (réservé aux 3 courses analysées par nos experts).
        </p>
      </div>

      <div className="divide-y divide-border/20">
        {items.map((s) => (
          <div key={s.numero} className="px-4 py-3 flex items-center gap-3">
            <span className="w-5 text-center text-text-muted text-xs font-mono">{s.rank}</span>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              s.rank === 1 ? "bg-status-win/20 border border-status-win/40 text-status-win" :
              s.rank <= 3 ? "bg-gold-faint border border-gold-primary/40 text-gold-light" :
              "bg-bg-elevated border border-border text-text-muted"
            }`}>{s.numero}</span>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary text-sm font-semibold truncate">{s.nom}</p>
              {s.jockey && <p className="text-text-muted text-xs truncate">{s.jockey}</p>}
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${SELECTION_LABEL_STYLE[s.label] ?? SELECTION_LABEL_STYLE["Régulier"]}`}>
              {s.label}
            </span>
            <span className="text-text-secondary text-xs font-mono w-10 text-right flex-shrink-0">
              {s.cote ? s.cote.toFixed(1) : "—"}
            </span>
          </div>
        ))}
      </div>

      {/* CTA premium */}
      <div className="m-4 p-4 rounded-xl bg-gradient-to-br from-gold-faint to-bg-elevated border border-gold-primary/30 flex items-center justify-between gap-3">
        <p className="text-text-secondary text-xs">Envie de l&apos;analyse experte du jour ?</p>
        <Link href="/pronostics" className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-xs rounded-xl transition-all shadow-gold-sm whitespace-nowrap">
          <Star className="w-3.5 h-3.5" fill="currentColor" /> Voir le pronostic premium
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4 : Brancher l'onglet** dans `CourseTabsClient`

Dans la signature du composant principal, ajouter `notreSelection,` aux props déstructurées. Puis dans le tableau `tabs`, insérer en 2ᵉ position (juste après `partants`) :
```ts
    { id: "selection", label: "Notre sélection", icon: Sparkles },
```
Et dans le rendu conditionnel, ajouter après le bloc `partants` :
```tsx
      {activeTab === "selection" && (
        <TabNotreSelection items={notreSelection ?? []} />
      )}
```

- [ ] **Step 5 : Typecheck** (cf. Task 5) puis commit

```bash
git add app/(public)/courses/[id]/page.tsx components/courses/CourseTabsClient.tsx
git commit -m "feat(courses): onglet 'Notre selection' (lecture stats gratuite + CTA premium)"
```

---

### Task 5 : Vérification finale + PR

**Files:** —

- [ ] **Step 1 : Typecheck du worktree** (le worktree n'a pas de node_modules → on type-check via le repo principal qui en a un)

Run (depuis `C:\Users\HP\elite-turf`) :
```
npx tsc --noEmit -p C:\Users\HP\etf-wt-notre-selection\tsconfig.json
```
Expected: 0 erreur sur `notre-selection.ts`, `reputation.ts`, `CourseTabsClient.tsx`, `page.tsx`. (Si le `-p` worktree ne résout pas, alternative : exécuter les tests Vitest + lint sur les fichiers modifiés.)

- [ ] **Step 2 : Lancer toute la suite de tests**

Run: `npx vitest run lib/turf/reputation.test.ts lib/courses/notre-selection.test.ts`
Expected: PASS (tous).

- [ ] **Step 3 : Push + PR**

```bash
git -C C:\Users\HP\etf-wt-notre-selection push -u origin feat/notre-selection
gh pr create --base main --head feat/notre-selection --title "feat: onglet 'Notre selection' (lecture stats par course)" --body-file <spec/summary>
```

- [ ] **Step 4 : Vérif visuelle** : ouvrir une course du jour `/courses/<id>`, cliquer l'onglet « Notre sélection » → 8 chevaux, étiquettes cohérentes, bandeau + CTA présents. Comparer avec l'onglet Statistiques.

---

## Self-review (rempli par l'auteur du plan)

- **Couverture spec** : visibilité 100% gratuit ✓ (Task 4 CTA, pas de paywall) · 8 fixes/tout-le-champ ✓ (Task 2) · cote+repli partout ✓ (Task 2 `hasCote`) · pas de vocabulaire premium ✓ (labels stats) · réutilise `getCourseStatsEnrichies` ✓ (Task 3) · réputation drivers/entraîneurs ✓ (Task 1) · bandeau distinction ✓ (Task 4). 
- **Placeholders** : aucun — tout le code est fourni.
- **Cohérence types** : `NotreSelectionItem` défini Task 2, importé Task 4 ; `buildNotreSelection(PartantEnrichi[])` aligné sur `statsEnrichies.partants`.
- **Risque dépôt concurrent** : tout en worktree isolé `feat/notre-selection`, livré en 1 PR ; pas de refactor de `field-analyzer.ts`.
