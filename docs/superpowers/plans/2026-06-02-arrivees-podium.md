# Arrivées « Podium nommé » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Remplacer l'affichage illisible des arrivées par un « podium nommé » (vainqueur en avant + 2-5 classés, médailles, dossards ronds, noms), sur les lignes par course et la carte Quinté+.

**Architecture:** Helper pur `buildArriveePodium` (testé) + composant `ArriveePodium` + 2 remplacements dans `page.tsx`.

**Tech Stack:** Next.js 14 (server components), Tailwind, Vitest.

---

### Task 1 : Helper `buildArriveePodium` (pur, testé)

**Files:** Create `lib/courses/arrivee.ts` + `lib/courses/arrivee.test.ts`

- [ ] **Step 1 — Test (échoue)** : `lib/courses/arrivee.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildArriveePodium } from "./arrivee";

describe("buildArriveePodium", () => {
  const partants = [
    { numero: 4, nom_cheval: "Imperator d'Em" },
    { numero: 2, nom_cheval: "Goldy Smile" },
    { numero: 5, nom_cheval: "High Tech Roc" },
  ];
  it("classe les places 1..N et mappe les noms", () => {
    expect(buildArriveePodium([4, 2, 5], partants)).toEqual([
      { rank: 1, numero: 4, nom: "Imperator d'Em" },
      { rank: 2, numero: 2, nom: "Goldy Smile" },
      { rank: 3, numero: 5, nom: "High Tech Roc" },
    ]);
  });
  it("nom null si partant absent ou nom manquant", () => {
    expect(buildArriveePodium([9], partants)[0].nom).toBeNull();
    expect(buildArriveePodium([7], [{ numero: 7 }])[0].nom).toBeNull();
  });
  it("arrivée vide ou null → []", () => {
    expect(buildArriveePodium([], partants)).toEqual([]);
    expect(buildArriveePodium(null, partants)).toEqual([]);
  });
});
```

- [ ] **Step 2 — Run RED** : `Set-Location C:\Users\HP\etf-wt-ns-promo; npx -y vitest run lib/courses/arrivee.test.ts` → FAIL (module manquant).

- [ ] **Step 3 — Implémenter** : `lib/courses/arrivee.ts`

```ts
/**
 * lib/courses/arrivee.ts
 * Transforme une arrivée officielle (ordre des n° de chevaux) en liste de
 * places enrichies du nom du cheval (null si le partant est introuvable).
 * Pur, sans I/O — utilisé par le composant ArriveePodium.
 */

export interface PodiumPlace {
  rank: number;
  numero: number;
  nom: string | null;
}

export function buildArriveePodium(
  arrivee: number[] | null | undefined,
  partants: { numero: number; nom_cheval?: string | null }[] | null | undefined,
): PodiumPlace[] {
  if (!arrivee || arrivee.length === 0) return [];
  const byNum = new Map<number, string | null>();
  for (const p of partants ?? []) byNum.set(p.numero, p.nom_cheval ?? null);
  return arrivee.map((numero, i) => ({
    rank: i + 1,
    numero,
    nom: byNum.get(numero) ?? null,
  }));
}
```

- [ ] **Step 4 — Run GREEN** : même commande → PASS.

- [ ] **Step 5 — Commit** :
```bash
git add lib/courses/arrivee.ts lib/courses/arrivee.test.ts
git commit -m "feat(arrivees): buildArriveePodium (mapping n -> nom, pur + teste)"
```

---

### Task 2 : Composant `ArriveePodium`

**Files:** Create `components/arrivees/ArriveePodium.tsx`

- [ ] **Step 1 — Créer** (server component, présentation pure) :

```tsx
import { buildArriveePodium } from "@/lib/courses/arrivee";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const ordinal = (rank: number): string => (rank === 1 ? "1ᵉʳ" : `${rank}ᵉ`);

/**
 * Podium d'arrivée : vainqueur mis en avant (dossard doré + nom), puis places
 * 2-5 classées (médailles top 3, dossards ronds distincts du rang). `compact`
 * masque les noms 2-5 sur mobile (lignes par course) ; sinon ils restent visibles.
 */
export function ArriveePodium({
  arrivee,
  partants,
  compact = false,
}: {
  arrivee: number[];
  partants: { numero: number; nom_cheval?: string | null }[];
  compact?: boolean;
}) {
  const places = buildArriveePodium(arrivee, partants);
  if (places.length === 0) return null;

  const winner = places[0];
  const rest = places.slice(1, 5);
  const extra = places.length - 5;

  return (
    <div className="space-y-2">
      {/* Vainqueur */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base leading-none" aria-hidden>{MEDALS[1]}</span>
        <span className="text-gold-primary text-[11px] font-bold uppercase tracking-wide flex-shrink-0">
          {ordinal(1)}
        </span>
        <span className="w-8 h-8 rounded-full bg-gold-faint border border-gold-primary/50 text-gold-light text-sm font-bold flex items-center justify-center flex-shrink-0">
          {winner.numero}
        </span>
        {winner.nom && (
          <span className="text-gold-light font-bold text-sm truncate">{winner.nom}</span>
        )}
      </div>

      {/* Places 2 → 5 */}
      {rest.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {rest.map((p) => (
            <span key={p.rank} className="inline-flex items-center gap-1.5 min-w-0">
              {MEDALS[p.rank] && (
                <span className="text-xs leading-none" aria-hidden>{MEDALS[p.rank]}</span>
              )}
              <span className="text-text-muted text-[11px] font-semibold flex-shrink-0">{ordinal(p.rank)}</span>
              <span className="w-6 h-6 rounded-full bg-bg-card border border-border text-text-secondary text-xs font-bold flex items-center justify-center flex-shrink-0">
                {p.numero}
              </span>
              {p.nom && (
                <span className={`text-text-muted text-xs truncate max-w-[140px] ${compact ? "hidden sm:inline" : "inline"}`}>
                  {p.nom}
                </span>
              )}
            </span>
          ))}
          {extra > 0 && (
            <span className="text-text-muted text-xs px-2 py-0.5 rounded-full bg-bg-card border border-border flex-shrink-0">
              +{extra}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2 — Commit** (avec Task 3).

---

### Task 3 : Brancher dans `page.tsx`

**Files:** Modify `app/(public)/arrivees/[date]/page.tsx`

- [ ] **Step 1 — Import** : après `import DateRangeNav from "@/components/ui/DateRangeNav";` :
```tsx
import { ArriveePodium } from "@/components/arrivees/ArriveePodium";
```

- [ ] **Step 2 — Carte Quinté+** : remplacer le bloc des positions :
```tsx
            <div className="flex flex-wrap gap-2">
              {quinte.arrivee_officielle.slice(0, 5).map((num: number, idx: number) => {
                const part = quinte.partants?.find((p: any) => p.numero === num);
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                      idx === 0
                        ? "bg-status-win/15 border border-status-win/40"
                        : "bg-bg-elevated border border-border"
                    }`}
                  >
                    <span className="text-text-muted text-xs font-mono">
                      {idx + 1}<sup>e</sup>
                    </span>
                    <span className="text-gold-primary font-bold text-sm">{num}</span>
                    {part?.nom_cheval && (
                      <span className="text-text-primary text-xs font-medium hidden sm:inline">
                        {part.nom_cheval}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
```
par :
```tsx
            <ArriveePodium arrivee={quinte.arrivee_officielle} partants={quinte.partants} />
```

- [ ] **Step 3 — Lignes par course** : remplacer le bloc des puces :
```tsx
                        <div className="flex flex-wrap gap-1.5">
                          {c.arrivee_officielle.slice(0, 5).map((num: number, idx: number) => (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono ${
                                idx === 0
                                  ? "bg-status-win/15 text-status-win border border-status-win/30"
                                  : "bg-bg-card text-text-secondary border border-border"
                              }`}
                            >
                              <span className="text-text-muted">{idx + 1}.</span>
                              <span className="font-bold">{num}</span>
                            </span>
                          ))}
                          {c.arrivee_officielle.length > 5 && (
                            <span className="text-text-muted text-xs px-2 py-0.5">
                              + {c.arrivee_officielle.length - 5}
                            </span>
                          )}
                        </div>
```
par :
```tsx
                        <ArriveePodium arrivee={c.arrivee_officielle} partants={c.partants} compact />
```

- [ ] **Step 4 — Typecheck** : `npx tsc --noEmit` → 0 erreur.
- [ ] **Step 5 — Tests** : `npx -y vitest run` → suite verte.
- [ ] **Step 6 — Commit** :
```bash
git add components/arrivees/ArriveePodium.tsx "app/(public)/arrivees/[date]/page.tsx"
git commit -m "feat(arrivees): podium nomme (composant ArriveePodium) sur lignes + carte Quinte+"
```

---

### Task 4 : PR
- [ ] Push `feat/arrivees-podium` + `gh pr create`.
- [ ] Vérif visuelle : `/arrivees/2026-06-01` → vainqueur nommé + médailles + dossards ronds, mobile et desktop.

---

## Self-review
- **Couverture spec** : helper testé ✓ (T1) · composant podium ✓ (T2) · 2 remplacements page ✓ (T3) · noms via partants ✓ · compact mobile ✓ · médailles ✓.
- **Placeholders** : aucun.
- **Cohérence** : `buildArriveePodium`/`PodiumPlace` (T1) consommés par `ArriveePodium` (T2) ; props `{arrivee, partants, compact}` identiques en T2 et T3.
