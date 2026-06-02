# Observabilité raison d'échec Paystack — Plan

> REQUIRED SUB-SKILL: superpowers:executing-plans. Checkboxes `- [ ]`.

**Goal:** Stocker + afficher la raison d'échec Paystack (`gateway_response`) sur les transactions `ECHEC`.

---

### Task 1 : `activate.ts` — interface + helpers + test (TDD)

**Files:** Modify `lib/paystack/activate.ts` · Create `lib/paystack/activate.test.ts`

- [ ] **Step 1 — Test (échoue)** : `lib/paystack/activate.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { buildFailureMetadata } from "./activate";

describe("buildFailureMetadata", () => {
  it("merge la metadata existante + raison/canal/statut", () => {
    const m = buildFailureMetadata({ plan_id: "pro" }, { status: "failed", channel: "card", gateway_response: "Declined" });
    expect(m).toMatchObject({
      plan_id: "pro",
      paystack_status: "failed",
      paystack_channel: "card",
      echec_raison: "Declined",
    });
  });
  it("repli sur le statut si pas de gateway_response", () => {
    const m = buildFailureMetadata(null, { status: "abandoned" });
    expect(m.echec_raison).toBe("abandoned");
    expect(m.paystack_channel).toBeNull();
  });
});
```

- [ ] **Step 2 — Run RED** : `Set-Location C:\Users\HP\etf-wt-ns-promo; npx -y vitest run lib/paystack/activate.test.ts` → FAIL.

- [ ] **Step 3 — Implémenter** :
  - Ajouter `gateway_response?: string;` à l'interface `PaystackPayment` (après `currency?`).
  - Ajouter (export) :
```ts
/** Construit la metadata enrichie d'une transaction échouée (pur, testable). */
export function buildFailureMetadata(
  existing: Record<string, unknown> | null | undefined,
  payment: Pick<PaystackPayment, "status" | "channel" | "gateway_response">,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    paystack_status:  payment.status,
    paystack_channel: payment.channel ?? null,
    echec_raison:     payment.gateway_response ?? payment.status ?? null,
  };
}

/** Marque une transaction Paystack ECHEC + stocke la raison dans metadata. */
export async function markPaystackTransactionFailed(payment: PaystackPayment): Promise<void> {
  const supabase = createServiceClient();
  const { data: tx } = await supabase
    .from("transactions").select("metadata").eq("reference_operateur", payment.reference).single();
  await supabase
    .from("transactions")
    .update({
      statut: "ECHEC",
      metadata: buildFailureMetadata(tx?.metadata as Record<string, unknown> | null, payment),
    })
    .eq("reference_operateur", payment.reference);
}
```

- [ ] **Step 4 — Run GREEN** → PASS.
- [ ] **Step 5 — Commit** : `git add lib/paystack/activate.ts lib/paystack/activate.test.ts && git commit -m "feat(paystack): capter la raison d'echec (gateway_response) + helper teste"`

---

### Task 2 : Utiliser le helper aux 2 endroits

**Files:** Modify `app/api/cron/paystack-recovery/route.ts` · `app/api/admin/paystack-recover-stuck/route.ts`

- [ ] **Step 1 — cron** : importer `markPaystackTransactionFailed` (ajouter à l'import depuis `@/lib/paystack/activate`), puis remplacer :
```ts
        await supabase
          .from("transactions")
          .update({ statut: "ECHEC" })
          .eq("reference_operateur", reference);
```
par :
```ts
        await markPaystackTransactionFailed(payment);
```

- [ ] **Step 2 — recover-stuck** : idem, importer `markPaystackTransactionFailed`, remplacer :
```ts
        await adminClient
          .from("transactions")
          .update({ statut: "ECHEC" })
          .eq("reference_operateur", reference);
```
par :
```ts
        await markPaystackTransactionFailed(payment);
```

- [ ] **Step 3 — Commit** (avec Task 3).

---

### Task 3 : Afficher la raison dans l'admin

**Files:** Modify `app/(admin)/admin/paiements/page.tsx`

- [ ] **Step 1 — Select** : ajouter `metadata` au `.select(...)` des transactions (après `reference_operateur`).
- [ ] **Step 2 — Affichage** : sous le badge de statut (cellule Statut), si `ECHEC` et `metadata.echec_raison`, afficher une petite ligne. Remplacer le `<td>` du statut pour ajouter :
```tsx
                        {tx.statut === "ECHEC" && (tx.metadata as any)?.echec_raison && (
                          <p className="text-text-muted text-[10px] mt-1 max-w-[160px] truncate" title={String((tx.metadata as any).echec_raison)}>
                            {(tx.metadata as any).paystack_channel ? `${(tx.metadata as any).paystack_channel} · ` : ""}{String((tx.metadata as any).echec_raison)}
                          </p>
                        )}
```

- [ ] **Step 3 — Typecheck + tests + commit** : `npx tsc --noEmit` ; `npx -y vitest run` ; commit route+page.

---

### Task 4 : PR
- [ ] Push + `gh pr create`.
- [ ] Vérif : après prochain échec (ou test), le statut « Échoué » affiche la raison (ex. « card · Declined »).

## Self-review
- Couverture : capter raison (T1) · 2 endroits ECHEC (T2) · affichage admin (T3) ✓. Pas de placeholder. `buildFailureMetadata`/`markPaystackTransactionFailed` cohérents T1↔T2.
