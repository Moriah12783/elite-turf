# Elite Turf — Guide projet (CLAUDE.md)

Plateforme de pronostics hippiques premium — **elite-turf.fr**. Marché : Afrique francophone + France/Maghreb (GA : France #1, Maroc #2, Mali/Burkina forts).

## Stack
- **Next.js 14.2.5** (App Router) · React 18 · TypeScript 5 (strict)
- **Supabase** (Postgres + Auth, projet `cpzjjnmszbyizeqhgrat`) — `lib/supabase/server.ts` : `createClient()` (RLS) / `createServiceClient()` (service role, serveur uniquement)
- Tailwind CSS · Resend (email) · Twilio (SMS) · WhatsApp Cloud API
- **Déploiement Cloudflare** (OpenNext) via CI GitHub sur `main` + **cron-worker/** séparé (Cloudflare Worker, triggers dans son `wrangler.toml`, auto-déployé via GitHub Action sur modif `cron-worker/**`)

## Commandes
```bash
npm run dev          # dev server
npx tsc --noEmit     # type-check
npm run build        # next build (~989 pages) — GATE PRINCIPAL
npm run lint         # next lint (.eslintrc.json : next/core-web-vitals)
npx vitest run       # tests (lib/**/*.test.ts)
```
**Gate qualité avant tout commit : `tsc` + `build` verts (+ vitest si lib/ touché).**

## ⚠️ Sources de vérité (NE JAMAIS re-coder ces valeurs en dur)
| Fichier | Rôle |
|---|---|
| `lib/constants/whatsapp.ts` | Numéro WhatsApp support UNIQUE (+33 6 44 68 67 20) — `whatsappUrl(message?)` |
| `lib/pricing.ts` | Copy marketing des offres. **Starter = Pro sur 7 jours : « 1 pronostic expert par jour (Tiercé, Quarté+, Quinté+) »** (`STARTER_OFFRE_LABEL` = `PRO_OFFRE_LABEL`, décision de Steph du 01/10/2026, PR #340) |
| `lib/paiement/mobile-money.ts` | Paiement Orange Money / Wave : pays, montants FCFA, message WhatsApp, lien `#mobile-money` (voir la section dédiée) |
| `lib/stats/home-stats.ts` | Stats home (`getHomeStats()`, SSR) — consommé par la home ET `/api/stats` |
| `lib/metrics/public-counters.ts` | Compteurs publics RÉELS (leads/profiles) — preuve sociale |
| `types/index.ts` (`PLAN_CONFIG`) | Structure des plans (prix, durées, features) |

## 🔒 Règles non négociables
1. **Paiement intouchable** sans QA dédiée : `app/api/paystack/*`, `app/api/paiement/stripe/*`, `app/api/cinetpay/*`, webhooks, pages `paiement/succes|echec`. Deux exceptions validées par Steph le 06/10/2026 (PR #367, Orange Money / Wave) ; la règle reste valable pour tout autre changement :
   - `components/abonnements/PaiementButton.tsx` : seule l'entrée Orange Money / Wave du menu a été modifiée, avec son accord explicite (« Bientôt disponible » → lien « Via WhatsApp » vers `#mobile-money` ; la note de bas de menu « Mobile Money de retour très bientôt », qui l'annonçait, a suivi) ;
   - `app/(public)/paiement/echec/page.tsx` : ligne « Astuce » qui renvoie vers Orange Money / Wave, changement gardé sur sa décision.
2. **Aucune donnée inventée** sur le site (audits Sprint 1 & 1.5) : pas de chiffres marketing en dur, pas de témoignages fabriqués, pas de promesse non tenable. Compteurs → `public-counters` ; stats → `home-stats` ; témoignages → table `testimonials` (modérés, affichés seulement si `approved`, avec disclaimer).
3. **Jamais de fetch client pour des données critiques d'affichage** (le hero a déjà cassé comme ça) : SSR + prop, fallback chiffré, jamais « … ».
4. **Aucun envoi marketing automatique** (email/SMS/WABA) sans décision humaine. Séquence de réactivation : templates `lib/email/templates/reactivation-r*.ts` + `scripts/export-reactivation-list.ts` (dry-run) — l'envoi est manuel.
5. Promesse support officielle : « **sous 2h en moyenne** » (pas de « 20/30 min »).

## Base de données (Supabase)
- **Migrations dans `supabase/migrations/`, appliquées À LA MAIN** (MCP Supabase ou SQL Editor) — pas de migration auto en CI. Toujours : fichier versionné + application manuelle + vérification.
- ⚠️ Le trigger `handle_new_user` (profil auto à l'inscription) a déjà divergé du fichier de migration — en cas de doute, vérifier en base : `SELECT pg_get_functiondef('public.handle_new_user'::regproc);`
- Tables clés : `profiles` (consentements `sms_opt_in/sms_opted_out/email_opted_out` + `sms_unsub_token` → page `/stop` = opt-out SMS+email), `pronostics`, `courses`, `partants`, `leads`, `transactions`, `sms_log`, `email_sent_log`, `testimonials`, `whatsapp_conversations`.

## Paiement Orange Money / Wave (depuis le 06/10/2026)
- **Source unique `lib/paiement/mobile-money.ts`** : pays (Côte d'Ivoire, Mali, Burkina Faso, Sénégal) ; montants via `formatPrice` (Starter 42 500 / Pro 99 500 / Elite 136 500 FCFA : le montant payé, pas un « ≈ ») ; message WhatsApp pré-rempli ; lien `/abonnements?pays=XX#mobile-money` (`lienMobileMoney()`).
- **Parcours** : le visiteur écrit sur le WhatsApp officiel → Steph lui envoie le numéro et le montant → après paiement, Steph envoie un reçu sur WhatsApp. **Aucun numéro de paiement publié sur le site.** Le compte peut être créé avant ou après le paiement (PR #368).
- **Activation : formulaire « Activer un paiement Orange Money / Wave » de `/admin/utilisateurs`** (PR #370, 06/10/2026). Route `POST /api/admin/abonnements/activer-mobile-money` ; règles pures dans `lib/paiement/activation-mobile-money.ts`.
  - « Vérifier » : aperçu, aucune écriture. « Confirmer » : exactement la saisie vérifiée.
  - Écritures, dans l'ordre : profil (statut + `date_expiration_abonnement`), puis ligne `abonnements` ACTIF (les anciennes passent EXPIRE), puis `transactions` SUCCES (`ORANGE_MONEY`/`WAVE`, XOF, référence `ET-MM-…`), puis e-mail de confirmation (case cochée par défaut).
  - Décisions de Steph : un abonné encore actif garde ses jours (prolongation depuis sa date de fin) ; paiement enregistré ; e-mail automatique.
  - Refus : compte introuvable ou en double ; renouvellement automatique par carte en cours ; accès permanent ; doublon probable (moins de 10 min ou même référence d'opérateur).
  - **Ne plus activer à la main en base.** C'est la ligne `abonnements` (`date_fin`) que le cron `expire-abonnements` lit pour repasser le profil en `EXPIRE`.
  - ⚠️ Table `plans` : Starter = « Découverte », Pro = « Performance » (`lib/plans/resolve.ts`).
- Le bouton « ✉ Confirmation » de `/admin/utilisateurs` (POST `/api/admin/renvoyer-confirmation`) renvoie l'e-mail si besoin. L'envoi et le journal sont partagés via `lib/abonnements/confirmation.ts`.
- **Paystack reste coupé** : `PAYSTACK_AVAILABLE = false` (`lib/promo.ts`).
- **Ne jamais mettre l'e-mail d'un visiteur dans un lien `wa.me`** : GA4 (chargé via GTM) enregistre l'adresse des liens cliqués. Le message pré-rempli s'arrête sur « E-mail de mon compte Elite Turf : » et le visiteur complète lui-même dans WhatsApp.

## Particularités à connaître
- **Deux** `WhatsAppFloatingButton` montés (root layout → `components/layout/`, layout public → `components/public/`) — les deux consomment la constante unique.
- **Accueil en cache** (brief SEO B3) : `app/(public)/page.tsx` est en `dynamic = "force-static"` + `revalidate = 240` (cookies et en-têtes vides au rendu → version visiteur) ; elite-turf-crons appelle « / » toutes les 5 min → version servie de ~5 min au plus. Les membres connectés sont réécrits vers `/accueil-membre` par le middleware (même adresse « / »). Cache ISR stocké dans R2 (`open-next.config.ts`) : seul l'accueil (+ quelques pages statiques) est mis en cache, les autres pages publiques sont rendues à chaque visite ; pas de tagCache → `revalidatePath`/`revalidateTag` sans effet.
- `/api/stats` : cache CDN 30 min. Après deploy, ~1-2 min (ou purge Cloudflare) pour voir un changement.
- Heures : les crons Cloudflare sont en **UTC fixe** (= heure Abidjan/Dakar). **Aucune heure de publication annoncée** (décision de Steph du 01/10/2026, PR #340) : le site dit « publié avant le départ de la course ». L'ancienne fenêtre « 8h30–9h30 GMT » n'était jamais tenue : ne pas la réintroduire (les « 8h30 » restants dans le code sont des commentaires).
- Emails : Resend (`lib/email/index.ts`, sandbox si clé absente) ; idempotence des séquences via `email_sent_log` / `sms_log` (UNIQUE user_id+type).
- ESLint : config minimale `next/core-web-vitals` ; `react/no-unescaped-entities` et `@typescript-eslint/no-explicit-any` désactivées (choix documenté : contenu FR plein d'apostrophes ; codebase utilise `any` aux frontières Supabase).
- Scripts CLI : `npx tsx scripts/<nom>.ts` (chargement manuel de `.env.local`, voir `send-test-email.ts`).
- Garantie commerciale active : « **1ᵉʳ pronostic expert perdant = 7 jours offerts** » (1×/abonné, via WhatsApp, prolongation manuelle admin) — affichée home + FAQ /abonnements.

## Process de travail attendu
Audit lecture seule → questions si donnée métier inconnue (**jamais d'invention**) → implémentation par commits atomiques (conventional commits) → gate tsc+build → diff + impact montrés → validation humaine → push/merge uniquement sur GO explicite.
