# Spec — Observabilité : raison d'échec Paystack sur les transactions

- **Date** : 2026-06-02 · **Statut** : approuvé en chat (Stéphane) · **Type** : observabilité

## Problème
Quand une transaction Paystack est marquée `ECHEC`, on ne stocke **que** le statut — pas **pourquoi**. Diagnostiquer un échec (ex. MAZEAU = carte refusée) oblige à aller dans le dashboard Paystack. Constaté pendant l'enquête sur les « 19 échecs ».

## Décision
Quand on marque `ECHEC`, **stocker la raison Paystack** (`gateway_response`, `channel`, `status`) dans `transactions.metadata`, et **l'afficher** dans `/admin/paiements` sous le badge « Échoué ».

## Architecture (DRY, réutilise le pattern existant)
- **`lib/paystack/activate.ts`** : ajouter `gateway_response?: string` à l'interface `PaystackPayment` (l'API le renvoie déjà) ; ajouter `buildFailureMetadata(existing, payment)` (**pur, testé**) ; ajouter `markPaystackTransactionFailed(payment)` (helper qui merge la metadata + `update statut=ECHEC`).
- **`app/api/cron/paystack-recovery/route.ts`** + **`app/api/admin/paystack-recover-stuck/route.ts`** : remplacer le `update({ statut: "ECHEC" })` inline par `markPaystackTransactionFailed(payment)`.
- **`app/(admin)/admin/paiements/page.tsx`** : ajouter `metadata` au `select` + afficher `metadata.echec_raison` (+ canal) sous le statut « Échoué ».

## Non-objectifs (YAGNI)
- Pas de backfill des échecs **existants** (forward-looking ; nécessiterait de re-fetch Paystack).
- Pas de changement du flux de paiement (c'est de l'observabilité, pas un fix).

## Tests
- Unitaire `buildFailureMetadata` (Vitest, pur). Helpers DB + affichage → `tsc` + visuel.

## Fichiers
- ~ `lib/paystack/activate.ts` (+ test) · ~ `app/api/cron/paystack-recovery/route.ts` · ~ `app/api/admin/paystack-recover-stuck/route.ts` · ~ `app/(admin)/admin/paiements/page.tsx`
