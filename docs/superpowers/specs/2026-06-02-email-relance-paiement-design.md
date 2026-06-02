# Spec — E-mail « paiement échoué » (relance manuelle)

- **Date** : 2026-06-02
- **Statut** : Design approuvé en chat (Stéphane, 2026-06-02) — déclencheur **manuel**
- **Type** : E-mail transactionnel réutilisable + route admin de relance.

## 1. Problème / Objectif

Quand un paiement carte **échoue ou est bloqué** (ex. Hamza, Maroc, bloqué par Stripe Radar), le client repart sans abonnement **et sans relance**. Besoin : un e-mail transactionnel **réutilisable** « paiement échoué » qui invite à **refaire** le paiement, **déclenché manuellement** par l'admin (il voit le paiement bloqué dans Stripe → relance).

## 2. Décisions validées (Q&A)

- **Déclencheur : MANUEL** (route admin que l'admin active). Pas d'auto-webhook en v1.
- Template **réutilisable**, charte e-mail existante, **CTA → `/abonnements`**.
- Ton **bienveillant / déculpabilisant** : « aucun montant débité », ça arrive (sécurité bancaire / carte étrangère). **Aucune promesse de gain.**
- Récupération **nom + plan via l'e-mail** (`profiles.email` existe).

## 3. Architecture (réutilise l'infra e-mail)

- **`lib/email/templates/paiement-echoue.ts`** *(nouveau)* — `templatePaiementEchoue({ nomComplet, email, planNom?, montantEur? }): { subject, html }`. Même pattern que les autres templates (`renderHeaderBanner` + `emailBase`/`emailButton`/`emailDivider`).
- **`lib/email/templates/banners/header-banner.ts`** *(modifié)* — ajout `BANNER_PAIEMENT_ECHOUE` (photo `cheval-2-rose.jpg`, cohérent avec les e-mails liés au paiement).
- **`app/api/admin/relance-paiement/route.ts`** *(nouveau)* — `POST { email }` (+ optionnels `nomComplet`, `planNom`), auth **Bearer `CRON_SECRET`** (comme `email-test`). Recherche le profil par `email` (`nom_complet`, `plan_id`/`statut_abonnement`) → envoie le **vrai** e-mail via `sendEmailDetailed` (pas de préfixe `[TEST]`). Réponse `{ ok }`.
- **`app/api/admin/email-test/route.ts`** *(modifié)* — enregistrer `"paiement-echoue"` dans `TEMPLATES` (aperçu `[TEST]`).

## 4. Contenu du mail

- **Objet** : « Votre paiement Elite Turf n'a pas abouti — finalisez en 1 clic ».
- Bannière + « Bonjour {prénom} » + **« aucun montant n'a été débité »** + explication douce (sécurité bancaire, carte étrangère) + **récap** (Plan + montant si fournis) + bouton **« Reprendre mon paiement »** → `/abonnements` + ligne support (répondre au mail / `contact@elite-turf.fr`).
- Preheader : « Votre paiement n'a pas abouti — aucun montant débité. Reprenez en 1 clic. »

## 5. Cas limites

- **Profil introuvable** par e-mail → on envoie **quand même** (un client ayant tenté de payer mérite la relance) avec `nomComplet` = param body ou repli (« cher client »).
- `planNom` / `montantEur` absents → bloc récap **masqué** (pas de valeurs vides affichées).
- `CRON_SECRET` non configuré ou Bearer invalide → `401`.

## 6. Non-objectifs (YAGNI)

- ❌ Pas d'auto-déclenchement via webhook Stripe (v2 si volume).
- ❌ Pas de bouton admin-UI (route/curl suffit en v1 ; bouton = follow-up facile).
- ❌ Pas de séquence multi-relance.

## 7. Tests

- **Unitaire Vitest** : `templatePaiementEchoue` (fonction pure → strings) — `subject` non vide, `html` contient le prénom, le lien `/abonnements`, « aucun montant ».
- **Route** = wiring (auth + lookup + Resend) → `tsc --noEmit` + **test manuel** (aperçu via `email-test` + envoi réel à Hamza après déploiement).

## 8. Fichiers impactés

- **+ `lib/email/templates/paiement-echoue.ts`** (+ `lib/email/templates/paiement-echoue.test.ts`)
- **~ `lib/email/templates/banners/header-banner.ts`**
- **+ `app/api/admin/relance-paiement/route.ts`**
- **~ `app/api/admin/email-test/route.ts`**

## 9. Garde-fou opérationnel

Worktree isolé `feat/email-relance-paiement` (depuis `origin/main` post-#146), livré en **une PR**. `CRON_SECRET` = admin-grade (auth de la route) → ne pas l'exposer.
