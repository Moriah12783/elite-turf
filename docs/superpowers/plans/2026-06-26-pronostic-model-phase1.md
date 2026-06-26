# Refonte modèle de pronostic — Phase 1 (Elite « plan de jeu » + audience BF) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Donner à l'Elite une nature différente du Pro — un **plan de jeu** déterministe (banker + mise en unités + value + Quinté+) — et prioriser les courses jouables au Burkina, sans nouveau scraper.

**Architecture:** On garde le pipeline `lib/ai-pronostics/` (CourseSelector → FieldAnalyzer → SelectionBuilder → AnalyseWriter → QualityValidator → review humaine). On ajoute un **module pur déterministe** `elite-plan.ts` qui transforme la sélection Elite en plan de jeu, branché dans l'AnalyseWriter, affiché distinctement, et publié. Le choix des courses devient *audience-aware* (Burkina).

**Tech Stack:** TypeScript, Next.js 14 (App Router), Supabase, Vitest (`npm test`), `tsc --noEmit` + `npm run build` comme gates (cf. CLAUDE.md du repo). Référence : `docs/superpowers/specs/2026-06-26-pronostic-model-design.md`.

**Gates rappelés :** avant chaque commit qui touche le typage : `rm -rf .next/types && npx tsc --noEmit`. Tests : `npm test` (vitest). Pas de promesse de gain, mises en **unités** (jamais €).

---

## File Structure

- **Create** `lib/ai-pronostics/elite-plan.ts` — module PUR : `buildElitePlanDeJeu()` (sélection Elite → plan de jeu). Zéro I/O, zéro LLM → 100% testable.
- **Create** `lib/ai-pronostics/elite-plan.test.ts` — tests vitest du module.
- **Modify** `lib/ai-pronostics/types.ts` — type `ElitePlanDeJeu` + champ optionnel `plan_de_jeu` dans `AnalyseWriterResult.subscriber_content`.
- **Modify** `lib/ai-pronostics/agents/selection-builder.ts` — branche ELITE : banker + base resserrée + orientation value.
- **Modify** `lib/ai-pronostics/agents/analyse-writer.ts` — peuple `plan_de_jeu` pour les drafts ELITE.
- **Modify** `lib/ai-pronostics/agents/quality-validator.ts` — check « ELITE a un plan_de_jeu complet ».
- **Modify** `lib/ai-pronostics/agents/course-selector.ts` — scoring *audience-aware* Burkina (priorise PMU_INTERNATIONAL).
- **Modify** display : `app/(public)/pronostics/[id]/page.tsx`, `components/pronostics/PronosticCard.tsx` — rendu du plan de jeu Elite.
- **Modify** publication (route de publish des drafts → table `pronostics`) — transporte `plan_de_jeu`.

---

## Task 1 : Type `ElitePlanDeJeu` + champ `plan_de_jeu`

**Files:**
- Modify: `lib/ai-pronostics/types.ts` (section 10, `AnalyseWriterResult.subscriber_content`)

- [ ] **Step 1 — Ajouter le type `ElitePlanDeJeu`** (avant `AnalyseWriterResult`, section 10)

```ts
/**
 * Plan de jeu ELITE (déterministe) — la différence de NATURE vs Pro.
 * Mises exprimées en UNITÉS (jamais en €) — jeu responsable.
 */
export interface ElitePlanDeJeu {
  banker: { number: number; name: string; justification: string };
  bet_strategy: {
    type_pari: string;                 // ex: "Quinté+ (ordre/désordre)", "Quarté+", "Tiercé"
    champ_reduit: number[];            // numéros du champ conseillé
    mise_unites: Array<{ libelle: string; unites: number }>;  // ex: {libelle:"Base couplé 7-3", unites:5}
  };
  value_picks: Array<{ number: number; name: string; raison: string }>;
  quinte_plan: { base: number[]; champ: number[]; strategie: string } | null;
}
```

- [ ] **Step 2 — Ajouter le champ optionnel** dans `AnalyseWriterResult.subscriber_content` (juste après `responsible_note: string;`)

```ts
    responsible_note: string;
    /** Présent UNIQUEMENT pour les drafts ELITE (cf. elite-plan.ts). */
    plan_de_jeu?: ElitePlanDeJeu;
```

- [ ] **Step 3 — Vérifier la compilation**

Run: `cd "C:/Users/HP/elite-turf" && rm -rf .next/types && npx tsc --noEmit`
Expected: exit 0 (aucune erreur).

- [ ] **Step 4 — Commit**

```bash
git add lib/ai-pronostics/types.ts
git commit -m "feat(ia): type ElitePlanDeJeu + champ plan_de_jeu (subscriber_content)"
```

---

## Task 2 : Module pur `buildElitePlanDeJeu` (TDD)

Transforme une sélection Elite (chevaux avec rôle + scores) + les paris disponibles en `ElitePlanDeJeu` déterministe. Aucune dépendance externe.

**Files:**
- Create: `lib/ai-pronostics/elite-plan.ts`
- Test: `lib/ai-pronostics/elite-plan.test.ts`

- [ ] **Step 1 — Écrire les tests d'abord**

```ts
import { describe, it, expect } from "vitest";
import { buildElitePlanDeJeu, type EliteSelectionInput } from "./elite-plan";

const base: EliteSelectionInput = {
  runners: [
    { number: 7, name: "Alpha",   role: "BASE",     confidence_score: 80, value_score: 30 },
    { number: 3, name: "Bravo",   role: "APPUI",    confidence_score: 70, value_score: 40 },
    { number: 12, name: "Charlie", role: "OUTSIDER", confidence_score: 50, value_score: 75 },
    { number: 5, name: "Delta",   role: "APPUI",    confidence_score: 65, value_score: 35 },
  ],
  paris_disponibles: ["QUINTE_PLUS", "QUARTE_PLUS", "TIERCE"],
};

describe("buildElitePlanDeJeu", () => {
  it("désigne le banker = meilleur confidence_score", () => {
    const p = buildElitePlanDeJeu(base);
    expect(p.banker.number).toBe(7);
    expect(p.banker.name).toBe("Alpha");
    expect(p.banker.justification.length).toBeGreaterThan(0);
  });

  it("cible les value_picks (value_score >= 50)", () => {
    const p = buildElitePlanDeJeu(base);
    expect(p.value_picks.map((v) => v.number)).toEqual([12]);
  });

  it("choisit le meilleur type de pari dispo (Quinté+ prioritaire)", () => {
    const p = buildElitePlanDeJeu(base);
    expect(p.bet_strategy.type_pari).toMatch(/Quinté\+/);
    expect(p.bet_strategy.champ_reduit).toEqual([7, 3, 12, 5]);
  });

  it("retombe sur Quarté+ si pas de Quinté+", () => {
    const p = buildElitePlanDeJeu({ ...base, paris_disponibles: ["QUARTE_PLUS", "TIERCE"] });
    expect(p.bet_strategy.type_pari).toMatch(/Quarté\+/);
    expect(p.quinte_plan).toBeNull();
  });

  it("produit un quinte_plan (base = top confidence, champ = le reste) si Quinté+ dispo", () => {
    const p = buildElitePlanDeJeu(base);
    expect(p.quinte_plan).not.toBeNull();
    expect(p.quinte_plan!.base).toEqual([7, 3]);     // 2 meilleurs confidence
    expect(p.quinte_plan!.champ).toEqual([5, 12]);   // le reste, trié par confidence
  });

  it("exprime les mises en UNITÉS, jamais en euros", () => {
    const p = buildElitePlanDeJeu(base);
    expect(p.bet_strategy.mise_unites.length).toBeGreaterThan(0);
    for (const m of p.bet_strategy.mise_unites) {
      expect(typeof m.unites).toBe("number");
      expect(m.libelle).not.toMatch(/€|euro/i);
    }
  });
});
```

- [ ] **Step 2 — Lancer les tests (doivent échouer)**

Run: `cd "C:/Users/HP/elite-turf" && npx vitest run lib/ai-pronostics/elite-plan.test.ts`
Expected: FAIL (`buildElitePlanDeJeu` n'existe pas).

- [ ] **Step 3 — Implémenter le module**

```ts
/**
 * lib/ai-pronostics/elite-plan.ts
 *
 * Module PUR (zéro I/O, zéro LLM) : transforme une sélection ELITE en
 * "plan de jeu" — la différence de NATURE entre Elite et Pro (cf. spec
 * 2026-06-26-pronostic-model-design). Mises en UNITÉS (jamais €).
 */
import type { ElitePlanDeJeu } from "./types";

export interface EliteRunnerInput {
  number: number;
  name: string;
  role: "BASE" | "APPUI" | "OUTSIDER" | "COMPLEMENT";
  confidence_score: number;
  value_score: number;
}

export interface EliteSelectionInput {
  runners: EliteRunnerInput[];
  paris_disponibles: string[];
}

const VALUE_THRESHOLD = 50;

/** Choisit le meilleur type de pari disponible (du plus prestigieux au moins). */
function pickBetType(paris: string[]): { type_pari: string; isQuinte: boolean } {
  if (paris.includes("QUINTE_PLUS")) return { type_pari: "Quinté+ (ordre/désordre)", isQuinte: true };
  if (paris.includes("QUARTE_PLUS") || paris.includes("QUARTE")) return { type_pari: "Quarté+", isQuinte: false };
  if (paris.includes("TIERCE")) return { type_pari: "Tiercé", isQuinte: false };
  return { type_pari: "Couplé", isQuinte: false };
}

export function buildElitePlanDeJeu(input: EliteSelectionInput): ElitePlanDeJeu {
  // Tri par confidence décroissante (le banker = plus haute confiance).
  const byConfidence = [...input.runners].sort((a, b) => b.confidence_score - a.confidence_score);
  const banker = byConfidence[0];

  const { type_pari, isQuinte } = pickBetType(input.paris_disponibles);

  // Champ réduit = les numéros de la sélection, ordre d'origine (mérite).
  const champ_reduit = input.runners.map((r) => r.number);

  // value_picks = chevaux sous-cotés (value_score élevé) = le "edge".
  const value_picks = input.runners
    .filter((r) => r.value_score >= VALUE_THRESHOLD)
    .map((r) => ({
      number: r.number,
      name: r.name,
      raison: `Cote supérieure à sa probabilité estimée (value ${r.value_score}/100)`,
    }));

  // Mise en UNITÉS — template responsable, jamais d'euros.
  const mise_unites = [
    { libelle: `Base autour du n°${banker.number} (${banker.name})`, unites: 5 },
    { libelle: `Champ réduit ${champ_reduit.join("-")}`, unites: 2 },
  ];

  // Quinté+ travaillé : base = 2 meilleurs confidence, champ = le reste (par confidence).
  const quinte_plan = isQuinte
    ? {
        base: byConfidence.slice(0, 2).map((r) => r.number),
        champ: byConfidence.slice(2).map((r) => r.number),
        strategie:
          "Jouer la base en couverture ordre + désordre, compléter par le champ. " +
          "Privilégier le désordre si le field est ouvert.",
      }
    : null;

  return {
    banker: {
      number: banker.number,
      name: banker.name,
      justification: `Plus haute confiance de la sélection (${banker.confidence_score}/100) — pivot du jeu.`,
    },
    bet_strategy: { type_pari, champ_reduit, mise_unites },
    value_picks,
    quinte_plan,
  };
}
```

- [ ] **Step 4 — Lancer les tests (doivent passer)**

Run: `cd "C:/Users/HP/elite-turf" && npx vitest run lib/ai-pronostics/elite-plan.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5 — Commit**

```bash
git add lib/ai-pronostics/elite-plan.ts lib/ai-pronostics/elite-plan.test.ts
git commit -m "feat(ia): buildElitePlanDeJeu — plan de jeu Elite deterministe (TDD)"
```

---

## Task 3 : SelectionBuilder ELITE — banker + value (cœur resserré)

Adapter la branche `ELITE` de `buildDeterministicSelection` pour produire un cœur resserré orienté value : top par mérite **garantissant** au moins 1 cheval value si dispo (le banker reste le mieux noté).

**Files:**
- Modify: `lib/ai-pronostics/agents/selection-builder.ts` (fonction `buildDeterministicSelection`, `case "ELITE"`)
- Test: `lib/ai-pronostics/selection-builder.elite.test.ts` (create)

- [ ] **Step 1 — Lire la branche actuelle** `case "ELITE"` (lignes ~143-153) pour conserver la signature `RankedRunner[]` et `eligible`.

- [ ] **Step 2 — Écrire le test** (create `selection-builder.elite.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { runSelectionBuilderAgent } from "./agents/selection-builder";
import type { FieldAnalyzerResult } from "./types";

function runner(n: number, score: number, value: number, profile = "FAVORI_LOGIQUE") {
  return {
    runner_id: `r${n}`, number: n, name: `H${n}`,
    global_score: score, confidence_score: score, regularity_score: score,
    form_score: score, distance_score: 50, terrain_score: 50,
    jockey_driver_score: 50, trainer_score: 50, value_score: value, risk_score: 20,
    profile, strengths: [], weaknesses: [], missing_data: [],
    notes_for_selection_builder: "",
  };
}

const field: FieldAnalyzerResult = {
  agent: "FieldAnalyzer", course_id: "c1", validation_status: "VALIDATION_PMU_INTERNATIONAL",
  status: "OK", data_completeness_score: 70, field_quality_score: 70, race_complexity: "MEDIUM",
  main_risks: [], top_signals: [], red_flags: [],
  runners_analysis: [
    runner(1, 85, 20), runner(2, 80, 25), runner(3, 75, 30), runner(4, 70, 35),
    runner(5, 60, 80, "OUTSIDER"), runner(6, 55, 40), runner(7, 50, 45), runner(8, 45, 30),
  ],
};

describe("SelectionBuilder ELITE", () => {
  it("produit une sélection ELITE qui inclut le cheval value (n°5)", async () => {
    const { result } = await runSelectionBuilderAgent({
      field, access_level: "ELITE", validation_status: "VALIDATION_PMU_INTERNATIONAL",
      course_libelle: "Test", course_hippodrome: "Vincennes",
    });
    const nums = result.selected_runners.map((r) => r.number);
    expect(nums).toContain(5);               // le value pick est retenu
    expect(result.selected_runners[0].number).toBe(1); // banker = meilleur score en tête
  });
});
```

- [ ] **Step 3 — Lancer le test (échoue ou passe selon l'existant)**

Run: `cd "C:/Users/HP/elite-turf" && npx vitest run lib/ai-pronostics/selection-builder.elite.test.ts`
Expected: noter le résultat (l'ancienne logique « top5 + 1 outsider » peut déjà inclure le n°5 ; le test fige le comportement voulu).

- [ ] **Step 4 — Ajuster la branche ELITE** pour garantir banker en tête + 1 value pick. Remplacer le `case "ELITE"` par :

```ts
    case "ELITE": {
      // Cœur resserré ELITE : le banker (meilleur score) en tête, puis les
      // meilleurs, en GARANTISSANT 1 cheval "value" (cote > proba) si dispo —
      // c'est le edge Elite (cf. elite-plan.ts).
      const core = eligible.slice(0, 5);
      const valuePick = eligible
        .slice(0)
        .sort((a, b) => b.value_score - a.value_score)
        .find((r) => r.value_score >= 50 && !core.includes(r) && r.risk_score < 65);
      return valuePick ? [...core, valuePick] : eligible.slice(0, 6);
    }
```

- [ ] **Step 5 — Lancer le test (doit passer)**

Run: `cd "C:/Users/HP/elite-turf" && npx vitest run lib/ai-pronostics/selection-builder.elite.test.ts`
Expected: PASS.

- [ ] **Step 6 — Tests de non-régression + commit**

Run: `cd "C:/Users/HP/elite-turf" && npm test`
Expected: vert (aucun test cassé).
```bash
git add lib/ai-pronostics/agents/selection-builder.ts lib/ai-pronostics/selection-builder.elite.test.ts
git commit -m "feat(ia): SelectionBuilder Elite garantit banker + value pick"
```

---

## Task 4 : AnalyseWriter — peupler `plan_de_jeu` pour l'Elite

**Files:**
- Modify: `lib/ai-pronostics/agents/analyse-writer.ts`

- [ ] **Step 1 — Lire `analyse-writer.ts`** : repérer (a) où `subscriber_content` est construit, (b) comment l'`access_level` et la sélection (`selected_runners` + scores) sont disponibles, (c) la liste `paris_disponibles` de la course (la passer en input si absente).

- [ ] **Step 2 — Importer le builder** en tête du fichier :

```ts
import { buildElitePlanDeJeu, type EliteRunnerInput } from "../elite-plan";
```

- [ ] **Step 3 — Après construction de `subscriber_content`, si `access_level === "ELITE"`, calculer + attacher le plan** (adapter les noms de variables locales au fichier réel) :

```ts
if (access_level === "ELITE") {
  const runners: EliteRunnerInput[] = selection.map((r) => ({
    number: r.number,
    name: r.name,
    role: r.role,
    confidence_score: r.confidence_score,
    value_score: fieldByNumber.get(r.number)?.value_score ?? 0, // value depuis le FieldAnalyzer
  }));
  subscriber_content.plan_de_jeu = buildElitePlanDeJeu({
    runners,
    paris_disponibles: parisDisponibles, // depuis la course (cf. Step 1)
  });
}
```

Note d'intégration : si le `value_score` n'est pas accessible dans l'AnalyseWriter, le faire remonter depuis le `SelectionBuilderResult`/`FieldAnalyzerResult` (déjà dans le pipeline). Si `paris_disponibles` n'est pas dispo, l'ajouter à l'input de l'agent (`CourseCandidate.paris_disponibles` existe déjà — le threader).

- [ ] **Step 4 — Vérifier la compilation**

Run: `cd "C:/Users/HP/elite-turf" && rm -rf .next/types && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5 — Commit**

```bash
git add lib/ai-pronostics/agents/analyse-writer.ts
git commit -m "feat(ia): AnalyseWriter peuple plan_de_jeu pour les drafts Elite"
```

---

## Task 5 : QualityValidator — exiger un `plan_de_jeu` complet pour l'Elite

**Files:**
- Modify: `lib/ai-pronostics/agents/quality-validator.ts`

- [ ] **Step 1 — Lire `quality-validator.ts`** : repérer le bloc `access_level_check` et la liste `blocking_issues`.

- [ ] **Step 2 — Ajouter un check** (NON bloquant → `warnings`, car l'humain affine l'Elite ; bloquant seulement si carrément absent) : si `access_level === "ELITE"` et `subscriber_content.plan_de_jeu` absent OU `banker` manquant → push un warning sévérité HIGH `code: "ELITE_PLAN_MISSING"`.

```ts
if (draft.access_level === "ELITE") {
  const plan = draft.subscriber_content?.plan_de_jeu;
  if (!plan || !plan.banker || !plan.bet_strategy) {
    warnings.push({
      code: "ELITE_PLAN_MISSING",
      message: "Draft ELITE sans plan de jeu complet (banker + stratégie) — à compléter avant publication.",
      severity: "HIGH",
    });
  }
}
```

- [ ] **Step 3 — Compilation + commit**

Run: `cd "C:/Users/HP/elite-turf" && rm -rf .next/types && npx tsc --noEmit`
```bash
git add lib/ai-pronostics/agents/quality-validator.ts
git commit -m "feat(ia): QualityValidator signale un Elite sans plan de jeu"
```

---

## Task 6 : CourseSelector — scoring *audience-aware* Burkina

**Files:**
- Modify: `lib/ai-pronostics/agents/course-selector.ts`

- [ ] **Step 1 — Lire `course-selector.ts`** : repérer le calcul de `africa_course_score` + l'attribution de `validation_status` (les 3 paliers).

- [ ] **Step 2 — Ajouter un bonus audience** : pour l'audience Burkina, une course `VALIDATION_PMU_INTERNATIONAL` (grande course France redistribuée sur PMUB) ne doit PAS être pénalisée vs `VALIDATION_LONACI_DIRECTE`. Introduire une constante d'audience et un bonus :

```ts
// Audience actuelle = Burkina (abonnés PMUB). Les grandes courses PMU France
// (palier PMU_INTERNATIONAL) sont jouables sur PMUB → on les valorise.
const AUDIENCE_COUNTRY = "BF";
function audienceBonus(v: ValidationStatus): number {
  if (AUDIENCE_COUNTRY === "BF" && v === "VALIDATION_PMU_INTERNATIONAL") return 15;
  return 0;
}
```
Puis ajouter `audienceBonus(validation_status)` au `africa_course_score` (cappé à 100).

- [ ] **Step 3 — Compilation + (si une fonction de score pure existe) test ; sinon vérif tsc + commit**

Run: `cd "C:/Users/HP/elite-turf" && rm -rf .next/types && npx tsc --noEmit && npm test`
```bash
git add lib/ai-pronostics/agents/course-selector.ts
git commit -m "feat(ia): course-selector audience-aware Burkina (bonus PMU_INTERNATIONAL)"
```

---

## Task 7 : Affichage — rendre le plan de jeu Elite

**Files:**
- Modify: `app/(public)/pronostics/[id]/page.tsx`
- Modify: `components/pronostics/PronosticCard.tsx`

- [ ] **Step 1 — Lire les 2 fichiers** : repérer où le `subscriber_content` (selection, suggested_ticket) est rendu pour un abonné ayant accès (`canAccess` true).

- [ ] **Step 2 — Si `plan_de_jeu` présent (Elite), afficher un bloc dédié** sous la sélection : un encart « 👑 Plan de jeu » avec : le **banker** (mis en avant), la **stratégie de pari** (`type_pari` + `champ_reduit`), les **mises en unités** (liste), les **value picks**, et le **Quinté+ travaillé** (base/champ/stratégie). Réutiliser les classes thème (`card-base`, `text-gold-*`).

- [ ] **Step 3 — Build de vérification**

Run: `cd "C:/Users/HP/elite-turf" && rm -rf .next/types && npx tsc --noEmit && npm run build`
Expected: build vert.

- [ ] **Step 4 — Vérif visuelle** (post-déploiement, connecté Elite) : la fiche pronostic Elite montre le bloc « Plan de jeu » ; le Pro montre la hiérarchie + ticket (inchangé). Commit.

```bash
git add "app/(public)/pronostics/[id]/page.tsx" components/pronostics/PronosticCard.tsx
git commit -m "feat(pronostics): affichage du plan de jeu Elite"
```

---

## Task 8 : Publication — transporter `plan_de_jeu` du draft vers `pronostics`

**Files:**
- Modify: la route/action qui publie un `ai_pronostic_draft` → table `pronostics` (à localiser : `grep -ril "ai_pronostic_drafts" app/api app/(admin)`)

- [ ] **Step 1 — Localiser le code de publication** (admin /pronostics/ai-review → publish). Identifier comment `subscriber_content`/`selection` est copié dans `pronostics`.

- [ ] **Step 2 — S'assurer que `plan_de_jeu` est inclus** dans le contenu copié vers `pronostics` (colonne contenu jsonb). Si la table `pronostics` n'a pas de colonne contenu riche, stocker `plan_de_jeu` dans la colonne jsonb existante du pronostic (à confirmer en lisant le schéma `pronostics`).

- [ ] **Step 3 — Vérif** : un draft Elite publié conserve son `plan_de_jeu` lisible côté fiche publique. tsc + build + commit.

```bash
git add <fichiers publication>
git commit -m "feat(pronostics): publication conserve le plan de jeu Elite"
```

---

## Self-Review (couverture spec Phase 1)

- ✅ Elite « plan de jeu » (banker + mise unités + value + Quinté+) → Tasks 1,2,3,4,7,8.
- ✅ Audience Burkina (PMU_INTERNATIONAL valorisé) → Task 6.
- ✅ Garde-fous (review humaine, pas de €, warning si plan manquant) → Tasks 2,5.
- ✅ Honnêteté (value = edge, pas de promesse) → Task 2 (raison value), pas de "garanti".
- Hors Phase 1 (plans séparés) : Pro hiérarchisé VISIBLE (Phase 2), scraper LONAB (Phase 3).

**Notes d'intégration honnêtes** : Tasks 4, 6, 7, 8 exigent de **lire le fichier cible d'abord** (signatures locales) — les contrats/insertions sont spécifiés, le code exact se finalise sur le fichier réel. Tasks 1, 2, 3 sont entièrement codées + testées.
